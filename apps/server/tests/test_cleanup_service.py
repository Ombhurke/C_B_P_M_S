"""Integration tests for CleanupService outbox, 3-hour expiry, and Storage API reconciliation."""
from datetime import datetime, timezone, timedelta
from pathlib import Path
import pytest

from app.core.config import settings
from app.core.database import db
from app.services.cleanup_service import cleanup_service
from app.services.quota_service import quota_service, CUSTOMER_MAX_FILE_BYTES
from test_api import client


@pytest.mark.asyncio
async def test_expired_upload_batch_releases_reservation_and_queues_cleanup(client):
    user_id = "expired-batch-user"
    batch_id = "batch-will-expire"
    item_id = "item-will-expire"
    past_iso = (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat()
    q_path = f"quarantine/{batch_id}/{item_id}.bin"

    # Set up local test quarantine file
    q_file = Path(settings.TEMP_STORAGE_DIR).resolve() / q_path
    q_file.parent.mkdir(parents=True, exist_ok=True)
    q_file.write_bytes(b"temp-quarantine-bytes")

    with db.transaction() as records:
        # Create expired batch and item with reserved quota
        quota_service.reserve_batch(
            records=records,
            principal_type="customer",
            principal_id=user_id,
            items=[{"name": "test.pdf", "size_bytes": 1000}],
            purpose="transient_print_job",
            access_mode="ephemeral",
            batch_id=batch_id,
        )

        records.put("upload_batches", batch_id, {
            "id": batch_id,
            "principal_type": "customer",
            "principal_id": user_id,
            "purpose": "transient_print_job",
            "access_mode": "ephemeral",
            "status": "pending",
            "expires_at": past_iso,
            "total_items": 1,
            "created_at": past_iso,
            "updated_at": past_iso,
        })
        records.put("upload_items", item_id, {
            "id": item_id,
            "batch_id": batch_id,
            "item_index": 0,
            "declared_name": "test.pdf",
            "enforced_ceiling_bytes": CUSTOMER_MAX_FILE_BYTES,
            "status": "reserved",
            "quarantine_path": q_path,
            "created_at": past_iso,
            "updated_at": past_iso,
        })

    # Outstanding reservation is held before sweep
    with db.transaction() as records:
        s1 = quota_service.get_usage_summary(records, user_id)
        assert s1["outstanding_reservation_bytes"] == CUSTOMER_MAX_FILE_BYTES

    # Run cleanup sweep
    await cleanup_service.sweep()

    # Verify:
    # 1. Batch and item are marked 'expired'
    # 2. Reservation is released
    # 3. Background task was executed and quarantine file was removed
    with db.transaction() as records:
        batch = records.get("upload_batches", batch_id)
        assert batch["status"] == "expired"
        item = records.get("upload_items", item_id)
        assert item["status"] == "expired"

        s2 = quota_service.get_usage_summary(records, user_id)
        assert s2["outstanding_reservation_bytes"] == 0

        # Background task completed
        tasks = records.list("background_tasks")
        matching = [t for t in tasks if t.get("target_id") == q_path]
        assert len(matching) == 1
        assert matching[0]["status"] == "completed"

    assert not q_file.exists()


@pytest.mark.asyncio
async def test_persistent_library_documents_survive_cleanup(client):
    user_id = "persistent-user-survivor"
    past_iso = (datetime.now(timezone.utc) - timedelta(hours=10)).isoformat()

    with db.transaction() as records:
        # Create persistent library document
        records.put("documents", "doc-permanent-1", {
            "id": "doc-permanent-1",
            "owner_id": user_id,
            "library": True,
            "status": "available",
            "access_mode": "account",
            "created_at": past_iso,
        })
        # Create persistent artifact
        records.put("object_artifacts", "art-permanent-1", {
            "id": "art-permanent-1",
            "storage_bucket": settings.SUPABASE_STORAGE_BUCKET,
            "storage_path": "canonical/customer_library/doc-permanent-1.bin",
            "artifact_type": "source",
            "purpose": "customer_library",
            "access_mode": "persistent",
            "owner_id": user_id,
            "size_bytes": 5000,
            "sha256": "abcdef123456",
            "expires_at": None,
            "deleted_at": None,
            "created_at": past_iso,
        })

    # Run sweep
    await cleanup_service.sweep()

    # Document and artifact MUST still be present and untouched
    with db.transaction() as records:
        doc = records.get("documents", "doc-permanent-1")
        assert doc is not None
        assert doc["status"] == "available"

        art = records.get("object_artifacts", "art-permanent-1")
        assert art is not None
        assert art["deleted_at"] is None
