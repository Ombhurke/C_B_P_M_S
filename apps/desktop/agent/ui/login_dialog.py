"""
CBPMS Counter Desk - Operator Login Dialog
Provides in-app authentication directly against the Supabase/FastAPI backend.
No .env configuration needed for shop operators.
"""

import json
import os
import threading
from PySide6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QWidget,
)
from PySide6.QtCore import Qt, Signal, Slot
from PySide6.QtGui import QFont

from agent.core.config import agent_settings
from agent.core.api_client import api_client
from agent.ui.theme import (
    COUNTER_DESK_STYLESHEET,
    COLOR_CANVAS,
    COLOR_CARD_BG,
    COLOR_BORDER,
    COLOR_TEXT_PRIMARY,
    COLOR_TEXT_MUTED,
    COLOR_OLIVE,
    COLOR_TERRACOTTA,
    COLOR_WARNING_BG,
)


class LoginDialog(QDialog):
    login_successful = Signal(dict)
    login_failed = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("CBPMS Counter Desk - Sign In")
        self.setFixedSize(460, 560)
        self.setStyleSheet(COUNTER_DESK_STYLESHEET)
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint)

        self.session_file = os.path.join(agent_settings.LOCAL_STATE_DIR, "session.json")
        self._is_authenticating = False

        self._build_ui()
        self._load_saved_session()

        self.login_successful.connect(self._on_login_success)
        self.login_failed.connect(self._on_login_failure)

    def _build_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(32, 32, 32, 32)
        main_layout.setSpacing(20)

        # Main Card Container
        card = QFrame()
        card.setObjectName("card")
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(24, 24, 24, 24)
        card_layout.setSpacing(16)

        # Header Badge & Title
        header_widget = QWidget()
        header_layout = QVBoxLayout(header_widget)
        header_layout.setContentsMargins(0, 0, 0, 0)
        header_layout.setSpacing(6)

        brand_lbl = QLabel("CBPMS CLOUD PRINTING")
        brand_lbl.setStyleSheet(f"color: {COLOR_OLIVE}; font-size: 11px; font-weight: 700; letter-spacing: 1.5px;")
        header_layout.addWidget(brand_lbl)

        title_lbl = QLabel("Counter Desk Sign-In")
        title_lbl.setStyleSheet(f"color: {COLOR_TEXT_PRIMARY}; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;")
        header_layout.addWidget(title_lbl)

        subtitle_lbl = QLabel("Enter your shop operator credentials to unlock the desk.")
        subtitle_lbl.setStyleSheet(f"color: {COLOR_TEXT_MUTED}; font-size: 13px;")
        subtitle_lbl.setWordWrap(True)
        header_layout.addWidget(subtitle_lbl)

        card_layout.addWidget(header_widget)

        # Error Banner (Hidden by default)
        self.lbl_error = QLabel()
        self.lbl_error.setWordWrap(True)
        self.lbl_error.setStyleSheet(
            f"background-color: {COLOR_WARNING_BG}; color: #a63a24; border: 1px solid #f1c3be; "
            f"border-radius: 6px; padding: 10px 14px; font-size: 13px; font-weight: 500;"
        )
        self.lbl_error.hide()
        card_layout.addWidget(self.lbl_error)

        # Username Input
        user_group = QVBoxLayout()
        user_group.setSpacing(6)
        user_lbl = QLabel("Username")
        user_lbl.setStyleSheet(f"color: {COLOR_TEXT_PRIMARY}; font-size: 13px; font-weight: 600;")
        self.txt_username = QLineEdit()
        self.txt_username.setPlaceholderText("e.g. operator1 or admin")
        self.txt_username.returnPressed.connect(self._focus_password)
        user_group.addWidget(user_lbl)
        user_group.addWidget(self.txt_username)
        card_layout.addLayout(user_group)

        # Password Input
        pass_group = QVBoxLayout()
        pass_group.setSpacing(6)
        pass_lbl = QLabel("Password")
        pass_lbl.setStyleSheet(f"color: {COLOR_TEXT_PRIMARY}; font-size: 13px; font-weight: 600;")
        self.txt_password = QLineEdit()
        self.txt_password.setEchoMode(QLineEdit.Password)
        self.txt_password.setPlaceholderText("••••••••••••")
        self.txt_password.returnPressed.connect(self.handle_login)
        pass_group.addWidget(pass_lbl)
        pass_group.addWidget(self.txt_password)
        card_layout.addLayout(pass_group)

        # Advanced Server URL (Collapsible)
        self.server_box = QWidget()
        server_layout = QVBoxLayout(self.server_box)
        server_layout.setContentsMargins(0, 4, 0, 0)
        server_layout.setSpacing(4)
        server_lbl = QLabel("Cloud API Endpoint")
        server_lbl.setStyleSheet(f"color: {COLOR_TEXT_MUTED}; font-size: 11px; font-weight: 600;")
        self.txt_server_url = QLineEdit()
        self.txt_server_url.setText(agent_settings.CLOUD_API_URL)
        self.txt_server_url.setStyleSheet("font-size: 12px; padding: 6px 10px; min-height: 32px;")
        server_layout.addWidget(server_lbl)
        server_layout.addWidget(self.txt_server_url)
        self.server_box.hide()

        self.btn_toggle_server = QPushButton("⚙ Advanced Server Settings")
        self.btn_toggle_server.setStyleSheet(
            f"border: none; background: transparent; color: {COLOR_TEXT_MUTED}; font-size: 12px; text-align: left; padding: 2px 0;"
        )
        self.btn_toggle_server.setCursor(Qt.PointingHandCursor)
        self.btn_toggle_server.clicked.connect(self._toggle_server_settings)
        card_layout.addWidget(self.btn_toggle_server)
        card_layout.addWidget(self.server_box)

        # Buttons
        card_layout.addSpacing(6)
        self.btn_login = QPushButton("Sign In to Counter Desk")
        self.btn_login.setObjectName("primaryAction")
        self.btn_login.setCursor(Qt.PointingHandCursor)
        self.btn_login.clicked.connect(self.handle_login)
        card_layout.addWidget(self.btn_login)

        self.btn_exit = QPushButton("Exit Application")
        self.btn_exit.setCursor(Qt.PointingHandCursor)
        self.btn_exit.clicked.connect(self.reject)
        card_layout.addWidget(self.btn_exit)

        main_layout.addWidget(card)

    def _toggle_server_settings(self):
        if self.server_box.isVisible():
            self.server_box.hide()
            self.btn_toggle_server.setText("⚙ Advanced Server Settings")
        else:
            self.server_box.show()
            self.btn_toggle_server.setText("⚙ Hide Server Settings")

    def _focus_password(self):
        self.txt_password.setFocus()

    def _load_saved_session(self):
        try:
            if os.path.exists(self.session_file):
                with open(self.session_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data.get("username"):
                        self.txt_username.setText(data["username"])
                        self.txt_password.setFocus()
                    if data.get("server_url"):
                        self.txt_server_url.setText(data["server_url"])
                        agent_settings.CLOUD_API_URL = data["server_url"]
                        api_client.set_base_url(data["server_url"])
        except Exception:
            pass

    def _save_session(self, username: str, server_url: str):
        try:
            os.makedirs(os.path.dirname(self.session_file), exist_ok=True)
            with open(self.session_file, "w", encoding="utf-8") as f:
                json.dump({
                    "username": username,
                    "server_url": server_url,
                    "shop_id": agent_settings.SHOP_ID,
                }, f, indent=2)
        except Exception:
            pass

    def handle_login(self):
        if self._is_authenticating:
            return

        username = self.txt_username.text().strip()
        password = self.txt_password.text().strip()
        server_url = self.txt_server_url.text().strip()

        if not username:
            self._show_error("Please enter your operator username.")
            self.txt_username.setFocus()
            return

        if not password:
            self._show_error("Please enter your account password.")
            self.txt_password.setFocus()
            return

        self._set_loading(True)
        self.lbl_error.hide()

        # Update base url if changed
        if server_url:
            agent_settings.CLOUD_API_URL = server_url
            api_client.set_base_url(server_url)

        def worker():
            try:
                api_client.login(username, password)
                self.login_successful.emit({
                    "username": username,
                    "server_url": server_url,
                    "shop_id": agent_settings.SHOP_ID,
                    "role": getattr(api_client, "role", "operator"),
                })
            except ValueError as val_err:
                self.login_failed.emit(str(val_err))
            except ConnectionError as conn_err:
                self.login_failed.emit("Could not reach backend server. Check your internet connection or server URL.")
            except Exception as exc:
                self.login_failed.emit(f"Authentication failed: {exc}")

        threading.Thread(target=worker, daemon=True).start()

    def _set_loading(self, loading: bool):
        self._is_authenticating = loading
        self.btn_login.setEnabled(not loading)
        self.txt_username.setEnabled(not loading)
        self.txt_password.setEnabled(not loading)
        self.btn_exit.setEnabled(not loading)
        if loading:
            self.btn_login.setText("Authenticating with Cloud...")
        else:
            self.btn_login.setText("Sign In to Counter Desk")

    def _show_error(self, message: str):
        self.lbl_error.setText(message)
        self.lbl_error.show()

    @Slot(dict)
    def _on_login_success(self, user_info: dict):
        self._set_loading(False)
        self._save_session(user_info["username"], user_info["server_url"])
        self.accept()

    @Slot(str)
    def _on_login_failure(self, error_message: str):
        self._set_loading(False)
        self._show_error(error_message)
        self.txt_password.clear()
        self.txt_password.setFocus()
