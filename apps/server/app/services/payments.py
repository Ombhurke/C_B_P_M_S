"""Only verified provider receipts may transition a job to paid.

A live adapter must create an order and verify a captured payment with its gateway,
including amount, currency and order binding. Never trust browser payment IDs.
"""
from dataclasses import dataclass
from typing import Protocol
import secrets
from fastapi import HTTPException
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
        return {"id": "mock_order_" + secrets.token_hex(16), "job_id": job_id,
                "provider": self.name, "amount_minor": amount_minor, "currency": currency,
                "payment_id": "mock_pay_" + secrets.token_hex(16)}

    def verify_capture(self, order):
        if order["provider"] != self.name:
            raise HTTPException(409, "Payment provider mismatch")
        return Receipt(order["id"], order["payment_id"], order["amount_minor"], order["currency"], True)


def get_provider() -> PaymentProvider:
    if settings.PAYMENT_PROVIDER != "mock":
        raise HTTPException(503, "Online payments are not configured; no payment has been taken")
    if not settings.ALLOW_MOCK_PAYMENTS or settings.ENVIRONMENT != "test":
        raise RuntimeError("Simulated payments are restricted to automated tests")
    return MockProvider()
