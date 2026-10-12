import {
  Shop,
  CostCalculation,
  StagedJobResponse,
  PrintConfig,
  CustomerDocument,
  CustomerJob,
  AccessMode,
  PaymentSuccessResponse,
} from './types';

export const API_BASE_URL = '/api/backend';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal || AbortSignal.timeout(40000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(typeof data.detail === 'string' ? data.detail : 'Request could not be completed', response.status);
  }
  return data as T;
}

export function fetchShops(): Promise<Shop[]> {
  return request<Shop[]>('/shops');
}

export function fetchShop(shopId: string): Promise<Shop> {
  return request<Shop>(`/shops/${encodeURIComponent(shopId)}`);
}

function form(shopId: string, config: PrintConfig) {
  const body = new FormData();
  const values = {
    shop_id: shopId,
    page_count: config.pageCount,
    copy_count: config.copyCount,
    is_color: config.isColor,
    duplex_mode: config.duplexMode,
    layout_nup: config.layoutNup,
    paper_type: config.paperType || 'normal',
  };
  Object.entries(values).forEach(([key, value]) => body.append(key, String(value)));
  return body;
}

export function calculateCost(shop: Shop, config: PrintConfig): Promise<CostCalculation> {
  return request('/jobs/calculate-cost', { method: 'POST', body: form(shop.id, config) });
}

export function stagePrintJob(
  shopId: string,
  config: PrintConfig,
  accessMode: AccessMode = 'anonymous',
  token?: string,
): Promise<StagedJobResponse> {
  if (config.isFolder && config.folderFiles && config.folderFiles.length > 0) {
    const body = form(shopId, config);
    body.append('folder_name', config.fileName || 'Folder_Bundle');
    body.append('access_mode', accessMode);
    config.folderFiles.forEach((file) => body.append('files', file));
    return request('/jobs/stage-folder', { method: 'POST', body }, token);
  }

  if (!config.file) throw new Error('Select a document first');
  const body = form(shopId, config);
  body.append('file', config.file);
  body.append('page_range', 'all');
  body.append('access_mode', accessMode);
  return request('/jobs/stage', { method: 'POST', body }, token);
}

export interface PaymentOrder {
  id: string;
  provider: string;
  amount_minor: number;
  currency: string;
  key_id?: string;
}

export interface RazorpayVerificationPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export function createPaymentOrder(job: StagedJobResponse): Promise<PaymentOrder> {
  return request(`/payments/${job.job_id}/order`, {
    method: 'POST',
    headers: { 'X-Checkout-Token': job.checkout_token },
  });
}

export function verifyPayment(
  job: StagedJobResponse,
  payload: RazorpayVerificationPayload,
): Promise<PaymentSuccessResponse> {
  return request(`/payments/${job.job_id}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Checkout-Token': job.checkout_token,
    },
    body: JSON.stringify(payload),
  });
}

export function payAtCounter(job: StagedJobResponse): Promise<PaymentSuccessResponse> {
  return request(`/payments/${job.job_id}/pay-at-counter`, {
    method: 'POST',
    headers: {
      'X-Checkout-Token': job.checkout_token,
    },
  });
}

export function mockConfirmPayment(job: StagedJobResponse, orderId: string): Promise<PaymentSuccessResponse> {
  return request(`/payments/${job.job_id}/mock-confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Checkout-Token': job.checkout_token,
    },
    body: JSON.stringify({ order_id: orderId }),
  });
}

export interface LoginSession {
  access_token: string;
  user: { username: string; shop_id: string; role: 'admin' | 'operator' };
}

export function login(username: string, password: string): Promise<LoginSession> {
  return request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export function uploadCustomerDocument(file: File): Promise<CustomerDocument> {
  const body = new FormData();
  body.append('file', file);
  return request('/customer/documents', { method: 'POST', body });
}

export function uploadCustomerDocumentsBatch(files: File[]): Promise<CustomerDocument[]> {
  const body = new FormData();
  files.forEach((f) => body.append('files', f));
  return request('/customer/documents/batch', { method: 'POST', body });
}

export interface DocumentQueryParams {
  q?: string;
  type?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export function fetchCustomerDocuments(params?: DocumentQueryParams): Promise<CustomerDocument[]> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set('q', params.q);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  return request(`/customer/documents${query ? `?${query}` : ''}`);
}

export function listCustomerDocuments(): Promise<CustomerDocument[]> {
  return fetchCustomerDocuments();
}

export function fetchCustomerDocument(documentId: string): Promise<CustomerDocument> {
  return request(`/customer/documents/${encodeURIComponent(documentId)}`);
}

export function deleteCustomerDocument(documentId: string): Promise<{ deleted: boolean; document_id?: string }> {
  return request(`/customer/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
}

export interface JobQueryParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export function fetchCustomerJobs(params?: JobQueryParams): Promise<CustomerJob[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  return request(`/customer/jobs${query ? `?${query}` : ''}`);
}

export function listCustomerJobs(): Promise<CustomerJob[]> {
  return fetchCustomerJobs();
}

export function fetchCustomerJob(jobId: string): Promise<CustomerJob> {
  return request(`/customer/jobs/${encodeURIComponent(jobId)}`);
}

export interface QueueItem {
  id: string;
  file_name: string;
  page_count: number;
  copy_count: number;
  copies?: number;
  is_color: boolean;
  total_cost: number;
  total_amount_in_inr?: number;
  job_status: string;
  duplex_mode?: string;
  paper_type?: string;
  layout_nup?: number;
  customer_phone?: string;
  cleanup_pending?: boolean;
  created_at: string;
}

export interface Summary {
  date_utc: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  cleanup_pending: number;
  paid_total: number;
}

export interface ActivityEvent {
  id: string;
  action: string;
  actor?: string | null;
  target?: string | null;
  created_at: string;
  status?: string | null;
}

export function fetchShopActivity(shopId: string, token: string): Promise<ActivityEvent[]> {
  return request(`/shops/${encodeURIComponent(shopId)}/activity`, {}, token);
}
