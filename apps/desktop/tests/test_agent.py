import os
import tempfile
import pytest
from agent.scanner.barcode_hook import BarcodeScannerHook
from agent.shredder.file_shredder import file_shredder
from agent.spooler.win32_spooler import spooler_bridge


def test_scanner_hook_parsing():
    hook = BarcodeScannerHook()

    # 1. Plain 4-digit PIN
    shop, pin = hook.parse_payload("4821")
    assert shop is None
    assert pin == "4821"

    # 2. 2D Barcode Payload
    shop, pin = hook.parse_payload("CBPMS:shop-demo-1:7193:job-98a2")
    assert shop == "shop-demo-1"
    assert pin == "7193"

    # 3. Invalid formats
    shop, pin = hook.parse_payload("INVALID_STRING")
    assert pin is None


def test_file_shredder():
    with tempfile.NamedTemporaryFile("wb", delete=False) as f:
        f.write(b"Confidential Customer Print Document Data 12345")
        temp_path = f.name

    assert os.path.exists(temp_path)
    success = file_shredder.shred_and_delete(temp_path, passes=1)
    assert success is True
    assert not os.path.exists(temp_path)


def test_spooler_bridge_mock_spool():
    printers = spooler_bridge.list_installed_printers()
    assert len(printers) > 0

    with tempfile.NamedTemporaryFile("wb", delete=False) as f:
        f.write(b"%PDF-1.4 Mock Spool Stream")
        temp_path = f.name

    try:
        res = spooler_bridge.spool_job(
            printers[0],
            temp_path,
            {"job_id": "test-job-1", "is_color": False, "duplex_mode": "simplex"}
        )
        assert res is True
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
