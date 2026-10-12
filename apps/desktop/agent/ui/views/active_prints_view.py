"""Active Prints View (04-monitor) for Counter Desk Desktop.
Monitors active physical print jobs through observable stages.
Provides explicit operator outcome confirmation and issue reporting.
No fabricated progress percentages or false completion claims.
"""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QFrame, QInputDialog, QMessageBox
)
from PySide6.QtCore import Qt, Signal
from agent.ui.theme import (
    COLOR_BORDER, COLOR_TEXT_MUTED, COLOR_OLIVE, COLOR_TERRACOTTA,
    COLOR_WARNING_BG, COLOR_SUCCESS_BG
)


class ActivePrintsView(QWidget):
    confirm_output_requested = Signal(str)  # notes
    report_problem_requested = Signal(str, str)  # issue_type, notes

    def __init__(self, parent=None):
        super().__init__(parent)
        self.active_job = {}
        self._init_ui()

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(32, 28, 32, 28)
        main_layout.setSpacing(20)

        # Header
        title_lbl = QLabel("Sent to the printer. Check the output.")
        title_lbl.setObjectName("headerTitle")
        sub_lbl = QLabel("Observe spool stages and verify physical paper output before confirming.")
        sub_lbl.setObjectName("headerSubtitle")
        main_layout.addWidget(title_lbl)
        main_layout.addWidget(sub_lbl)

        # 2-column layout (60% stages & specs, 40% verification card)
        workspace = QHBoxLayout()
        workspace.setSpacing(24)

        # Left: Active Job Card and Spool Stages
        left_box = QVBoxLayout()
        left_box.setSpacing(16)

        self.job_card = QFrame()
        self.job_card.setObjectName("card")
        jc_layout = QVBoxLayout(self.job_card)
        jc_layout.setSpacing(14)

        self.lbl_job_title = QLabel("No active print job")
        self.lbl_job_title.setObjectName("cardTitle")
        self.lbl_job_specs = QLabel("Waiting for print dispatch...")
        self.lbl_job_specs.setObjectName("cardMeta")
        self.lbl_spool_id = QLabel("Spool Reference: None")
        self.lbl_spool_id.setObjectName("cardMeta")

        jc_layout.addWidget(self.lbl_job_title)
        jc_layout.addWidget(self.lbl_job_specs)
        jc_layout.addWidget(self.lbl_spool_id)
        jc_layout.addSpacing(10)

        # Observable stages
        stages_title = QLabel("Observable print stages:")
        stages_title.setStyleSheet("font-weight: 600; font-size: 15px;")
        jc_layout.addWidget(stages_title)

        self.stage1_lbl = QLabel("1. Release authorized — Done")
        self.stage2_lbl = QLabel("2. File verified (SHA-256) — Done")
        self.stage3_lbl = QLabel("3. Sent to Windows spooler — Done")
        self.stage4_lbl = QLabel("4. Physical output — Awaiting operator verification")
        self.stage5_lbl = QLabel("5. Result sync — Not yet confirmed")

        for lbl in (self.stage1_lbl, self.stage2_lbl, self.stage3_lbl):
            lbl.setStyleSheet(f"font-size: 14px; color: {COLOR_OLIVE}; font-weight: 500;")
            jc_layout.addWidget(lbl)

        self.stage4_lbl.setStyleSheet("font-size: 14px; color: #c05634; font-weight: 600;")
        self.stage5_lbl.setStyleSheet(f"font-size: 14px; color: {COLOR_TEXT_MUTED};")
        jc_layout.addWidget(self.stage4_lbl)
        jc_layout.addWidget(self.stage5_lbl)
        jc_layout.addStretch()

        left_box.addWidget(self.job_card)
        workspace.addLayout(left_box, 60)

        # Right: Verification & Outcome Card
        right_box = QVBoxLayout()
        right_box.setSpacing(16)

        self.outcome_card = QFrame()
        self.outcome_card.setObjectName("card")
        oc_layout = QVBoxLayout(self.outcome_card)
        oc_layout.setSpacing(14)

        oc_title = QLabel("Did the complete document print correctly?")
        oc_title.setObjectName("cardTitle")
        oc_layout.addWidget(oc_title)

        self.btn_confirm_output = QPushButton("Confirm full output")
        self.btn_confirm_output.setObjectName("printAction")
        self.btn_confirm_output.clicked.connect(self._on_confirm_output)
        oc_layout.addWidget(self.btn_confirm_output)

        self.btn_report_problem = QPushButton("Report problem")
        self.btn_report_problem.clicked.connect(self._on_report_problem)
        oc_layout.addWidget(self.btn_report_problem)

        warn_note = QLabel("Do not confirm until you have checked the physical paper output.")
        warn_note.setStyleSheet(f"font-size: 13px; color: {COLOR_TEXT_MUTED}; font-style: italic;")
        warn_note.setWordWrap(True)
        oc_layout.addWidget(warn_note)

        reprint_warn = QLabel("Unsure whether it printed? Check the printer queue before retrying.")
        reprint_warn.setStyleSheet("font-size: 13px; color: #a63a24; font-weight: 500;")
        reprint_warn.setWordWrap(True)
        oc_layout.addWidget(reprint_warn)

        oc_layout.addSpacing(10)
        self.lbl_cleanup_status = QLabel("Local temporary file: Scheduled for shredding on confirmation")
        self.lbl_cleanup_status.setStyleSheet(f"font-size: 13px; color: {COLOR_TEXT_MUTED};")
        self.lbl_cleanup_status.setWordWrap(True)
        oc_layout.addWidget(self.lbl_cleanup_status)
        oc_layout.addStretch()

        right_box.addWidget(self.outcome_card)
        workspace.addLayout(right_box, 40)
        main_layout.addLayout(workspace)

    def set_active_job(self, job: dict, spool_id: str = "", printer: str = ""):
        self.active_job = job or {}
        if not self.active_job:
            self.lbl_job_title.setText("No active print job")
            self.lbl_job_specs.setText("Waiting for print dispatch...")
            self.lbl_spool_id.setText("Spool Reference: None")
            self.btn_confirm_output.setEnabled(False)
            self.btn_report_problem.setEnabled(False)
            return

        doc_name = self.active_job.get("file_name", "Document")
        pages = self.active_job.get("page_count", 1)
        copies = self.active_job.get("copy_count", 1)
        printer_str = printer or self.active_job.get("printer", "Station printer")

        self.lbl_job_title.setText(f"{self.active_job.get('job_id', '')} — {doc_name}")
        self.lbl_job_specs.setText(f"{pages} pages · {copies} copy · Sent to {printer_str}")
        self.lbl_spool_id.setText(f"Spool Reference: {spool_id or self.active_job.get('spool_id', 'Spool-Active')}")

        self.btn_confirm_output.setEnabled(True)
        self.btn_report_problem.setEnabled(True)

    def _on_confirm_output(self):
        self.confirm_output_requested.emit("Complete output verified by operator")

    def _on_report_problem(self):
        issues = ["paper_jam", "ink_toner_issue", "partial_pages", "hardware_offline", "other"]
        issue, ok = QInputDialog.getItem(
            self, "Report Problem", "Select issue type:",
            issues, 0, False
        )
        if ok and issue:
            notes, ok2 = QInputDialog.getText(self, "Issue Details", "Enter details or error description:")
            if ok2:
                self.report_problem_requested.emit(issue, notes.strip())
