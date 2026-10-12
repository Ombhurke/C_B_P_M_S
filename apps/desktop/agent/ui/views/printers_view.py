"""Printers and Stations View (06-printers) for Counter Desk Desktop.
Displays local detected Windows devices and shop printer registrations.
Shows explicit capability vs. driver support diagnostics.
"""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QFrame, QAbstractItemView,
    QInputDialog, QMessageBox
)
from PySide6.QtCore import Qt, Signal
from agent.ui.theme import (
    COLOR_BORDER, COLOR_TEXT_MUTED, COLOR_OLIVE, COLOR_TERRACOTTA
)


class PrintersView(QWidget):
    refresh_printers_requested = Signal()
    map_printer_requested = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.local_printers = []
        self.shop_printers = []
        self.selected_printer = None
        self._init_ui()

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(32, 28, 32, 28)
        main_layout.setSpacing(18)

        # Header
        title_lbl = QLabel("Know what each printer can handle.")
        title_lbl.setObjectName("headerTitle")
        sub_lbl = QLabel("Distinguish hardware claims from verified raw print-path capabilities.")
        sub_lbl.setObjectName("headerSubtitle")
        main_layout.addWidget(title_lbl)
        main_layout.addWidget(sub_lbl)

        # Actions toolbar
        tb_layout = QHBoxLayout()
        self.btn_refresh = QPushButton("Refresh local devices")
        self.btn_refresh.clicked.connect(self.refresh_printers_requested.emit)
        tb_layout.addWidget(self.btn_refresh)
        tb_layout.addStretch()
        main_layout.addLayout(tb_layout)

        # Workspace (65% Table, 35% Diagnostics Card)
        workspace = QHBoxLayout()
        workspace.setSpacing(24)

        # Table
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Printer device", "Observed state", "Station", "Supported print path"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table.verticalHeader().setVisible(False)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.itemSelectionChanged.connect(self._on_row_selected)
        workspace.addWidget(self.table, 65)

        # Right Detail & Capability Card
        right_box = QVBoxLayout()
        right_box.setSpacing(16)

        self.detail_card = QFrame()
        self.detail_card.setObjectName("card")
        dc_layout = QVBoxLayout(self.detail_card)
        dc_layout.setSpacing(12)

        self.lbl_det_title = QLabel("Device details")
        self.lbl_det_title.setObjectName("cardTitle")
        dc_layout.addWidget(self.lbl_det_title)

        self.lbl_det_name = QLabel("Select a printer")
        self.lbl_det_name.setObjectName("cardMeta")
        self.lbl_det_status = QLabel("Status: —")
        self.lbl_det_status.setObjectName("cardMeta")
        self.lbl_det_station = QLabel("Station mapping: —")
        self.lbl_det_station.setObjectName("cardMeta")

        dc_layout.addWidget(self.lbl_det_name)
        dc_layout.addWidget(self.lbl_det_status)
        dc_layout.addWidget(self.lbl_det_station)

        self.btn_map_station = QPushButton("Map as this station's printer")
        self.btn_map_station.setObjectName("primaryAction")
        self.btn_map_station.setEnabled(False)
        self.btn_map_station.clicked.connect(self._on_map_clicked)
        dc_layout.addWidget(self.btn_map_station)
        right_box.addWidget(self.detail_card)

        # Driver vs Hardware explanation card
        self.expl_card = QFrame()
        self.expl_card.setObjectName("card")
        ec_layout = QVBoxLayout(self.expl_card)
        ec_layout.setSpacing(10)

        ec_title = QLabel("Hardware capabilities are not driver support.")
        ec_title.setStyleSheet("font-weight: 600; font-size: 15px;")
        ec_layout.addWidget(ec_title)

        ec_copy = QLabel("Only settings the app can submit correctly via raw spooling are supported.")
        ec_copy.setStyleSheet(f"font-size: 13px; color: {COLOR_TEXT_MUTED};")
        ec_copy.setWordWrap(True)
        ec_layout.addWidget(ec_copy)

        supp_lbl = QLabel("✓ Supported: PDF direct, single-copy, B&W")
        supp_lbl.setStyleSheet(f"font-size: 13px; color: {COLOR_OLIVE}; font-weight: 500;")
        ec_layout.addWidget(supp_lbl)

        unsupp_lbl = QLabel("✗ Unavailable in raw path: Duplex, Images, Multi-copy")
        unsupp_lbl.setStyleSheet("font-size: 13px; color: #a63a24; font-weight: 500;")
        ec_layout.addWidget(unsupp_lbl)
        right_box.addWidget(self.expl_card)

        right_box.addStretch()
        workspace.addLayout(right_box, 35)
        main_layout.addLayout(workspace)

    def update_printers(self, local_printers: list, shop_printers: list, current_mapped: str = ""):
        self.local_printers = local_printers or []
        self.shop_printers = shop_printers or []

        self.table.setRowCount(len(self.local_printers))
        for row, p_name in enumerate(self.local_printers):
            is_mapped = (p_name == current_mapped)
            station_text = "This station" if is_mapped else "Local Windows device"
            path_text = "PDF direct · 1 copy · Simplex · B&W"
            state_text = "Detected (Ready)"

            for col, text in enumerate((p_name, state_text, station_text, path_text)):
                item = QTableWidgetItem(str(text))
                item.setFlags(Qt.ItemIsSelectable | Qt.ItemIsEnabled)
                self.table.setItem(row, col, item)

    def _on_row_selected(self):
        row = self.table.currentRow()
        if 0 <= row < len(self.local_printers):
            p_name = self.local_printers[row]
            self.selected_printer = p_name
            self.lbl_det_name.setText(f"Device: {p_name}")
            self.lbl_det_status.setText("Status: Windows printer online")
            self.lbl_det_station.setText(f"Submits via: Native Win32 Spooler RAW stream")
            self.btn_map_station.setEnabled(True)
        else:
            self.selected_printer = None
            self.btn_map_station.setEnabled(False)

    def _on_map_clicked(self):
        if self.selected_printer:
            self.map_printer_requested.emit(self.selected_printer)
