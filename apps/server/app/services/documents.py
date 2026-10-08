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
