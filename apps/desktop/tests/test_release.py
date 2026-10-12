from pathlib import Path
from unittest.mock import Mock
import pytest

from agent.core.config import agent_settings
from agent.core.api_client import api_client
from agent.core.lifecycle import PrintLifecycleManager, JobLifecycleStage
from agent.spooler.win32_spooler import spooler_bridge


def make_lifecycle(tmp_path, monkeypatch):
    spool_dir = tmp_path / "spool"
    spool_dir.mkdir(parents=True, exist_ok=True)
    state_dir = tmp_path / "state"
    state_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(agent_settings, "LOCAL_SPOOL_DIR", str(spool_dir))
    monkeypatch.setattr(agent_settings, "LOCAL_STATE_DIR", str(state_dir))

    logs = []
    manager = PrintLifecycleManager(on_log=lambda m: logs.append(m))

    monkeypatch.setattr(api_client, "verify_release_token", Mock(return_value={
        "job_id": "job-test-101",
        "file_name": "document.pdf",
        "download_url": "/file",
        "file_hash": "hash123",
        "is_color": False,
        "duplex_mode": "simplex",
        "copy_count": 1,
        "layout_nup": 1
    }))

    def fake_download(url, path, expected_hash):
        Path(path).write_bytes(b"%PDF-1.4 Fake PDF Content")
    monkeypatch.setattr(api_client, "download_staged_document", fake_download)

    return manager, logs


def test_find_and_review_never_prints(tmp_path, monkeypatch):
    manager, logs = make_lifecycle(tmp_path, monkeypatch)
    spool_mock = Mock()
    monkeypatch.setattr(spooler_bridge, "spool_job", spool_mock)

    job = manager.find_and_review("4821")

    assert job is not None
    assert manager.stage == JobLifecycleStage.REVIEWING
    # Invariant: Scanning/reviewing must NEVER trigger spool_job
    spool_mock.assert_not_called()
    assert manager.local_file_path is not None
    assert Path(manager.local_file_path).exists()


def test_print_blocked_for_unsupported_settings(tmp_path, monkeypatch):
    manager, logs = make_lifecycle(tmp_path, monkeypatch)
    manager.find_and_review("4821")

    # Set duplex which is unsupported in raw mode
    manager.active_job["duplex_mode"] = "duplex_long"
    spool_mock = Mock()
    monkeypatch.setattr(spooler_bridge, "spool_job", spool_mock)

    success = manager.submit_print("HP LaserJet Pro")
    assert success is False
    spool_mock.assert_not_called()
    assert any("Duplex is not supported" in log for log in logs)


def test_submit_print_transitions_to_spool_accepted(tmp_path, monkeypatch):
    manager, logs = make_lifecycle(tmp_path, monkeypatch)
    manager.find_and_review("4821")

    monkeypatch.setattr(spooler_bridge, "spool_job", Mock(return_value=True))
    success = manager.submit_print("HP LaserJet Pro")

    assert success is True
    assert manager.stage == JobLifecycleStage.AWAITING_CONFIRMATION
    assert manager.active_spool_id is not None


def test_confirm_output_cleans_local_file_and_completes(tmp_path, monkeypatch):
    manager, logs = make_lifecycle(tmp_path, monkeypatch)
    manager.find_and_review("4821")
    monkeypatch.setattr(spooler_bridge, "spool_job", Mock(return_value=True))
    manager.submit_print("HP LaserJet Pro")

    confirm_mock = Mock(return_value={"status": "completed"})
    monkeypatch.setattr(api_client, "confirm_output", confirm_mock)

    res = manager.confirm_output("Verified by operator")
    assert res is True
    confirm_mock.assert_called_once_with("job-test-101", notes="Verified by operator")
    # Sandboxed local file must be shredded
    assert manager.local_file_path is None


def test_failed_confirmation_enqueues_outbox_without_reprint(tmp_path, monkeypatch):
    manager, logs = make_lifecycle(tmp_path, monkeypatch)
    manager.find_and_review("4821")
    monkeypatch.setattr(spooler_bridge, "spool_job", Mock(return_value=True))
    manager.submit_print("HP LaserJet Pro")

    # Network drops during confirmation
    confirm_mock = Mock(side_effect=RuntimeError("Offline"))
    monkeypatch.setattr(api_client, "confirm_output", confirm_mock)

    res = manager.confirm_output("Verified by operator")
    assert res is True
    pending = manager.completion_outbox.pending()
    assert len(pending) == 1
    assert pending[0]["job_id"] == "job-test-101"

    # Flush outbox when network returns
    confirm_mock.side_effect = None
    spool_mock = Mock()
    monkeypatch.setattr(spooler_bridge, "spool_job", spool_mock)

    flushed = manager.flush_outbox()
    assert flushed == 1
    assert manager.completion_outbox.pending() == []
    # Invariant: Flushed outbox item reports result only, NEVER re-spools
    spool_mock.assert_not_called()


def test_abandon_claim_releases_server_claim(tmp_path, monkeypatch):
    manager, logs = make_lifecycle(tmp_path, monkeypatch)
    manager.find_and_review("4821")

    abandon_mock = Mock(return_value={"ok": True})
    monkeypatch.setattr(api_client, "abandon_job_claim", abandon_mock)

    res = manager.abandon_claim()
    assert res is True
    abandon_mock.assert_called_once_with("job-test-101")
    assert manager.stage == JobLifecycleStage.IDLE
