import re
import time
from typing import Callable, Optional, Tuple


class BarcodeScannerHook:
    """Aggregates and parses USB Barcode Reader keystrokes."""
    def __init__(self, on_scan_callback: Optional[Callable[[str, str], None]] = None):
        self.on_scan_callback = on_scan_callback
        self._buffer = ""
        self._last_char_time = 0.0
        self.keystroke_threshold_ms = 100  # Barcode readers send chars at high speed (<50ms)

    def parse_payload(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Parses raw scanner input.
        Supports:
        1. Plain 4-digit numeric code: "4821"
        2. CBPMS 2D Barcode: "CBPMS:<shop_id>:<token>:<job_id>"
        """
        cleaned = text.strip()
        
        # 1. Check 2D Barcode format
        if cleaned.startswith("CBPMS:"):
            parts = cleaned.split(":")
            if len(parts) == 4 and parts[1] and re.fullmatch(r"\d{4}", parts[2]) and parts[3]:
                shop_id = parts[1]
                token = parts[2]
                return shop_id, token

        # 2. Check 4-digit code format
        match = re.match(r"^\d{4}$", cleaned)
        if match:
            return None, cleaned

        return None, None

    def handle_input_string(self, input_text: str):
        """Processes a full string (either scanned or typed into UI)."""
        shop_id, token = self.parse_payload(input_text)
        if token and self.on_scan_callback:
            self.on_scan_callback(token, shop_id or "")
            return True
        return False
