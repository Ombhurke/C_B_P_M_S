"""Overview View (01-overview) for Counter Desk Desktop.
At-a-glance shop management: incoming work, station readiness, attention items.
Overview never prints.
"""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QFrame, QAbstractItemView
)
from PySide6.QtCore import Qt, Signal
from agent.ui.theme import (
    COLOR_CARD_BG, COLOR_BORDER, COLOR_TEXT_MUTED, COLOR_OLIVE,
    COLOR_WARNING_BG, COLOR_SUCCESS_BG
)


class OverviewView(QWidget):
    open_queue_requested = Signal()
    review_job_requested = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.jobs_data = []
        self._init_ui()

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(32, 28, 32, 28)
        main_layout.setSpacing(20)

        # Header
        title_lbl = QLabel("Your counter, at a glance.")
        title_lbl.setObjectName("headerTitle")
        sub_lbl = QLabel("Review incoming work and keep this station ready.")
        sub_lbl.setObjectName("headerSubtitle")
        main_layout.addWidget(title_lbl)
        main_layout.addWidget(sub_lbl)

        # Summary strip
        self.summary_strip = QHBoxLayout()
        self.summary_strip.setSpacing(12)
        self.stat_awaiting = self._create_stat_card("Awaiting review", "0")
        self.stat_active = self._create_stat_card("Active prints", "0")
        self.stat_attention = self._create_stat_card("Needs attention", "0")
        self.stat_confirmed = self._create_stat_card("Confirmed today", "0")
        self.summary_strip.addWidget(self.stat_awaiting)
        self.summary_strip.addWidget(self.stat_active)
        self.summary_strip.addWidget(self.stat_attention)
        self.summary_strip.addWidget(self.stat_confirmed)
        main_layout.addLayout(self.summary_strip)

        # Main workspace 2-column layout (65% table, 35% station cards)
        workspace_layout = QHBoxLayout()
        workspace_layout.setSpacing(24)

        # Left: Incoming jobs table
        left_box = QVBoxLayout()
        left_box.setSpacing(12)
        table_hdr = QHBoxLayout()
        t_lbl = QLabel("Incoming jobs")
        t_lbl.setObjectName("cardTitle")
        table_hdr.addWidget(t_lbl)
        table_hdr.addStretch()

        self.btn_open_queue = QPushButton("Open print queue")
        self.btn_open_queue.setObjectName("primaryAction")
        self.btn_open_queue.clicked.connect(self.open_queue_requested.emit)
        table_hdr.addWidget(self.btn_open_queue)

        self.btn_open_job = QPushButton("Open selected job")
        self.btn_open_job.setEnabled(False)
        self.btn_open_job.clicked.connect(self._on_open_selected)
        table_hdr.addWidget(self.btn_open_job)
        left_box.addLayout(table_hdr)

        self.jobs_table = QTableWidget(0, 5)
        self.jobs_table.setHorizontalHeaderLabels(["Reference", "Document", "Requested settings", "Payment", "State"])
        self.jobs_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.jobs_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.jobs_table.verticalHeader().setVisible(False)
        self.jobs_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.jobs_table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.jobs_table.itemSelectionChanged.connect(self._on_selection_changed)
        left_box.addWidget(self.jobs_table)
        workspace_layout.addLayout(left_box, 65)

        # Right: This station & Attention needed
        right_box = QVBoxLayout()
        right_box.setSpacing(16)

        # Station info card
        self.station_card = QFrame()
        self.station_card.setObjectName("card")
        sc_layout = QVBoxLayout(self.station_card)
        sc_title = QLabel("This station")
        sc_title.setObjectName("cardTitle")
        sc_layout.addWidget(sc_title)

        self.lbl_printer_name = QLabel("Printer: Not configured")
        self.lbl_printer_status = QLabel("Observed status: Checking...")
        self.lbl_scanner_status = QLabel("Scanner: Connected (Keyboard emulation)")
        self.lbl_print_support = QLabel("Print support: PDF direct, single-copy only")
        for lbl in (self.lbl_printer_name, self.lbl_printer_status, self.lbl_scanner_status, self.lbl_print_support):
            lbl.setObjectName("cardMeta")
            sc_layout.addWidget(lbl)
        sc_layout.addStretch()
        right_box.addWidget(self.station_card)

        # Attention needed card
        self.attention_card = QFrame()
        self.attention_card.setObjectName("card")
        ac_layout = QVBoxLayout(self.attention_card)
        ac_title = QLabel("Attention needed")
        ac_title.setObjectName("cardTitle")
        ac_layout.addWidget(ac_title)
        self.lbl_attention_text = QLabel("All station services operating normally.")
        self.lbl_attention_text.setObjectName("cardMeta")
        self.lbl_attention_text.setWordWrap(True)
        ac_layout.addWidget(self.lbl_attention_text)
        self.btn_review_issue = QPushButton("Review issue")
        self.btn_review_issue.setEnabled(False)
        self.btn_review_issue.clicked.connect(self.open_queue_requested.emit)
        ac_layout.addWidget(self.btn_review_issue)
        ac_layout.addStretch()
        right_box.addWidget(self.attention_card)

        workspace_layout.addLayout(right_box, 35)
        main_layout.addLayout(workspace_layout)

    def _create_stat_card(self, label: str, value: str) -> QFrame:
        card = QFrame()
        card.setObjectName("card")
        card.setFixedHeight(88)
        c_layout = QVBoxLayout(card)
        c_layout.setContentsMargins(14, 10, 14, 10)
        v_lbl = QLabel(value)
        v_lbl.setStyleSheet(f"font-size: 26px; font-weight: 700; color: {COLOR_OLIVE};")
        l_lbl = QLabel(label)
        l_lbl.setStyleSheet(f"font-size: 13px; color: {COLOR_TEXT_MUTED}; text-transform: uppercase;")
        c_layout.addWidget(v_lbl)
        c_layout.addWidget(l_lbl)
        card.value_label = v_lbl
        return card

    def update_data(self, queue_jobs: list, summary: dict, printer_name: str, printer_ready: bool):
        self.jobs_data = queue_jobs or []
        awaiting = sum(1 for j in self.jobs_data if j.get("job_status") in ("queued", "processing"))
        active = sum(1 for j in self.jobs_data if j.get("job_status") == "processing")
        attention = sum(1 for j in self.jobs_data if j.get("job_status") == "failed" or j.get("is_color") or j.get("copy_count", 1) > 1)
        confirmed = summary.get("completed_jobs", 0)

        self.stat_awaiting.value_label.setText(str(awaiting))
        self.stat_active.value_label.setText(str(active))
        self.stat_attention.value_label.setText(str(attention))
        self.stat_confirmed.value_label.setText(str(confirmed))

        self.lbl_printer_name.setText(f"Printer: {printer_name or 'None'}")
        self.lbl_printer_status.setText(f"Observed status: {'Ready' if printer_ready else 'Attention required'}")

        if attention > 0:
            self.lbl_attention_text.setText(f"{attention} job(s) in queue require special print path or operator attention.")
            self.btn_review_issue.setEnabled(True)
        else:
            self.lbl_attention_text.setText("All station services operating normally.")
            self.btn_review_issue.setEnabled(False)

        # Populate incoming jobs
        self.jobs_table.setRowCount(len(self.jobs_data))
        for row, job in enumerate(self.jobs_data):
            ref = job.get("id", "")[:10]
            doc = job.get("file_name", "Document")
            specs = f"{job.get('page_count', 1)}p · {job.get('copy_count', 1)}c · {'Color' if job.get('is_color') else 'B&W'} · {job.get('duplex_mode', 'simplex')}"
            pmt = "Verified online" if job.get("payment_status") == "completed" else "Due at counter"
            st = "Awaiting review" if job.get("job_status") == "queued" else job.get("job_status", "staged")

            for col, text in enumerate((ref, doc, specs, pmt, st)):
                item = QTableWidgetItem(str(text))
                item.setFlags(Qt.ItemIsSelectable | Qt.ItemIsEnabled)
                self.jobs_table.setItem(row, col, item)

    def _on_selection_changed(self):
        has_sel = len(self.jobs_table.selectedItems()) > 0
        self.btn_open_job.setEnabled(has_sel)

    def _on_open_selected(self):
        row = self.jobs_table.currentRow()
        if 0 <= row < len(self.jobs_data):
            self.review_job_requested.emit(self.jobs_data[row].get("id"))
