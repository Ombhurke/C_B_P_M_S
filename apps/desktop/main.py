import sys
import os
import time
from agent.core.config import agent_settings
from agent.core.api_client import api_client
from agent.core.ws_client import DesktopWebSocketClient
from agent.scanner.barcode_hook import BarcodeScannerHook
from agent.spooler.win32_spooler import spooler_bridge
from agent.shredder.file_shredder import file_shredder
from agent.ui.dashboard import DesktopDashboard, HAS_PYSIDE


class DesktopAgentApp:
    def __init__(self):
        self.selected_printer = agent_settings.SELECTED_PRINTER_NAME
        self.active_queue = []
        self.scanner_hook = BarcodeScannerHook(on_scan_callback=self.on_barcode_scanned)
        self.dashboard = DesktopDashboard(
            on_release_callback=self.handle_release_request,
            on_printer_change=self.handle_printer_change
        )
        self.ws_client = DesktopWebSocketClient(on_event_callback=self.handle_ws_event)

    def handle_printer_change(self, printer_name: str):
        self.selected_printer = printer_name
        self.dashboard.log(f"[Config] Target printer set to: {printer_name}")

    def handle_ws_event(self, event: str, data: dict):
        if event == "JOB_QUEUED":
            self.dashboard.log(f"🔔 [Live Queue] New Job received! PIN: {data.get('release_token')} ({data.get('file_name')})")
            self.refresh_queue()
        elif event == "JOB_COMPLETED":
            self.dashboard.log(f"✅ [Live Queue] Job {data.get('job_id')} finished.")
            self.refresh_queue()

    def refresh_queue(self):
        try:
            self.active_queue = api_client.fetch_shop_queue(agent_settings.SHOP_ID)
            self.dashboard.update_queue(self.active_queue)
        except Exception as e:
            print(f"[Agent] Failed to refresh queue: {e}")

    def on_barcode_scanned(self, token: str, shop_id: str):
        self.dashboard.log(f"⚡ [Scanner Hook] Barcode parsed. PIN: {token} (Shop: {shop_id or 'default'})")
        self.handle_release_request(token)

    def handle_release_request(self, raw_input: str):
        shop_id, token = self.scanner_hook.parse_payload(raw_input)
        target_token = token or raw_input.strip()

        if not target_token:
            self.dashboard.log("⚠️ [Error] Empty PIN or invalid barcode.")
            return

        self.dashboard.log(f"⏳ [Release] Verifying release token '{target_token}' with Cloud API...")
        
        try:
            # 1. Verify with Cloud API
            job_data = api_client.verify_release_token(target_token, shop_id)
            job_id = job_data["job_id"]
            file_name = job_data["file_name"]
            download_url = job_data["download_url"]

            self.dashboard.log(f"🔓 [Release] Token authorized for '{file_name}'. Downloading binary payload...")

            # 2. Local Sandboxed Download
            ext = os.path.splitext(file_name)[1] or ".pdf"
            local_sandboxed_path = os.path.join(agent_settings.LOCAL_SPOOL_DIR, f"{job_id}{ext}")
            
            try:
                api_client.download_staged_document(download_url, local_sandboxed_path)
                self.dashboard.log(f"📥 [Spooler] Ingested into local sandbox: {local_sandboxed_path}")

                # 3. Spool to Windows Subsystem
                self.dashboard.log(f"🖨️ [Spooler] Dispatching to '{self.selected_printer}'...")
                spool_success = spooler_bridge.spool_job(self.selected_printer, local_sandboxed_path, job_data)
                
                if spool_success:
                    self.dashboard.log(f"✨ [Spooler] Job successfully spooled to printer hardware.")
                else:
                    self.dashboard.log(f"⚠️ [Spooler] Spooler returned warning/error.")

            finally:
                # 4. Immediate Physical File Shred & Cloud Purge Callback (Guaranteed in finally)
                self.dashboard.log(f"🛡️ [Shredder] Shredding local sandbox file...")
                file_shredder.shred_and_delete(local_sandboxed_path, passes=1)
                
                self.dashboard.log(f"☁️ [Cloud Cleanup] Triggering cloud blob ephemeral purge...")
                api_client.notify_spool_completed(job_id, "completed")
                self.dashboard.log(f"🔒 [Security] Job {job_id} completely purged from all disk and cloud memory.")
                self.refresh_queue()

        except Exception as e:
            self.dashboard.log(f"❌ [Release Failed] {e}")

    def run(self):
        printers = spooler_bridge.list_installed_printers()
        self.ws_client.start()
        self.refresh_queue()

        if HAS_PYSIDE:
            self.dashboard.launch(printers, self.active_queue)
            sys.exit(self.dashboard.app.exec())
        else:
            print("[Agent] Running in Headless CLI Mode. Type a 4-digit PIN to release (or 'exit'):")
            while True:
                try:
                    user_input = input("CBPMS-Agent> ").strip()
                    if user_input.lower() in ("exit", "quit"):
                        break
                    if user_input:
                        self.handle_release_request(user_input)
                except (KeyboardInterrupt, EOFError):
                    break


if __name__ == "__main__":
    app = DesktopAgentApp()
    app.run()
