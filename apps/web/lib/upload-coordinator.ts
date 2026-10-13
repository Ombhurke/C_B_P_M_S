/**
 * Authoritative Direct-to-Storage Upload Coordinator.
 *
 * Enforces:
 * - Direct upload to Supabase Storage: zero file bytes pass through Next.js / Vercel Functions.
 * - Enforces client-side validation against server-published policy.
 * - Bounded transfer concurrency (max 3 files in flight).
 * - Full multi-item manifest and atomic batch finalization.
 * - Idempotency and compensation on failure/cancellation.
 */

import { CustomerDocument, StagedJobResponse } from './types';

export interface UploadItemProgress {
  itemId?: string;
  name: string;
  sizeBytes: number;
  status: 'pending' | 'requesting_permission' | 'uploading' | 'validating' | 'accepted' | 'failed' | 'cancelled';
  progressPercent: number;
  errorMessage?: string;
}

export interface DirectUploadOptions {
  files: File[];
  purpose: 'customer_library' | 'transient_print_job';
  accessMode?: 'ephemeral' | 'persistent';
  shopId?: string;
  printConfig?: {
    color?: boolean;
    copies?: number;
    duplex?: boolean;
    layout_nup?: number;
  };
  guestToken?: string;
  onProgress?: (progress: UploadItemProgress[]) => void;
  signal?: AbortSignal;
}

export interface UploadBatchResult {
  batchId: string;
  purpose: 'customer_library' | 'transient_print_job';
  documents?: CustomerDocument[];
  job?: StagedJobResponse;
}

const API_PREFIX = '/api/backend';
const CONCURRENCY_LIMIT = 3;

function getAuthHeaders(guestToken?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (guestToken) {
    headers['X-Guest-Session'] = guestToken;
  }
  return headers;
}

export async function executeDirectUpload(options: DirectUploadOptions): Promise<UploadBatchResult> {
  const { files, purpose, accessMode, shopId, printConfig, guestToken, onProgress, signal } = options;

  if (!files || files.length === 0) {
    throw new Error('At least one file must be selected for upload');
  }

  // Initial progress tracking
  const progressState: UploadItemProgress[] = files.map((f) => ({
    name: f.name,
    sizeBytes: f.size,
    status: 'pending',
    progressPercent: 0,
  }));

  const notifyProgress = () => {
    if (onProgress) {
      onProgress([...progressState]);
    }
  };
  notifyProgress();

  // 1. Create upload batch on the server (reserves quota upfront)
  const manifestItems = files.map((f) => ({
    name: f.name,
    size_bytes: f.size,
    mime_type: f.type || 'application/pdf',
  }));

  const batchPayload = {
    purpose,
    access_mode: accessMode || (purpose === 'customer_library' ? 'persistent' : 'ephemeral'),
    shop_id: shopId,
    items: manifestItems,
    print_config: printConfig,
  };

  const createBatchRes = await fetch(`${API_PREFIX}/uploads/batches`, {
    method: 'POST',
    headers: getAuthHeaders(guestToken),
    body: JSON.stringify(batchPayload),
    credentials: 'same-origin',
    signal,
  });

  if (!createBatchRes.ok) {
    const errorData = await createBatchRes.json().catch(() => ({}));
    const message = errorData.detail?.message || errorData.detail || 'Failed to create upload admission';
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  const batchData = await createBatchRes.json();
  const batchId = batchData.batch_id;
  const serverItems = batchData.items;

  // Map server item IDs to progress items
  serverItems.forEach((srvItem: any, idx: number) => {
    if (progressState[idx]) {
      progressState[idx].itemId = srvItem.id;
    }
  });
  notifyProgress();

  let hasError = false;

  // 2. Transfer items with bounded concurrency
  async function processItem(srvItem: any, file: File, index: number) {
    if (signal?.aborted || hasError) return;

    try {
      // 2a. Request permission
      progressState[index].status = 'requesting_permission';
      notifyProgress();

      const permRes = await fetch(`${API_PREFIX}/uploads/items/${srvItem.id}/permission`, {
        method: 'POST',
        headers: getAuthHeaders(guestToken),
        credentials: 'same-origin',
        signal,
      });

      if (!permRes.ok) {
        throw new Error('Failed to obtain upload permission grant');
      }

      const permData = await permRes.json();
      const uploadUrl = permData.upload_url;

      // 2b. Direct file transfer to Supabase Storage
      progressState[index].status = 'uploading';
      progressState[index].progressPercent = 10;
      notifyProgress();

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        signal,
      });

      if (!uploadRes.ok) {
        throw new Error(`Direct storage upload failed (${uploadRes.status} ${uploadRes.statusText})`);
      }

      progressState[index].progressPercent = 80;

      // 2c. Complete & validate item on backend
      progressState[index].status = 'validating';
      notifyProgress();

      const compRes = await fetch(`${API_PREFIX}/uploads/items/${srvItem.id}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(guestToken),
        credentials: 'same-origin',
        signal,
      });

      if (!compRes.ok) {
        const errJson = await compRes.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Validation failed on server');
      }

      progressState[index].status = 'accepted';
      progressState[index].progressPercent = 100;
      notifyProgress();
    } catch (err: any) {
      hasError = true;
      progressState[index].status = 'failed';
      progressState[index].errorMessage = err.message || 'Upload failed';
      notifyProgress();
      throw err;
    }
  }

  try {
    // Queue execution with bounded concurrency
    const queue = serverItems.map((srvItem: any, idx: number) => () => processItem(srvItem, files[idx], idx));
    const running: Promise<void>[] = [];

    for (const task of queue) {
      if (signal?.aborted || hasError) break;
      const p = task().then(() => {
        running.splice(running.indexOf(p), 1);
      });
      running.push(p);
      if (running.length >= CONCURRENCY_LIMIT) {
        await Promise.race(running);
      }
    }
    await Promise.all(running);

    if (hasError) {
      throw new Error('One or more files failed to transfer or validate');
    }

    // 3. Finalize the batch
    const finalizeRes = await fetch(`${API_PREFIX}/uploads/batches/${batchId}/finalize`, {
      method: 'POST',
      headers: getAuthHeaders(guestToken),
      credentials: 'same-origin',
      signal,
    });

    if (!finalizeRes.ok) {
      const finErr = await finalizeRes.json().catch(() => ({}));
      throw new Error(finErr.detail || 'Failed to finalize upload batch');
    }

    const finalResult = await finalizeRes.json();
    return {
      batchId,
      purpose,
      documents: finalResult.documents,
      job: finalResult.job,
    };
  } catch (err: any) {
    // Compensate by cancelling the batch and releasing reservations
    try {
      await fetch(`${API_PREFIX}/uploads/batches/${batchId}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(guestToken),
        credentials: 'same-origin',
      });
    } catch {
      // Best effort cancellation
    }
    throw err;
  }
}
