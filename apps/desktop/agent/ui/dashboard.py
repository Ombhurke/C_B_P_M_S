import sys
import os
import shutil
from typing import Optional, Callable

try:
    from PySide6.QtWidgets import (
        QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
        QLabel, QLineEdit, QPushButton, QTableWidget, QTableWidgetItem,
        QHeaderView, QComboBox, QTextEdit, QMessageBox, QInputDialog,
        QStackedWidget, QButtonGroup
    )
    from PySide6.QtCore import Qt, Signal, QObject
    from PySide6.QtGui import QFont
    HAS_PYSIDE = True
except ImportError:
    HAS_PYSIDE = False


class AgentUiBridge(QObject if HAS_PYSIDE else object):
    if HAS_PYSIDE:
        queue_updated = Signal(list)
        log_message = Signal(str)
        scan_triggered = Signal(str)
        stage_updated = Signal(int, str)


class DesktopDashboard:
    """Print Station Desktop GUI matching station-01 to station-06."""
    def __init__(
        self,
        on_release_callback: Optional[Callable[[str], None]] = None,
        on_printer_change: Optional[Callable[[str], None]] = None
    ):
        self.on_release_callback = on_release_callback
        self.on_printer_change = on_printer_change
        self.app = None
        self.window = None
        self.log_box = None
        self.queue_table = None
        self.scan_input = None
        self.release_btn = None
        self.proceed_btn = None
        self.review_file_lbl = None
        self.review_specs_lbl = None
        self.stage1_lbl = None
        self.stage2_lbl = None
        self.stage3_lbl = None
        self.confirm_output_btn = None
        self.report_issue_btn = None
        self.printer_combo = None
        self.bridge = None
        self.active_job = None
        from agent.core.config import agent_settings
        self.shop_id = agent_settings.SHOP_ID
        self.operator_username = agent_settings.OPERATOR_USERNAME

    def launch(self, initial_printers: list, initial_queue: list):
        if not HAS_PYSIDE:
            print("[UI] PySide6 not installed. Running in CLI mode.")
            return

        self.app = QApplication.instance() or QApplication(sys.argv)
        self.bridge = AgentUiBridge()
        self.bridge.log_message.connect(self._log, Qt.QueuedConnection)
        self.bridge.queue_updated.connect(self._update_queue, Qt.QueuedConnection)

        self.window = QMainWindow()
        self.window.setWindowTitle("CBPMS Print Station — Desktop Operator Console")
        self.window.resize(1024, 680)
        self.window.setStyleSheet("""
            QMainWindow { background-color: #fcfaf7; color: #251c17; font-family: 'Segoe UI', sans-serif; }
            QLabel { color: #251c17; font-family: 'Segoe UI', sans-serif; }
        """)

        # Printer combo
        self.printer_combo = QComboBox()
        self.printer_combo.addItems(initial_printers)
        if self.on_printer_change:
            self.printer_combo.currentTextChanged.connect(self.on_printer_change)
            self.on_printer_change(self.printer_combo.currentText())

        from agent.ui.panels import (
            build_connect_panel, build_release_panel, build_review_panel,
            build_monitor_panel, build_history_panel, build_settings_panel
        )

        central = QWidget()
        main_layout = QHBoxLayout(central)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # 220px Espresso Navigation Rail
        rail = QWidget()
        rail.setFixedWidth(220)
        rail.setStyleSheet("background-color: #1a1613; border-right: 1px solid #2d2621;")
        rail_layout = QVBoxLayout(rail)
        rail_layout.setContentsMargins(12, 20, 12, 20)
        rail_layout.setSpacing(8)

        brand = QLabel("PRINT STATION")
        brand.setStyleSheet("color: #ea7c50; font-weight: bold; font-size: 14px; padding: 0 8px 12px 8px; border-bottom: 1px solid #2d2621;")
        rail_layout.addWidget(brand)

        self.stack = QStackedWidget()
        self.stack.addWidget(build_connect_panel(self))
        self.stack.addWidget(build_release_panel(self))
        self.stack.addWidget(build_review_panel(self))
        self.stack.addWidget(build_monitor_panel(self))
        self.stack.addWidget(build_history_panel(self))
        self.stack.addWidget(build_settings_panel(self))

        nav_items = [
            ("Connect", 0),
            ("Release Desk", 1),
            ("Review", 2),
            ("Monitor", 3),
            ("History", 4),
            ("Settings", 5)
        ]

        self.nav_buttons = []
        for label, idx in nav_items:
            btn = QPushButton(label)
            btn.setCheckable(True)
            btn.setStyleSheet("""
                QPushButton {
                    background-color: transparent;
                    color: #d1c7bc;
                    text-align: left;
                    padding: 10px 14px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    border: none;
                }
                QPushButton:hover { background-color: #26201b; color: #ffffff; }
                QPushButton:checked { background-color: #ea7c50; color: #ffffff; }
            """)
            btn.clicked.connect(lambda _, i=idx: self._switch_tab(i))
            rail_layout.addWidget(btn)
            self.nav_buttons.append(btn)

        self.nav_buttons[1].setChecked(True)  # Start on Release Desk
        self.stack.setCurrentIndex(1)

        rail_layout.addStretch()
        footer = QLabel(f"Station: Online\n{self.operator_username}")
        footer.setStyleSheet("color: #8c7e72; font-size: 11px; padding: 8px;")
        rail_layout.addWidget(footer)

        main_layout.addWidget(rail)
        main_layout.addWidget(self.stack)

        self.window.setCentralWidget(central)
        self.window.show()
        self._update_queue(initial_queue)
        self._log("[System] Print Station initialized. Local spooler bridge ready.")

    def _switch_tab(self, index: int):
        self.stack.setCurrentIndex(index)
        for i, btn in enumerate(self.nav_buttons):
            btn.setChecked(i == index)

    def login_credentials(self):
        from agent.core.config import agent_settings
        username = agent_settings.OPERATOR_USERNAME
        password = agent_settings.OPERATOR_PASSWORD
        if not username:
            username, ok = QInputDialog.getText(self.window, "Sign in", "Operator username:")
            if not ok:
                return "", ""
        if not password:
            password, ok = QInputDialog.getText(self.window, "Sign in", "Password:", QLineEdit.Password)
            if not ok:
                return "", ""
        return username, password

    def _handle_manual_submit(self):
        text = self.scan_input.text().strip()
        if text and self.on_release_callback:
            self.on_release_callback(text)
            self.scan_input.clear()

    def _handle_proceed_print(self):
        self._switch_tab(3)  # Switch to Monitor

    def _handle_confirm_output(self):
        from agent.core.api_client import api_client
        if self.active_job:
            try:
                api_client.confirm_output(self.active_job["job_id"])
                self._log(f"[Physical] Output confirmed for {self.active_job['job_id']}.")
            except Exception as e:
                self._log(f"[Error] Confirmation failed: {e}")
        self.stage3_lbl.setText("Stage 3: Physical Output Confirmation — Verified & Finished")
        self._switch_tab(1)  # Return to release desk

    def _handle_report_issue(self):
        from agent.core.api_client import api_client
        if self.active_job:
            try:
                api_client.report_issue(self.active_job["job_id"], "paper_jam", "Operator flagged issue at station")
                self._log(f"[Hardware] Reported issue for {self.active_job['job_id']}; retained in queue.")
            except Exception as e:
                self._log(f"[Error] Report issue failed: {e}")
        self.stage3_lbl.setText("Stage 3: Physical Output Confirmation — Issue Flagged (Retained)")

    def _handle_purge_cache(self):
        from agent.core.config import agent_settings
        spool_dir = agent_settings.LOCAL_SPOOL_DIR
        count = 0
        if os.path.exists(spool_dir):
            for f in os.listdir(spool_dir):
                path = os.path.join(spool_dir, f)
                try:
                    if os.path.isfile(path):
                        os.remove(path)
                        count += 1
                except Exception:
                    pass
        self._log(f"[Maintenance] Cleaned {count} temporary spool file(s).")

    def log(self, text: str):
        if self.bridge:
            self.bridge.log_message.emit(text)
        else:
            self._log(text)

    def _log(self, text: str):
        if self.log_box:
            self.log_box.append(text)
        print(f"[UI Log] {text}")

    def update_queue(self, jobs: list):
        if self.bridge:
            self.bridge.queue_updated.emit(jobs)
        else:
            self._update_queue(jobs)

    def _update_queue(self, jobs: list):
        if not self.queue_table:
            return
        self.queue_table.setRowCount(len(jobs))
        for row, j in enumerate(jobs):
            self.queue_table.setItem(row, 0, QTableWidgetItem(str(j.get("job_status", "-"))))
            self.queue_table.setItem(row, 1, QTableWidgetItem(str(j.get("file_name", "doc"))))
            self.queue_table.setItem(row, 2, QTableWidgetItem(f"{j.get('page_count', 1)} pgs ({j.get('copy_count', 1)} copies)"))
            self.queue_table.setItem(row, 3, QTableWidgetItem(f"{'Color' if j.get('is_color') else 'B&W'} / {j.get('duplex_mode', 'simplex')}"))
            self.queue_table.setItem(row, 4, QTableWidgetItem(f"₹{j.get('total_cost', 0):.2f}"))
