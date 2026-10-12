import io
from pypdf import PdfWriter

from test_api import client, customer_auth
from app.core.database import db


def create_test_pdf(pages=2):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595, height=842)
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()


def test_independent_customer_library_upload_and_listing(client):
    headers = customer_auth(client)
    pdf_bytes = create_test_pdf(pages=3)

    # 1. Unauthenticated request rejected
    rejected = client.post(
        "/api/v1/customer/documents",
        files={"file": ("lecture_notes.pdf", pdf_bytes, "application/pdf")},
    )
    assert rejected.status_code == 401

    # 2. Upload valid PDF
    upload_res = client.post(
        "/api/v1/customer/documents",
        headers=headers,
        files={"file": ("lecture_notes.pdf", pdf_bytes, "application/pdf")},
    )
    assert upload_res.status_code == 200
    doc = upload_res.json()
    assert doc["file_name"] == "lecture_notes.pdf"
    assert doc["page_count"] == 3
    assert doc["status"] == "available"
    assert doc["mime_type"] == "application/pdf"
    doc_id = doc["id"]

    # 3. List documents
    list_res = client.get("/api/v1/customer/documents", headers=headers)
    assert list_res.status_code == 200
    docs = list_res.json()
    assert any(d["id"] == doc_id for d in docs)

    # 4. Search and filter
    search_hit = client.get("/api/v1/customer/documents?q=lecture", headers=headers).json()
    assert len(search_hit) == 1
    assert search_hit[0]["id"] == doc_id

    search_miss = client.get("/api/v1/customer/documents?q=nonexistent", headers=headers).json()
    assert len(search_miss) == 0

    type_pdf = client.get("/api/v1/customer/documents?type=pdf", headers=headers).json()
    assert len(type_pdf) == 1

    type_img = client.get("/api/v1/customer/documents?type=image", headers=headers).json()
    assert len(type_img) == 0

    # 5. Get document by ID
    get_res = client.get(f"/api/v1/customer/documents/{doc_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["file_name"] == "lecture_notes.pdf"

    # 6. Isolated from another customer
    other_headers = customer_auth(client, email="second_customer@example.com")
    other_get = client.get(f"/api/v1/customer/documents/{doc_id}", headers=other_headers)
    assert other_get.status_code == 404
    other_list = client.get("/api/v1/customer/documents", headers=other_headers).json()
    assert not any(d["id"] == doc_id for d in other_list)

    # 7. Delete document
    del_res = client.delete(f"/api/v1/customer/documents/{doc_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True

    # 8. Document no longer in list or accessible
    after_list = client.get("/api/v1/customer/documents", headers=headers).json()
    assert not any(d["id"] == doc_id for d in after_list)


def create_test_image():
    from PIL import Image
    img = Image.new("RGB", (100, 100), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_customer_library_batch_folder_upload(client):
    headers = customer_auth(client, email="batch_uploader@example.com")
    pdf1 = create_test_pdf(pages=2)
    pdf2 = create_test_pdf(pages=3)
    img1 = create_test_image()

    files = [
        ("files", ("doc1.pdf", pdf1, "application/pdf")),
        ("files", ("doc2.pdf", pdf2, "application/pdf")),
        ("files", ("chart.png", img1, "image/png")),
    ]

    res = client.post("/api/v1/customer/documents/batch", headers=headers, files=files)
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) == 3
    names = {d["file_name"] for d in docs}
    assert names == {"doc1.pdf", "doc2.pdf", "chart.png"}

    # Verify they appear in library
    list_res = client.get("/api/v1/customer/documents", headers=headers)
    assert list_res.status_code == 200
    listed_names = {d["file_name"] for d in list_res.json()}
    assert {"doc1.pdf", "doc2.pdf", "chart.png"}.issubset(listed_names)


def test_stage_folder_print_job(client):
    shop_id = "shop-demo-1"

    pdf1 = create_test_pdf(pages=2)
    pdf2 = create_test_pdf(pages=3)
    img1 = create_test_image()

    files = [
        ("files", ("chapter1.pdf", pdf1, "application/pdf")),
        ("files", ("chapter2.pdf", pdf2, "application/pdf")),
        ("files", ("figure.png", img1, "image/png")),
    ]
    data = {
        "shop_id": shop_id,
        "folder_name": "Course_Packet",
        "copy_count": 1,
        "is_color": False,
        "duplex_mode": "simplex",
        "layout_nup": 1,
        "paper_type": "normal",
        "access_mode": "anonymous",
    }

    res = client.post("/api/v1/jobs/stage-folder", data=data, files=files)
    assert res.status_code == 200
    job = res.json()
    assert job["file_name"] == "Course_Packet.pdf"
    # Total pages: 2 + 3 + 1 = 6 pages
    assert job["page_count"] == 6
    assert job["job_status"] == "staged"
    assert "checkout_token" in job
    assert job["total_cost"] > 0

