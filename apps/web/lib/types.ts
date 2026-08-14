export type DuplexMode = 'simplex' | 'duplex_long' | 'duplex_short';

export type JobStatus = 'staged' | 'queued' | 'processing' | 'completed' | 'expired' | 'failed';

export interface Printer {
  id: string;
  shop_id: string;
  device_name: string;
  driver_name?: string;
  is_color_supported: boolean;
  is_duplex_supported: boolean;
  max_paper_size: string;
  status: 'online' | 'busy' | 'offline' | 'error';
}

export interface Shop {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  base_bw_rate: number;
  base_color_rate: number;
  duplex_discount: number;
  currency: string;
  is_active: boolean;
  printers: Printer[];
}

export interface PrintConfig {
  file: File | null;
  fileName: string;
  fileSize: number;
  pageCount: number;
  copyCount: number;
  isColor: boolean;
  duplexMode: DuplexMode;
  layoutNup: number;
  pageRange: string;
}

export interface CostCalculation {
  page_count: number;
  copy_count: number;
  is_color: boolean;
  duplex_mode: DuplexMode;
  layout_nup: number;
  sheets_per_copy: number;
  total_sheets: number;
  rate_per_page: number;
  discount: number;
  total_cost: number;
  currency: string;
}

export interface StagedJobResponse {
  job_id: string;
  shop_id: string;
  file_name: string;
  file_size_bytes: number;
  page_count: number;
  copy_count: number;
  is_color: boolean;
  duplex_mode: DuplexMode;
  layout_nup: number;
  total_cost: number;
  currency: string;
  payment_status: string;
  job_status: JobStatus;
}

export interface PaymentSuccessResponse {
  job_id: string;
  shop_id: string;
  release_token: string;
  barcode_payload: string;
  total_cost: number;
  payment_status: string;
  job_status: JobStatus;
  expires_at: string;
}
