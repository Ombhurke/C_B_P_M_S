import os
import sys
import pytest
from unittest.mock import MagicMock, patch
from PySide6.QtWidgets import QApplication

os.environ["QT_QPA_PLATFORM"] = "offscreen"


@pytest.fixture(scope="session")
def qapp():
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)
    return app


def test_login_dialog_ui_initialization(qapp):
    from agent.ui.login_dialog import LoginDialog

    dlg = LoginDialog()
    assert dlg.windowTitle() == "CBPMS Counter Desk - Sign In"
    assert dlg.txt_username is not None
    assert dlg.txt_password is not None
    assert dlg.btn_login is not None
    assert dlg.btn_exit is not None
    assert dlg.lbl_error.isHidden()

    dlg.show()
    # Empty validation
    dlg.txt_username.setText("")
    dlg.txt_password.setText("")
    dlg.handle_login()
    assert not dlg.lbl_error.isHidden()
    assert "Please enter your operator username" in dlg.lbl_error.text()

    # Empty password validation
    dlg.txt_username.setText("valid_user")
    dlg.txt_password.setText("")
    dlg.handle_login()
    assert not dlg.lbl_error.isHidden()
    assert "Please enter your account password" in dlg.lbl_error.text()


def test_api_client_dynamic_shop_adoption(monkeypatch):
    from agent.core.api_client import DesktopApiClient
    from agent.core.config import agent_settings

    client = DesktopApiClient("http://127.0.0.1:8000/api/v1")

    # Mock response from /auth/login with dynamic shop assignment
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "access_token": "test-bearer-token-123",
        "user": {
            "username": "shop_operator",
            "shop_id": "auto-discovered-shop-42",
            "role": "operator"
        }
    }

    with patch("requests.post", return_value=mock_resp):
        client.login("shop_operator", "correct_password")

    assert client.token == "test-bearer-token-123"
    assert client.role == "operator"
    assert agent_settings.SHOP_ID == "auto-discovered-shop-42"


def test_api_client_login_invalid_credentials():
    from agent.core.api_client import DesktopApiClient

    client = DesktopApiClient("http://127.0.0.1:8000/api/v1")

    mock_resp = MagicMock()
    mock_resp.status_code = 401

    with patch("requests.post", return_value=mock_resp):
        with pytest.raises(ValueError, match="Invalid operator username or password"):
            client.login("bad_user", "wrong_pass")


def test_login_dialog_failure_signal(qapp):
    from agent.ui.login_dialog import LoginDialog

    dlg = LoginDialog()
    dlg.show()
    dlg.txt_password.setText("some_secret")

    # Simulate failure signal from worker thread
    dlg.login_failed.emit("Invalid username or password")
    assert not dlg.lbl_error.isHidden()
    assert "Invalid username or password" in dlg.lbl_error.text()
    assert dlg.txt_password.text() == ""  # Cleared for security
    assert dlg.result() != 1  # Not accepted
