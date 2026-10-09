"""Durable, non-printing completion retry queue.

Only the result callback is persisted. A queued item never causes a document to
be downloaded or printed again; it only retries the idempotent API transition.
"""
import json
import os
import tempfile
import time
from pathlib import Path


class CompletionOutbox:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)

    def _path(self, job_id):
        safe = "".join(ch for ch in job_id if ch.isalnum() or ch in "-_ ").strip().replace(" ", "_")
        return self.directory / f"completion-{safe}.json"

    def enqueue(self, job_id, status, error_message=None):
        if status not in ("completed", "failed"):
            raise ValueError("completion status must be completed or failed")
        payload = {"job_id": job_id, "status": status, "error_message": error_message,
                   "created_at": time.time(), "attempts": 0}
        fd, temp_name = tempfile.mkstemp(prefix="completion-", suffix=".tmp", dir=self.directory)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(payload, handle)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_name, self._path(job_id))
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)

    def pending(self):
        entries = []
        for path in sorted(self.directory.glob("completion-*.json")):
            try:
                with path.open("r", encoding="utf-8") as handle:
                    payload = json.load(handle)
                if payload.get("job_id") and payload.get("status") in ("completed", "failed"):
                    payload["_path"] = path
                    entries.append(payload)
            except (OSError, ValueError, TypeError):
                # A malformed outbox item is retained for operator inspection.
                continue
        return entries

    def acknowledge(self, payload):
        path = payload.get("_path") or self._path(payload["job_id"])
        Path(path).unlink(missing_ok=True)
