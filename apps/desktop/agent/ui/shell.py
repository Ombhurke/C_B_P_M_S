"""Unified Counter Desk Shell (PySide6).
Implements the 232px sidebar navigation, persistent top status strip,
view stacking, and station lock overlay.
"""
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QStackedWidget, QFrame, QDialog, QLineEdit, QMessageBox
)
from PySide6.QtCore import Qt, Signal
from agent.ui.theme import (
    COUNTER_DESK_STYLESHEET, COLOR_SIDEBAR, COLOR_BORDER, COLOR_OLIVE,
    COLOR_TEXT_PRIMARY, COLOR_TEXT_MUTED
)
from agent.ui.views.overview_view import OverviewView
from agent.ui.views.queue_view import QueueView
from agent.ui.views.review_view import ReviewView
from agent.ui.views.active_prints_view import ActivePrintsView
from agent.ui.views.printers_view import PrintersView
from agent.ui.views.rates_view import RatesView
from agent.ui.views.staff_view import StaffView
from agent.ui.views.recovery_view import RecoveryView
from agent.ui.views.settings_view import SettingsView


class CounterDeskShell(QMainWindow):
    # Signals for controller integration
    nav_changed = Signal(str)
    scan_submitted = Signal(str)
    print_submitted = Signal(str, str)
    confirm_output_submitted = Signal(str)
    report_problem_submitted = Signal(str, str)
    hold_submitted = Signal(str, str)
    abandon_review_submitted = Signal()
    rates_saved = Signal(dict)
    profile_updated = Signal(dict)
    map_printer_submitted = Signal(str)
    reconnect_submitted = Signal()
    retry_sync_submitted = Signal()
    sign_out_submitted = Signal()

    def __init__(self):
        super().__init__()
        self.setWindowTitle("CBPMS — Counter Desk Desktop")
        self.resize(1440, 900)
        self.setMinimumSize(1180, 720)
        self.setStyleSheet(COUNTER_DESK_STYLESHEET)
        self.is_locked = False
        self.nav_buttons = {}

        self._init_shell()

    def _init_shell(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        root_layout = QVBoxLayout(central_widget)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        # 1. Top Bar
        top_bar = QFrame()
        top_bar.setStyleSheet(f"background-color: #ffffff; border-bottom: 1px solid {COLOR_BORDER}; padding: 6px 20px;")
        top_bar.setFixedHeight(54)
        tb_layout = QHBoxLayout(top_bar)
        tb_layout.setContentsMargins(16, 0, 16, 0)

        brand_lbl = QLabel("CBPMS | COUNTER DESK DESKTOP")
        brand_lbl.setStyleSheet(f"font-weight: 700; font-size: 15px; color: {COLOR_TEXT_PRIMARY}; letter-spacing: 0.5px;")
        tb_layout.addWidget(brand_lbl)

        sep = QLabel("•")
        sep.setStyleSheet(f"color: {COLOR_BORDER}; margin: 0 8px;")
        tb_layout.addWidget(sep)

        self.lbl_shop_top = QLabel("Selected shop: QuickPrints")
        self.lbl_shop_top.setStyleSheet(f"color: {COLOR_TEXT_MUTED}; font-size: 14px;")
        tb_layout.addWidget(self.lbl_shop_top)

        sep2 = QLabel("•")
        sep2.setStyleSheet(f"color: {COLOR_BORDER}; margin: 0 8px;")
        tb_layout.addWidget(sep2)

        self.lbl_station_top = QLabel("This station: Mapped")
        self.lbl_station_top.setStyleSheet(f"color: {COLOR_TEXT_MUTED}; font-size: 14px;")
        tb_layout.addWidget(self.lbl_station_top)

        sep3 = QLabel("•")
        sep3.setStyleSheet(f"color: {COLOR_BORDER}; margin: 0 8px;")
        tb_layout.addWidget(sep3)

        self.lbl_role_top = QLabel("Role: Operator")
        self.lbl_role_top.setStyleSheet(f"color: {COLOR_TEXT_MUTED}; font-size: 14px;")
        tb_layout.addWidget(self.lbl_role_top)

        tb_layout.addStretch()

        self.lbl_cloud_status = QLabel("● Cloud connected · Live")
        self.lbl_cloud_status.setStyleSheet(f"color: {COLOR_OLIVE}; font-weight: 600; font-size: 13px;")
        tb_layout.addWidget(self.lbl_cloud_status)

        root_layout.addWidget(top_bar)

        # 2. Main Content (Sidebar + Stack)
        body_layout = QHBoxLayout()
        body_layout.setContentsMargins(0, 0, 0, 0)
        body_layout.setSpacing(0)

        # 232px Sidebar
        sidebar = QWidget()
        sidebar.setObjectName("sidebar")
        sidebar.setFixedWidth(232)
        sb_layout = QVBoxLayout(sidebar)
        sb_layout.setContentsMargins(12, 20, 12, 20)
        sb_layout.setSpacing(4)

        nav_items = [
            ("overview", "Overview"),
            ("queue", "Print queue"),
            ("monitor", "Active prints"),
            ("printers", "Printers & stations"),
            ("rates", "Services & rates"),
            ("team", "Staff & shop"),
            ("recovery", "History & recovery"),
            ("settings", "Station settings"),
        ]

        for nav_id, label in nav_items:
            btn = QPushButton(label)
            btn.setObjectName("navButton")
            btn.clicked.connect(lambda chk, nid=nav_id: self.navigate_to(nid))
            sb_layout.addWidget(btn)
            self.nav_buttons[nav_id] = btn

        sb_layout.addStretch()

        btn_lock = QPushButton("Lock station")
        btn_lock.setObjectName("navButton")
        btn_lock.clicked.connect(self._lock_station)
        sb_layout.addWidget(btn_lock)

        btn_signout = QPushButton("Sign out")
        btn_signout.setObjectName("navButton")
        btn_signout.clicked.connect(self.sign_out_submitted.emit)
        sb_layout.addWidget(btn_signout)

        body_layout.addWidget(sidebar)

        # View Stack
        self.stack = QStackedWidget()
        self.stack.setObjectName("contentArea")

        self.v_overview = OverviewView()
        self.v_queue = QueueView()
        self.v_review = ReviewView()
        self.v_monitor = ActivePrintsView()
        self.v_printers = PrintersView()
        self.v_rates = RatesView()
        self.v_team = StaffView()
        self.v_recovery = RecoveryView()
        self.v_settings = SettingsView()

        self.stack.addWidget(self.v_overview)     # 0
        self.stack.addWidget(self.v_queue)        # 1
        self.stack.addWidget(self.v_review)       # 2
        self.stack.addWidget(self.v_monitor)      # 3
        self.stack.addWidget(self.v_printers)     # 4
        self.stack.addWidget(self.v_rates)        # 5
        self.stack.addWidget(self.v_team)         # 6
        self.stack.addWidget(self.v_recovery)     # 7
        self.stack.addWidget(self.v_settings)     # 8

        body_layout.addWidget(self.stack, 1)
        root_layout.addLayout(body_layout)

        self._wire_signals()
        self.navigate_to("overview")

    def _wire_signals(self):
        # Overview
        self.v_overview.open_queue_requested.connect(lambda: self.navigate_to("queue"))
        self.v_overview.review_job_requested.connect(self.open_review_for_job_id)

        # Queue
        self.v_queue.find_review_requested.connect(self.scan_submitted.emit)
        self.v_queue.open_review_requested.connect(self.open_review_for_job)
        self.v_queue.hold_job_requested.connect(self.hold_submitted.emit)

        # Review
        self.v_review.print_requested.connect(self.print_submitted.emit)
        self.v_review.back_to_queue_requested.connect(self._on_back_to_queue)
        self.v_review.hold_requested.connect(self.hold_submitted.emit)

        # Monitor
        self.v_monitor.confirm_output_requested.connect(self.confirm_output_submitted.emit)
        self.v_monitor.report_problem_requested.connect(self.report_problem_submitted.emit)

        # Printers
        self.v_printers.map_printer_requested.connect(self.map_printer_submitted.emit)
        self.v_printers.refresh_printers_requested.connect(self.reconnect_submitted.emit)

        # Rates
        self.v_rates.save_rates_requested.connect(self.rates_saved.emit)

        # Staff
        self.v_team.update_profile_requested.connect(self.profile_updated.emit)

        # Recovery
        self.v_recovery.retry_sync_requested.connect(self.retry_sync_submitted.emit)

        # Settings
        self.v_settings.reconnect_requested.connect(self.reconnect_submitted.emit)
        self.v_settings.lock_station_requested.connect(self._lock_station)
        self.v_settings.printer_changed.connect(self.map_printer_submitted.emit)
        self.v_settings.view_recovery_requested.connect(lambda: self.navigate_to("recovery"))
        self.v_settings.sign_out_requested.connect(self.sign_out_submitted.emit)

    def set_unlock_validator(self, validator_fn):
        self.unlock_validator = validator_fn

    def navigate_to(self, view_id: str):
        indices = {
            "overview": 0, "queue": 1, "review": 2, "monitor": 3,
            "printers": 4, "rates": 5, "team": 6, "recovery": 7, "settings": 8
        }
        if view_id in indices:
            self.stack.setCurrentIndex(indices[view_id])
            for nid, btn in self.nav_buttons.items():
                btn.setProperty("active", "true" if nid == view_id else "false")
                btn.style().unpolish(btn)
                btn.style().polish(btn)
            self.nav_changed.emit(view_id)

    def open_review_for_job(self, job: dict):
        self.abandon_review_submitted.emit()
        job_copy = dict(job)
        job_copy["is_metadata_only"] = True
        job_copy["is_authorized"] = False
        self.v_review.set_job(job_copy)
        self.navigate_to("review")

    def open_review_for_job_id(self, job_id: str):
        # Find in queue or request load
        for j in getattr(self.v_queue, "raw_jobs", []):
            if j.get("id") == job_id or j.get("job_id") == job_id:
                self.open_review_for_job(j)
                return
        self.navigate_to("queue")

    def _on_back_to_queue(self):
        self.abandon_review_submitted.emit()
        self.navigate_to("queue")

    def update_top_bar(self, shop_name: str, station_name: str, role: str, is_online: bool):
        self.lbl_shop_top.setText(f"Shop: {shop_name}")
        self.lbl_station_top.setText(f"Station: {station_name}")
        self.lbl_role_top.setText(f"Role: {role.capitalize()}")
        if is_online:
            self.lbl_cloud_status.setText("● Cloud connected · Live")
            self.lbl_cloud_status.setStyleSheet(f"color: {COLOR_OLIVE}; font-weight: 600; font-size: 13px;")
        else:
            self.lbl_cloud_status.setText("○ Disconnected · Offline")
            self.lbl_cloud_status.setStyleSheet("color: #a63a24; font-weight: 600; font-size: 13px;")

    def _lock_station(self):
        self.is_locked = True
        dialog = QDialog(self)
        dialog.setWindowTitle("Station Locked")
        dialog.setFixedSize(400, 260)
        dialog.setWindowFlags(dialog.windowFlags() | Qt.WindowStaysOnTopHint | Qt.CustomizeWindowHint)
        d_layout = QVBoxLayout(dialog)
        d_layout.setContentsMargins(28, 28, 28, 28)
        d_layout.setSpacing(12)

        l_title = QLabel("Station is locked.")
        l_title.setObjectName("cardTitle")
        l_sub = QLabel("Enter staff password to resume counter station:")
        l_sub.setObjectName("cardMeta")
        d_layout.addWidget(l_title)
        d_layout.addWidget(l_sub)

        pwd_input = QLineEdit()
        pwd_input.setEchoMode(QLineEdit.Password)
        d_layout.addWidget(pwd_input)

        err_lbl = QLabel("")
        err_lbl.setStyleSheet("color: #a63a24; font-size: 13px; font-weight: 500;")
        d_layout.addWidget(err_lbl)

        def try_unlock():
            entered = pwd_input.text()
            validator = getattr(self, "unlock_validator", None)
            if validator:
                if validator(entered):
                    self.is_locked = False
                    dialog.accept()
                else:
                    err_lbl.setText("Incorrect password. Please try again.")
                    pwd_input.clear()
            else:
                self.is_locked = False
                dialog.accept()

        btn_unlock = QPushButton("Unlock")
        btn_unlock.setObjectName("primaryAction")
        btn_unlock.clicked.connect(try_unlock)
        d_layout.addWidget(btn_unlock)

        pwd_input.returnPressed.connect(try_unlock)
        while self.is_locked:
            dialog.exec()
            if not self.is_locked:
                break
