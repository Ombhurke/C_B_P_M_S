import { Shop, CostCalculation, StagedJobResponse, PaymentSuccessResponse, PrintConfig } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Mock shops for instant offline/standalone preview
const MOCK_SHOPS: Record<string, Shop> = {
  'shop-demo-1': {
    id: 'shop-demo-1',
    name: 'QuickPrint Express - Hub 1',
    email: 'counter1@quickprint.io',
    phone: '+91 98765 43210',
    address: 'University North Gate, Block A',
    base_bw_rate: 2.0,
    base_color_rate: 10.0,
    duplex_discount: 0.5,
    currency: 'INR',
    is_active: true,
    printers: [
      {
        id: 'p-1',
        shop_id: 'shop-demo-1',
        device_name: 'HP LaserJet Pro M404dn (High-Speed B&W)',
        is_color_supported: false,
        is_duplex_supported: true,
        max_paper_size: 'A4',
        status: 'online'
      },
      {
        id: 'p-2',
        shop_id: 'shop-demo-1',
        device_name: 'Canon imageRUNNER C3226 (Color Laser)',
        is_color_supported: true,
        is_duplex_supported: true,
        max_paper_size: 'A3',
        status: 'online'
      }
    ]
  },
  'shop-demo-2': {
    id: 'shop-demo-2',
    name: 'City Copy & Print Center',
    email: 'citycopy@printcenter.com',
    phone: '+91 91234 56789',
    address: 'Main Market Commercial Plaza #4',
    base_bw_rate: 3.0,
    base_color_rate: 12.0,
    duplex_discount: 1.0,
    currency: 'INR',
    is_active: true,
    printers: [
      {
        id: 'p-3',
        shop_id: 'shop-demo-2',
        device_name: 'Epson EcoTank L6490',
        is_color_supported: true,
        is_duplex_supported: true,
        max_paper_size: 'A4',
        status: 'online'
      }
    ]
  }
};

export async function fetchShop(shopId: string): Promise<Shop> {
  try {
    const res = await fetch(`${API_BASE_URL}/shops/${shopId}`, { cache: 'no-store' });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`Backend API unreachable at ${API_BASE_URL}, using mock shop context.`);
  }
  return MOCK_SHOPS[shopId] || {
    ...MOCK_SHOPS['shop-demo-1'],
    id: shopId,
    name: `Print Shop (${shopId})`
  };
}

export async function calculateCost(shop: Shop, config: PrintConfig): Promise<CostCalculation> {
  const baseRate = config.isColor ? shop.base_color_rate : shop.base_bw_rate;
  const effectivePages = Math.ceil(config.pageCount / config.layoutNup);
  
  let sheetsPerCopy = effectivePages;
  let totalCost = 0;
  let discount = 0;

  if (config.duplexMode !== 'simplex') {
    sheetsPerCopy = Math.ceil(effectivePages / 2);
    const totalSheets = sheetsPerCopy * config.copyCount;
    const rawCost = totalSheets * 2 * baseRate;
    discount = totalSheets * (shop.duplex_discount || 0);
    totalCost = Math.max(0, rawCost - discount);
  } else {
    const totalSheets = sheetsPerCopy * config.copyCount;
    totalCost = totalSheets * baseRate;
  }

  return {
    page_count: config.pageCount,
    copy_count: config.copyCount,
    is_color: config.isColor,
    duplex_mode: config.duplexMode,
    layout_nup: config.layoutNup,
    sheets_per_copy: sheetsPerCopy,
    total_sheets: sheetsPerCopy * config.copyCount,
    rate_per_page: baseRate,
    discount: Number(discount.toFixed(2)),
    total_cost: Number(totalCost.toFixed(2)),
    currency: shop.currency || 'INR'
  };
}

export async function stagePrintJob(shopId: string, config: PrintConfig): Promise<StagedJobResponse> {
  const formData = new FormData();
  formData.append('shop_id', shopId);
  formData.append('page_count', config.pageCount.toString());
  formData.append('copy_count', config.copyCount.toString());
  formData.append('is_color', config.isColor.toString());
  formData.append('duplex_mode', config.duplexMode);
  formData.append('layout_nup', config.layoutNup.toString());
  formData.append('page_range', config.pageRange);
  
  if (config.file) {
    formData.append('file', config.file);
  } else {
    // Generate dummy file if none selected for preview
    formData.append('file', new Blob(['dummy content'], { type: 'application/pdf' }), config.fileName);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/jobs/stage`, {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API offline, generating local staged job session.');
  }

  // Fallback local staged job simulation
  const jobId = `job-${Math.random().toString(36).substring(2, 10)}`;
  return {
    job_id: jobId,
    shop_id: shopId,
    file_name: config.fileName,
    file_size_bytes: config.fileSize,
    page_count: config.pageCount,
    copy_count: config.copyCount,
    is_color: config.isColor,
    duplex_mode: config.duplexMode,
    layout_nup: config.layoutNup,
    total_cost: 20.00,
    currency: 'INR',
    payment_status: 'pending',
    job_status: 'staged'
  };
}

export async function verifyPayment(jobId: string, paymentId: string): Promise<PaymentSuccessResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/jobs/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        payment_id: paymentId,
        payment_method: 'UPI_QR'
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend offline, generating local release token.');
  }

  const token = Math.floor(1000 + Math.random() * 9000).toString();
  return {
    job_id: jobId,
    shop_id: 'shop-demo-1',
    release_token: token,
    barcode_payload: `CBPMS:shop-demo-1:${token}:${jobId}`,
    total_cost: 20.00,
    payment_status: 'completed',
    job_status: 'queued',
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  };
}
