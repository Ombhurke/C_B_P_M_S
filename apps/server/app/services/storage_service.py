"""File persistence is indexed by the durable job record, never process memory."""
import hashlib
import logging
from pathlib import Path
from fastapi import HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        self.client = None

    def initialize(self):
        self.client = None
        if settings.ENVIRONMENT == "test" and settings.ALLOW_LOCAL_STORAGE:
            Path(settings.TEMP_STORAGE_DIR).mkdir(parents=True, exist_ok=True)
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            from supabase import create_client
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
            bucket = self.client.storage.get_bucket(settings.SUPABASE_STORAGE_BUCKET)
            if bucket.public:
                self.client = None
                raise RuntimeError("Document storage bucket must be private")

    def save(self, job_id, filename, content, mime):
        if not self.client and not (settings.ENVIRONMENT == "test" and settings.ALLOW_LOCAL_STORAGE):
            raise HTTPException(503, "Private document storage is not configured")
        suffix = Path(filename).suffix.lower()
        path = Path(settings.TEMP_STORAGE_DIR).resolve() / (job_id + suffix)
        remote = None
        if self.client:
            remote = "staged/" + path.name
            self.client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
                remote, content, {"content-type": mime})
        else:
            path.write_bytes(content)
        return {"file_path": str(path) if not remote else None, "supabase_path": remote,
                "file_hash": hashlib.sha256(content).hexdigest(), "file_size_bytes": len(content)}

    def signed_url(self, job):
        if self.client and job.get("supabase_path"):
            response = self.client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).create_signed_url(
                job["supabase_path"], settings.TOKEN_PRESIGNED_URL_TTL_SECONDS)
            return response["signedURL"]
        return None

    def create_signed_upload_grant(self, path: str):
        if not self.client and not (settings.ENVIRONMENT == "test" and settings.ALLOW_LOCAL_STORAGE):
            raise HTTPException(503, "Private document storage is not configured")
        if self.client:
            res = self.client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).create_signed_upload_url(path)
            return {
                "upload_url": res.get("signed_url") or res.get("signedUrl"),
                "token": res.get("token"),
                "path": path,
            }
        # Local test fallback
        return {
            "upload_url": f"/mock-storage/{path}",
            "token": f"mock-token-{path}",
            "path": path,
        }

    def download_bytes(self, path: str) -> bytes:
        if not self.client and not (settings.ENVIRONMENT == "test" and settings.ALLOW_LOCAL_STORAGE):
            raise HTTPException(503, "Private document storage is not configured")
        if self.client:
            return self.client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).download(path)
        local_path = Path(settings.TEMP_STORAGE_DIR).resolve() / path
        if not local_path.is_file():
            raise FileNotFoundError(f"Storage object '{path}' not found")
        return local_path.read_bytes()

    def copy_object(self, from_path: str, to_path: str) -> None:
        if not self.client and not (settings.ENVIRONMENT == "test" and settings.ALLOW_LOCAL_STORAGE):
            raise HTTPException(503, "Private document storage is not configured")
        if self.client:
            self.client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).copy(from_path, to_path)
        else:
            src = Path(settings.TEMP_STORAGE_DIR).resolve() / from_path
            dst = Path(settings.TEMP_STORAGE_DIR).resolve() / to_path
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(src.read_bytes())

    def remove_objects(self, paths: list[str]) -> bool:
        if not paths:
            return True
        success = True
        try:
            if self.client:
                self.client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).remove(paths)
            else:
                for p in paths:
                    (Path(settings.TEMP_STORAGE_DIR).resolve() / p).unlink(missing_ok=True)
        except Exception:
            logger.warning("Failed to remove storage objects: %s", paths)
            success = False
        return success

    def purge(self, job):
        # Keep paths until every deletion succeeds, so cleanup can retry after restart.
        try:
            if job.get("supabase_path"):
                if self.client:
                    self.client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).remove([job["supabase_path"]])
                elif settings.ENVIRONMENT == "test" and settings.ALLOW_LOCAL_STORAGE:
                    (Path(settings.TEMP_STORAGE_DIR).resolve() / job["supabase_path"]).unlink(missing_ok=True)
                else:
                    return False
            if job.get("file_path"):
                Path(job["file_path"]).unlink(missing_ok=True)
            return True
        except Exception:
            logger.warning("File deletion pending for job %s", job["id"])
            return False


storage_service = StorageService()
