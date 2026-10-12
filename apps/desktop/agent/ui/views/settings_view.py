"""Station Settings View (09-settings) for Counter Desk Desktop.
Station pairing, printer selection, locked review policy, and redacted diagnostics.
"""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QFrame, QComboBox, QCheckBox, QMessageBox, QFileDialog
)
from PySide6.QtCore import Qt, Signal
from agent.ui.theme import (
    COLOR_BORDER, COLOR_TEXT_MUTED, COLOR_OLIVE, COLOR_TERRACOTTA
)


class SettingsView(QWidget):
    reconnect_requested = Signal()
    lock_station_requested = Signal()
    printer_changed = Signal(str)
    view_recovery_requested = Signal()
    sign_out_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.available_printers = []
        self._init_ui()

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(32, 28, 32, 28)
        main_layout.setSpacing(18)

        # Header
        title_lbl = QLabel("One shop. One trusted station.")
        title_lbl.setObjectName("headerTitle")
        sub_lbl = QLabel("Station pairing, local print preferences, and diagnostics.")
        sub_lbl.setObjectName("headerSubtitle")
        main_layout.addWidget(title_lbl)
        main_layout.addWidget(sub_lbl)

        # Workspace (55% Connection & Device, 45% Privacy & Diagnostics)
        workspace = QHBoxLayout()
        workspace.setSpacing(24)

        # Left: Connection & Hardware Pairing
        left_box = QVBoxLayout()
        left_box.setSpacing(16)

        self.conn_card = QFrame()
        self.conn_card.setObjectName("card")
        cc_layout = QVBoxLayout(self.conn_card)
        cc_layout.setSpacing(12)

        cc_title = QLabel("Station connection")
        cc_title.setObjectName("cardTitle")
        cc_layout.addWidget(cc_title)

        self.lbl_account = QLabel("Signed in: Operator Account")
        self.lbl_shop = QLabel("Shop: Not selected")
        self.lbl_station = QLabel("Station identity: Station Alpha")
        self.lbl_api = QLabel("API connection: Connected")
        for lbl in (self.lbl_account, self.lbl_shop, self.lbl_station, self.lbl_api):
            lbl.setObjectName("cardMeta")
            cc_layout.addWidget(lbl)

        btn_row = QHBoxLayout()
        self.btn_reconnect = QPushButton("Reconnect")
        self.btn_reconnect.clicked.connect(self.reconnect_requested.emit)
        self.btn_lock = QPushButton("Lock station")
        self.btn_lock.clicked.connect(self.lock_station_requested.emit)
        btn_row.addWidget(self.btn_reconnect)
        btn_row.addWidget(self.btn_lock)
        cc_layout.addLayout(btn_row)

        cc_layout.addSpacing(10)
        cc_layout.addWidget(QLabel("Station printer mapping:"))
        self.printer_combo = QComboBox()
        self.printer_combo.currentTextChanged.connect(self._on_printer_combo_changed)
        cc_layout.addWidget(self.printer_combo)

        # Scanner policy
        policy_box = QFrame()
        policy_box.setStyleSheet(f"background-color: #fcfaf7; border: 1px solid {COLOR_BORDER}; border-radius: 6px; padding: 10px;")
        pb_layout = QVBoxLayout(policy_box)
        chk = QCheckBox("Review required before printing (Locked ON)")
        chk.setChecked(True)
        chk.setEnabled(False)  # Invariant: cannot be disabled
        pb_layout.addWidget(chk)
        rule_lbl = QLabel("Safety invariant: Scanning a receipt or pressing Enter never starts a physical print.")
        rule_lbl.setStyleSheet(f"font-size: 13px; color: {COLOR_TEXT_MUTED}; font-style: italic;")
        rule_lbl.setWordWrap(True)
        pb_layout.addWidget(rule_lbl)
        cc_layout.addWidget(policy_box)

        left_box.addWidget(self.conn_card)
        workspace.addLayout(left_box, 55)

        # Right: Privacy, Diagnostics & Sign out
        right_box = QVBoxLayout()
        right_box.setSpacing(16)

        # Privacy card
        priv_card = QFrame()
        priv_card.setObjectName("card")
        prc_layout = QVBoxLayout(priv_card)
        prc_title = QLabel("Local privacy & storage")
        prc_title.setObjectName("cardTitle")
        prc_layout.addWidget(prc_title)

        self.lbl_cleanup = QLabel("Temporary file cleanup: Sandboxed shredding active")
        self.lbl_pending_sync = QLabel("Pending result sync: 0 items")
        for lbl in (self.lbl_cleanup, self.lbl_pending_sync):
            lbl.setObjectName("cardMeta")
            prc_layout.addWidget(lbl)

        self.btn_view_recovery = QPushButton("View recovery & sync")
        self.btn_view_recovery.clicked.connect(self.view_recovery_requested.emit)
        prc_layout.addWidget(self.btn_view_recovery)
        right_box.addWidget(priv_card)

        # Diagnostics card
        diag_card = QFrame()
        diag_card.setObjectName("card")
        dc_layout = QVBoxLayout(diag_card)
        dc_title = QLabel("Diagnostics")
        dc_title.setObjectName("cardTitle")
        dc_layout.addWidget(dc_title)

        self.btn_export_diag = QPushButton("Export redacted diagnostics")
        self.btn_export_diag.clicked.connect(self._on_export_diagnostics)
        dc_layout.addWidget(self.btn_export_diag)

        dc_layout.addSpacing(10)
        self.btn_sign_out = QPushButton("Sign out of station")
        self.btn_sign_out.setObjectName("dangerAction")
        self.btn_sign_out.clicked.connect(self._on_sign_out)
        dc_layout.addWidget(self.btn_sign_out)
        right_box.addWidget(diag_card)

        right_box.addStretch()
        workspace.addLayout(right_box, 45)
        main_layout.addLayout(workspace)

    def set_station_info(self, username: str, role: str, shop_name: str, shop_id: str,
                         printers: list, selected_printer: str, pending_sync_count: int):
        self.lbl_account.setText(f"Signed in: {username} ({role.capitalize()})")
        self.lbl_shop.setText(f"Shop: {shop_name or shop_id}")
        self.lbl_pending_sync.setText(f"Pending result sync: {pending_sync_count} items")

        self.available_printers = printers or []
        self.printer_combo.blockSignals(True)
        self.printer_combo.clear()
        for p in self.available_printers:
            self.printer_combo.addItem(p)
        if selected_printer and selected_printer in self.available_printers:
            self.printer_combo.setCurrentText(selected_printer)
        self.printer_combo.blockSignals(False)

    def _on_printer_combo_changed(self, text: str):
        if text.strip():
            self.printer_changed.emit(text.strip())

    def _on_export_diagnostics(self):
        filename, _ = QFileDialog.getSaveFileName(self, "Export Redacted Diagnostics", "cbpms_diagnostics.txt", "Text Files (*.txt)")
        if filename:
            try:
                import platform
                diag = f"""CBPMS Counter Desk Diagnostics Report
Platform: {platform.platform()}
Python: {platform.python_version()}
Station: Mapped
Selected Printer: {self.printer_combo.currentText()}
Observed Devices: {', '.join(self.available_printers)}
Review Required Policy: LOCKED_ON (Scanner never prints)
Storage Shredder: Active
(All authentication tokens, client credentials, and file paths redacted)
"""
                with open(filename, "w", encoding="utf-8") as f:
                    f.write(diag)
                QMessageBox.information(self, "Diagnostics Exported", "Redacted diagnostics saved successfully.")
            except Exception as exc:
                QMessageBox.warning(self, "Export Failed", f"Could not write diagnostics: {exc}")

    def _on_sign_out(self):
        reply = QMessageBox.question(
            self, "Sign Out",
            "Are you sure you want to sign out and disconnect this station?",
            QMessageBox.Yes | QMessageBox.No
        )
        if reply == QMessageBox.Yes:
            self.sign_out_requested.emit()
