export type DuplexMode = 'simplex' | 'duplex_long' | 'duplex_short';

export type JobStatus = 'staged' | 'queued' | 'processing' | 'completed' | 'expired' | 'failed';
export type AccessMode = 'anonymous' | 'account';

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

export interface PaperRateItem {
  bw_single: number;
  bw_duplex: number;
  color_single: number;
  color_duplex: number;
}

export interface PaperRateConfig {
  normal?: PaperRateItem;
  bond?: PaperRateItem;
  [key: string]: PaperRateItem | undefined;
}

export interface Shop {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  upi_id?: string;
  base_bw_rate: number;
  base_color_rate: number;
  duplex_discount: number;
  currency: string;
  is_active: boolean;
  supports_bw?: boolean;
  supports_color?: boolean;
  supports_duplex?: boolean;
  supported_layouts?: number[];
  paper_rates?: PaperRateConfig;
  printers: Printer[];
}

export type { QueueItem, Summary, ActivityEvent } from './api';

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
  paperType: 'normal' | 'bond';
}

export interface CostCalculation {
  page_count: number;
  copy_count: number;
  is_color: boolean;
  duplex_mode: DuplexMode;
  layout_nup: number;
  paper_type?: string;
  sheets_per_copy: number;
  total_sheets: number;
  rate_per_page: number;
  discount: number;
  total_cost: number;
  currency: string;
}

export interface StagedJobResponse {
  checkout_token: string;
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
  access_mode: AccessMode;
  document_id: string;
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

export interface CustomerUser {
  id: string;
  username: string;
  alias?: string;
  alias_chosen?: boolean;
  shop_id: null;
  role: 'customer';
}

export interface CustomerSession {
  user: CustomerUser;
}

export interface CustomerDocument {
  id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  file_hash: string;
  created_at: string;
  updated_at: string;
  status: 'available' | 'deleting' | 'deleted';
  page_count?: number | null;
  latest_job_status?: JobStatus | null;
}

export interface CustomerJob {
  job_id: string;
  document_id: string;
  shop_id: string;
  file_name: string;
  access_mode: AccessMode;
  page_count: number;
  copy_count: number;
  total_cost: number;
  currency: string;
  payment_status: string;
  job_status: JobStatus;
  created_at: string;
  expires_at: string;
  release_token?: string | null;
}
