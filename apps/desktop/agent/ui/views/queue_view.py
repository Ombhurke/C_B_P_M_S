"""Queue & Release Desk View (02-queue) for Counter Desk Desktop.
Handles barcode scanning, token lookup, queue filtering, and job metadata inspection.
Scanning or Enter NEVER starts a physical print.
"""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QFrame, QAbstractItemView,
    QInputDialog, QMessageBox
)
from PySide6.QtCore import Qt, Signal
from agent.ui.theme import (
    COLOR_BORDER, COLOR_TEXT_MUTED, COLOR_OLIVE, COLOR_TERRACOTTA
)


class QueueView(QWidget):
    find_review_requested = Signal(str)
    open_review_requested = Signal(dict)
    hold_job_requested = Signal(str, str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.raw_jobs = []
        self.filtered_jobs = []
        self.selected_job = None
        self.current_filter = "All"
        self._init_ui()

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(32, 28, 32, 28)
        main_layout.setSpacing(18)

        # Heading
        title_lbl = QLabel("Review before you print.")
        title_lbl.setObjectName("headerTitle")
        main_layout.addWidget(title_lbl)

        # Full-width compact scan strip
        scan_card = QFrame()
        scan_card.setObjectName("card")
        sc_layout = QHBoxLayout(scan_card)
        sc_layout.setContentsMargins(16, 12, 16, 12)
        sc_layout.setSpacing(14)

        scan_title = QLabel("Enter release code:")
        scan_title.setStyleSheet("font-weight: 600; font-size: 15px;")
        sc_layout.addWidget(scan_title)

        self.input_code = QLineEdit()
        self.input_code.setPlaceholderText("Scan customer receipt barcode or enter 4-digit PIN")
        self.input_code.returnPressed.connect(self._on_find_review)
        sc_layout.addWidget(self.input_code, 1)

        self.btn_find_review = QPushButton("Find & review")
        self.btn_find_review.setObjectName("primaryAction")
        self.btn_find_review.clicked.connect(self._on_find_review)
        sc_layout.addWidget(self.btn_find_review)

        help_lbl = QLabel("Scanning never starts a print.")
        help_lbl.setStyleSheet(f"color: {COLOR_TEXT_MUTED}; font-size: 13px; font-style: italic;")
        sc_layout.addWidget(help_lbl)
        main_layout.addWidget(scan_card)

        # Filter Tabs strip
        tabs_layout = QHBoxLayout()
        tabs_layout.setSpacing(8)
        self.filter_buttons = {}
        for tab_name in ("Awaiting review", "Ready", "Active", "Attention", "All"):
            btn = QPushButton(tab_name)
            btn.setFixedHeight(36)
            btn.setCheckable(True)
            btn.clicked.connect(lambda checked, t=tab_name: self._set_filter(t))
            tabs_layout.addWidget(btn)
            self.filter_buttons[tab_name] = btn
        self.filter_buttons["All"].setChecked(True)
        tabs_layout.addStretch()
        main_layout.addLayout(tabs_layout)

        # Workspace (65% Table, 35% Selected Job Inspector)
        workspace = QHBoxLayout()
        workspace.setSpacing(24)

        # Table
        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["Reference", "Document", "Settings", "Payment", "Status"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table.verticalHeader().setVisible(False)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.itemSelectionChanged.connect(self._on_row_selected)
        workspace.addWidget(self.table, 65)

        # Right Inspector Card
        self.detail_card = QFrame()
        self.detail_card.setObjectName("card")
        dc_layout = QVBoxLayout(self.detail_card)
        dc_layout.setSpacing(12)

        self.lbl_det_title = QLabel("Selected job")
        self.lbl_det_title.setObjectName("cardTitle")
        dc_layout.addWidget(self.lbl_det_title)

        self.lbl_det_ref = QLabel("No job selected")
        self.lbl_det_privacy = QLabel("—")
        self.lbl_det_specs = QLabel("—")
        self.lbl_det_payment = QLabel("—")
        self.lbl_det_release = QLabel("Release: Not yet authorized")
        self.lbl_det_compat = QLabel("Printer compatibility: Requires check")

        for lbl in (self.lbl_det_ref, self.lbl_det_privacy, self.lbl_det_specs,
                    self.lbl_det_payment, self.lbl_det_release, self.lbl_det_compat):
            lbl.setObjectName("cardMeta")
            dc_layout.addWidget(lbl)

        dc_layout.addSpacing(10)
        self.btn_review_job = QPushButton("Review job")
        self.btn_review_job.setObjectName("primaryAction")
        self.btn_review_job.setEnabled(False)
        self.btn_review_job.clicked.connect(self._on_review_clicked)
        dc_layout.addWidget(self.btn_review_job)

        self.btn_hold_job = QPushButton("Hold / Reject with reason")
        self.btn_hold_job.setEnabled(False)
        self.btn_hold_job.clicked.connect(self._on_hold_clicked)
        dc_layout.addWidget(self.btn_hold_job)

        dc_layout.addStretch()
        workspace.addWidget(self.detail_card, 35)
        main_layout.addLayout(workspace)

    def _set_filter(self, filter_name: str):
        self.current_filter = filter_name
        for name, btn in self.filter_buttons.items():
            btn.setChecked(name == filter_name)
        self._apply_filter()

    def _apply_filter(self):
        if self.current_filter == "Awaiting review":
            self.filtered_jobs = [j for j in self.raw_jobs if j.get("job_status") == "queued"]
        elif self.current_filter == "Ready":
            self.filtered_jobs = [j for j in self.raw_jobs if j.get("job_status") in ("queued", "processing")]
        elif self.current_filter == "Active":
            self.filtered_jobs = [j for j in self.raw_jobs if j.get("job_status") == "processing"]
        elif self.current_filter == "Attention":
            self.filtered_jobs = [j for j in self.raw_jobs if j.get("job_status") == "failed" or j.get("is_color") or j.get("copy_count", 1) > 1]
        else:
            self.filtered_jobs = list(self.raw_jobs)

        self.table.setRowCount(len(self.filtered_jobs))
        for row, job in enumerate(self.filtered_jobs):
            ref = job.get("id", "")[:10]
            doc = job.get("file_name", "Document")
            specs = f"{job.get('page_count', 1)}p · {job.get('copy_count', 1)}c · {'Color' if job.get('is_color') else 'B&W'} · {job.get('duplex_mode', 'simplex')}"
            pmt = "Verified online" if job.get("payment_status") == "completed" else "Due at counter"
            st = job.get("job_status", "staged")

            for col, text in enumerate((ref, doc, specs, pmt, st)):
                item = QTableWidgetItem(str(text))
                item.setFlags(Qt.ItemIsSelectable | Qt.ItemIsEnabled)
                self.table.setItem(row, col, item)

    def update_queue(self, jobs: list):
        self.raw_jobs = jobs or []
        self._apply_filter()

    def _on_row_selected(self):
        row = self.table.currentRow()
        if 0 <= row < len(self.filtered_jobs):
            self.selected_job = self.filtered_jobs[row]
            self.lbl_det_ref.setText(f"Job: {self.selected_job.get('id', '')}")
            mode = self.selected_job.get("access_mode", "anonymous").capitalize()
            self.lbl_det_privacy.setText(f"Mode: {mode} job")
            specs = f"{self.selected_job.get('page_count', 1)} pages · {self.selected_job.get('copy_count', 1)} copy · {self.selected_job.get('paper_type', 'A4')}"
            self.lbl_det_specs.setText(specs)
            pmt = "Verified online" if self.selected_job.get("payment_status") == "completed" else "Due at counter"
            self.lbl_det_payment.setText(f"Payment: {pmt} (₹{self.selected_job.get('total_cost', 0):.2f})")
            st = self.selected_job.get("job_status")
            self.lbl_det_release.setText(f"Release: {'Authorized' if st == 'processing' else 'Requires scan/PIN'}")
            self.lbl_det_compat.setText("Printer compatibility: Select printer in Review")

            self.btn_review_job.setEnabled(True)
            self.btn_hold_job.setEnabled(True)
        else:
            self.selected_job = None
            self.btn_review_job.setEnabled(False)
            self.btn_hold_job.setEnabled(False)

    def _on_find_review(self):
        val = self.input_code.text().strip()
        if val:
            self.input_code.clear()
            self.find_review_requested.emit(val)

    def _on_review_clicked(self):
        if self.selected_job:
            self.open_review_requested.emit(self.selected_job)

    def _on_hold_clicked(self):
        if not self.selected_job:
            return
        reason, ok = QInputDialog.getText(
            self, "Hold / Reject Job",
            f"Enter reason for holding or rejecting job {self.selected_job.get('id', '')}:"
        )
        if ok and reason.strip():
            self.hold_job_requested.emit(self.selected_job.get("id"), reason.strip())
