from decimal import Decimal
import secrets
import time

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, ConfigDict

from app.api.v1.jobs import check_checkout, get_job
from app.core.database import db
from app.core.config import settings
from app.core.audit import record_audit
from app.models.schemas import PaymentVerifyResponse
from app.services.payments import get_provider
from app.services.websocket_hub import ws_hub

router = APIRouter(prefix="/payments", tags=["Payments"])


class Confirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_id: str


def payable(job):
    if job["expires_at_epoch"] <= time.time() or job["job_status"] == "expired":
        raise HTTPException(409, "Checkout expired; upload again")


@router.post("/{job_id}/order")
def create_order(job_id: str, x_checkout_token: str = Header(...)):
    provider = get_provider()
    with db.transaction() as records:
        job = get_job(records, job_id)
        check_checkout(job, x_checkout_token)
        payable(job)
        if not job["order"]:
            if job["job_status"] != "staged":
                raise HTTPException(409, "Job cannot enter checkout")
            amount = int(Decimal(str(job["total_cost"])) * 100)
            job["order"] = provider.create_order(job_id, amount, job["currency"])
            records.put("jobs", job_id, job)
        return {k: job["order"][k] for k in ("id", "provider", "amount_minor", "currency")}


@router.post("/{job_id}/mock-confirm", response_model=PaymentVerifyResponse)
async def mock_confirm(job_id: str, payload: Confirmation, x_checkout_token: str = Header(...)):
    if settings.ENVIRONMENT != "test":
        raise HTTPException(404, "Not found")
    provider = get_provider()
    if provider.name != "mock":
        raise HTTPException(404, "Mock checkout is disabled")
    changed = False
    with db.transaction() as records:
        job = get_job(records, job_id)
        check_checkout(job, x_checkout_token)
        payable(job)
        order = job["order"]
        if not order or order["id"] != payload.order_id:
            raise HTTPException(409, "Order does not belong to this checkout")
        receipt = provider.verify_capture(order)
        if (not receipt.captured or receipt.order_id != order["id"] or
            receipt.amount_minor != int(Decimal(str(job["total_cost"])) * 100) or
            receipt.currency != job["currency"]):
            raise HTTPException(409, "Verified payment does not match the order")
        if job["payment_status"] != "completed":
            if job["job_status"] != "staged":
                raise HTTPException(409, "Invalid job transition")
            active = {j["release_token"] for j in records.list("jobs") if
                      j["shop_id"] == job["shop_id"] and j["expires_at_epoch"] > time.time()
                      and j["job_status"] in ("queued", "processing", "failed")}
            available = [f"{i:04d}" for i in range(10000) if f"{i:04d}" not in active]
            if not available:
                raise HTTPException(503, "Shop release code capacity reached")
            job.update(payment_status="completed", payment_id=receipt.payment_id,
                       release_token=secrets.choice(available), job_status="queued")
            records.put("jobs", job_id, job)
            record_audit(records, "payment.mock_completed", target=job_id,
                         metadata={"shop_id": job["shop_id"], "provider": provider.name})
            changed = True
        # A replay returns the same receipt and token, without resetting a printed job.
        response = {**job, "job_id": job_id,
                    "barcode_payload": f"CBPMS:{job['shop_id']}:{job['release_token']}:{job_id}"}
    if changed:
        await ws_hub.broadcast_to_shop(job["shop_id"], "JOB_QUEUED", {"job_id": job_id})
    return response
