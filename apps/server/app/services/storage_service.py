import os
import shutil
import uuid
from typing import Optional, Dict
from datetime import datetime, timedelta
from app.core.config import settings
from app.core.security import hash_content

# Optional Supabase SDK import
try:
    from supabase import create_client, Client
    HAS_SUPABASE_SDK = True
except ImportError:
    HAS_SUPABASE_SDK = False


class StorageService:
    """Manages ephemeral in-memory, Supabase Storage bucket, and local disk staging."""
    def __init__(self):
        self.storage_dir = settings.TEMP_STORAGE_DIR
        self._temp_registry: Dict[str, dict] = {}
        self.supabase_client: Optional[Client] = None

        if HAS_SUPABASE_SDK and settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY):
            try:
                key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
                self.supabase_client = create_client(settings.SUPABASE_URL, key)
                print(f"[StorageService] Connected to Supabase Storage: {settings.SUPABASE_STORAGE_BUCKET}")
            except Exception as e:
                print(f"[StorageService] Supabase init failed ({e}), using local staging.")

    def save_staged_file(self, job_id: str, file_name: str, content: bytes) -> dict:
        ext = os.path.splitext(file_name)[1]
        safe_name = f"{job_id}{ext}"
        file_path = os.path.join(self.storage_dir, safe_name)
        
        # Always write local copy for buffer integrity
        with open(file_path, "wb") as f:
            f.write(content)
            
        file_hash = hash_content(content)
        supabase_path = None

        # Upload to Supabase bucket if configured
        if self.supabase_client:
            try:
                storage_bucket = settings.SUPABASE_STORAGE_BUCKET
                blob_path = f"staged/{safe_name}"
                res = self.supabase_client.storage.from_(storage_bucket).upload(
                    path=blob_path,
                    file=content,
                    file_options={"content-type": "application/octet-stream", "upsert": "true"}
                )
                supabase_path = blob_path
                print(f"[StorageService] Staged to Supabase Storage: {storage_bucket}/{blob_path}")
            except Exception as e:
                print(f"[StorageService] Supabase upload warning: {e}")

        meta = {
            "job_id": job_id,
            "file_name": file_name,
            "file_path": file_path,
            "supabase_path": supabase_path,
            "file_size": len(content),
            "file_hash": file_hash,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(seconds=settings.JOB_TTL_SECONDS)
        }
        self._temp_registry[job_id] = meta
        return meta

    def get_presigned_download_url(self, job_id: str, token: str) -> str:
        """Generates a 60-second short-lived URL from Supabase Storage or server route."""
        meta = self._temp_registry.get(job_id)
        if self.supabase_client and meta and meta.get("supabase_path"):
            try:
                res = self.supabase_client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).create_signed_url(
                    path=meta["supabase_path"],
                    expires_in=settings.TOKEN_PRESIGNED_URL_TTL_SECONDS
                )
                if isinstance(res, dict) and "signedURL" in res:
                    return res["signedURL"]
                elif hasattr(res, "signed_url"):
                    return res.signed_url
            except Exception as e:
                print(f"[StorageService] Failed to create signed URL: {e}")
        
        # Fallback to FastAPI server download endpoint
        return f"/api/v1/jobs/{job_id}/download?token={token}"

    def get_file_meta(self, job_id: str) -> Optional[dict]:
        return self._temp_registry.get(job_id)

    def get_file_path(self, job_id: str) -> Optional[str]:
        meta = self._temp_registry.get(job_id)
        if meta and os.path.exists(meta["file_path"]):
            return meta["file_path"]
        return None

    def purge_file(self, job_id: str) -> bool:
        """Physical shredding of local disk and deletion of Supabase Storage blob."""
        meta = self._temp_registry.pop(job_id, None)
        
        # Delete from Supabase Storage
        if self.supabase_client and meta and meta.get("supabase_path"):
            try:
                self.supabase_client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).remove([meta["supabase_path"]])
                print(f"[StorageService] Deleted Supabase storage blob: {meta['supabase_path']}")
            except Exception as e:
                print(f"[StorageService] Supabase blob delete warning: {e}")

        # Local overwrite and unlink
        if meta and os.path.exists(meta["file_path"]):
            try:
                size = os.path.getsize(meta["file_path"])
                with open(meta["file_path"], "wb") as f:
                    f.write(b"\x00" * min(size, 1024 * 1024))
                os.remove(meta["file_path"])
                return True
            except Exception:
                if os.path.exists(meta["file_path"]):
                    os.remove(meta["file_path"])
                return True
        return False


storage_service = StorageService()
