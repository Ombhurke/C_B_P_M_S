import os
import sys
import threading
from PySide6.QtWidgets import QApplication, QMessageBox, QDialog, QVBoxLayout, QLabel, QLineEdit, QPushButton
from PySide6.QtCore import QObject, Signal, Slot

from agent.core.config import agent_settings
from agent.core.api_client import api_client
from agent.core.ws_client import DesktopWebSocketClient
from agent.core.lifecycle import PrintLifecycleManager, JobLifecycleStage
from agent.spooler.win32_spooler import spooler_bridge
from agent.ui.shell import CounterDeskShell


class DesktopAgentController(QObject):
    # Signals for thread-safe UI updates
    data_refreshed = Signal()
    review_ready = Signal(dict, str)  # job, preview_path
    print_completed = Signal(dict, str)  # job, spool_id
    error_occurred = Signal(str)
    info_occurred = Signal(str)

    def __init__(self, shell: CounterDeskShell, app: QApplication):
        super().__init__()
        self.shell = shell
        self.app = app
        self.selected_printer = agent_settings.SELECTED_PRINTER_NAME
        self.shop_profile = {}
        self.summary_data = {}
        self.queue_jobs = []
        self.team_members = []
        self.installed_printers = []

        self.lifecycle = PrintLifecycleManager(
            on_stage_change=self._on_lifecycle_stage,
            on_log=self._on_lifecycle_log
        )
        self.ws_client = DesktopWebSocketClient(on_event_callback=self._handle_ws_event)

        self._wire_signals()

    def _wire_signals(self):
        self.data_refreshed.connect(self._apply_data_to_views)
        self.review_ready.connect(self._apply_review_ready)
        self.print_completed.connect(self._apply_print_completed)
        self.error_occurred.connect(self._show_error_dialog)
        self.info_occurred.connect(self._show_info_dialog)

        # Connect Shell signals
        self.shell.scan_submitted.connect(self.handle_find_review)
        self.shell.print_submitted.connect(self.handle_submit_print)
        self.shell.confirm_output_submitted.connect(self.handle_confirm_output)
        self.shell.report_problem_submitted.connect(self.handle_report_problem)
        self.shell.hold_submitted.connect(self.handle_hold_job)
        self.shell.abandon_review_submitted.connect(self.handle_abandon_review)
        self.shell.rates_saved.connect(self.handle_save_rates)
        self.shell.staff_invited.connect(self.handle_invite_staff)
        self.shell.profile_updated.connect(self.handle_update_profile)
        self.shell.map_printer_submitted.connect(self.handle_printer_change)
        self.shell.reconnect_submitted.connect(self.refresh_all_data)
        self.shell.retry_sync_submitted.connect(self.handle_retry_sync)
        self.shell.sign_out_submitted.connect(self.handle_sign_out)

    def _handle_ws_event(self, event, data):
        if event != "PONG":
            self.refresh_all_data()

    def _on_lifecycle_stage(self, stage: str, data: dict):
        pass

    def _on_lifecycle_log(self, message: str):
        print(f"[CounterDesk Lifecycle] {message}")

    def refresh_all_data(self):
        def worker():
            try:
                self.lifecycle.flush_outbox()
                self.installed_printers = spooler_bridge.list_installed_printers()
                self.shop_profile = api_client.fetch_shop_profile()
                self.summary_data = api_client.fetch_shop_summary()
                self.queue_jobs = api_client.fetch_shop_queue()
                self.team_members = api_client.fetch_team()
                self.data_refreshed.emit()
            except Exception as exc:
                self.error_occurred.emit(f"Data refresh failed: {exc}")
        threading.Thread(target=worker, daemon=True).start()

    @Slot()
    def _apply_data_to_views(self):
        shop_name = self.shop_profile.get("name", "QuickPrints")
        role = getattr(api_client, "role", "operator")
        is_owner = (role == "admin")

        self.shell.update_top_bar(shop_name, "Station Alpha", role, True)

        is_printer_ready = bool(self.selected_printer in self.installed_printers)
        self.shell.v_overview.update_data(self.queue_jobs, self.summary_data, self.selected_printer, is_printer_ready)
        self.shell.v_queue.update_queue(self.queue_jobs)
        self.shell.v_printers.update_printers(self.installed_printers, self.shop_profile.get("printers", []), self.selected_printer)
        self.shell.v_rates.update_rates(self.shop_profile, is_owner)
        self.shell.v_team.update_data(self.team_members, self.shop_profile, is_owner)

        pending_items = self.lifecycle.completion_outbox.pending()
        self.shell.v_recovery.update_data(pending_items, [])
        self.shell.v_settings.set_station_info(
            api_client.username, role, shop_name, agent_settings.SHOP_ID,
            self.installed_printers, self.selected_printer, len(pending_items)
        )

    def handle_find_review(self, raw_input: str):
        def worker():
            job = self.lifecycle.find_and_review(raw_input)
            if job:
                preview_path = self.lifecycle.local_file_path or ""
                self.review_ready.emit(job, preview_path)
            else:
                self.error_occurred.emit("Could not authorize job for review. Verify release code and shop match.")
        threading.Thread(target=worker, daemon=True).start()

    @Slot(dict, str)
    def _apply_review_ready(self, job: dict, preview_path: str):
        self.shell.v_review.set_job(job, preview_path, self.installed_printers, self.selected_printer)
        self.shell.navigate_to("review")

    def handle_submit_print(self, printer_name: str):
        def worker():
            success = self.lifecycle.submit_print(printer_name)
            if success:
                self.print_completed.emit(self.lifecycle.active_job, self.lifecycle.active_spool_id or "")
            else:
                self.error_occurred.emit("Print dispatch could not be completed. Check printer compatibility and connection.")
        threading.Thread(target=worker, daemon=True).start()

    @Slot(dict, str)
    def _apply_print_completed(self, job: dict, spool_id: str):
        self.shell.v_monitor.set_active_job(job, spool_id, self.selected_printer)
        self.shell.navigate_to("monitor")

    def handle_confirm_output(self, notes: str):
        def worker():
            self.lifecycle.confirm_output(notes)
            self.refresh_all_data()
            self.info_occurred.emit("Output confirmed. Customer document processed.")
        threading.Thread(target=worker, daemon=True).start()

    def handle_report_problem(self, issue_type: str, notes: str):
        def worker():
            self.lifecycle.report_issue(issue_type, notes)
            self.refresh_all_data()
            self.info_occurred.emit("Issue reported. Document retained in recovery.")
        threading.Thread(target=worker, daemon=True).start()

    def handle_hold_job(self, job_id: str, reason: str):
        def worker():
            try:
                api_client.reject_job(job_id, reason)
                self.refresh_all_data()
                self.info_occurred.emit(f"Job {job_id} held with reason: {reason}")
            except Exception as exc:
                self.error_occurred.emit(f"Failed to hold job: {exc}")
        threading.Thread(target=worker, daemon=True).start()

    def handle_abandon_review(self):
        def worker():
            self.lifecycle.abandon_claim()
            self.refresh_all_data()
        threading.Thread(target=worker, daemon=True).start()

    def handle_save_rates(self, payload: dict):
        def worker():
            try:
                api_client.update_rates(payload)
                self.refresh_all_data()
                self.info_occurred.emit("Shop rates updated successfully.")
            except Exception as exc:
                self.error_occurred.emit(f"Failed to save rates: {exc}")
        threading.Thread(target=worker, daemon=True).start()

    def handle_invite_staff(self, username: str, role: str, password: str):
        def worker():
            try:
                api_client.invite_team_member(username, role, password)
                self.refresh_all_data()
                self.info_occurred.emit(f"Staff member {username} invited successfully.")
            except Exception as exc:
                self.error_occurred.emit(f"Failed to add staff member: {exc}")
        threading.Thread(target=worker, daemon=True).start()

    def handle_update_profile(self, payload: dict):
        def worker():
            try:
                api_client.update_profile(payload)
                self.refresh_all_data()
                self.info_occurred.emit("Shop profile updated successfully.")
            except Exception as exc:
                self.error_occurred.emit(f"Failed to update profile: {exc}")
        threading.Thread(target=worker, daemon=True).start()

    def handle_printer_change(self, printer_name: str):
        self.selected_printer = printer_name
        self._apply_data_to_views()

    def handle_retry_sync(self):
        def worker():
            flushed = self.lifecycle.flush_outbox()
            self.refresh_all_data()
            self.info_occurred.emit(f"Result sync flushed {flushed} pending items (no reprinting).")
        threading.Thread(target=worker, daemon=True).start()

    def handle_sign_out(self):
        self.ws_client.stop()
        self.app.quit()

    @Slot(str)
    def _show_error_dialog(self, message: str):
        QMessageBox.warning(self.shell, "Counter Desk Alert", message)

    @Slot(str)
    def _show_info_dialog(self, message: str):
        QMessageBox.information(self.shell, "Counter Desk", message)


def prompt_credentials():
    username = agent_settings.OPERATOR_USERNAME
    password = agent_settings.OPERATOR_PASSWORD
    return username, password


def run_app():
    app = QApplication(sys.argv)
    shell = CounterDeskShell()
    controller = DesktopAgentController(shell, app)

    username, password = prompt_credentials()
    if not username or not password:
        print("[Desktop Agent] Missing credentials in .env.", file=sys.stderr)
        return

    try:
        api_client.login(username, password)
        controller.refresh_all_data()
        controller.ws_client.start()
        shell.show()
    except Exception as exc:
        QMessageBox.critical(None, "Sign-In Failed", f"Sign-in rejected: {exc}")
        return

    sys.exit(app.exec())


if __name__ == "__main__":
    run_app()
