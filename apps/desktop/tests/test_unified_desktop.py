import os
import sys
import pytest
from PySide6.QtWidgets import QApplication

os.environ["QT_QPA_PLATFORM"] = "offscreen"


@pytest.fixture(scope="session")
def qapp():
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)
    return app


def test_shell_navigation_and_views(qapp):
    from agent.ui.shell import CounterDeskShell
    shell = CounterDeskShell()

    # Initial view should be overview
    assert shell.stack.currentIndex() == 0

    # Navigate through all 8 sections
    shell.navigate_to("queue")
    assert shell.stack.currentIndex() == 1

    shell.navigate_to("review")
    assert shell.stack.currentIndex() == 2

    shell.navigate_to("monitor")
    assert shell.stack.currentIndex() == 3

    shell.navigate_to("printers")
    assert shell.stack.currentIndex() == 4

    shell.navigate_to("rates")
    assert shell.stack.currentIndex() == 5

    shell.navigate_to("team")
    assert shell.stack.currentIndex() == 6

    shell.navigate_to("recovery")
    assert shell.stack.currentIndex() == 7

    shell.navigate_to("settings")
    assert shell.stack.currentIndex() == 8


def test_shell_top_bar_updates(qapp):
    from agent.ui.shell import CounterDeskShell
    shell = CounterDeskShell()

    shell.update_top_bar("Test Print Shop", "Station Beta", "admin", True)
    assert "Test Print Shop" in shell.lbl_shop_top.text()
    assert "Station Beta" in shell.lbl_station_top.text()
    assert "Admin" in shell.lbl_role_top.text()
    assert "Live" in shell.lbl_cloud_status.text()

    shell.update_top_bar("Test Print Shop", "Station Beta", "operator", False)
    assert "Offline" in shell.lbl_cloud_status.text()


def test_staff_creation_removed_but_roster_and_profile_remain(qapp):
    from PySide6.QtWidgets import QPushButton
    from agent.ui.shell import CounterDeskShell
    from agent.core.api_client import DesktopApiClient
    from main import DesktopAgentController

    shell = CounterDeskShell()
    view = shell.v_team
    view.update_data(
        [{"username": "existing.operator", "role": "operator", "active": True}],
        {"name": "Test shop", "address": "Test address"}, True,
    )
    assert view.table.rowCount() == 1
    assert view.table.item(0, 0).text() == "existing.operator"
    assert view.btn_edit_profile.isEnabled()
    assert "Test shop" in view.lbl_shop_name.text()
    assert not any("add staff" in b.text().lower() for b in view.findChildren(QPushButton))
    assert not hasattr(view, "invite_staff_requested")
    assert not hasattr(shell, "staff_invited")
    assert not hasattr(DesktopAgentController, "handle_invite_staff")
    assert not hasattr(DesktopApiClient, "invite_team_member")
    view.update_data([], {}, False)
    assert not view.btn_edit_profile.isEnabled()
    shell.close()


def test_review_view_compatibility_blocks_unsupported(qapp):
    from agent.ui.views.review_view import ReviewView
    rv = ReviewView()
    rv.set_printers(["HP LaserJet"], "HP LaserJet")

    # Incompatible job: Duplex
    job = {
        "job_id": "job-1",
        "file_name": "test.pdf",
        "duplex_mode": "duplex_long",
        "is_color": False,
        "copy_count": 1
    }
    rv.set_job(job)
    assert rv.btn_print.isEnabled() is False
    assert "Duplex is not supported" in rv.lbl_compat_status.text()

    # Compatible job
    job_compat = {
        "job_id": "job-2",
        "file_name": "test.pdf",
        "duplex_mode": "simplex",
        "is_color": False,
        "copy_count": 1
    }
    rv.set_job(job_compat)
    assert rv.btn_print.isEnabled() is True
    assert "Compatible" in rv.lbl_compat_status.text()


def test_metadata_only_review_blocks_print(qapp):
    from agent.ui.views.review_view import ReviewView
    rv = ReviewView()
    rv.set_printers(["HP LaserJet"], "HP LaserJet")

    # Metadata-only job (e.g. clicked from queue row without authorization scan)
    job_metadata = {
        "job_id": "job-queue-only",
        "file_name": "test.pdf",
        "duplex_mode": "simplex",
        "is_color": False,
        "copy_count": 1,
        "is_metadata_only": True
    }
    rv.set_job(job_metadata)
    assert rv.btn_print.isEnabled() is False
    assert "Scan receipt or enter release code" in rv.lbl_compat_status.text()


def test_station_lock_unlock_validation(qapp):
    from agent.ui.shell import CounterDeskShell
    shell = CounterDeskShell()

    validated = []
    def validator(pwd: str):
        ok = (pwd == "correct_staff_pass")
        validated.append(ok)
        return ok

    shell.set_unlock_validator(validator)
    assert shell.unlock_validator("wrong_pass") is False
    assert shell.unlock_validator("correct_staff_pass") is True
    shell.close()


def test_station_printer_config_persistence(tmp_path, monkeypatch, qapp):
    from agent.core.config import agent_settings
    from agent.ui.shell import CounterDeskShell
    from main import DesktopAgentController

    monkeypatch.setattr(agent_settings, "LOCAL_STATE_DIR", str(tmp_path))
    shell = CounterDeskShell()
    ctrl = DesktopAgentController(shell, qapp)

    ctrl.handle_printer_change("Custom Office Printer")
    assert ctrl.selected_printer == "Custom Office Printer"

    # Reload from saved config
    ctrl2 = DesktopAgentController(shell, qapp)
    assert ctrl2.selected_printer == "Custom Office Printer"
    shell.close()
