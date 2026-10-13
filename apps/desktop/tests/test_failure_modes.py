from pathlib import Path
from unittest.mock import Mock
import pytest

from agent.core.config import agent_settings
from agent.core.api_client import api_client, DesktopApiClient
from agent.core.lifecycle import PrintLifecycleManager, JobLifecycleStage
from agent.core.completion_outbox import CompletionOutbox
from agent.spooler.win32_spooler import spooler_bridge


def setup_env(tmp_path, monkeypatch):
    spool_dir = tmp_path / "spool"
    spool_dir.mkdir(parents=True, exist_ok=True)
    state_dir = tmp_path / "state"
    state_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(agent_settings, "LOCAL_SPOOL_DIR", str(spool_dir))
    monkeypatch.setattr(agent_settings, "LOCAL_STATE_DIR", str(state_dir))

    logs = []
    manager = PrintLifecycleManager(on_log=lambda m: logs.append(m))
    return manager, logs


def test_wrong_shop_token_rejected():
    client = DesktopApiClient()
    with pytest.raises(ValueError, match="belongs to another shop"):
        client.verify_release_token("1234", shop_id="different-shop-id")


def test_download_hash_mismatch_blocks_preview_and_shreds(tmp_path, monkeypatch):
    manager, logs = setup_env(tmp_path, monkeypatch)

    monkeypatch.setattr(api_client, "verify_release_token", Mock(return_value={
        "job_id": "job-tampered",
        "file_name": "tampered.pdf",
        "download_url": "/file",
        "file_hash": "expected_valid_hash"
    }))

    # Server returns content with mismatching hash
    def fake_tampered_download(url, path, expected_hash):
        if expected_hash != "different_hash":
            raise ValueError("Downloaded document failed integrity verification")
    monkeypatch.setattr(api_client, "download_staged_document", fake_tampered_download)

    job = manager.find_and_review("1234")
    assert job is not None
    # Local file path must not be set or retained
    assert manager.local_file_path is None
    assert any("integrity verification" in log or "Failed to load preview" in log for log in logs)


def test_duplicate_print_click_is_serialized(tmp_path, monkeypatch):
    manager, logs = setup_env(tmp_path, monkeypatch)

    monkeypatch.setattr(api_client, "verify_release_token", Mock(return_value={
        "job_id": "job-dup",
        "file_name": "doc.pdf",
        "download_url": "/file",
        "file_hash": "hash",
        "is_color": False,
        "duplex_mode": "simplex",
        "copy_count": 1,
        "layout_nup": 1
    }))
    monkeypatch.setattr(api_client, "download_staged_document", lambda u, p, h: Path(p).write_bytes(b"%PDF"))
    manager.find_and_review("1234")

    # Lock the dispatch lock manually to simulate concurrent click
    assert manager.dispatch_lock.acquire(blocking=False) is True
    # Second click while dispatch is active
    second_submit = manager.submit_print("HP LaserJet")
    assert second_submit is False
    assert any("already running" in log for log in logs)
    manager.dispatch_lock.release()


def test_unsupported_printer_settings_all_blocked(tmp_path, monkeypatch):
    manager, logs = setup_env(tmp_path, monkeypatch)

    base_job = {
        "job_id": "job-checks",
        "file_name": "doc.pdf",
        "is_color": False,
        "duplex_mode": "simplex",
        "copy_count": 1,
        "layout_nup": 1
    }

    # 1. Non-PDF blocked
    job_txt = {**base_job, "file_name": "doc.txt"}
    ok, reason = manager.validate_compatibility("Printer", job_txt)
    assert not ok and "Only PDF" in reason

    # 2. Color requested but station raw path is B&W
    job_color = {**base_job, "is_color": True}
    ok, reason = manager.validate_compatibility("Printer", job_color)
    assert not ok and "Color requested" in reason

    # 3. Duplex requested but raw path is simplex
    job_duplex = {**base_job, "duplex_mode": "duplex_long"}
    ok, reason = manager.validate_compatibility("Printer", job_duplex)
    assert not ok and "Duplex is not supported" in reason

    # 4. Multi-copy requested
    job_copies = {**base_job, "copy_count": 3}
    ok, reason = manager.validate_compatibility("Printer", job_copies)
    assert not ok and "copies requested" in reason

    # 5. N-up layout requested
    job_nup = {**base_job, "layout_nup": 2}
    ok, reason = manager.validate_compatibility("Printer", job_nup)
    assert not ok and "2-up layout" in reason


def test_outbox_replay_persists_across_restart_without_reprinting(tmp_path):
    state_dir = tmp_path / "state"
    state_dir.mkdir(parents=True, exist_ok=True)

    # First session enqueues pending sync
    outbox1 = CompletionOutbox(str(state_dir))
    outbox1.enqueue("job-persisted", "completed", notes="Verified by operator")
    assert len(outbox1.pending()) == 1

    # Simulate station crash & restart: instantiate fresh outbox
    outbox2 = CompletionOutbox(str(state_dir))
    pending = outbox2.pending()
    assert len(pending) == 1
    assert pending[0]["job_id"] == "job-persisted"
    assert pending[0]["status"] == "completed"
    assert pending[0]["notes"] == "Verified by operator"

    # Acknowledge and ensure removal
    outbox2.acknowledge(pending[0])
    assert outbox2.pending() == []


def test_a_to_b_dispatch_mismatch_is_blocked(tmp_path, monkeypatch):
    manager, logs = setup_env(tmp_path, monkeypatch)

    monkeypatch.setattr(api_client, "verify_release_token", Mock(return_value={
        "job_id": "job-A",
        "file_name": "docA.pdf",
        "download_url": "/fileA",
        "file_hash": "hashA",
        "is_color": False,
        "duplex_mode": "simplex",
        "copy_count": 1,
        "layout_nup": 1
    }))
    monkeypatch.setattr(api_client, "download_staged_document", lambda u, p, h: Path(p).write_bytes(b"%PDF"))
    manager.find_and_review("1234")

    assert manager.active_job["job_id"] == "job-A"

    # Attempt dispatch targeting job-B while job-A is active
    mismatch_dispatch = manager.submit_print("HP LaserJet", target_job_id="job-B")
    assert mismatch_dispatch is False
    assert any("does not match active authorized context job-A" in log for log in logs)


def test_scan_blocked_while_dispatch_or_confirmation_active(tmp_path, monkeypatch):
    manager, logs = setup_env(tmp_path, monkeypatch)

    manager.stage = JobLifecycleStage.SUBMITTING
    job = manager.find_and_review("1234")
    assert job is None
    assert any("Cannot start new review while a print dispatch is in progress" in log for log in logs)


def test_report_issue_permanent_4xx_not_enqueued_into_outbox(tmp_path, monkeypatch):
    manager, logs = setup_env(tmp_path, monkeypatch)
    manager.active_job = {"job_id": "job-test-422"}

    # Mock 422 Unprocessable Entity error
    class MockHTTPError(Exception):
        def __init__(self):
            self.response = Mock(status_code=422)

    monkeypatch.setattr(api_client, "report_issue", Mock(side_effect=MockHTTPError()))

    res = manager.report_issue(issue_type="hardware_error", notes="bad")
    assert res is False
    assert manager.completion_outbox.pending() == []
    assert any("rejected permanently by server (422" in log for log in logs)
