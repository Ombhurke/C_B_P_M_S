"""Services & Rates View (07-rates) for Counter Desk Desktop.
Displays and edits shop base rates and paper rates with owner role verification.
Rate changes apply strictly to future customer quotes; existing jobs keep accepted price.
"""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QFrame, QDoubleSpinBox, QMessageBox
)
from PySide6.QtCore import Qt, Signal
from agent.ui.theme import (
    COLOR_BORDER, COLOR_TEXT_MUTED, COLOR_OLIVE, COLOR_TERRACOTTA
)


class RatesView(QWidget):
    save_rates_requested = Signal(dict)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.shop_data = {}
        self.is_owner = False
        self._init_ui()

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(32, 28, 32, 28)
        main_layout.setSpacing(18)

        # Header
        title_lbl = QLabel("Keep your services clear.")
        title_lbl.setObjectName("headerTitle")
        sub_lbl = QLabel("Changes apply to new quotes. Existing jobs keep their accepted price.")
        sub_lbl.setObjectName("headerSubtitle")
        main_layout.addWidget(title_lbl)
        main_layout.addWidget(sub_lbl)

        # Workspace (50% Available Services, 50% Rate Configuration)
        workspace = QHBoxLayout()
        workspace.setSpacing(24)

        # Left: Services Availability
        self.services_card = QFrame()
        self.services_card.setObjectName("card")
        sc_layout = QVBoxLayout(self.services_card)
        sc_layout.setSpacing(14)

        sc_title = QLabel("Available services")
        sc_title.setObjectName("cardTitle")
        sc_layout.addWidget(sc_title)

        srv_items = [
            ("✓ Black & White PDF", "Available on this station", True),
            ("✗ Colour Printing", "No verified raw colour profile", False),
            ("✗ Duplex Auto-Flip", "Raw spool path lacks duplex PJL", False),
            ("✗ Direct Image Spooling", "Requires PDF conversion", False),
        ]
        for name, desc, active in srv_items:
            s_box = QFrame()
            s_box.setStyleSheet("border-bottom: 1px solid #f0ebe2; padding: 6px 0;")
            sb_layout = QVBoxLayout(s_box)
            n_lbl = QLabel(name)
            n_lbl.setStyleSheet(f"font-weight: 600; font-size: 15px; color: {COLOR_OLIVE if active else '#a63a24'};")
            d_lbl = QLabel(desc)
            d_lbl.setStyleSheet(f"font-size: 13px; color: {COLOR_TEXT_MUTED};")
            sb_layout.addWidget(n_lbl)
            sb_layout.addWidget(d_lbl)
            sc_layout.addWidget(s_box)

        sc_layout.addStretch()
        workspace.addWidget(self.services_card, 50)

        # Right: Pricing Form
        self.pricing_card = QFrame()
        self.pricing_card.setObjectName("card")
        pc_layout = QVBoxLayout(self.pricing_card)
        pc_layout.setSpacing(14)

        pc_title = QLabel("Standard A4 Rates")
        pc_title.setObjectName("cardTitle")
        pc_layout.addWidget(pc_title)

        # Base BW price
        pc_layout.addWidget(QLabel("Black & white page price (₹):"))
        self.spin_bw = QDoubleSpinBox()
        self.spin_bw.setRange(0.1, 100.0)
        self.spin_bw.setSingleStep(0.5)
        self.spin_bw.setValue(2.0)
        pc_layout.addWidget(self.spin_bw)

        # Color price
        pc_layout.addWidget(QLabel("Colour page price (₹):"))
        self.spin_color = QDoubleSpinBox()
        self.spin_color.setRange(0.5, 200.0)
        self.spin_color.setSingleStep(1.0)
        self.spin_color.setValue(5.0)
        pc_layout.addWidget(self.spin_color)

        # Glossy paper extra
        pc_layout.addWidget(QLabel("Glossy paper rate (₹):"))
        self.spin_glossy = QDoubleSpinBox()
        self.spin_glossy.setRange(1.0, 100.0)
        self.spin_glossy.setValue(10.0)
        pc_layout.addWidget(self.spin_glossy)

        pc_layout.addSpacing(10)
        self.btn_save_rates = QPushButton("Save rates")
        self.btn_save_rates.setObjectName("primaryAction")
        self.btn_save_rates.clicked.connect(self._on_save_clicked)
        pc_layout.addWidget(self.btn_save_rates)

        self.lbl_perm_note = QLabel("Note: Rate editing requires Owner / Admin permissions.")
        self.lbl_perm_note.setStyleSheet(f"font-size: 13px; color: {COLOR_TEXT_MUTED};")
        pc_layout.addWidget(self.lbl_perm_note)
        pc_layout.addStretch()

        workspace.addWidget(self.pricing_card, 50)
        main_layout.addLayout(workspace)

    def update_rates(self, shop: dict, is_owner: bool):
        self.shop_data = shop or {}
        self.is_owner = is_owner
        base = self.shop_data.get("base_rates", {})
        paper = self.shop_data.get("paper_rates", {})

        self.spin_bw.setValue(float(base.get("bw_normal", 2.0)))
        self.spin_color.setValue(float(base.get("color_normal", 5.0)))
        self.spin_glossy.setValue(float(paper.get("glossy", 10.0)))

        self.spin_bw.setEnabled(is_owner)
        self.spin_color.setEnabled(is_owner)
        self.spin_glossy.setEnabled(is_owner)
        self.btn_save_rates.setEnabled(is_owner)

        if not is_owner:
            self.lbl_perm_note.setText("Operator account: Read-only rate view.")
        else:
            self.lbl_perm_note.setText("Owner account: Modifications sync to customer checkout quote engine.")

    def _on_save_clicked(self):
        payload = {
            "base_rates": {
                "bw_normal": self.spin_bw.value(),
                "color_normal": self.spin_color.value()
            },
            "paper_rates": {
                "normal": 0.0,
                "bond": 2.0,
                "glossy": self.spin_glossy.value()
            }
        }
        self.save_rates_requested.emit(payload)
