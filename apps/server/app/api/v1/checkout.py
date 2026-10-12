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


class RazorpayVerifyPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


def payable(job):
    if job["expires_at_epoch"] <= time.time() or job["job_status"] == "expired":
        raise HTTPException(409, "Checkout expired; upload again")


def allocate_release_token(records, shop_id: str) -> str:
    active = {
        j["release_token"]
        for j in records.list("jobs")
        if j["shop_id"] == shop_id
        and j["expires_at_epoch"] > time.time()
        and j["job_status"] in ("queued", "processing", "failed")
        and j.get("release_token")
    }
    available = [f"{i:04d}" for i in range(10000) if f"{i:04d}" not in active]
    if not available:
        raise HTTPException(503, "Shop release code capacity reached")
    return secrets.choice(available)


@router.post("/{job_id}/order")
def create_order(job_id: str, x_checkout_token: str = Header(...)):
    provider = get_provider()
    with db.transaction() as records:
        job = get_job(records, job_id)
        check_checkout(job, x_checkout_token)
        payable(job)
        if not job.get("order"):
            if job["job_status"] != "staged":
                raise HTTPException(409, "Job cannot enter checkout")
            amount = int(Decimal(str(job["total_cost"])) * 100)
            job["order"] = provider.create_order(job_id, amount, job["currency"])
            records.put("jobs", job_id, job)

        order_data = {
            "id": job["order"]["id"],
            "provider": job["order"]["provider"],
            "amount_minor": job["order"]["amount_minor"],
            "currency": job["order"]["currency"],
            "key_id": job["order"].get("key_id", settings.RAZORPAY_KEY_ID),
        }
        return order_data


@router.post("/{job_id}/verify", response_model=PaymentVerifyResponse)
async def verify_razorpay_payment(
    job_id: str,
    payload: RazorpayVerifyPayload,
    x_checkout_token: str = Header(...),
):
    provider = get_provider()
    if provider.name != "razorpay":
        raise HTTPException(400, f"Current payment provider is {provider.name}, not razorpay")

    changed = False
    with db.transaction() as records:
        job = get_job(records, job_id)
        check_checkout(job, x_checkout_token)
        payable(job)

        order = job.get("order")
        if not order or order["id"] != payload.razorpay_order_id:
            raise HTTPException(409, "Order ID does not match this job's checkout")

        expected_amount = int(Decimal(str(job["total_cost"])) * 100)
        receipt = provider.verify_payment(
            order_id=payload.razorpay_order_id,
            payment_id=payload.razorpay_payment_id,
            signature=payload.razorpay_signature,
            expected_amount_minor=expected_amount,
            currency=job["currency"],
        )

        if job["payment_status"] != "completed":
            if job["job_status"] != "staged":
                raise HTTPException(409, "Invalid job transition")

            token = allocate_release_token(records, job["shop_id"])
            job.update(
                payment_status="completed",
                payment_method="razorpay",
                payment_id=receipt.payment_id,
                release_token=token,
                job_status="queued",
            )
            records.put("jobs", job_id, job)
            record_audit(
                records,
                "payment.razorpay_completed",
                target=job_id,
                metadata={
                    "shop_id": job["shop_id"],
                    "payment_id": receipt.payment_id,
                    "order_id": receipt.order_id,
                    "amount": job["total_cost"],
                },
            )
            changed = True

        response = {
            **job,
            "job_id": job_id,
            "barcode_payload": f"CBPMS:{job['shop_id']}:{job['release_token']}:{job_id}",
        }

    if changed:
        await ws_hub.broadcast_to_shop(job["shop_id"], "JOB_QUEUED", {"job_id": job_id})

    return response


@router.post("/{job_id}/pay-at-counter", response_model=PaymentVerifyResponse)
async def pay_at_counter(job_id: str, x_checkout_token: str = Header(...)):
    changed = False
    with db.transaction() as records:
        job = get_job(records, job_id)
        check_checkout(job, x_checkout_token)
        payable(job)

        if not job.get("release_token"):
            if job["job_status"] != "staged":
                raise HTTPException(409, "Invalid job transition")

            token = allocate_release_token(records, job["shop_id"])
            job.update(
                payment_status="pending",
                payment_method="counter",
                release_token=token,
                job_status="queued",
            )
            records.put("jobs", job_id, job)
            record_audit(
                records,
                "payment.pay_at_counter_chosen",
                target=job_id,
                metadata={"shop_id": job["shop_id"], "amount": job["total_cost"]},
            )
            changed = True

        response = {
            **job,
            "job_id": job_id,
            "barcode_payload": f"CBPMS:{job['shop_id']}:{job['release_token']}:{job_id}",
        }

    if changed:
        await ws_hub.broadcast_to_shop(
            job["shop_id"],
            "JOB_QUEUED",
            {"job_id": job_id, "payment_method": "counter"},
        )

    return response


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
        if (
            not receipt.captured
            or receipt.order_id != order["id"]
            or receipt.amount_minor != int(Decimal(str(job["total_cost"])) * 100)
            or receipt.currency != job["currency"]
        ):
            raise HTTPException(409, "Verified payment does not match the order")
        if job["payment_status"] != "completed":
            if job["job_status"] != "staged":
                raise HTTPException(409, "Invalid job transition")
            token = allocate_release_token(records, job["shop_id"])
            job.update(
                payment_status="completed",
                payment_id=receipt.payment_id,
                release_token=token,
                job_status="queued",
            )
            records.put("jobs", job_id, job)
            record_audit(
                records,
                "payment.mock_completed",
                target=job_id,
                metadata={"shop_id": job["shop_id"], "provider": provider.name},
            )
            changed = True
        response = {
            **job,
            "job_id": job_id,
            "barcode_payload": f"CBPMS:{job['shop_id']}:{job['release_token']}:{job_id}",
        }
    if changed:
        await ws_hub.broadcast_to_shop(job["shop_id"], "JOB_QUEUED", {"job_id": job_id})
    return response
