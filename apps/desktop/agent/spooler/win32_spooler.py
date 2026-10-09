import sys
import os
import time
from typing import List, Dict, Optional
from agent.core.config import agent_settings

# Attempt native win32print import on Windows
try:
    import win32print
    import win32ui
    import win32con
    HAS_WIN32PRINT = True
except ImportError:
    HAS_WIN32PRINT = False


class NativeSpoolerBridge:
    """Interfaces with Windows Print Subsystem via win32print."""
    def __init__(self):
        self.is_native_available = HAS_WIN32PRINT and (sys.platform == "win32")

    def list_installed_printers(self) -> List[str]:
        """Queries local Windows printer devices."""
        if self.is_native_available:
            try:
                printers = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
                return [p[2] for p in printers]
            except Exception as e:
                print(f"[Spooler] Failed to enum native printers: {e}")
        
        if not agent_settings.MOCK_PRINTING:
            return []
        return [
            "HP LaserJet Pro M404dn (B&W High Speed)",
            "Canon imageRUNNER C3226 (Color & Duplex)",
            "Microsoft Print to PDF"
        ]

    def spool_job(
        self,
        printer_name: str,
        file_path: str,
        job_meta: dict
    ) -> bool:
        """
        Sends raw document buffer to the operating system printer driver.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Spool target file not found: {file_path}")

        file_size = os.path.getsize(file_path)
        doc_title = f"CBPMS_Job_{job_meta.get('job_id', 'unknown')}_{os.path.basename(file_path)}"

        if agent_settings.MOCK_PRINTING:
            print("[Spooler:Mock] Simulated print; no physical output")
            return True
        if not self.is_native_available:
            raise RuntimeError("Windows printer support is unavailable; simulation is disabled")
        if (not agent_settings.RAW_PDF_SUPPORTED or not file_path.lower().endswith('.pdf') or
            job_meta.get('copy_count', 1) != 1 or job_meta.get('layout_nup', 1) != 1 or
            job_meta.get('duplex_mode', 'simplex') != 'simplex' or job_meta.get('is_color', False)):
            raise RuntimeError("Native RAW printing requires an explicitly configured PDF-direct printer and default single-copy settings")

        if self.is_native_available:
            try:
                h_printer = win32print.OpenPrinter(printer_name)
                try:
                    # Initialize print job
                    h_job = win32print.StartDocPrinter(h_printer, 1, (doc_title, None, "RAW"))
                    win32print.StartPagePrinter(h_printer)
                    
                    with open(file_path, "rb") as f:
                        buf = f.read(64 * 1024)
                        while buf:
                            win32print.WritePrinter(h_printer, buf)
                            buf = f.read(64 * 1024)
                            
                    win32print.EndPagePrinter(h_printer)
                    win32print.EndDocPrinter(h_printer)
                    print(f"[Spooler] Native win32print spool success: {doc_title} -> {printer_name}")
                    return True
                finally:
                    win32print.ClosePrinter(h_printer)
            except Exception as e:
                print(f"[Spooler] Native win32print error: {e}")
                return False
        else:
            return False


spooler_bridge = NativeSpoolerBridge()
