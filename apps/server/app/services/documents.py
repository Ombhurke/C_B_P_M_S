import io
from pathlib import Path
from fastapi import HTTPException
from pypdf import PdfReader


def inspect_document(filename, content):
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        try:
            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted:
                raise ValueError("Encrypted PDF")
            count = len(reader.pages)
            if not 1 <= count <= 1000:
                raise ValueError("Invalid page count")
            return count, "application/pdf"
        except Exception as exc:
            raise HTTPException(422, "Upload a valid, unencrypted PDF (1–1000 pages)") from exc
    if suffix in (".png", ".jpg", ".jpeg"):
        from PIL import Image
        try:
            with Image.open(io.BytesIO(content)) as image:
                if image.format not in ("PNG", "JPEG"):
                    raise ValueError("Invalid image format")
                image.verify()
                return 1, "image/png" if image.format == "PNG" else "image/jpeg"
        except Exception as exc:
            raise HTTPException(422, "Invalid or oversized image") from exc
    raise HTTPException(422, "Supported formats: PDF, PNG, JPG. Export DOCX to PDF first.")


def merge_documents_into_pdf(items: list[tuple[str, bytes]]) -> tuple[bytes, int]:
    """Merges a list of (filename, content) PDFs and images into a single valid PDF.
    Returns (merged_pdf_bytes, total_page_count).
    """
    from pypdf import PdfWriter
    from PIL import Image

    if not items:
        raise HTTPException(422, "Folder contains no valid documents to merge")

    writer = PdfWriter()
    sorted_items = sorted(items, key=lambda x: x[0].lower())

    for filename, content in sorted_items:
        suffix = Path(filename).suffix.lower()
        if suffix == ".pdf":
            try:
                reader = PdfReader(io.BytesIO(content))
                if reader.is_encrypted:
                    raise ValueError(f"Encrypted PDF: {filename}")
                for page in reader.pages:
                    writer.add_page(page)
            except Exception as exc:
                raise HTTPException(422, f"Could not process PDF '{filename}': {exc}") from exc
        elif suffix in (".png", ".jpg", ".jpeg"):
            try:
                with Image.open(io.BytesIO(content)) as img:
                    if img.mode in ("RGBA", "P"):
                        img = img.convert("RGB")
                    pdf_buf = io.BytesIO()
                    img.save(pdf_buf, format="PDF")
                    pdf_buf.seek(0)
                    img_reader = PdfReader(pdf_buf)
                    for page in img_reader.pages:
                        writer.add_page(page)
            except Exception as exc:
                raise HTTPException(422, f"Could not process image '{filename}': {exc}") from exc

    total_pages = len(writer.pages)
    if total_pages == 0:
        raise HTTPException(422, "Folder contains no readable PDF or image pages")
    if total_pages > 2000:
        raise HTTPException(422, "Combined document exceeds maximum limit of 2000 pages")

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue(), total_pages
