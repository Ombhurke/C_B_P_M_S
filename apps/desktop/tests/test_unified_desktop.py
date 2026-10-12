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
