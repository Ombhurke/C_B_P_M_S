"""Review View (03-review) for Counter Desk Desktop.
Operator's print decision: authorized preview, requested settings, release checks,
hardware compatibility validation, and explicit guarded Print action.
"""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QFrame, QComboBox, QMessageBox, QScrollArea, QInputDialog
)
from PySide6.QtCore import Qt, Signal
from agent.ui.theme import (
    COLOR_CARD_BG, COLOR_BORDER, COLOR_TEXT_MUTED, COLOR_OLIVE,
    COLOR_TERRACOTTA, COLOR_WARNING_BG, COLOR_SUCCESS_BG
)


class ReviewView(QWidget):
    print_requested = Signal(str)  # printer_name
    back_to_queue_requested = Signal()
    hold_requested = Signal(str, str)  # job_id, reason

    def __init__(self, parent=None):
        super().__init__(parent)
        self.job = {}
        self.available_printers = []
        self._init_ui()

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(32, 28, 32, 28)
        main_layout.setSpacing(18)

        # Header
        hdr_layout = QHBoxLayout()
        self.title_lbl = QLabel("Review job")
        self.title_lbl.setObjectName("headerTitle")
        hdr_layout.addWidget(self.title_lbl)
        hdr_layout.addStretch()

        self.btn_back = QPushButton("Back to queue")
        self.btn_back.clicked.connect(self.back_to_queue_requested.emit)
        hdr_layout.addWidget(self.btn_back)
        main_layout.addLayout(hdr_layout)

        # 2-Column Desktop composition (55% Preview, 45% Inspection & Print)
        content_layout = QHBoxLayout()
        content_layout.setSpacing(24)

        # Left 55%: Document Preview Card
        self.preview_card = QFrame()
        self.preview_card.setObjectName("card")
        prev_layout = QVBoxLayout(self.preview_card)
        prev_layout.setSpacing(14)

        prev_hdr = QHBoxLayout()
        self.lbl_prev_title = QLabel("Authorized preview")
        self.lbl_prev_title.setObjectName("cardTitle")
        self.lbl_page_count = QLabel("Page 1 of 1")
        self.lbl_page_count.setObjectName("cardMeta")
        prev_hdr.addWidget(self.lbl_prev_title)
        prev_hdr.addStretch()
        prev_hdr.addWidget(self.lbl_page_count)
        prev_layout.addLayout(prev_hdr)

        # Preview paper representation
        self.paper_frame = QFrame()
        self.paper_frame.setStyleSheet(f"""
            background-color: #ffffff;
            border: 1px solid {COLOR_BORDER};
            border-radius: 4px;
            min-height: 420px;
        """)
        paper_layout = QVBoxLayout(self.paper_frame)
        paper_layout.setAlignment(Qt.AlignCenter)

        self.lbl_doc_icon = QLabel("📄")
        self.lbl_doc_icon.setStyleSheet("font-size: 48px;")
        self.lbl_doc_name = QLabel("No document loaded")
        self.lbl_doc_name.setStyleSheet("font-size: 17px; font-weight: 600; text-align: center;")
        self.lbl_doc_hash = QLabel("SHA-256: Unverified")
        self.lbl_doc_hash.setStyleSheet(f"font-size: 12px; color: {COLOR_TEXT_MUTED}; font-family: monospace;")
        self.lbl_doc_status = QLabel("Awaiting authorized release grant")
        self.lbl_doc_status.setStyleSheet(f"font-size: 14px; color: {COLOR_TEXT_MUTED};")

        paper_layout.addWidget(self.lbl_doc_icon, 0, Qt.AlignCenter)
        paper_layout.addWidget(self.lbl_doc_name, 0, Qt.AlignCenter)
        paper_layout.addWidget(self.lbl_doc_hash, 0, Qt.AlignCenter)
        paper_layout.addWidget(self.lbl_doc_status, 0, Qt.AlignCenter)
        prev_layout.addWidget(self.paper_frame, 1)

        alert_lbl = QLabel("Print sends a physical job. Review preview and settings before dispatch.")
        alert_lbl.setStyleSheet(f"font-size: 13px; color: {COLOR_TEXT_MUTED}; font-style: italic;")
        prev_layout.addWidget(alert_lbl)
        content_layout.addWidget(self.preview_card, 55)

        # Right 45%: Requested Settings, Checks & Print Action
        right_panel = QVBoxLayout()
        right_panel.setSpacing(14)

        # Requested Settings Card
        settings_card = QFrame()
        settings_card.setObjectName("card")
        sc_layout = QVBoxLayout(settings_card)
        sc_title = QLabel("Requested print")
        sc_title.setObjectName("cardTitle")
        sc_layout.addWidget(sc_title)

        self.lbl_req_pages = QLabel("Pages: —")
        self.lbl_req_copies = QLabel("Copies: —")
        self.lbl_req_paper = QLabel("Paper: —")
        self.lbl_req_color = QLabel("Colour: —")
        self.lbl_req_sides = QLabel("Sides: —")
        self.lbl_req_quote = QLabel("Accepted quote: —")

        for lbl in (self.lbl_req_pages, self.lbl_req_copies, self.lbl_req_paper,
                    self.lbl_req_color, self.lbl_req_sides, self.lbl_req_quote):
            lbl.setObjectName("cardMeta")
            sc_layout.addWidget(lbl)
        right_panel.addWidget(settings_card)

        # Release Checks Card
        checks_card = QFrame()
        checks_card.setObjectName("card")
        cc_layout = QVBoxLayout(checks_card)
        cc_title = QLabel("Release checks")
        cc_title.setObjectName("cardTitle")
        cc_layout.addWidget(cc_title)

        self.chk_shop = QLabel("✓ Selected shop matches")
        self.chk_auth = QLabel("✓ Release authorized")
        self.chk_payment = QLabel("✓ Server payment verified")
        self.chk_integrity = QLabel("✓ File integrity verified")

        for chk in (self.chk_shop, self.chk_auth, self.chk_payment, self.chk_integrity):
            chk.setStyleSheet(f"font-size: 14px; color: {COLOR_OLIVE}; font-weight: 500;")
            cc_layout.addWidget(chk)
        right_panel.addWidget(checks_card)

        # Printer Compatibility & Dispatch Card
        printer_card = QFrame()
        printer_card.setObjectName("card")
        pc_layout = QVBoxLayout(printer_card)
        pc_title = QLabel("Station printer")
        pc_title.setObjectName("cardTitle")
        pc_layout.addWidget(pc_title)

        self.printer_combo = QComboBox()
        self.printer_combo.currentIndexChanged.connect(self._validate_and_update_state)
        pc_layout.addWidget(self.printer_combo)

        self.lbl_compat_status = QLabel("Compatible with this job")
        self.lbl_compat_status.setStyleSheet(f"font-size: 13px; color: {COLOR_OLIVE}; font-weight: 600;")
        pc_layout.addWidget(self.lbl_compat_status)

        self.btn_print = QPushButton("Print")
        self.btn_print.setObjectName("printAction")
        self.btn_print.clicked.connect(self._on_print_clicked)
        pc_layout.addWidget(self.btn_print)

        self.btn_hold = QPushButton("Hold / Reject with reason")
        self.btn_hold.clicked.connect(self._on_hold_clicked)
        pc_layout.addWidget(self.btn_hold)

        right_panel.addWidget(printer_card)
        content_layout.addLayout(right_panel, 45)
        main_layout.addLayout(content_layout)

    def set_printers(self, printers: list, selected: str = ""):
        self.available_printers = printers or []
        self.printer_combo.clear()
        for p in self.available_printers:
            self.printer_combo.addItem(p)
        if selected and selected in self.available_printers:
            self.printer_combo.setCurrentText(selected)

    def set_job(self, job: dict, preview_path: str = None, printers: list = None, selected_printer: str = ""):
        self.job = job or {}
        if printers:
            self.set_printers(printers, selected_printer)

        job_id = self.job.get("id") or self.job.get("job_id", "")
        self.title_lbl.setText(f"Review job {job_id}")

        doc_name = self.job.get("file_name", "Document.pdf")
        pages = self.job.get("page_count", 1)
        copies = self.job.get("copy_count", 1)
        is_color = self.job.get("is_color", False)
        duplex = self.job.get("duplex_mode", "simplex")
        cost = self.job.get("total_cost", 0.0)

        self.lbl_doc_name.setText(doc_name)
        self.lbl_page_count.setText(f"Page 1 of {pages}")
        self.lbl_req_pages.setText(f"Pages: {pages} total")
        self.lbl_req_copies.setText(f"Copies: {copies}")
        self.lbl_req_paper.setText(f"Paper: {self.job.get('paper_type', 'A4')}")
        self.lbl_req_color.setText(f"Colour: {'Color' if is_color else 'Black & white'}")
        self.lbl_req_sides.setText(f"Sides: {duplex}")
        self.lbl_req_quote.setText(f"Accepted quote: ₹{cost:.2f}")

        fhash = self.job.get("file_hash", "")
        if fhash:
            self.lbl_doc_hash.setText(f"SHA-256: {fhash[:16]}...{fhash[-8:]}")
            self.chk_integrity.setText("✓ File integrity verified")
            self.chk_integrity.setStyleSheet(f"font-size: 14px; color: {COLOR_OLIVE}; font-weight: 500;")
        else:
            self.lbl_doc_hash.setText("SHA-256: Unverified")
            self.chk_integrity.setText("⚠ File hash pending")
            self.chk_integrity.setStyleSheet(f"font-size: 14px; color: #a63a24; font-weight: 500;")

        pmt = self.job.get("payment_status")
        method = self.job.get("payment_method")
        if pmt == "completed":
            self.chk_payment.setText("✓ Server payment verified (Online)")
            self.chk_payment.setStyleSheet(f"font-size: 14px; color: {COLOR_OLIVE}; font-weight: 500;")
        elif method == "counter":
            self.chk_payment.setText("ℹ Payment due at counter (₹{:.2f})".format(cost))
            self.chk_payment.setStyleSheet(f"font-size: 14px; color: {COLOR_TEXT_MUTED}; font-weight: 500;")
        else:
            self.chk_payment.setText("⚠ Payment unverified")
            self.chk_payment.setStyleSheet("font-size: 14px; color: #a63a24; font-weight: 500;")

        if preview_path:
            self.lbl_doc_status.setText("Authorized preview loaded and verified.")
        else:
            self.lbl_doc_status.setText("Preview unavailable: Release grant pending.")

        self.btn_print.setText(f"Print {pages} pages · {copies} copy")
        self._validate_and_update_state()

    def _validate_and_update_state(self):
        printer = self.printer_combo.currentText().strip()
        if not printer:
            self.lbl_compat_status.setText("Print blocked: No printer selected.")
            self.lbl_compat_status.setStyleSheet("font-size: 13px; color: #a63a24; font-weight: 600;")
            self.btn_print.setEnabled(False)
            return

        # Check raw driver constraints
        if self.job.get("is_color", False):
            self.lbl_compat_status.setText("Print blocked: Color requested but raw spool path is B&W.")
            self.lbl_compat_status.setStyleSheet("font-size: 13px; color: #a63a24; font-weight: 600;")
            self.btn_print.setEnabled(False)
            return

        duplex = self.job.get("duplex_mode", "simplex")
        if duplex != "simplex":
            self.lbl_compat_status.setText("Print blocked: Duplex is not supported by current raw print path.")
            self.lbl_compat_status.setStyleSheet("font-size: 13px; color: #a63a24; font-weight: 600;")
            self.btn_print.setEnabled(False)
            return

        copies = self.job.get("copy_count", 1)
        if copies > 1:
            self.lbl_compat_status.setText(f"Print blocked: {copies} copies requested; raw spool supports single copy.")
            self.lbl_compat_status.setStyleSheet("font-size: 13px; color: #a63a24; font-weight: 600;")
            self.btn_print.setEnabled(False)
            return

        self.lbl_compat_status.setText(f"Compatible with {printer}")
        self.lbl_compat_status.setStyleSheet(f"font-size: 13px; color: {COLOR_OLIVE}; font-weight: 600;")
        self.btn_print.setEnabled(True)

    def _on_print_clicked(self):
        printer = self.printer_combo.currentText().strip()
        if printer:
            self.print_requested.emit(printer)

    def _on_hold_clicked(self):
        job_id = self.job.get("id") or self.job.get("job_id", "")
        reason, ok = QInputDialog.getText(
            self, "Hold / Reject Job",
            f"Enter reason for holding or rejecting job {job_id}:"
        )
        if ok and reason.strip():
            self.hold_requested.emit(job_id, reason.strip())
