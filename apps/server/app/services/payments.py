"""Only verified provider receipts may transition a job to paid.

A live adapter must create an order and verify a captured payment with its gateway,
including amount, currency and order binding. Never trust browser payment IDs.
"""
from dataclasses import dataclass
from typing import Protocol
import hashlib
import hmac
import secrets
import re
from fastapi import HTTPException
import httpx
from app.core.config import settings


@dataclass(frozen=True)
class Receipt:
    order_id: str
    payment_id: str
    amount_minor: int
    currency: str
    captured: bool


class PaymentProvider(Protocol):
    name: str

    def create_order(self, job_id: str, amount_minor: int, currency: str) -> dict: ...
    def verify_capture(self, order: dict) -> Receipt: ...


class MockProvider:
    name = "mock"

    def create_order(self, job_id, amount_minor, currency):
        return {
            "id": "mock_order_" + secrets.token_hex(16),
            "job_id": job_id,
            "provider": self.name,
            "amount_minor": amount_minor,
            "currency": currency,
            "payment_id": "mock_pay_" + secrets.token_hex(16),
        }

    def verify_capture(self, order):
        if order["provider"] != self.name:
            raise HTTPException(409, "Payment provider mismatch")
        return Receipt(order["id"], order["payment_id"], order["amount_minor"], order["currency"], True)


class RazorpayProvider:
    name = "razorpay"

    def __init__(self):
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            raise HTTPException(503, "Razorpay payment gateway credentials are not configured")
        self.key_id = settings.RAZORPAY_KEY_ID
        self.key_secret = settings.RAZORPAY_KEY_SECRET

    def create_order(self, job_id: str, amount_minor: int, currency: str = "INR") -> dict:
        url = "https://api.razorpay.com/v1/orders"
        payload = {
            "amount": amount_minor,
            "currency": currency,
            "receipt": job_id[:40],
            "notes": {"job_id": job_id},
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, auth=(self.key_id, self.key_secret))
                if res.status_code >= 400:
                    raise HTTPException(502, "Payment gateway could not create the order")
                data = res.json()
        except (httpx.RequestError, ValueError):
            raise HTTPException(502, "Payment gateway is unavailable") from None

        return {
            "id": data["id"],
            "job_id": job_id,
            "provider": self.name,
            "key_id": self.key_id,
            "amount_minor": amount_minor,
            "currency": currency,
        }

    def verify_capture(self, order: dict) -> Receipt:
        raise HTTPException(409, "A gateway-verified payment is required")

    def verify_payment(
        self,
        order_id: str,
        payment_id: str,
        signature: str,
        expected_amount_minor: int,
        currency: str = "INR",
    ) -> Receipt:
        if not re.fullmatch(r"order_[A-Za-z0-9]{1,64}", order_id) or not re.fullmatch(r"pay_[A-Za-z0-9]{1,64}", payment_id):
            raise HTTPException(422, "Invalid payment identifiers")
        # 1. Cryptographic HMAC-SHA256 signature verification
        body = f"{order_id}|{payment_id}".encode("utf-8")
        expected_sig = hmac.new(self.key_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        if not secrets.compare_digest(expected_sig, signature):
            raise HTTPException(400, "Invalid Razorpay payment signature")

        # 2. Server-side fetch from Razorpay API to confirm capture status and exact amount
        url = f"https://api.razorpay.com/v1/payments/{payment_id}"
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(url, auth=(self.key_id, self.key_secret))
                if res.status_code >= 400:
                    raise HTTPException(502, "Could not verify payment with gateway")
                payment_data = res.json()
        except (httpx.RequestError, ValueError):
            raise HTTPException(502, "Payment gateway is unavailable") from None

        if not isinstance(payment_data, dict) or payment_data.get("id") != payment_id:
            raise HTTPException(409, "Payment ID mismatch")

        if payment_data.get("order_id") != order_id:
            raise HTTPException(409, "Payment order ID mismatch")

        status = payment_data.get("status")
        if status != "captured" or payment_data.get("captured") is not True:
            raise HTTPException(409, "Payment has not been captured")

        if payment_data.get("currency") != currency:
            raise HTTPException(409, "Payment currency mismatch")

        amount_paid = payment_data.get("amount", 0)
        if amount_paid != expected_amount_minor:
            raise HTTPException(409, f"Paid amount {amount_paid} does not match required {expected_amount_minor}")

        return Receipt(order_id, payment_id, expected_amount_minor, currency, True)


def get_provider():
    if settings.PAYMENT_PROVIDER == "razorpay":
        if (
            settings.ENVIRONMENT == "production"
            and not getattr(settings, "ALLOW_RAZORPAY_TEST_KEYS", False)
            and not settings.RAZORPAY_KEY_ID.startswith("rzp_live_")
        ):
            raise HTTPException(503, "Live payment credentials are required in production")
        return RazorpayProvider()
    if settings.PAYMENT_PROVIDER == "mock":
        if not settings.ALLOW_MOCK_PAYMENTS or settings.ENVIRONMENT != "test":
            raise RuntimeError("Simulated payments are restricted to automated tests")
        return MockProvider()
    raise HTTPException(503, "Online payments are not configured; no payment has been taken")
