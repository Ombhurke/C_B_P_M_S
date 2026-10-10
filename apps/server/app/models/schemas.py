from pydantic import BaseModel, Field
from typing import Optional, List, Literal
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


class AccessMode(str, Enum):
    ANONYMOUS = "anonymous"
    ACCOUNT = "account"


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


class PrinterCreateRequest(BaseModel):
    device_name: str = Field(..., min_length=1, max_length=150)
    driver_name: Optional[str] = None
    is_color_supported: bool = True
    is_duplex_supported: bool = True
    max_paper_size: str = "A4"


class PrinterUpdateRequest(BaseModel):
    device_name: Optional[str] = Field(None, min_length=1, max_length=150)
    driver_name: Optional[str] = None
    is_color_supported: Optional[bool] = None
    is_duplex_supported: Optional[bool] = None
    max_paper_size: Optional[str] = None
    status: Optional[str] = None


class StationSchema(BaseModel):
    id: str
    shop_id: str
    name: str
    location: str = "Main counter"
    status: str = "online"
    assigned_printer_id: Optional[str] = None
    last_sync: Optional[str] = None


class StationCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    location: str = Field("Main counter", max_length=100)
    assigned_printer_id: Optional[str] = None


class StationUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    location: Optional[str] = Field(None, max_length=100)
    assigned_printer_id: Optional[str] = None
    status: Optional[str] = None


class TeamMemberSchema(BaseModel):
    username: str
    shop_id: str
    role: Literal["admin", "operator"]
    active: bool = True
    last_active: Optional[str] = None


class TeamInviteRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=12, max_length=256)
    role: Literal["admin", "operator"] = "operator"


class TeamMemberUpdateRequest(BaseModel):
    role: Optional[Literal["admin", "operator"]] = None
    active: Optional[bool] = None


class ShopProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = None
    address: Optional[str] = None
    opening_hours: Optional[str] = None


class JobRejectRequest(BaseModel):
    reason: str = Field(..., min_length=2, max_length=500)


class JobOutputConfirmRequest(BaseModel):
    printer_name: Optional[str] = None
    notes: Optional[str] = None


class JobIssueReportRequest(BaseModel):
    issue_type: str = Field(..., min_length=2, max_length=50)
    details: str = Field(..., min_length=2, max_length=500)


class ShopSchema(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    opening_hours: Optional[str] = "Mon – Fri 09:00 – 18:00\nSat – Sun 10:00 – 16:00"
    base_bw_rate: float = 2.00
    base_color_rate: float = 10.00
    duplex_discount: float = 0.50
    currency: str = "INR"
    is_active: bool = True
    supports_bw: bool = True
    supports_color: bool = True
    supports_duplex: bool = True
    supported_layouts: List[int] = [1, 2, 4, 8]
    paper_rates: dict = {}
    printers: List[PrinterSchema] = []
    stations: List[StationSchema] = []


class ShopUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = None
    address: Optional[str] = None
    opening_hours: Optional[str] = None
    base_bw_rate: Optional[float] = Field(None, ge=0, le=10000, allow_inf_nan=False)
    base_color_rate: Optional[float] = Field(None, ge=0, le=10000, allow_inf_nan=False)
    duplex_discount: Optional[float] = Field(None, ge=0, le=10000, allow_inf_nan=False)
    supports_bw: Optional[bool] = None
    supports_color: Optional[bool] = None
    supports_duplex: Optional[bool] = None
    supported_layouts: Optional[List[int]] = None
    paper_rates: Optional[dict] = None


# --- Print Job Schemas ---
class JobCreateRequest(BaseModel):
    shop_id: str
    page_count: int = Field(..., gt=0)
    copy_count: int = Field(1, gt=0)
    is_color: bool = False
    duplex_mode: DuplexMode = DuplexMode.SIMPLEX
    layout_nup: int = Field(1, ge=1, le=8)
    paper_type: str = "normal"
    page_range: str = "all"


class CostCalculationResponse(BaseModel):
    page_count: int
    copy_count: int
    is_color: bool
    duplex_mode: DuplexMode
    layout_nup: int
    paper_type: str = "normal"
    sheets_per_copy: int
    total_sheets: int
    rate_per_page: float
    discount: float
    total_cost: float
    currency: str


class JobStagedResponse(BaseModel):
    checkout_token: str
    job_id: str
    shop_id: str
    file_name: str
    file_size_bytes: int
    page_count: int
    copy_count: int
    is_color: bool
    duplex_mode: DuplexMode
    layout_nup: int
    paper_type: str = "normal"
    total_cost: float
    currency: str
    payment_status: PaymentStatus
    job_status: JobStatus
    access_mode: AccessMode = AccessMode.ANONYMOUS
    document_id: str


class CustomerRegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=256)


class CustomerDocumentResponse(BaseModel):
    id: str
    file_name: str
    file_size_bytes: int
    mime_type: str
    file_hash: str
    created_at: str
    updated_at: str
    status: Literal["available", "deleting", "deleted"]
    page_count: Optional[int] = None
    latest_job_status: Optional[JobStatus] = None


class CustomerJobResponse(BaseModel):
    job_id: str
    document_id: str
    shop_id: str
    file_name: str
    access_mode: AccessMode
    page_count: int
    copy_count: int
    total_cost: float
    currency: str
    payment_status: PaymentStatus
    job_status: JobStatus
    created_at: str
    expires_at: str
    release_token: Optional[str] = None


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
    token: str = Field(pattern=r"^\d{4}$")
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
    status: Literal["completed", "failed"] = "completed"
    error_message: Optional[str] = None
