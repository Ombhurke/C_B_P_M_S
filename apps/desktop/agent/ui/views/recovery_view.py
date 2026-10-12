"""History and Recovery View (05-recovery) for Counter Desk Desktop.
Provides audit transparency, outbox retry, and safe issue reconciliation.
Guarantees: Outbox retry retries API reporting only, never reprints.
"""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QFrame, QAbstractItemView,
    QMessageBox
)
from PySide6.QtCore import Qt, Signal
from agent.ui.theme import (
    COLOR_BORDER, COLOR_TEXT_MUTED, COLOR_OLIVE, COLOR_TERRACOTTA
)


class RecoveryView(QWidget):
    retry_sync_requested = Signal()
    refresh_history_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.history_items = []
        self.pending_outbox_items = []
        self.current_filter = "All"
        self._init_ui()

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(32, 28, 32, 28)
        main_layout.setSpacing(18)

        # Header
        title_lbl = QLabel("Resolve issues without printing twice.")
        title_lbl.setObjectName("headerTitle")
        sub_lbl = QLabel("Review past dispatches, reconcile unknown outcomes, and retry report sync.")
        sub_lbl.setObjectName("headerSubtitle")
        main_layout.addWidget(title_lbl)
        main_layout.addWidget(sub_lbl)

        # Filters and Refresh
        filter_bar = QHBoxLayout()
        filter_bar.setSpacing(8)
        self.filter_buttons = {}
        for fname in ("All", "Needs review", "Pending sync", "Confirmed"):
            btn = QPushButton(fname)
            btn.setFixedHeight(36)
            btn.setCheckable(True)
            btn.clicked.connect(lambda chk, f=fname: self._set_filter(f))
            filter_bar.addWidget(btn)
            self.filter_buttons[fname] = btn
        self.filter_buttons["All"].setChecked(True)
        filter_bar.addStretch()

        self.btn_refresh = QPushButton("Refresh history")
        self.btn_refresh.clicked.connect(self.refresh_history_requested.emit)
        filter_bar.addWidget(self.btn_refresh)
        main_layout.addLayout(filter_bar)

        # 2-column layout (65% Table, 35% Decision Card)
        workspace = QHBoxLayout()
        workspace.setSpacing(24)

        # Table
        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["Reference", "Printer", "Local result", "Cloud result", "Next action"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table.verticalHeader().setVisible(False)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.itemSelectionChanged.connect(self._on_row_selected)
        workspace.addWidget(self.table, 65)

        # Right Decision Card
        self.decision_card = QFrame()
        self.decision_card.setObjectName("card")
        dc_layout = QVBoxLayout(self.decision_card)
        dc_layout.setSpacing(14)

        self.lbl_card_title = QLabel("Select an item to inspect")
        self.lbl_card_title.setObjectName("cardTitle")
        dc_layout.addWidget(self.lbl_card_title)

        self.lbl_card_copy = QLabel("Select an event or pending sync from the table to review safety recommendations.")
        self.lbl_card_copy.setObjectName("cardMeta")
        self.lbl_card_copy.setWordWrap(True)
        dc_layout.addWidget(self.lbl_card_copy)

        self.btn_retry_sync = QPushButton("Retry result sync")
        self.btn_retry_sync.setObjectName("primaryAction")
        self.btn_retry_sync.setEnabled(False)
        self.btn_retry_sync.clicked.connect(self.retry_sync_requested.emit)
        dc_layout.addWidget(self.btn_retry_sync)

        self.lbl_retry_note = QLabel("Retrying only reports the existing recorded result. It NEVER downloads or spools again.")
        self.lbl_retry_note.setStyleSheet(f"font-size: 13px; color: {COLOR_TEXT_MUTED}; font-style: italic;")
        self.lbl_retry_note.setWordWrap(True)
        dc_layout.addWidget(self.lbl_retry_note)

        dc_layout.addStretch()
        workspace.addWidget(self.decision_card, 35)
        main_layout.addLayout(workspace)

    def _set_filter(self, filter_name: str):
        self.current_filter = filter_name
        for name, btn in self.filter_buttons.items():
            btn.setChecked(name == filter_name)
        self._render_rows()

    def update_data(self, pending_outbox: list, audit_events: list):
        self.pending_outbox_items = pending_outbox or []
        self.history_items = []

        # Convert pending outbox items into rows
        for item in self.pending_outbox_items:
            self.history_items.append({
                "ref": item.get("job_id", "")[:12],
                "printer": "Station printer",
                "local": "Spool accepted" if item.get("status") == "completed" else "Failed",
                "cloud": "Sync pending",
                "action": "Retry report",
                "is_pending": True,
                "raw": item
            })

        # Convert server audit events
        for event in (audit_events or []):
            action = event.get("action", "")
            target = event.get("target", "") or ""
            status = event.get("status", "completed")
            self.history_items.append({
                "ref": target[:12],
                "printer": "Mapped device",
                "local": "Confirmed" if "confirmed" in action else "Recorded",
                "cloud": "Synced",
                "action": "View audit record",
                "is_pending": False,
                "raw": event
            })

        self._render_rows()

    def _render_rows(self):
        filtered = []
        for item in self.history_items:
            if self.current_filter == "Pending sync" and not item["is_pending"]:
                continue
            if self.current_filter == "Confirmed" and item["is_pending"]:
                continue
            filtered.append(item)

        self.table.setRowCount(len(filtered))
        for row, item in enumerate(filtered):
            for col, key in enumerate(("ref", "printer", "local", "cloud", "action")):
                c_item = QTableWidgetItem(str(item[key]))
                c_item.setFlags(Qt.ItemIsSelectable | Qt.ItemIsEnabled)
                self.table.setItem(row, col, c_item)

    def _on_row_selected(self):
        row = self.table.currentRow()
        if 0 <= row < len(self.history_items):
            item = self.history_items[row]
            if item["is_pending"]:
                self.lbl_card_title.setText("Result synchronization pending")
                self.lbl_card_copy.setText(
                    f"Job {item['ref']} was spooled successfully, but network dropped during cloud status update. "
                    "Clicking retry will report the outcome to the server without reprinting."
                )
                self.btn_retry_sync.setEnabled(True)
            else:
                self.lbl_card_title.setText("Audit event record")
                self.lbl_card_copy.setText(
                    f"Reference: {item['ref']}\nAction: {item['raw'].get('action')}\nActor: {item['raw'].get('actor')}\nRecorded safely in audit log."
                )
                self.btn_retry_sync.setEnabled(False)
        else:
            self.btn_retry_sync.setEnabled(False)
