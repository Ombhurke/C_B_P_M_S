"""Comprehensive integration and security tests for Direct Uploads API."""
import io
from pathlib import Path
from pypdf import PdfWriter
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import db
from test_api import client, auth, customer_auth
from app.services.storage_service import storage_service


def create_test_pdf_bytes(num_pages=1):
    writer = PdfWriter()
    for _ in range(num_pages):
        writer.add_blank_page(width=595, height=842)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def test_get_upload_policy(client):
    res = client.get("/api/v1/uploads/policy")
    assert res.status_code == 200
    data = res.json()
    assert "application/pdf" in data["supported_mime_types"]
    assert data["customer_max_file_bytes"] == 26214400
    assert data["guest_max_file_bytes"] == 2097152
    assert data["customer_max_storage_bytes"] == 100000000
    assert data["customer_max_daily_admission_bytes"] == 100000000
    assert data["grant_ttl_seconds"] == 7200
    assert data["privacy_expiry_seconds"] == 10800


def test_guest_session_captcha(client):
    # Invalid CAPTCHA token fails
    res_bad = client.post("/api/v1/uploads/guest-session", json={
        "shop_id": "shop-demo-1",
        "captcha_token": "invalid-token"
    })
    assert res_bad.status_code == 403

    # Non-existent shop fails
    res_no_shop = client.post("/api/v1/uploads/guest-session", json={
        "shop_id": "non-existent-shop",
        "captcha_token": "valid-token-123"
    })
    assert res_no_shop.status_code == 404

    # Valid CAPTCHA succeeds
    res_ok = client.post("/api/v1/uploads/guest-session", json={
        "shop_id": "shop-demo-1",
        "captcha_token": "valid-mock-token"
    })
    assert res_ok.status_code == 200
    sess = res_ok.json()
    assert "guest_token" in sess
    assert sess["shop_id"] == "shop-demo-1"


def test_customer_direct_upload_lifecycle_to_library(client):
    headers = customer_auth(client, email="uploader@example.com")

    # 1. Check initial storage usage
    usage_init = client.get("/api/v1/customer/storage-usage", headers=headers).json()
    assert usage_init["active_storage_bytes"] == 0
    assert usage_init["outstanding_reservation_bytes"] == 0

    # 2. Create upload batch for customer library
    pdf_bytes = create_test_pdf_bytes(2)
    batch_req = {
        "purpose": "customer_library",
        "access_mode": "persistent",
        "items": [
            {"name": "my_doc.pdf", "size_bytes": len(pdf_bytes), "mime_type": "application/pdf"}
        ]
    }
    batch_res = client.post("/api/v1/uploads/batches", headers=headers, json=batch_req)
    assert batch_res.status_code == 200
    batch = batch_res.json()
    assert batch["status"] == "pending"
    assert len(batch["items"]) == 1
    item = batch["items"][0]
    assert item["status"] == "reserved"

    # Verify reservation is held
    usage_reserved = client.get("/api/v1/customer/storage-usage", headers=headers).json()
    assert usage_reserved["outstanding_reservation_bytes"] == 26214400

    # 3. Request upload permission
    perm_res = client.post(f"/api/v1/uploads/items/{item['id']}/permission", headers=headers)
    assert perm_res.status_code == 200
    perm = perm_res.json()
    assert "upload_url" in perm
    assert "token" in perm
    assert perm["quarantine_path"] == item["quarantine_path"]

    # 4. Simulate upload directly to storage quarantine path (mock local storage in test mode)
    q_file = Path(settings.TEMP_STORAGE_DIR).resolve() / item["quarantine_path"]
    q_file.parent.mkdir(parents=True, exist_ok=True)
    q_file.write_bytes(pdf_bytes)

    # 5. Notify complete
    comp_res = client.post(f"/api/v1/uploads/items/{item['id']}/complete", headers=headers)
    assert comp_res.status_code == 200
    comp = comp_res.json()
    assert comp["status"] == "accepted"
    assert comp["page_count"] == 2
    assert comp["observed_size_bytes"] == len(pdf_bytes)

    # Quarantine file must be removed after promotion
    assert not q_file.exists()

    # Quota ledger should reflect settled active storage and zero outstanding reservation
    usage_settled = client.get("/api/v1/customer/storage-usage", headers=headers).json()
    assert usage_settled["outstanding_reservation_bytes"] == 0
    assert usage_settled["active_storage_bytes"] == len(pdf_bytes)
    assert usage_settled["daily_charged_admission_bytes"] == len(pdf_bytes)

    # 6. Finalize batch
    fin_res = client.post(f"/api/v1/uploads/batches/{batch['batch_id']}/finalize", headers=headers)
    assert fin_res.status_code == 200
    fin = fin_res.json()
    assert fin["status"] == "finalized"
    assert len(fin["documents"]) == 1
    doc_id = fin["documents"][0]["id"]

    # 7. Document is now visible in customer library
    docs = client.get("/api/v1/customer/documents", headers=headers).json()
    assert any(d["id"] == doc_id for d in docs)

    # 8. Deleting document frees active storage but retains daily admission
    del_res = client.delete(f"/api/v1/customer/documents/{doc_id}", headers=headers)
    assert del_res.status_code == 200
    usage_deleted = client.get("/api/v1/customer/storage-usage", headers=headers).json()
    assert usage_deleted["active_storage_bytes"] == 0
    assert usage_deleted["daily_charged_admission_bytes"] == len(pdf_bytes)


def test_customer_isolation_and_cross_principal_denial(client):
    headers_a = customer_auth(client, email="user_a@example.com")
    headers_b = customer_auth(client, email="user_b@example.com")

    # User A creates a batch
    batch_a = client.post("/api/v1/uploads/batches", headers=headers_a, json={
        "purpose": "customer_library",
        "items": [{"name": "secret.pdf", "size_bytes": 1000, "mime_type": "application/pdf"}]
    }).json()
    item_a_id = batch_a["items"][0]["id"]

    # User B cannot get permission for User A's item
    res_b_perm = client.post(f"/api/v1/uploads/items/{item_a_id}/permission", headers=headers_b)
    assert res_b_perm.status_code == 403

    # User B cannot complete User A's item
    res_b_comp = client.post(f"/api/v1/uploads/items/{item_a_id}/complete", headers=headers_b)
    assert res_b_comp.status_code == 403

    # User B cannot view User A's batch
    res_b_batch = client.get(f"/api/v1/uploads/batches/{batch_a['batch_id']}", headers=headers_b)
    assert res_b_batch.status_code == 404

    # User B cannot finalize User A's batch
    res_b_fin = client.post(f"/api/v1/uploads/batches/{batch_a['batch_id']}/finalize", headers=headers_b)
    assert res_b_fin.status_code == 404

    # User B cannot cancel User A's batch
    res_b_can = client.post(f"/api/v1/uploads/batches/{batch_a['batch_id']}/cancel", headers=headers_b)
    assert res_b_can.status_code == 404


def test_invalid_file_rejected_and_reservation_released(client):
    headers = customer_auth(client, email="invalid_uploader@example.com")

    batch = client.post("/api/v1/uploads/batches", headers=headers, json={
        "purpose": "customer_library",
        "items": [{"name": "corrupt.pdf", "size_bytes": 500, "mime_type": "application/pdf"}]
    }).json()
    item_id = batch["items"][0]["id"]
    q_path = batch["items"][0]["quarantine_path"]

    # Get permission
    client.post(f"/api/v1/uploads/items/{item_id}/permission", headers=headers)

    # Write corrupt non-PDF bytes to quarantine
    corrupt_file = Path(settings.TEMP_STORAGE_DIR).resolve() / q_path
    corrupt_file.parent.mkdir(parents=True, exist_ok=True)
    corrupt_file.write_bytes(b"NOT A REAL PDF FILE HEADER")

    # Complete must fail with 422
    res_comp = client.post(f"/api/v1/uploads/items/{item_id}/complete", headers=headers)
    assert res_comp.status_code == 422

    # Reservation must be released upon rejection
    usage = client.get("/api/v1/customer/storage-usage", headers=headers).json()
    assert usage["outstanding_reservation_bytes"] == 0
    assert usage["active_storage_bytes"] == 0


def test_guest_direct_print_flow(client):
    # 1. Create guest session
    sess_res = client.post("/api/v1/uploads/guest-session", json={
        "shop_id": "shop-demo-1",
        "captcha_token": "valid-token"
    })
    assert sess_res.status_code == 200
    guest_token = sess_res.json()["guest_token"]
    guest_headers = {"X-Guest-Session": guest_token}

    # 2. Create batch
    pdf_bytes = create_test_pdf_bytes(1)
    batch_res = client.post("/api/v1/uploads/batches", headers=guest_headers, json={
        "purpose": "transient_print_job",
        "access_mode": "ephemeral",
        "shop_id": "shop-demo-1",
        "items": [{"name": "flyer.pdf", "size_bytes": len(pdf_bytes), "mime_type": "application/pdf"}],
        "print_config": {"color": False, "copies": 1, "duplex": False}
    })
    assert batch_res.status_code == 200
    batch = batch_res.json()
    item = batch["items"][0]

    # 3. Get permission
    perm = client.post(f"/api/v1/uploads/items/{item['id']}/permission", headers=guest_headers).json()
    assert "upload_url" in perm

    # 4. Upload bytes
    q_file = Path(settings.TEMP_STORAGE_DIR).resolve() / item["quarantine_path"]
    q_file.parent.mkdir(parents=True, exist_ok=True)
    q_file.write_bytes(pdf_bytes)

    # 5. Complete
    comp = client.post(f"/api/v1/uploads/items/{item['id']}/complete", headers=guest_headers).json()
    assert comp["status"] == "accepted"

    # 6. Finalize -> stages transient print job with checkout token
    fin = client.post(f"/api/v1/uploads/batches/{batch['batch_id']}/finalize", headers=guest_headers).json()
    assert fin["status"] == "finalized"
    assert fin["job"] is not None
    job = fin["job"]
    assert job["job_status"] == "staged"
    assert job["payment_status"] == "pending"
    assert "checkout_token" in job
    assert job["total_cost"] > 0


def test_folder_multi_file_merge_deterministic_single_pdf(client):
    headers = customer_auth(client, email="folder_uploader@example.com")
    pdf1 = create_test_pdf_bytes(1)
    pdf2 = create_test_pdf_bytes(2)

    batch_req = {
        "purpose": "transient_print_job",
        "access_mode": "ephemeral",
        "shop_id": "shop-demo-1",
        "items": [
            {"name": "file_b.pdf", "size_bytes": len(pdf2), "mime_type": "application/pdf"},
            {"name": "file_a.pdf", "size_bytes": len(pdf1), "mime_type": "application/pdf"},
        ],
        "print_config": {"color": False, "copies": 1, "duplex": False}
    }
    batch = client.post("/api/v1/uploads/batches", headers=headers, json=batch_req).json()
    assert len(batch["items"]) == 2

    for it, content in zip(batch["items"], [pdf2, pdf1]):
        client.post(f"/api/v1/uploads/items/{it['id']}/permission", headers=headers)
        q_file = Path(settings.TEMP_STORAGE_DIR).resolve() / it["quarantine_path"]
        q_file.parent.mkdir(parents=True, exist_ok=True)
        q_file.write_bytes(content)
        comp = client.post(f"/api/v1/uploads/items/{it['id']}/complete", headers=headers).json()
        assert comp["status"] == "accepted"

    fin = client.post(f"/api/v1/uploads/batches/{batch['batch_id']}/finalize", headers=headers).json()
    assert fin["status"] == "finalized"
    job = fin["job"]
    # Total merged pages = 1 + 2 = 3 pages
    assert job["page_count"] == 3
    assert "folder-merge-2-files.pdf" in job["file_name"]
    assert job["document_id"] is not None


def test_idempotency_key_replay_and_conflict(client):
    headers = customer_auth(client, email="idempotent_uploader@example.com")
    items_orig = [{"name": "test.pdf", "size_bytes": 1000, "mime_type": "application/pdf"}]

    req = {
        "purpose": "customer_library",
        "idempotency_key": "idemp-key-999",
        "items": items_orig
    }

    # First call creates batch
    b1 = client.post("/api/v1/uploads/batches", headers=headers, json=req).json()
    assert b1["batch_id"] is not None

    # Replay with same manifest returns identical batch
    b2 = client.post("/api/v1/uploads/batches", headers=headers, json=req).json()
    assert b2["batch_id"] == b1["batch_id"]

    # Replay with different manifest causes 409 Conflict
    req_modified = {
        "purpose": "customer_library",
        "idempotency_key": "idemp-key-999",
        "items": [{"name": "tampered.pdf", "size_bytes": 2000, "mime_type": "application/pdf"}]
    }
    b3 = client.post("/api/v1/uploads/batches", headers=headers, json=req_modified)
    assert b3.status_code == 409


def test_batch_cancellation_releases_reservation_and_cleans_storage(client):
    headers = customer_auth(client, email="canceller@example.com")
    pdf_bytes = create_test_pdf_bytes(1)

    batch = client.post("/api/v1/uploads/batches", headers=headers, json={
        "purpose": "customer_library",
        "items": [{"name": "abandon.pdf", "size_bytes": len(pdf_bytes), "mime_type": "application/pdf"}]
    }).json()

    # Reservation was applied (25 MiB)
    u1 = client.get("/api/v1/customer/storage-usage", headers=headers).json()
    assert u1["outstanding_reservation_bytes"] == 26214400

    # Cancel batch
    can_res = client.post(f"/api/v1/uploads/batches/{batch['batch_id']}/cancel", headers=headers)
    assert can_res.status_code == 200
    assert can_res.json()["cancelled"] is True

    # Quota is immediately freed
    u2 = client.get("/api/v1/customer/storage-usage", headers=headers).json()
    assert u2["outstanding_reservation_bytes"] == 0
    assert u2["active_storage_bytes"] == 0

