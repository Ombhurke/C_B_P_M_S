import os
import threading
import time
from typing import Optional, Dict, Any, Callable
from agent.core.config import agent_settings
from agent.core.api_client import api_client
from agent.core.completion_outbox import CompletionOutbox
from agent.scanner.barcode_hook import BarcodeScannerHook
from agent.spooler.win32_spooler import spooler_bridge
from agent.shredder.file_shredder import file_shredder


class JobLifecycleStage:
    IDLE = "idle"
    FINDING = "finding"
    REVIEWING = "reviewing"
    SUBMITTING = "submitting"
    SPOOL_ACCEPTED = "spool_accepted"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    OUTPUT_CONFIRMED = "output_confirmed"
    ISSUE_REPORTED = "issue_reported"
    FAILED = "failed"


class PrintLifecycleManager:
    """Manages explicit lifecycle transitions for counter desk print station.
    Enforces invariant: Scanning/reviewing never prints. Physical print requires deliberate action.
    """
    def __init__(self, on_stage_change: Optional[Callable[[str, Dict[str, Any]], None]] = None,
                 on_log: Optional[Callable[[str], None]] = None):
        self.stage = JobLifecycleStage.IDLE
        self.active_job: Optional[Dict[str, Any]] = None
        self.local_file_path: Optional[str] = None
        self.active_spool_id: Optional[str] = None
        self.dispatch_lock = threading.Lock()
        self.on_stage_change = on_stage_change
        self.on_log = on_log or (lambda msg: None)
        self.completion_outbox = CompletionOutbox(agent_settings.LOCAL_STATE_DIR)
        self.scanner_hook = BarcodeScannerHook()

    def _set_stage(self, stage: str, data: Optional[Dict[str, Any]] = None):
        self.stage = stage
        if self.on_stage_change:
            self.on_stage_change(stage, data or self.active_job or {})

    def log(self, message: str):
        self.on_log(message)

    def find_and_review(self, raw_input: str) -> Optional[Dict[str, Any]]:
        """Finds job metadata and authorizes review. NEVER physically prints."""
        if self.stage in (JobLifecycleStage.SUBMITTING, JobLifecycleStage.SPOOL_ACCEPTED, JobLifecycleStage.AWAITING_CONFIRMATION):
            self.log("Cannot start new review while a print dispatch is in progress or awaiting confirmation.")
            return None

        shop_id, token = self.scanner_hook.parse_payload(raw_input)
        if not token:
            self.log("Enter a valid PIN or receipt barcode.")
            return None

        self._set_stage(JobLifecycleStage.FINDING, {"token": token})
        try:
            job = api_client.verify_release_token(token, shop_id)
            self.active_job = job
            self.log(f"Job {job.get('job_id')} verified for review. Preparing authorized preview...")
            self.prepare_preview(job)
            self._set_stage(JobLifecycleStage.REVIEWING, job)
            return job
        except Exception as exc:
            self.log(f"Review authorization failed: {exc}")
            self._set_stage(JobLifecycleStage.IDLE, {"error": str(exc)})
            return None

    def prepare_preview(self, job: Dict[str, Any]) -> Optional[str]:
        """Downloads authorized file into local sandbox with hash validation."""
        download_url = job.get("download_url")
        if not download_url:
            self.log("No download URL provided in release grant.")
            return None

        file_name = job.get("file_name", "document.pdf")
        ext = os.path.splitext(file_name)[1] or ".pdf"
        target_path = os.path.join(agent_settings.LOCAL_SPOOL_DIR, f"preview_{job['job_id']}{ext}")
        try:
            api_client.download_staged_document(download_url, target_path, job.get("file_hash"))
            self.local_file_path = target_path
            self.log("Preview document downloaded and SHA-256 verified.")
            return target_path
        except Exception as exc:
            self.log(f"Failed to load preview: {exc}")
            if os.path.exists(target_path):
                file_shredder.shred_and_delete(target_path)
            self.local_file_path = None
            return None

    def validate_compatibility(self, printer_name: str, job: Dict[str, Any]) -> tuple[bool, str]:
        """Strict pre-flight driver and hardware capability checks."""
        if not printer_name:
            return False, "No printer selected for this station."

        # File type check
        file_name = job.get("file_name", "").lower()
        if not file_name.endswith(".pdf"):
            return False, "Print blocked: Only PDF documents are supported in raw spool path."

        # Color capability
        if job.get("is_color", False):
            if not getattr(agent_settings, "COLOR_SUPPORTED", False):
                return False, "Print blocked: Color requested but current station path is B&W only."

        # Duplex capability
        duplex = job.get("duplex_mode", "simplex")
        if duplex and duplex != "simplex":
            if not getattr(agent_settings, "DUPLEX_SUPPORTED", False):
                return False, "Print blocked: Duplex is not supported by current raw print path."

        # Multi-copy capability
        copy_count = job.get("copy_count", 1)
        if copy_count > 1 and not getattr(agent_settings, "MULTI_COPY_SUPPORTED", False):
            return False, f"Print blocked: {copy_count} copies requested; raw spool supports single copy only."

        # N-up layout capability
        nup = job.get("layout_nup", 1)
        if nup > 1:
            return False, f"Print blocked: {nup}-up layout requires driver rendering not available in raw mode."

        return True, "Compatible with station print path."

    def submit_print(self, printer_name: str, target_job_id: Optional[str] = None) -> bool:
        """Explicit operator action to spool to physical printer."""
        if not self.dispatch_lock.acquire(blocking=False):
            self.log("A print dispatch is already running; please wait.")
            return False

        try:
            if not self.active_job:
                self.log("No active job selected to print.")
                return False

            active_id = self.active_job.get("id") or self.active_job.get("job_id")
            if target_job_id and active_id != target_job_id:
                self.log(f"Print dispatch blocked: requested job {target_job_id} does not match active authorized context {active_id}.")
                return False

            if self.stage != JobLifecycleStage.REVIEWING:
                self.log(f"Cannot dispatch from stage '{self.stage}'.")
                return False

            is_compat, reason = self.validate_compatibility(printer_name, self.active_job)
            if not is_compat:
                self.log(f"Print dispatch blocked: {reason}")
                return False

            if not self.local_file_path or not os.path.exists(self.local_file_path):
                self.log("Local document file missing. Re-fetching...")
                self.prepare_preview(self.active_job)
                if not self.local_file_path or not os.path.exists(self.local_file_path):
                    self.log("Cannot print: document file unavailable.")
                    return False

            self._set_stage(JobLifecycleStage.SUBMITTING, self.active_job)
            self.log(f"Submitting job {self.active_job.get('job_id') or active_id} to {printer_name}...")

            success = spooler_bridge.spool_job(printer_name, self.local_file_path, self.active_job)
            if not success:
                self._set_stage(JobLifecycleStage.FAILED, {"error": "Windows spooler rejected print job."})
                self.log("Print failed: Spooler rejected the document buffer.")
                return False

            # Preserve native spool job reference
            self.active_spool_id = getattr(spooler_bridge, "last_job_id", None) or f"Spool-{int(time.time() * 1000) % 100000}"
            self._set_stage(JobLifecycleStage.SPOOL_ACCEPTED, {
                **self.active_job,
                "spool_id": self.active_spool_id,
                "printer": printer_name
            })
            self._set_stage(JobLifecycleStage.AWAITING_CONFIRMATION, {
                **self.active_job,
                "spool_id": self.active_spool_id,
                "printer": printer_name
            })
            self.log("Document accepted by Windows spooler. Verify physical paper output before confirming.")
            return True
        finally:
            self.dispatch_lock.release()

    def confirm_output(self, notes: Optional[str] = None) -> bool:
        """Operator explicitly confirms physical paper printed successfully."""
        if not self.active_job:
            self.log("No active job to confirm.")
            return False

        job_id = self.active_job.get("id") or self.active_job.get("job_id")
        try:
            api_client.confirm_output(job_id, notes=notes)
            self.log(f"Physical output confirmed for job {job_id}. Cloud record completed.")
            self._cleanup_local()
            self._set_stage(JobLifecycleStage.OUTPUT_CONFIRMED, self.active_job)
            self._set_stage(JobLifecycleStage.IDLE)
            return True
        except Exception as exc:
            self.log(f"Output confirmation call failed ({exc}). Enqueuing for background retry...")
            self.completion_outbox.enqueue(job_id, "completed", action_type="confirm_output", notes=notes)
            self._cleanup_local()
            self._set_stage(JobLifecycleStage.OUTPUT_CONFIRMED, self.active_job)
            self._set_stage(JobLifecycleStage.IDLE)
            return True

    def report_issue(self, issue_type: str = "hardware_error", notes: Optional[str] = None) -> bool:
        """Operator reports a printing problem."""
        if not self.active_job:
            self.log("No active job to report.")
            return False

        job_id = self.active_job.get("id") or self.active_job.get("job_id")
        text = (notes or "Operator reported printing issue").strip()
        if len(text) < 2:
            text = "Operator reported issue"

        try:
            api_client.report_issue(job_id, issue_type=issue_type, details=text)
            self.log(f"Issue reported for job {job_id} ({issue_type}). Document retained for recovery.")
            self._cleanup_local()
            self._set_stage(JobLifecycleStage.ISSUE_REPORTED, self.active_job)
            self._set_stage(JobLifecycleStage.IDLE)
            return True
        except Exception as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code and 400 <= status_code < 500:
                self.log(f"Issue report rejected permanently by server ({status_code}: {exc}). Not queuing into retry outbox.")
                self._cleanup_local()
                self._set_stage(JobLifecycleStage.FAILED, {"error": str(exc)})
                return False

            self.log(f"Issue reporting call failed ({exc}). Enqueuing for background retry...")
            self.completion_outbox.enqueue(job_id, "failed", error_message=str(exc),
                                           action_type="report_issue", notes=text, issue_type=issue_type)
            self._cleanup_local()
            self._set_stage(JobLifecycleStage.ISSUE_REPORTED, self.active_job)
            self._set_stage(JobLifecycleStage.IDLE)
            return True

    def abandon_claim(self) -> bool:
        """Operator closes review without printing; reverts job to queued."""
        if not self.active_job:
            self._set_stage(JobLifecycleStage.IDLE)
            return True

        job_id = self.active_job.get("id") or self.active_job.get("job_id")
        self._cleanup_local()
        if job_id and self.stage == JobLifecycleStage.REVIEWING:
            try:
                api_client.abandon_job_claim(job_id)
                self.log(f"Review closed. Job {job_id} returned to queue.")
            except Exception as exc:
                self.log(f"Could not release claim on server: {exc}")

        self.active_job = None
        self._set_stage(JobLifecycleStage.IDLE)
        return True

    def flush_outbox(self) -> int:
        """Flushes pending results without reprinting."""
        flushed = 0
        for item in self.completion_outbox.pending():
            job_id = item["job_id"]
            action_type = item.get("action_type", "confirm_output")
            notes = (item.get("notes") or "Operator reported issue").strip()
            if len(notes) < 2:
                notes = "Operator reported issue"
            try:
                if action_type == "confirm_output":
                    api_client.confirm_output(job_id, notes=notes)
                elif action_type == "report_issue":
                    api_client.report_issue(job_id, issue_type=item.get("issue_type", "hardware_error"),
                                            details=notes)
                else:
                    api_client.notify_spool_completed(job_id, item["status"], item.get("error_message"))
                self.completion_outbox.acknowledge(item)
                flushed += 1
                self.log(f"Synchronized pending result for {job_id} (no reprint).")
            except Exception as exc:
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                if status_code and 400 <= status_code < 500:
                    self.log(f"Pending item {job_id} rejected permanently ({status_code}); acknowledging outbox item: {exc}")
                    self.completion_outbox.acknowledge(item)
                else:
                    self.log(f"Pending sync for {job_id} remains queued: {exc}")
        return flushed

    def _cleanup_local(self):
        if self.local_file_path and os.path.exists(self.local_file_path):
            file_shredder.shred_and_delete(self.local_file_path)
            self.local_file_path = None
