"""Authoritative Quota and Ledger Service.

Enforces:
- 100,000,000 bytes maximum active customer storage
- 100,000,000 bytes maximum UTC-day admission
- Real provider-enforced ceilings (25 MiB verified customer / 2 MiB guest) reserved BEFORE issuing grants
- Immediate release of reservations on failure/cancel/expiry
- Deletion frees active storage but NEVER refunds today's daily admission
- UTC daily reset handling
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from fastapi import HTTPException


CUSTOMER_MAX_STORAGE_BYTES = 100_000_000  # 100 MB decimal cap
CUSTOMER_MAX_DAILY_ADMISSION_BYTES = 100_000_000  # 100 MB decimal cap
CUSTOMER_MAX_FILE_BYTES = 26_214_400  # 25 MiB ceiling
GUEST_MAX_FILE_BYTES = 2_097_152  # 2 MiB ceiling
CUSTOMER_MAX_BATCH_FILES = 20
GUEST_MAX_BATCH_FILES = 5

PRIVACY_EXPIRY_SECONDS = 10800  # 3 hours
GRANT_EXPIRY_SECONDS = 7200  # 2 hours


class QuotaExceededException(HTTPException):
    def __init__(self, detail: str, code: str = "QUOTA_EXCEEDED"):
        super().__init__(status_code=403, detail={"message": detail, "code": code})


class QuotaService:
    @staticmethod
    def get_today_utc() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    @staticmethod
    def get_next_reset_utc() -> str:
        now = datetime.now(timezone.utc)
        tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        return tomorrow.isoformat()

    def get_account_ledger(self, records, account_id: str) -> Dict[str, Any]:
        data = records.get("quota_accounts", account_id)
        if not data:
            data = {
                "id": account_id,
                "active_storage_bytes": 0,
                "outstanding_reservation_bytes": 0,
                "max_storage_bytes": CUSTOMER_MAX_STORAGE_BYTES,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        return data

    def get_daily_ledger(self, records, account_id: str, date_str: Optional[str] = None) -> Dict[str, Any]:
        date_str = date_str or self.get_today_utc()
        ledger_key = f"{account_id}:{date_str}"
        data = records.get("quota_daily_usage", ledger_key)
        if not data:
            data = {
                "id": ledger_key,
                "account_id": account_id,
                "usage_date": date_str,
                "charged_admission_bytes": 0,
                "outstanding_reservation_bytes": 0,
                "max_admission_bytes": CUSTOMER_MAX_DAILY_ADMISSION_BYTES,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        return data

    def get_usage_summary(self, records, account_id: str) -> Dict[str, Any]:
        acct = self.get_account_ledger(records, account_id)
        daily = self.get_daily_ledger(records, account_id)

        active = int(acct.get("active_storage_bytes", 0))
        reserved = int(acct.get("outstanding_reservation_bytes", 0))
        total_storage_exposure = active + reserved

        charged_daily = int(daily.get("charged_admission_bytes", 0))
        reserved_daily = int(daily.get("outstanding_reservation_bytes", 0))
        total_daily_exposure = charged_daily + reserved_daily

        return {
            "account_id": account_id,
            "active_storage_bytes": active,
            "outstanding_reservation_bytes": reserved,
            "total_storage_exposure_bytes": total_storage_exposure,
            "max_storage_bytes": CUSTOMER_MAX_STORAGE_BYTES,
            "storage_remaining_bytes": max(0, CUSTOMER_MAX_STORAGE_BYTES - total_storage_exposure),
            "daily_charged_admission_bytes": charged_daily,
            "daily_outstanding_reservation_bytes": reserved_daily,
            "total_daily_exposure_bytes": total_daily_exposure,
            "max_daily_admission_bytes": CUSTOMER_MAX_DAILY_ADMISSION_BYTES,
            "daily_remaining_bytes": max(0, CUSTOMER_MAX_DAILY_ADMISSION_BYTES - total_daily_exposure),
            "today_utc": self.get_today_utc(),
            "resets_at_utc": self.get_next_reset_utc(),
        }

    def reserve_batch(
        self,
        records,
        principal_type: str,
        principal_id: str,
        items: List[Dict[str, Any]],
        purpose: str,
        access_mode: str,
        batch_id: str,
    ) -> List[Dict[str, Any]]:
        """Validates limits, computes provider-enforced ceilings, and transactionally reserves quota."""
        if not items:
            raise HTTPException(400, "Upload manifest cannot be empty")

        if principal_type == "guest":
            if len(items) > GUEST_MAX_BATCH_FILES:
                raise HTTPException(400, f"Guest uploads are limited to {GUEST_MAX_BATCH_FILES} files per batch")
            if access_mode != "ephemeral":
                raise HTTPException(403, "Guests may only upload ephemeral print documents")

            prepared_items = []
            for idx, it in enumerate(items):
                declared_size = int(it.get("size_bytes", 0))
                if declared_size <= 0:
                    raise HTTPException(422, f"Item {idx + 1} has invalid declared size")
                if declared_size > GUEST_MAX_FILE_BYTES:
                    raise HTTPException(413, f"Item '{it.get('name')}' exceeds guest limit of 2 MiB")

                # The provider ceiling enforced for guest upload grants is GUEST_MAX_FILE_BYTES (2 MiB)
                prepared_items.append({
                    "item_index": idx,
                    "declared_name": it["name"],
                    "declared_size_bytes": declared_size,
                    "declared_mime": it.get("mime_type", "application/octet-stream"),
                    "enforced_ceiling_bytes": GUEST_MAX_FILE_BYTES,
                })
            return prepared_items

        if principal_type == "customer":
            if len(items) > CUSTOMER_MAX_BATCH_FILES:
                raise HTTPException(400, f"Batch size cannot exceed {CUSTOMER_MAX_BATCH_FILES} files")

            total_ceiling = 0
            prepared_items = []
            for idx, it in enumerate(items):
                declared_size = int(it.get("size_bytes", 0))
                if declared_size <= 0:
                    raise HTTPException(422, f"Item {idx + 1} has invalid declared size")
                if declared_size > CUSTOMER_MAX_FILE_BYTES:
                    raise HTTPException(413, f"Item '{it.get('name')}' exceeds customer limit of 25 MiB")

                ceiling = CUSTOMER_MAX_FILE_BYTES
                total_ceiling += ceiling
                prepared_items.append({
                    "item_index": idx,
                    "declared_name": it["name"],
                    "declared_size_bytes": declared_size,
                    "declared_mime": it.get("mime_type", "application/octet-stream"),
                    "enforced_ceiling_bytes": ceiling,
                })

            # Check and lock customer quota rows
            acct = self.get_account_ledger(records, principal_id)
            daily = self.get_daily_ledger(records, principal_id)

            active_storage = int(acct.get("active_storage_bytes", 0))
            reserved_storage = int(acct.get("outstanding_reservation_bytes", 0))
            if active_storage + reserved_storage + total_ceiling > CUSTOMER_MAX_STORAGE_BYTES:
                raise QuotaExceededException(
                    f"Upload would exceed account storage cap of 100 MB (current active: {active_storage} bytes, "
                    f"pending reservations: {reserved_storage} bytes, requested reservation: {total_ceiling} bytes)",
                    code="STORAGE_QUOTA_EXCEEDED"
                )

            charged_daily = int(daily.get("charged_admission_bytes", 0))
            reserved_daily = int(daily.get("outstanding_reservation_bytes", 0))
            if charged_daily + reserved_daily + total_ceiling > CUSTOMER_MAX_DAILY_ADMISSION_BYTES:
                raise QuotaExceededException(
                    f"Upload would exceed daily admission cap of 100 MB (today's consumed: {charged_daily} bytes, "
                    f"pending reservations: {reserved_daily} bytes, requested reservation: {total_ceiling} bytes)",
                    code="DAILY_ADMISSION_EXCEEDED"
                )

            # Apply reservations
            now_iso = datetime.now(timezone.utc).isoformat()
            acct["outstanding_reservation_bytes"] = reserved_storage + total_ceiling
            acct["updated_at"] = now_iso
            records.put("quota_accounts", principal_id, acct)

            daily["outstanding_reservation_bytes"] = reserved_daily + total_ceiling
            daily["updated_at"] = now_iso
            records.put("quota_daily_usage", daily["id"], daily)

            # Record immutable quota event
            event_id = f"qev-{uuid.uuid4().hex[:12]}"
            records.put("quota_events", event_id, {
                "id": event_id,
                "account_id": principal_id,
                "event_type": "reserve",
                "delta_active": 0,
                "delta_reserved": total_ceiling,
                "delta_daily": 0,
                "batch_id": batch_id,
                "item_id": None,
                "created_at": now_iso,
                "data": {"item_count": len(items), "purpose": purpose},
            })

            return prepared_items

        raise HTTPException(400, f"Unsupported principal type: {principal_type}")

    def settle_item(
        self,
        records,
        principal_type: str,
        principal_id: str,
        batch_id: str,
        item_id: str,
        enforced_ceiling_bytes: int,
        observed_size_bytes: int,
        purpose: str,
        access_mode: str,
    ) -> None:
        """Settles an item reservation: releases the ceiling reservation and records actual observed bytes."""
        if principal_type != "customer":
            return

        now_iso = datetime.now(timezone.utc).isoformat()
        acct = self.get_account_ledger(records, principal_id)
        daily = self.get_daily_ledger(records, principal_id)

        # Release ceiling reservation
        current_res = int(acct.get("outstanding_reservation_bytes", 0))
        acct["outstanding_reservation_bytes"] = max(0, current_res - enforced_ceiling_bytes)

        # For persistent storage (library documents), charge active storage
        if access_mode == "persistent":
            current_active = int(acct.get("active_storage_bytes", 0))
            acct["active_storage_bytes"] = current_active + observed_size_bytes

        acct["updated_at"] = now_iso
        records.put("quota_accounts", principal_id, acct)

        # Charge daily admission ledger for all uploads (ephemeral or persistent)
        current_daily_res = int(daily.get("outstanding_reservation_bytes", 0))
        daily["outstanding_reservation_bytes"] = max(0, current_daily_res - enforced_ceiling_bytes)
        current_charged = int(daily.get("charged_admission_bytes", 0))
        daily["charged_admission_bytes"] = current_charged + observed_size_bytes
        daily["updated_at"] = now_iso
        records.put("quota_daily_usage", daily["id"], daily)

        # Record quota event
        event_id = f"qev-{uuid.uuid4().hex[:12]}"
        records.put("quota_events", event_id, {
            "id": event_id,
            "account_id": principal_id,
            "event_type": "settle",
            "delta_active": observed_size_bytes if access_mode == "persistent" else 0,
            "delta_reserved": -enforced_ceiling_bytes,
            "delta_daily": observed_size_bytes,
            "batch_id": batch_id,
            "item_id": item_id,
            "created_at": now_iso,
            "data": {"observed_bytes": observed_size_bytes, "access_mode": access_mode},
        })

    def release_reservation(
        self,
        records,
        principal_type: str,
        principal_id: str,
        batch_id: str,
        item_id: Optional[str],
        released_bytes: int,
    ) -> None:
        """Releases an unconsumed quota reservation without charging storage or admission."""
        if principal_type != "customer" or released_bytes <= 0:
            return

        now_iso = datetime.now(timezone.utc).isoformat()
        acct = self.get_account_ledger(records, principal_id)
        daily = self.get_daily_ledger(records, principal_id)

        current_res = int(acct.get("outstanding_reservation_bytes", 0))
        acct["outstanding_reservation_bytes"] = max(0, current_res - released_bytes)
        acct["updated_at"] = now_iso
        records.put("quota_accounts", principal_id, acct)

        current_daily_res = int(daily.get("outstanding_reservation_bytes", 0))
        daily["outstanding_reservation_bytes"] = max(0, current_daily_res - released_bytes)
        daily["updated_at"] = now_iso
        records.put("quota_daily_usage", daily["id"], daily)

        event_id = f"qev-{uuid.uuid4().hex[:12]}"
        records.put("quota_events", event_id, {
            "id": event_id,
            "account_id": principal_id,
            "event_type": "release",
            "delta_active": 0,
            "delta_reserved": -released_bytes,
            "delta_daily": 0,
            "batch_id": batch_id,
            "item_id": item_id,
            "created_at": now_iso,
            "data": {"released_bytes": released_bytes},
        })

    def free_active_storage(
        self,
        records,
        account_id: str,
        freed_bytes: int,
        target_id: Optional[str] = None,
    ) -> None:
        """Frees confirmed active storage. Note: Daily charged admission is NEVER refunded."""
        if freed_bytes <= 0:
            return

        now_iso = datetime.now(timezone.utc).isoformat()
        acct = self.get_account_ledger(records, account_id)
        current_active = int(acct.get("active_storage_bytes", 0))
        acct["active_storage_bytes"] = max(0, current_active - freed_bytes)
        acct["updated_at"] = now_iso
        records.put("quota_accounts", account_id, acct)

        event_id = f"qev-{uuid.uuid4().hex[:12]}"
        records.put("quota_events", event_id, {
            "id": event_id,
            "account_id": account_id,
            "event_type": "delete",
            "delta_active": -freed_bytes,
            "delta_reserved": 0,
            "delta_daily": 0,
            "batch_id": None,
            "item_id": target_id,
            "created_at": now_iso,
            "data": {"freed_bytes": freed_bytes},
        })

    def backfill_existing_documents(self, records, dry_run: bool = True) -> Dict[str, Any]:
        """Scans existing cbpms_private.documents and reconciles active storage into quota_accounts.

        Historical documents do NOT count toward today's daily admission cap.
        """
        all_docs = records.list("documents")
        user_totals: Dict[str, int] = {}
        user_counts: Dict[str, int] = {}

        for doc in all_docs:
            if not doc.get("library") or doc.get("status") in ("deleted", "deleting"):
                continue
            owner = doc.get("owner_id")
            if not owner:
                continue
            size = int(doc.get("file_size_bytes", 0))
            user_totals[owner] = user_totals.get(owner, 0) + size
            user_counts[owner] = user_counts.get(owner, 0) + 1

        report = {
            "dry_run": dry_run,
            "total_documents_scanned": len(all_docs),
            "users_with_library_docs": len(user_totals),
            "backfill_summary": [
                {
                    "user_id": uid,
                    "document_count": user_counts[uid],
                    "total_active_bytes": user_totals[uid],
                }
                for uid in user_totals
            ],
        }

        if not dry_run:
            now_iso = datetime.now(timezone.utc).isoformat()
            for uid, total_bytes in user_totals.items():
                acct = self.get_account_ledger(records, uid)
                acct["active_storage_bytes"] = total_bytes
                acct["outstanding_reservation_bytes"] = 0
                acct["updated_at"] = now_iso
                records.put("quota_accounts", uid, acct)

        return report


quota_service = QuotaService()
