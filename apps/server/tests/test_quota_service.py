"""Comprehensive unit and concurrency tests for QuotaService."""
import pytest
from test_api import client
from app.core.database import db
from app.services.quota_service import (
    quota_service,
    CUSTOMER_MAX_STORAGE_BYTES,
    CUSTOMER_MAX_DAILY_ADMISSION_BYTES,
    CUSTOMER_MAX_FILE_BYTES,
    GUEST_MAX_FILE_BYTES,
    QuotaExceededException,
)
from fastapi import HTTPException


def test_quota_summary_initial(client):
    user_id = "test-user-initial"
    with db.transaction() as records:
        summary = quota_service.get_usage_summary(records, user_id)
        assert summary["account_id"] == user_id
        assert summary["active_storage_bytes"] == 0
        assert summary["outstanding_reservation_bytes"] == 0
        assert summary["max_storage_bytes"] == CUSTOMER_MAX_STORAGE_BYTES
        assert summary["storage_remaining_bytes"] == CUSTOMER_MAX_STORAGE_BYTES
        assert summary["daily_charged_admission_bytes"] == 0
        assert summary["max_daily_admission_bytes"] == CUSTOMER_MAX_DAILY_ADMISSION_BYTES


def test_customer_reservation_and_settlement(client):
    user_id = "test-user-flow"
    batch_id = "batch-101"
    items = [
        {"name": "doc1.pdf", "size_bytes": 5_000_000, "mime_type": "application/pdf"},
        {"name": "doc2.pdf", "size_bytes": 10_000_000, "mime_type": "application/pdf"},
    ]

    with db.transaction() as records:
        prepared = quota_service.reserve_batch(
            records=records,
            principal_type="customer",
            principal_id=user_id,
            items=items,
            purpose="customer_library",
            access_mode="persistent",
            batch_id=batch_id,
        )
        assert len(prepared) == 2
        # Ceilings reserved: 2 * CUSTOMER_MAX_FILE_BYTES (2 * 26_214_400)
        expected_reserved = 2 * CUSTOMER_MAX_FILE_BYTES

        summary = quota_service.get_usage_summary(records, user_id)
        assert summary["outstanding_reservation_bytes"] == expected_reserved
        assert summary["daily_outstanding_reservation_bytes"] == expected_reserved
        assert summary["active_storage_bytes"] == 0
        assert summary["daily_charged_admission_bytes"] == 0

        # Now settle item 1 with observed 4_999_000 bytes
        quota_service.settle_item(
            records=records,
            principal_type="customer",
            principal_id=user_id,
            batch_id=batch_id,
            item_id="item-1",
            enforced_ceiling_bytes=CUSTOMER_MAX_FILE_BYTES,
            observed_size_bytes=4_999_000,
            purpose="customer_library",
            access_mode="persistent",
        )

        summary2 = quota_service.get_usage_summary(records, user_id)
        # Reservation dropped by 1 ceiling, active increased by 4_999_000, daily charged increased by 4_999_000
        assert summary2["outstanding_reservation_bytes"] == CUSTOMER_MAX_FILE_BYTES
        assert summary2["active_storage_bytes"] == 4_999_000
        assert summary2["daily_charged_admission_bytes"] == 4_999_000

        # Settle item 2 with observed 10_000_000 bytes
        quota_service.settle_item(
            records=records,
            principal_type="customer",
            principal_id=user_id,
            batch_id=batch_id,
            item_id="item-2",
            enforced_ceiling_bytes=CUSTOMER_MAX_FILE_BYTES,
            observed_size_bytes=10_000_000,
            purpose="customer_library",
            access_mode="persistent",
        )

        summary3 = quota_service.get_usage_summary(records, user_id)
        assert summary3["outstanding_reservation_bytes"] == 0
        assert summary3["active_storage_bytes"] == 14_999_000
        assert summary3["daily_charged_admission_bytes"] == 14_999_000


def test_customer_storage_cap_rejection(client):
    user_id = "test-user-over-cap"
    batch_id = "batch-over"
    # 4 files * 26_214_400 = 104_857_600 > 100_000_000
    items = [
        {"name": f"doc{i}.pdf", "size_bytes": 1_000_000, "mime_type": "application/pdf"}
        for i in range(4)
    ]

    with db.transaction() as records:
        with pytest.raises(QuotaExceededException) as exc_info:
            quota_service.reserve_batch(
                records=records,
                principal_type="customer",
                principal_id=user_id,
                items=items,
                purpose="customer_library",
                access_mode="persistent",
                batch_id=batch_id,
            )
        assert "storage cap" in str(exc_info.value.detail).lower() or exc_info.value.status_code == 403


def test_release_reservation_on_cancel(client):
    user_id = "test-user-cancel"
    batch_id = "batch-cancel"
    items = [{"name": "test.pdf", "size_bytes": 2_000_000, "mime_type": "application/pdf"}]

    with db.transaction() as records:
        quota_service.reserve_batch(
            records=records,
            principal_type="customer",
            principal_id=user_id,
            items=items,
            purpose="customer_library",
            access_mode="persistent",
            batch_id=batch_id,
        )
        summary = quota_service.get_usage_summary(records, user_id)
        assert summary["outstanding_reservation_bytes"] == CUSTOMER_MAX_FILE_BYTES

        # Cancel/release reservation
        quota_service.release_reservation(
            records=records,
            principal_type="customer",
            principal_id=user_id,
            batch_id=batch_id,
            item_id="item-1",
            released_bytes=CUSTOMER_MAX_FILE_BYTES,
        )

        summary2 = quota_service.get_usage_summary(records, user_id)
        assert summary2["outstanding_reservation_bytes"] == 0
        assert summary2["active_storage_bytes"] == 0
        assert summary2["daily_charged_admission_bytes"] == 0


def test_free_active_storage_does_not_refund_daily_admission(client):
    user_id = "test-user-delete-retention"
    batch_id = "batch-del"
    items = [{"name": "file.pdf", "size_bytes": 5_000_000, "mime_type": "application/pdf"}]

    with db.transaction() as records:
        quota_service.reserve_batch(
            records=records,
            principal_type="customer",
            principal_id=user_id,
            items=items,
            purpose="customer_library",
            access_mode="persistent",
            batch_id=batch_id,
        )
        quota_service.settle_item(
            records=records,
            principal_type="customer",
            principal_id=user_id,
            batch_id=batch_id,
            item_id="item-del",
            enforced_ceiling_bytes=CUSTOMER_MAX_FILE_BYTES,
            observed_size_bytes=5_000_000,
            purpose="customer_library",
            access_mode="persistent",
        )

        # Confirm active and daily both 5MB
        s1 = quota_service.get_usage_summary(records, user_id)
        assert s1["active_storage_bytes"] == 5_000_000
        assert s1["daily_charged_admission_bytes"] == 5_000_000

        # Now delete file from library
        quota_service.free_active_storage(records, user_id, 5_000_000, target_id="doc-del")

        s2 = quota_service.get_usage_summary(records, user_id)
        # Active storage is freed:
        assert s2["active_storage_bytes"] == 0
        # Daily consumed admission is NOT refunded:
        assert s2["daily_charged_admission_bytes"] == 5_000_000


def test_guest_upload_limits(client):
    # Guest cannot upload more than 5 files
    guest_items_too_many = [
        {"name": f"g{i}.pdf", "size_bytes": 500_000} for i in range(6)
    ]
    with db.transaction() as records:
        with pytest.raises(HTTPException) as exc:
            quota_service.reserve_batch(
                records=records,
                principal_type="guest",
                principal_id="guest-sess-1",
                items=guest_items_too_many,
                purpose="transient_print_job",
                access_mode="ephemeral",
                batch_id="b-guest-1",
            )
        assert exc.value.status_code == 400

        # Guest file > 2 MiB rejected
        with pytest.raises(HTTPException) as exc2:
            quota_service.reserve_batch(
                records=records,
                principal_type="guest",
                principal_id="guest-sess-1",
                items=[{"name": "big.pdf", "size_bytes": GUEST_MAX_FILE_BYTES + 1}],
                purpose="transient_print_job",
                access_mode="ephemeral",
                batch_id="b-guest-2",
            )
        assert exc2.value.status_code == 413

        # Guest cannot create persistent library uploads
        with pytest.raises(HTTPException) as exc3:
            quota_service.reserve_batch(
                records=records,
                principal_type="guest",
                principal_id="guest-sess-1",
                items=[{"name": "ok.pdf", "size_bytes": 100_000}],
                purpose="customer_library",
                access_mode="persistent",
                batch_id="b-guest-3",
            )
        assert exc3.value.status_code == 403


def test_backfill_existing_documents(client):
    with db.transaction() as records:
        records.put("documents", "doc-bf-1", {
            "id": "doc-bf-1",
            "owner_id": "bf-user-1",
            "library": True,
            "file_size_bytes": 3_500_000,
            "status": "available",
        })
        records.put("documents", "doc-bf-2", {
            "id": "doc-bf-2",
            "owner_id": "bf-user-1",
            "library": True,
            "file_size_bytes": 1_500_000,
            "status": "available",
        })
        # Deleted document should be ignored
        records.put("documents", "doc-bf-3", {
            "id": "doc-bf-3",
            "owner_id": "bf-user-1",
            "library": True,
            "file_size_bytes": 10_000_000,
            "status": "deleted",
        })

        # Dry run
        dry_report = quota_service.backfill_existing_documents(records, dry_run=True)
        assert dry_report["dry_run"] is True
        user_summary = next(s for s in dry_report["backfill_summary"] if s["user_id"] == "bf-user-1")
        assert user_summary["total_active_bytes"] == 5_000_000

        # Before apply, ledger is not touched
        s_before = quota_service.get_usage_summary(records, "bf-user-1")
        assert s_before["active_storage_bytes"] == 0

        # Apply
        quota_service.backfill_existing_documents(records, dry_run=False)
        s_after = quota_service.get_usage_summary(records, "bf-user-1")
        assert s_after["active_storage_bytes"] == 5_000_000
        # Historical backfill does NOT charge today's daily admission
        assert s_after["daily_charged_admission_bytes"] == 0


def test_concurrent_reservation_prevents_overbooking(client):
    from concurrent.futures import ThreadPoolExecutor

    user_id = "concurrent-user-overbooking"
    # Each thread requests 2 files = 2 * 26_214_400 = 52,428,800 bytes
    # Two concurrent requests = 104,857,600 > 100,000,000 cap!
    items = [
        {"name": "file1.pdf", "size_bytes": 10_000_000, "mime_type": "application/pdf"},
        {"name": "file2.pdf", "size_bytes": 10_000_000, "mime_type": "application/pdf"},
    ]

    results = []

    def attempt_reservation(batch_id):
        try:
            with db.transaction() as records:
                quota_service.reserve_batch(
                    records=records,
                    principal_type="customer",
                    principal_id=user_id,
                    items=items,
                    purpose="customer_library",
                    access_mode="persistent",
                    batch_id=batch_id,
                )
            return ("success", None)
        except Exception as exc:
            return ("error", exc)

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_reservation, "batch-c1")
        f2 = executor.submit(attempt_reservation, "batch-c2")
        results = [f1.result(), f2.result()]

    successes = [r for r in results if r[0] == "success"]
    failures = [r for r in results if r[0] == "error"]

    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}"
    assert len(failures) == 1, f"Expected exactly 1 failure, got {len(failures)}"
    assert isinstance(failures[0][1], (QuotaExceededException, HTTPException))

    with db.transaction() as records:
        summary = quota_service.get_usage_summary(records, user_id)
        # Exactly one reservation succeeded: 2 * 26_214_400 = 52_428_800
        assert summary["outstanding_reservation_bytes"] == 2 * CUSTOMER_MAX_FILE_BYTES
        assert summary["outstanding_reservation_bytes"] <= CUSTOMER_MAX_STORAGE_BYTES

