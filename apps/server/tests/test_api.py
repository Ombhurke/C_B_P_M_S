import io
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid5, NAMESPACE_URL

import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from pypdf import PdfWriter

from app.main import app
from app.core.config import settings
from app.core.database import db, Database
from app.core.auth import password_hash
from app.services.payments import MockProvider, Receipt, get_provider
from app.services.storage_service import storage_service


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "test")
    monkeypatch.setattr(settings, "SEED_DEMO_SHOPS", True)
    monkeypatch.setattr(settings, "ALLOW_LOCAL_STORAGE", True)
    monkeypatch.setattr(settings, "DATABASE_URL", "sqlite:///" + (tmp_path / "test.db").as_posix())
    monkeypatch.setattr(settings, "TEMP_STORAGE_DIR", str(tmp_path / "files"))
    monkeypatch.setattr(settings, "SUPABASE_URL", None)
    monkeypatch.setattr(settings, "BOOTSTRAP_ADMIN_USERNAME", "admin")
    monkeypatch.setattr(settings, "BOOTSTRAP_ADMIN_PASSWORD", "test-password-only-123")
    monkeypatch.setattr(settings, "BOOTSTRAP_SHOP_ID", "shop-demo-1")
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "mock")
    monkeypatch.setattr(settings, "ALLOW_MOCK_PAYMENTS", True)
    storage_service.client = None
    with TestClient(app) as api:
        api.identities = {}
        def identity(token):
            if token not in api.identities:
                raise HTTPException(401, "Invalid Google token")
            return api.identities[token]
        monkeypatch.setattr("app.core.google_auth.fetch_supabase_user", identity)
        yield api


def auth(client, username="admin", password="test-password-only-123"):
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def customer_auth(client, email="customer@example.com", password="customer-password-123"):
    user_id = str(uuid5(NAMESPACE_URL, email))
    token = "test." + user_id + ".signature"
    client.identities[token] = {"id": user_id, "email": email, "email_confirmed_at": "2026-01-01T00:00:00Z",
                              "app_metadata": {"providers": ["google"]}}
    return {"Authorization": "Bearer " + token}


def stage_with_headers(client, headers, access_mode="account", shop_id="shop-demo-1"):
    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    content = io.BytesIO()
    writer.write(content)
    response = client.post("/api/v1/jobs/stage", headers=headers,
        data={"shop_id": shop_id, "page_count": 1, "copy_count": 1, "access_mode": access_mode},
        files={"file": ("library.pdf", content.getvalue(), "application/pdf")})
    assert response.status_code == 200, response.text
    return response.json()


def stage(client, shop_id="shop-demo-1", pages=4):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595, height=842)
    content = io.BytesIO()
    writer.write(content)
    response = client.post("/api/v1/jobs/stage",
        data={"shop_id": shop_id, "page_count": 1, "copy_count": 1},
        files={"file": ("document.pdf", content.getvalue(), "application/pdf")})
    assert response.status_code == 200, response.text
    return response.json()


def pay(client, job):
    headers = {"X-Checkout-Token": job["checkout_token"]}
    order = client.post(f"/api/v1/payments/{job['job_id']}/order", headers=headers)
    assert order.status_code == 200
    response = client.post(f"/api/v1/payments/{job['job_id']}/mock-confirm",
                           headers=headers, json={"order_id": order.json()["id"]})
    assert response.status_code == 200, response.text
    return response.json(), order.json()


def claim(client, receipt, headers):
    return client.post("/api/v1/jobs/verify-token", headers=headers,
                       json={"shop_id": receipt["shop_id"], "token": receipt["release_token"]})


def complete(client, job, headers, status="completed"):
    return client.post(f"/api/v1/jobs/{job['job_id']}/complete", headers=headers,
                       json={"job_id": job["job_id"], "status": status})


def test_lifecycle_and_authoritative_price(client):
    headers = auth(client)
    job = stage(client)
    assert job["page_count"] == 4 and job["total_cost"] == 8
    receipt, _ = pay(client, job)
    result = claim(client, receipt, headers)
    assert result.status_code == 200
    assert client.get(result.json()["download_url"]).content.startswith(b"%PDF")
    assert complete(client, job, headers).json()["shredded"] is True
    assert client.get(result.json()["download_url"]).status_code == 403
    assert not list(Path(settings.TEMP_STORAGE_DIR).iterdir())


def test_payment_is_idempotent_and_cannot_reset_completed_job(client):
    job = stage(client)
    receipt, first_order = pay(client, job)
    second, second_order = pay(client, job)
    assert first_order == second_order and receipt["release_token"] == second["release_token"]
    headers = auth(client)
    claim(client, receipt, headers)
    complete(client, job, headers)
    third, _ = pay(client, job)
    assert third["job_status"] == "completed"
    assert third["release_token"] == receipt["release_token"]


def test_payment_ownership_and_client_supplied_id_rejected(client):
    job = stage(client)
    other = stage(client)
    url = f"/api/v1/payments/{job['job_id']}"
    assert client.post(url + "/order", headers={"X-Checkout-Token": other["checkout_token"]}).status_code == 403
    assert client.post("/api/v1/jobs/verify-payment", json={"job_id": job["job_id"], "payment_id": "fake"}).status_code == 404
    _, order = pay(client, job)
    headers = {"X-Checkout-Token": job["checkout_token"]}
    assert client.post(url + "/mock-confirm", headers=headers, json={"order_id": "wrong"}).status_code == 409
    assert client.post(url + "/mock-confirm", headers=headers, json={"order_id": order["id"], "payment_id": "fake"}).status_code == 422


def test_provider_amount_mismatch_cannot_release_job(client, monkeypatch):
    job = stage(client)
    headers = {"X-Checkout-Token": job["checkout_token"]}
    order = client.post(f"/api/v1/payments/{job['job_id']}/order", headers=headers).json()
    monkeypatch.setattr(MockProvider, "verify_capture", lambda self, o: Receipt(o["id"], "fake", 1, o["currency"], True))
    response = client.post(f"/api/v1/payments/{job['job_id']}/mock-confirm",
                           headers=headers, json={"order_id": order["id"]})
    assert response.status_code == 409
    with db.transaction() as records:
        assert records.get("jobs", job["job_id"])["payment_status"] == "pending"


def test_live_provider_never_falls_back(client, monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "razorpay")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "")
    with pytest.raises(HTTPException) as error:
        get_provider()
    assert error.value.status_code == 503

    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_dummy")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "dummy_secret")
    provider = get_provider()
    assert provider.name == "razorpay"


def test_auth_scope_and_revocation(client):
    headers = auth(client)
    assert client.get("/api/v1/jobs/queue/shop-demo-1").status_code == 401
    assert client.get("/api/v1/jobs/queue/shop-demo-2", headers=headers).status_code == 403
    assert client.patch("/api/v1/shops/shop-demo-2", headers=headers, json={"base_bw_rate": 3}).status_code == 403
    client.post("/api/v1/auth/logout", headers=headers)
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_operator_cannot_change_rates(client):
    headers = auth(client)
    user = {"username": "operator", "password": "operator-password-123", "role": "operator"}
    assert client.post("/api/v1/auth/users", headers=headers, json=user).status_code == 201
    operator = auth(client, "operator", user["password"])
    assert client.patch("/api/v1/shops/shop-demo-1", headers=operator, json={"base_bw_rate": 4}).status_code == 403
    assert client.get("/api/v1/jobs/queue/shop-demo-1", headers=operator).status_code == 200


def test_rates_are_durable_and_staged_price_is_locked(client):
    headers = auth(client)
    job = stage(client)
    response = client.patch("/api/v1/shops/shop-demo-1", headers=headers, json={"base_bw_rate": 5})
    assert response.status_code == 200
    second_connection = Database()
    second_connection.initialize(settings.DATABASE_URL)
    try:
        with second_connection.transaction() as records:
            assert records.get("shops", "shop-demo-1")["base_bw_rate"] == 5
            assert records.get("jobs", job["job_id"])["total_cost"] == 8
    finally:
        second_connection.close()
    assert pay(client, job)[1]["amount_minor"] == 800


def test_restart_preserves_jobs_files_sessions_and_rates(client):
    job = stage(client)
    receipt, _ = pay(client, job)
    headers = auth(client)
    # Dispose the entire engine, then recreate it from the same persistent database.
    db.close()
    db.initialize(settings.DATABASE_URL)
    result = claim(client, receipt, headers)
    assert result.status_code == 200
    assert client.get(result.json()["download_url"]).status_code == 200


def test_failed_print_retains_file_for_retry(client):
    job = stage(client)
    receipt, _ = pay(client, job)
    headers = auth(client)
    claim(client, receipt, headers)
    response = complete(client, job, headers, "failed")
    assert response.json()["shredded"] is False
    assert len(list(Path(settings.TEMP_STORAGE_DIR).iterdir())) == 1
    assert claim(client, receipt, headers).status_code == 200


def test_atomic_claim_prevents_duplicate_release(client):
    job = stage(client)
    receipt, _ = pay(client, job)
    headers = auth(client)
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: claim(client, receipt, headers), range(2)))
    assert sorted(r.status_code for r in responses) == [200, 400]


def test_atomic_payment_confirmation(client):
    job = stage(client)
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: pay(client, job), range(2)))
    assert responses[0][0]["release_token"] == responses[1][0]["release_token"]
    assert responses[0][1] == responses[1][1]


def test_expired_checkout_and_download_rejected(client):
    job = stage(client)
    receipt, _ = pay(client, job)
    headers = auth(client)
    release = claim(client, receipt, headers).json()
    with db.transaction() as records:
        stored = records.get("jobs", job["job_id"])
        stored.update(download_until=time.time() - 1, expires_at_epoch=time.time() - 1)
        records.put("jobs", job["job_id"], stored)
    assert client.get(release["download_url"]).status_code == 403
    assert client.post(f"/api/v1/payments/{job['job_id']}/order",
                       headers={"X-Checkout-Token": job["checkout_token"]}).status_code == 409


def test_pending_cleanup_retried(client, monkeypatch):
    from app.services.cleanup_service import cleanup_service
    job = stage(client)
    receipt, _ = pay(client, job)
    headers = auth(client)
    claim(client, receipt, headers)
    original = storage_service.purge
    monkeypatch.setattr(storage_service, "purge", lambda job: False)
    assert complete(client, job, headers).json()["shredded"] is False
    monkeypatch.setattr(storage_service, "purge", original)
    client.portal.call(cleanup_service.sweep)
    with db.transaction() as records:
        assert records.get("jobs", job["job_id"])["cleanup_pending"] is False


def test_expiry_cleanup_after_restart(client):
    from app.services.cleanup_service import cleanup_service
    job = stage(client)
    with db.transaction() as records:
        stored = records.get("jobs", job["job_id"])
        stored["expires_at_epoch"] = time.time() - 1
        records.put("jobs", job["job_id"], stored)
    db.close()
    db.initialize(settings.DATABASE_URL)
    client.portal.call(cleanup_service.sweep)
    with db.transaction() as records:
        assert records.get("jobs", job["job_id"])["job_status"] == "expired"
    assert not list(Path(settings.TEMP_STORAGE_DIR).iterdir())


def test_queue_hides_checkout_and_release_secrets(client):
    job = stage(client)
    pay(client, job)
    response = client.get("/api/v1/jobs/queue/shop-demo-1", headers=auth(client))
    assert len(response.json()) == 1
    assert "release_token" not in response.text
    assert "checkout" not in response.text and "file_path" not in response.text


def test_websocket_auth_and_events(client):
    headers = auth(client)
    token = headers["Authorization"].removeprefix("Bearer ")
    with client.websocket_connect("/ws/queue/shop-demo-1") as socket:
        socket.send_json({"token": token})
        assert socket.receive_json()["event"] == "CONNECTED"
        pay(client, stage(client))
        assert socket.receive_json()["event"] == "JOB_QUEUED"
    with client.websocket_connect("/ws/queue/shop-demo-2") as socket:
        socket.send_json({"token": token})
        assert socket.receive()["type"] == "websocket.close"
    with client.websocket_connect("/ws/queue/shop-demo-1") as socket:
        socket.send_json({"token": "invalid"})
        assert socket.receive()["type"] == "websocket.close"


def test_rate_limiter_survives_restart(client):
    headers = auth(client)
    for index in range(3):
        response = client.post("/api/v1/jobs/verify-token", headers=headers,
                               json={"shop_id": "shop-demo-1", "token": "0000"})
        assert response.status_code == (429 if index == 2 else 400)
    db.close()
    db.initialize(settings.DATABASE_URL)
    assert client.post("/api/v1/jobs/verify-token", headers=headers,
                       json={"shop_id": "shop-demo-1", "token": "0000"}).status_code == 429


def test_validation_and_no_fake_uploads(client):
    assert client.post("/api/v1/jobs/calculate-cost",
        data={"shop_id": "shop-demo-1", "page_count": 1, "layout_nup": 0}).status_code == 422
    assert client.post("/api/v1/jobs/stage",
        data={"shop_id": "shop-demo-1", "page_count": 2},
        files={"file": ("fake.pdf", b"not a document", "application/pdf")}).status_code == 422
    assert client.patch("/api/v1/shops/shop-demo-1", headers=auth(client),
                        json={"base_bw_rate": -1}).status_code == 422
    assert not list(Path(settings.TEMP_STORAGE_DIR).iterdir())


def test_odd_duplex_does_not_charge_blank_side(client):
    response = client.post("/api/v1/jobs/calculate-cost",
        data={"shop_id": "shop-demo-1", "page_count": 3, "duplex_mode": "duplex_long"})
    assert response.json()["total_cost"] == 5.50


def test_customer_account_mode_library_and_job_isolation(client):
    customer = customer_auth(client)
    job = stage_with_headers(client, customer)
    assert job["access_mode"] == "account"
    documents = client.get("/api/v1/customer/documents", headers=customer)
    assert documents.status_code == 200 and len(documents.json()) == 1
    assert documents.json()[0]["id"] == job["document_id"]
    assert client.get("/api/v1/customer/jobs", headers=customer).json()[0]["job_id"] == job["job_id"]

    pay(client, job)
    operator = auth(client)
    shop_queue = client.get("/api/v1/jobs/queue/shop-demo-1", headers=operator)
    other_queue = client.get("/api/v1/jobs/queue/shop-demo-2", headers=operator)
    assert shop_queue.status_code == 200 and any(item["id"] == job["job_id"] for item in shop_queue.json())
    assert other_queue.status_code == 403
    assert "owner_username" not in shop_queue.text and "checkout_hash" not in shop_queue.text

    other = customer_auth(client, "other@example.com")
    assert client.get("/api/v1/customer/documents", headers=other).json() == []
    assert client.get(f"/api/v1/customer/jobs/{job['job_id']}", headers=other).status_code == 404

    anonymous = stage(client)
    assert len(client.get("/api/v1/customer/documents", headers=customer).json()) == 1
    assert client.get(f"/api/v1/jobs/{anonymous['job_id']}/status").status_code == 403
    assert client.get(f"/api/v1/jobs/{anonymous['job_id']}/status",
                      headers={"X-Checkout-Token": anonymous["checkout_token"]}).status_code == 200


def test_account_mode_requires_customer_session_and_retains_library_file(client):
    writer = PdfWriter(); writer.add_blank_page(width=595, height=842); content = io.BytesIO(); writer.write(content)
    rejected = client.post("/api/v1/jobs/stage", data={"shop_id": "shop-demo-1", "page_count": 1, "copy_count": 1, "access_mode": "account"},
                           files={"file": ("library.pdf", content.getvalue(), "application/pdf")})
    assert rejected.status_code == 401

    customer = customer_auth(client)
    job = stage_with_headers(client, customer)
    receipt, _ = pay(client, job)
    operator = auth(client)
    assert claim(client, receipt, operator).status_code == 200
    result = complete(client, job, operator)
    assert result.json()["shredded"] is False
    with db.transaction() as records:
        stored = records.get("jobs", job["job_id"])
        assert stored["file_path"] and Path(stored["file_path"]).is_file()
    assert client.get("/api/v1/customer/documents", headers=customer).status_code == 200
    document_id = job["document_id"]
    assert client.delete(f"/api/v1/customer/documents/{document_id}", headers=customer).status_code == 200
    assert not list(Path(settings.TEMP_STORAGE_DIR).iterdir())


def test_customer_job_status_accepts_owner_or_capability_only(client):
    customer = customer_auth(client)
    job = stage_with_headers(client, customer)
    assert client.get(f"/api/v1/jobs/{job['job_id']}/status", headers=customer).status_code == 200
    assert client.get(f"/api/v1/jobs/{job['job_id']}/status").status_code == 403
    anonymous = stage(client)
    assert client.get(f"/api/v1/jobs/{anonymous['job_id']}/status", headers=customer).status_code == 403


def test_customer_account_delete_rejects_active_job_then_removes_identity(client):
    customer = customer_auth(client)
    job = stage_with_headers(client, customer)
    assert client.delete("/api/v1/auth/me", headers=customer).status_code == 409
    with db.transaction() as records:
        stored = records.get("jobs", job["job_id"])
        stored["job_status"] = "completed"
        records.put("jobs", job["job_id"], stored)
    assert client.delete("/api/v1/auth/me", headers=customer).status_code == 200
    assert client.get("/api/v1/auth/me", headers=customer).status_code == 403


def test_shop_activity_is_scoped_and_contains_state_changes(client):
    job = stage(client)
    pay(client, job)
    operator = auth(client)
    activity = client.get("/api/v1/shops/shop-demo-1/activity", headers=operator)
    assert activity.status_code == 200
    actions = {event["action"] for event in activity.json()}
    assert "job.stage" in actions and "payment.mock_completed" in actions
    assert client.get("/api/v1/shops/shop-demo-2/activity", headers=operator).status_code == 403


def test_operator_job_rejection_and_audit(client):
    job = stage(client)
    operator = auth(client)
    res = client.post(f"/api/v1/shops/shop-demo-1/jobs/{job['job_id']}/reject",
                      json={"reason": "Out of stock paper", "note": "Only normal paper left"},
                      headers=operator)
    assert res.status_code == 200
    assert res.json()["job_status"] == "failed"
    with db.transaction() as records:
        stored = records.get("jobs", job["job_id"])
        assert stored["job_status"] == "failed"
        assert stored["rejection_reason"] == "Out of stock paper"


def test_station_and_printer_management_endpoints(client):
    operator = auth(client)
    # Register printer
    p_res = client.post("/api/v1/shops/shop-demo-1/printers",
                        json={"device_name": "HP Tank 580", "max_paper_size": "A4", "is_color_supported": True, "is_duplex_supported": True},
                        headers=operator)
    assert p_res.status_code == 201
    assert p_res.json()["device_name"] == "HP Tank 580"

    # Pair station
    s_res = client.post("/api/v1/shops/shop-demo-1/stations",
                        json={"name": "Counter Station 1", "location": "Front Desk"},
                        headers=operator)
    assert s_res.status_code == 201
    assert s_res.json()["name"] == "Counter Station 1"

    # List stations
    list_res = client.get("/api/v1/shops/shop-demo-1/stations", headers=operator)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1


def test_job_confirm_output_and_report_issue_endpoints(client):
    job = stage(client)
    receipt, _ = pay(client, job)
    operator = auth(client)
    claim_res = claim(client, receipt, operator)
    assert claim_res.status_code == 200

    # Test report issue
    issue_res = client.post(f"/api/v1/jobs/{job['job_id']}/report-issue",
                            json={"issue_type": "paper_jam", "details": "Tray 2 jammed"},
                            headers=operator)
    assert issue_res.status_code == 200
    assert issue_res.json()["status"] == "failed"
    assert issue_res.json()["retained_for_retry"] is True

    # Test confirm output
    confirm_res = client.post(f"/api/v1/jobs/{job['job_id']}/confirm-output",
                              json={"notes": "Reprinted and collected by customer"},
                              headers=operator)
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "completed"
    assert confirm_res.json()["output_confirmed"] is True


def test_customer_calculate_cost_paper_matrix_and_nup(client):
    # 1. Normal Paper B&W Simplex: 1 page -> ₹2
    res = client.post("/api/v1/jobs/calculate-cost", data={
        "shop_id": "shop-demo-1", "page_count": 1, "copy_count": 1,
        "is_color": False, "duplex_mode": "simplex", "layout_nup": 1, "paper_type": "normal"
    })
    assert res.status_code == 200
    assert res.json()["total_cost"] == 2.0

    # 2. Normal Paper B&W Duplex on shop-demo-1 (legacy discount 0.5): 2 pages -> ₹3.50
    res_duplex = client.post("/api/v1/jobs/calculate-cost", data={
        "shop_id": "shop-demo-1", "page_count": 2, "copy_count": 1,
        "is_color": False, "duplex_mode": "duplex_long", "layout_nup": 1, "paper_type": "normal"
    })
    assert res_duplex.status_code == 200
    assert res_duplex.json()["total_cost"] == 3.50

    # 3. Bond Paper B&W Simplex: 1 page -> ₹3
    res_bond = client.post("/api/v1/jobs/calculate-cost", data={
        "shop_id": "shop-demo-1", "page_count": 1, "copy_count": 1,
        "is_color": False, "duplex_mode": "simplex", "layout_nup": 1, "paper_type": "bond"
    })
    assert res_bond.status_code == 200
    assert res_bond.json()["total_cost"] == 3.0

    # 4. Bond Paper B&W Duplex: 2 pages -> ₹5
    res_bond_duplex = client.post("/api/v1/jobs/calculate-cost", data={
        "shop_id": "shop-demo-1", "page_count": 2, "copy_count": 1,
        "is_color": False, "duplex_mode": "duplex_long", "layout_nup": 1, "paper_type": "bond"
    })
    assert res_bond_duplex.status_code == 200
    assert res_bond_duplex.json()["total_cost"] == 5.0

    # 5. N-Up 4 (4 pages onto 1 physical sheet) -> no extra layout fee
    res_nup = client.post("/api/v1/jobs/calculate-cost", data={
        "shop_id": "shop-demo-1", "page_count": 4, "copy_count": 1,
        "is_color": False, "duplex_mode": "simplex", "layout_nup": 4, "paper_type": "normal"
    })
    assert res_nup.status_code == 200
    assert res_nup.json()["total_cost"] == 2.0

    # 6. Configured paper_rates on shop: ₹2 single, ₹3 duplex
    with db.transaction() as records:
        s = records.get("shops", "shop-demo-1")
        s["paper_rates"] = {"normal": {"bw_single": 2.0, "bw_duplex": 3.0}}
        records.put("shops", "shop-demo-1", s)
    res_configured = client.post("/api/v1/jobs/calculate-cost", data={
        "shop_id": "shop-demo-1", "page_count": 2, "copy_count": 1,
        "is_color": False, "duplex_mode": "duplex_long", "layout_nup": 1, "paper_type": "normal"
    })
    assert res_configured.status_code == 200
    assert res_configured.json()["total_cost"] == 3.0


def test_client_quoted_cost_verification_at_checkout(client):
    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    content = io.BytesIO()
    writer.write(content)
    pdf_bytes = content.getvalue()

    # Test valid client quote matching server calculation (₹2.00 for 1 B&W page)
    res_valid = client.post("/api/v1/jobs/stage", data={
        "shop_id": "shop-demo-1", "page_count": 1, "copy_count": 1,
        "is_color": False, "duplex_mode": "simplex", "layout_nup": 1, "paper_type": "normal",
        "client_quoted_cost": 2.00
    }, files={"file": ("test.pdf", pdf_bytes, "application/pdf")})
    assert res_valid.status_code == 200
    assert res_valid.json()["total_cost"] == 2.00

    # Test tampered/mismatched client quote (attacker attempts ₹0.50 instead of ₹2.00)
    res_mismatch = client.post("/api/v1/jobs/stage", data={
        "shop_id": "shop-demo-1", "page_count": 1, "copy_count": 1,
        "is_color": False, "duplex_mode": "simplex", "layout_nup": 1, "paper_type": "normal",
        "client_quoted_cost": 0.50
    }, files={"file": ("test.pdf", pdf_bytes, "application/pdf")})
    assert res_mismatch.status_code == 409
    assert "Quote mismatch" in res_mismatch.json()["detail"]


def test_security_unpaid_job_cannot_be_confirmed_or_reported(client):
    operator = auth(client)
    job = stage(client)
    # 1. Unpaid job cannot be confirmed
    unpaid_confirm = client.post(f"/api/v1/jobs/{job['job_id']}/confirm-output",
                                 headers=operator, json={"notes": "premature confirmation"})
    assert unpaid_confirm.status_code == 402

    # 2. Pay and queue job
    receipt, _ = pay(client, job)
    # 3. Now it can be confirmed
    paid_confirm = client.post(f"/api/v1/jobs/{job['job_id']}/confirm-output",
                               headers=operator, json={"notes": "verified print"})
    assert paid_confirm.status_code == 200
    assert paid_confirm.json()["status"] == "completed"

    # 4. Completed job cannot be rejected
    rejected = client.post(f"/api/v1/shops/shop-demo-1/jobs/{job['job_id']}/reject",
                           headers=operator, json={"reason": "too late"})
    assert rejected.status_code == 409


def test_security_team_member_reserved_username(client):
    admin = auth(client)
    res = client.post("/api/v1/shops/shop-demo-1/team", headers=admin, json={
        "username": "supabase:attacker",
        "password": "Password12345!",
        "role": "operator"
    })
    assert res.status_code == 422


def test_security_customer_upload_filename_sanitization(client):
    customer = customer_auth(client)
    writer = PdfWriter(); writer.add_blank_page(width=595, height=842); content = io.BytesIO(); writer.write(content)
    res = client.post("/api/v1/customer/documents", headers=customer,
                      files={"file": ("../../traversal_doc.pdf", content.getvalue(), "application/pdf")})
    assert res.status_code == 200
    doc = res.json()
    assert doc["file_name"] == "traversal_doc.pdf"
    assert "/" not in doc["file_name"] and "\\" not in doc["file_name"]


def test_pay_at_counter_flow(client):
    headers = auth(client)
    job = stage(client)
    res = client.post(
        f"/api/v1/payments/{job['job_id']}/pay-at-counter",
        headers={"X-Checkout-Token": job["checkout_token"]},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["payment_status"] == "pending"
    assert data["payment_method"] == "counter"
    assert data["job_status"] == "queued"
    assert len(data["release_token"]) == 4

    # Operator can verify release token at counter
    claim_res = client.post(
        "/api/v1/jobs/verify-token",
        headers=headers,
        json={"shop_id": "shop-demo-1", "token": data["release_token"]},
    )
    assert claim_res.status_code == 200
    assert claim_res.json()["payment_method"] == "counter"

    # Operator completes job, automatically marking payment completed
    comp_res = client.post(
        f"/api/v1/jobs/{job['job_id']}/complete",
        headers=headers,
        json={"job_id": job["job_id"], "status": "completed"},
    )
    assert comp_res.status_code == 200

    # Job is now completed and paid
    with db.transaction() as records:
        updated = records.get("jobs", job["job_id"])
        assert updated["job_status"] == "completed"
        assert updated["payment_status"] == "completed"


def test_razorpay_verification_flow(client, monkeypatch):
    import hmac, hashlib
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "razorpay")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_testkey")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "testsecret123")

    order_id = "order_test123"
    payment_id = "pay_test123456"

    # Mock httpx.Client post and get for Razorpay server API
    class MockRazorpayClient:
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def post(self, url, json=None, auth=None):
            class MockResp:
                status_code = 200
                def json(self):
                    return {
                        "id": order_id,
                        "amount": json.get("amount", 800),
                        "currency": "INR",
                    }
            return MockResp()
        def get(self, url, auth=None):
            class MockResp:
                status_code = 200
                def json(self):
                    return {
                        "id": payment_id,
                        "order_id": order_id,
                        "status": "captured",
                        "amount": 800,
                        "currency": "INR",
                    }
            return MockResp()

    monkeypatch.setattr("httpx.Client", MockRazorpayClient)

    job = stage(client)
    order_res = client.post(
        f"/api/v1/payments/{job['job_id']}/order",
        headers={"X-Checkout-Token": job["checkout_token"]},
    )
    assert order_res.status_code == 200
    order_data = order_res.json()
    assert order_data["key_id"] == "rzp_test_testkey"
    assert order_data["id"] == order_id

    sig = hmac.new(b"testsecret123", f"{order_id}|{payment_id}".encode("utf-8"), hashlib.sha256).hexdigest()

    verify_res = client.post(
        f"/api/v1/payments/{job['job_id']}/verify",
        headers={"X-Checkout-Token": job["checkout_token"]},
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": sig,
        },
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["payment_status"] == "completed"
    assert verify_data["payment_method"] == "razorpay"
    assert verify_data["job_status"] == "queued"
    assert len(verify_data["release_token"]) == 4


def test_database_auto_resolves_sslrootcert(monkeypatch):
    from app.core.database import Database
    from sqlalchemy.engine import make_url
    from sqlalchemy import create_engine as real_create_engine

    db_instance = Database()
    fake_url = "postgresql+psycopg://user:pass@localhost:5432/postgres?sslmode=verify-full&sslrootcert=D:/nonexistent/fake.crt"

    captured_urls = []

    def mock_create_engine(url, **kwargs):
        captured_urls.append(str(url))
        return real_create_engine("sqlite:///:memory:")

    monkeypatch.setattr("app.core.database.create_engine", mock_create_engine)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    try:
        db_instance.initialize(fake_url)
    except Exception:
        pass

    assert len(captured_urls) == 1
    parsed_captured = make_url(captured_urls[0])
    resolved_cert = parsed_captured.query.get("sslrootcert", "")
    assert "D:/nonexistent/fake.crt" not in resolved_cert
    assert "supabase-prod-ca-2021.crt" in resolved_cert or resolved_cert == "system"
