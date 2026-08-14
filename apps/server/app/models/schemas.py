from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class DuplexMode(str, Enum):
    SIMPLEX = "simplex"
    DUPLEX_LONG = "duplex_long"
    DUPLEX_SHORT = "duplex_short"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class JobStatus(str, Enum):
    STAGED = "staged"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    EXPIRED = "expired"
    FAILED = "failed"


# --- Shop Schemas ---
class PrinterSchema(BaseModel):
    id: str
    shop_id: str
    device_name: str
    driver_name: Optional[str] = None
    is_color_supported: bool = True
    is_duplex_supported: bool = True
    max_paper_size: str = "A4"
    status: str = "online"


class ShopSchema(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    base_bw_rate: float = 2.00
    base_color_rate: float = 10.00
    duplex_discount: float = 0.50
    currency: str = "INR"
    is_active: bool = True
    printers: List[PrinterSchema] = []


class ShopUpdateRequest(BaseModel):
    name: Optional[str] = None
    base_bw_rate: Optional[float] = None
    base_color_rate: Optional[float] = None
    duplex_discount: Optional[float] = None


# --- Print Job Schemas ---
class JobCreateRequest(BaseModel):
    shop_id: str
    page_count: int = Field(..., gt=0)
    copy_count: int = Field(1, gt=0)
    is_color: bool = False
    duplex_mode: DuplexMode = DuplexMode.SIMPLEX
    layout_nup: int = Field(1, ge=1, le=4)
    page_range: str = "all"


class CostCalculationResponse(BaseModel):
    page_count: int
    copy_count: int
    is_color: bool
    duplex_mode: DuplexMode
    layout_nup: int
    sheets_per_copy: int
    total_sheets: int
    rate_per_page: float
    discount: float
    total_cost: float
    currency: str


class JobStagedResponse(BaseModel):
    job_id: str
    shop_id: str
    file_name: str
    file_size_bytes: int
    page_count: int
    copy_count: int
    is_color: bool
    duplex_mode: DuplexMode
    layout_nup: int
    total_cost: float
    currency: str
    payment_status: PaymentStatus
    job_status: JobStatus


class PaymentVerifyRequest(BaseModel):
    job_id: str
    payment_id: str
    payment_method: str = "UPI"


class PaymentVerifyResponse(BaseModel):
    job_id: str
    shop_id: str
    release_token: str
    barcode_payload: str
    total_cost: float
    payment_status: PaymentStatus
    job_status: JobStatus
    expires_at: datetime


class TokenVerifyRequest(BaseModel):
    shop_id: str
    token: str
    operator_id: Optional[str] = "counter_op_1"


class TokenVerifyResponse(BaseModel):
    job_id: str
    shop_id: str
    file_name: str
    file_hash: str
    page_count: int
    copy_count: int
    is_color: bool
    duplex_mode: DuplexMode
    layout_nup: int
    total_cost: float
    download_url: str
    download_url_expires_in_seconds: int = 60


class JobCompleteRequest(BaseModel):
    job_id: str
    status: str = "completed"
    error_message: Optional[str] = None
