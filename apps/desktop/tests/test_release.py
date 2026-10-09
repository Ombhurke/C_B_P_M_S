from pathlib import Path
from unittest.mock import Mock

from main import DesktopAgentApp
from agent.core.config import agent_settings
from agent.core.api_client import api_client
from agent.spooler.win32_spooler import spooler_bridge


def make_app(tmp_path, monkeypatch):
    spool_dir = tmp_path / "spool"
    spool_dir.mkdir()
    monkeypatch.setattr(agent_settings, "LOCAL_SPOOL_DIR", str(spool_dir))
    monkeypatch.setattr(agent_settings, "LOCAL_STATE_DIR", str(tmp_path / "state"))
    app = DesktopAgentApp()
    app.dashboard = Mock()
    app.refresh_queue = Mock()
    monkeypatch.setattr(api_client, "verify_release_token", Mock(return_value={
        "job_id": "job-test", "file_name": "document.pdf", "download_url": "/file", "file_hash": "hash"}))
    def download(url, path, expected_hash):
        Path(path).write_bytes(b"example")
    monkeypatch.setattr(api_client, "download_staged_document", download)
    notify = Mock(return_value={"shredded": False})
    monkeypatch.setattr(api_client, "notify_spool_completed", notify)
    return app, notify


def test_print_failure_never_reports_completed(tmp_path, monkeypatch):
    app, notify = make_app(tmp_path, monkeypatch)
    monkeypatch.setattr(spooler_bridge, "spool_job", Mock(return_value=False))
    app.handle_release_request("1234")
    notify.assert_called_once_with("job-test", "failed", "Printer did not accept the job")
    assert not list(Path(agent_settings.LOCAL_SPOOL_DIR).iterdir())


def test_download_failure_retains_cloud_job(tmp_path, monkeypatch):
    app, notify = make_app(tmp_path, monkeypatch)
    monkeypatch.setattr(api_client, "download_staged_document", Mock(side_effect=RuntimeError("network")))
    printer = Mock()
    monkeypatch.setattr(spooler_bridge, "spool_job", printer)
    app.handle_release_request("1234")
    printer.assert_not_called()
    notify.assert_called_once_with("job-test", "failed", "network")


def test_missing_printer_support_fails_closed(tmp_path, monkeypatch):
    monkeypatch.setattr(agent_settings, "MOCK_PRINTING", False)
    monkeypatch.setattr(spooler_bridge, "is_native_available", False)
    path = tmp_path / "file.pdf"
    path.write_bytes(b"test")
    import pytest
    with pytest.raises(RuntimeError, match="unavailable"):
        spooler_bridge.spool_job("missing", str(path), {})


def test_ack_failure_does_not_claim_purge(tmp_path, monkeypatch):
    app, notify = make_app(tmp_path, monkeypatch)
    monkeypatch.setattr(spooler_bridge, "spool_job", Mock(return_value=True))
    notify.side_effect = RuntimeError("offline")
    app.handle_release_request("1234")
    assert any("uncertain" in str(call) for call in app.dashboard.log.call_args_list)
    assert not list(Path(agent_settings.LOCAL_SPOOL_DIR).iterdir())
    assert len(app.completion_outbox.pending()) == 1


def test_uncertain_completion_is_retried_without_reprinting(tmp_path, monkeypatch):
    app, notify = make_app(tmp_path, monkeypatch)
    monkeypatch.setattr(spooler_bridge, "spool_job", Mock(return_value=True))
    notify.side_effect = RuntimeError("offline")
    app.handle_release_request("1234")
    pending = app.completion_outbox.pending()
    assert len(pending) == 1 and pending[0]["status"] == "completed"

    notify.side_effect = None
    notify.return_value = {"shredded": True}
    app.flush_completion_outbox()
    notify.assert_called_with("job-test", "completed", None)
    assert app.completion_outbox.pending() == []
