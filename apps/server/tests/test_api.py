import pytest
import io
from fastapi.testclient import TestClient
from app.main import app
from app.api.v1.jobs import JOBS_DB
from app.core.security import rate_limiter

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_state():
    JOBS_DB.clear()
    rate_limiter._attempts.clear()
    yield
    JOBS_DB.clear()
    rate_limiter._attempts.clear()


def test_root_and_health():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "online"
    
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"


def test_get_shop_details():
    res = client.get("/api/v1/shops/shop-demo-1")
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "QuickPrint Express - Hub 1"
    assert data["base_bw_rate"] == 2.00
    assert data["base_color_rate"] == 10.00
    assert len(data["printers"]) == 2


def test_cost_calculation():
    # 10 pages, B&W (2.0/pg), simplex -> 20.0
    res = client.post(
        "/api/v1/jobs/calculate-cost",
        data={
            "shop_id": "shop-demo-1",
            "page_count": 10,
            "copy_count": 1,
            "is_color": False,
            "duplex_mode": "simplex",
            "layout_nup": 1
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_cost"] == 20.00
    assert data["sheets_per_copy"] == 10

    # 10 pages, Color (10.0/pg), Duplex Long (0.50 discount per sheet) -> 5 sheets * 20.0 - 5 * 0.5 = 97.50
    res_color = client.post(
        "/api/v1/jobs/calculate-cost",
        data={
            "shop_id": "shop-demo-1",
            "page_count": 10,
            "copy_count": 1,
            "is_color": True,
            "duplex_mode": "duplex_long",
            "layout_nup": 1
        }
    )
    assert res_color.status_code == 200
    assert res_color.json()["total_cost"] == 97.50


def test_end_to_end_job_lifecycle():
    # 1. Stage Job with File Upload
    file_bytes = b"%PDF-1.4 Mock PDF binary stream for testing"
    res_stage = client.post(
        "/api/v1/jobs/stage",
        data={
            "shop_id": "shop-demo-1",
            "page_count": 4,
            "copy_count": 1,
            "is_color": False,
            "duplex_mode": "simplex",
            "layout_nup": 1
        },
        files={"file": ("test_doc.pdf", io.BytesIO(file_bytes), "application/pdf")}
    )
    assert res_stage.status_code == 200
    staged_data = res_stage.json()
    job_id = staged_data["job_id"]
    assert staged_data["job_status"] == "staged"
    assert staged_data["total_cost"] == 8.00

    # 2. Verify Payment
    res_pay = client.post(
        "/api/v1/jobs/verify-payment",
        json={
            "job_id": job_id,
            "payment_id": "pay_mock_12345",
            "payment_method": "UPI_QR"
        }
    )
    assert res_pay.status_code == 200
    pay_data = res_pay.json()
    release_token = pay_data["release_token"]
    assert len(release_token) == 4
    assert pay_data["job_status"] == "queued"

    # 3. Counter Token Release Verification
    res_token = client.post(
        "/api/v1/jobs/verify-token",
        json={
            "shop_id": "shop-demo-1",
            "token": release_token
        }
    )
    assert res_token.status_code == 200
    token_data = res_token.json()
    assert token_data["job_id"] == job_id
    assert "download_url" in token_data

    # 4. Complete & Cloud Ephemeral Shred
    res_complete = client.post(
        f"/api/v1/jobs/{job_id}/complete",
        json={"job_id": job_id, "status": "completed"}
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["shredded"] is True


def test_rate_limiting_on_invalid_token():
    # 3 failed attempts should trigger 429 lockout
    for attempt in range(1, 4):
        res = client.post(
            "/api/v1/jobs/verify-token",
            json={
                "shop_id": "shop-demo-1",
                "token": "0000"
            }
        )
        if attempt < 3:
            assert res.status_code == 400
        else:
            assert res.status_code == 429
            assert "locked" in res.json()["detail"]
