import getpass
import os
import sys
import threading

from agent.core.config import agent_settings
from agent.core.api_client import api_client
from agent.core.ws_client import DesktopWebSocketClient
from agent.core.completion_outbox import CompletionOutbox
from agent.scanner.barcode_hook import BarcodeScannerHook
from agent.spooler.win32_spooler import spooler_bridge
from agent.shredder.file_shredder import file_shredder
from agent.ui.dashboard import DesktopDashboard, HAS_PYSIDE


class DesktopAgentApp:
    def __init__(self):
        self.selected_printer = agent_settings.SELECTED_PRINTER_NAME
        self.active_queue = []
        self.release_lock = threading.Lock()
        self.completion_outbox = CompletionOutbox(agent_settings.LOCAL_STATE_DIR)
        self.scanner_hook = BarcodeScannerHook()
        self.dashboard = DesktopDashboard(on_release_callback=self.start_release,
                                          on_printer_change=self.handle_printer_change)
        self.ws_client = DesktopWebSocketClient(on_event_callback=self.handle_ws_event)

    def handle_printer_change(self, printer_name):
        self.selected_printer = printer_name

    def handle_ws_event(self, event, data):
        if event != "PONG":
            self.refresh_queue()

    def refresh_queue(self):
        try:
            self.flush_completion_outbox()
            self.active_queue = api_client.fetch_shop_queue()
            self.dashboard.update_queue(self.active_queue)
        except Exception as exc:
            self.dashboard.log(f"Queue unavailable: {exc}")

    def flush_completion_outbox(self):
        for pending in self.completion_outbox.pending():
            try:
                api_client.notify_spool_completed(pending["job_id"], pending["status"], pending.get("error_message"))
                self.completion_outbox.acknowledge(pending)
                self.dashboard.log(f"Recovered server result for {pending['job_id']} without reprinting.")
            except Exception as exc:
                self.dashboard.log(f"Pending result for {pending['job_id']} remains queued: {exc}")

    def start_release(self, raw_input):
        if not self.release_lock.acquire(blocking=False):
            self.dashboard.log("A release is already running; please wait.")
            return
        def work():
            try:
                self.handle_release_request(raw_input)
            finally:
                self.release_lock.release()
        threading.Thread(target=work, daemon=False).start()

    def handle_release_request(self, raw_input):
        shop_id, token = self.scanner_hook.parse_payload(raw_input)
        if not token:
            self.dashboard.log("Enter a valid PIN or barcode.")
            return
        job = None
        local_path = None
        status = "failed"
        failure_message = None
        try:
            job = api_client.verify_release_token(token, shop_id)
            self.dashboard.active_job = job
            if HAS_PYSIDE and getattr(self.dashboard, 'review_file_lbl', None):
                self.dashboard.review_file_lbl.setText(job.get("file_name", "Document"))
                specs = f"{job.get('page_count', 1)} pages · {'Color' if job.get('is_color') else 'B&W'} · {job.get('duplex_mode', 'simplex')} · {job.get('paper_type', 'normal').upper()}"
                self.dashboard.review_specs_lbl.setText(specs)
            local_path = os.path.join(agent_settings.LOCAL_SPOOL_DIR,
                                      job["job_id"] + os.path.splitext(job["file_name"])[1])
            api_client.download_staged_document(job["download_url"], local_path, job["file_hash"])
            if HAS_PYSIDE and getattr(self.dashboard, 'stage1_lbl', None):
                self.dashboard.stage1_lbl.setText("Stage 1: Verified Document Download — Completed (SHA-256 Validated)")
            if not spooler_bridge.spool_job(self.selected_printer, local_path, job):
                raise RuntimeError("Printer did not accept the job")
            if HAS_PYSIDE and getattr(self.dashboard, 'stage2_lbl', None):
                self.dashboard.stage2_lbl.setText(f"Stage 2: Windows Spooler Submission — Sent to {self.selected_printer}")
            status = "completed"
            self.dashboard.log("Document accepted by spooler; physical output is not yet confirmed.")
            if HAS_PYSIDE and getattr(self.dashboard, 'stage3_lbl', None):
                self.dashboard.stage3_lbl.setText("Stage 3: Physical Output Confirmation — Awaiting Operator Verification")
        except Exception as exc:
            failure_message = str(exc)
            if HAS_PYSIDE and getattr(self.dashboard, 'stage2_lbl', None):
                self.dashboard.stage2_lbl.setText(f"Stage 2: Submission Failed — {exc}")
            self.dashboard.log(f"Release failed: {exc}")
        finally:
            if local_path and os.path.exists(local_path):
                if not file_shredder.shred_and_delete(local_path):
                    self.dashboard.log("Local cleanup failed; operator attention required.")
            if job:
                try:
                    if failure_message:
                        result = api_client.notify_spool_completed(job["job_id"], status, failure_message)
                    else:
                        result = api_client.notify_spool_completed(job["job_id"], status)
                    if status == "failed":
                        self.dashboard.log("Job retained for retry until expiry.")
                    elif result.get("shredded"):
                        self.dashboard.log("Cloud file deletion confirmed.")
                    else:
                        self.dashboard.log("Spooling recorded; cloud deletion is pending.")
                except Exception as exc:
                    self.completion_outbox.enqueue(job["job_id"], status, failure_message)
                    self.dashboard.log(
                        f"Result for {job['job_id']} is uncertain: {status}. "
                        f"Callback queued for retry ({exc}); do not reprint automatically.")
                self.refresh_queue()

    def run(self):
        printers = spooler_bridge.list_installed_printers()
        if HAS_PYSIDE:
            self.dashboard.launch(printers, [])
            username, password = self.dashboard.login_credentials()
        else:
            username = agent_settings.OPERATOR_USERNAME or input("Operator username: ")
            password = agent_settings.OPERATOR_PASSWORD or getpass.getpass("Operator password: ")
        try:
            api_client.login(username, password)
            self.refresh_queue()
            self.ws_client.start()
        except Exception as exc:
            self.dashboard.log(f"[Security] Unauthorized access or sign-in failed: {exc}. Closing application.")
            if HAS_PYSIDE and self.dashboard.window:
                self.dashboard.window.close()
            return
        try:
            if HAS_PYSIDE:
                self.dashboard.app.exec()
            else:
                while True:
                    value = input("PIN / barcode (exit to quit)> ").strip()
                    if value.lower() in ("exit", "quit"):
                        break
                    self.handle_release_request(value)
        except (KeyboardInterrupt, EOFError):
            pass
        finally:
            self.ws_client.stop()


if __name__ == "__main__":
    DesktopAgentApp().run()
