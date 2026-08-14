import sys
import os
from typing import Optional, Callable

# Check for PySide6
try:
    from PySide6.QtWidgets import (
        QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
        QLabel, QLineEdit, QPushButton, QTableWidget, QTableWidgetItem,
        QHeaderView, QComboBox, QTextEdit, QMessageBox
    )
    from PySide6.QtCore import Qt, Signal, QObject, QTimer
    from PySide6.QtGui import QFont, QColor
    HAS_PYSIDE = True
except ImportError:
    HAS_PYSIDE = False


class AgentUiBridge(QObject if HAS_PYSIDE else object):
    if HAS_PYSIDE:
        queue_updated = Signal(list)
        log_message = Signal(str)
        scan_triggered = Signal(str)


class DesktopDashboard:
    """Counter Operator GUI for CBPMS Desktop Agent."""
    def __init__(
        self,
        on_release_callback: Optional[Callable[[str], None]] = None,
        on_printer_change: Optional[Callable[[str], None]] = None
    ):
        self.on_release_callback = on_release_callback
        self.on_printer_change = on_printer_change
        self.app = None
        self.window = None

    def launch(self, initial_printers: list, initial_queue: list):
        if not HAS_PYSIDE:
            print("[UI] PySide6 not installed. Running in CLI mode.")
            return

        self.app = QApplication.instance() or QApplication(sys.argv)
        self.window = QMainWindow()
        self.window.setWindowTitle("CBPMS Counter Agent - v1.0.0")
        self.window.resize(800, 560)
        self.window.setStyleSheet("""
            QMainWindow { background-color: #090d16; color: #f1f5f9; }
            QLabel { color: #cbd5e1; font-family: 'Segoe UI', sans-serif; }
            QLineEdit { background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px; color: #38bdf8; font-size: 16px; font-weight: bold; }
            QLineEdit:focus { border: 1px solid #0284c7; }
            QPushButton { background-color: #0284c7; border-radius: 8px; padding: 10px 18px; color: #ffffff; font-weight: bold; }
            QPushButton:hover { background-color: #0369a1; }
            QTableWidget { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 8px; color: #e2e8f0; gridline-color: #1e293b; }
            QHeaderView::section { background-color: #1e293b; color: #94a3b8; padding: 6px; font-weight: bold; border: none; }
            QComboBox { background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px; color: #f8fafc; }
            QTextEdit { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 8px; color: #10b981; font-family: 'Consolas', monospace; font-size: 11px; }
        """)

        central = QWidget()
        layout = QVBoxLayout(central)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(14)

        # Header Bar
        header = QHBoxLayout()
        title_label = QLabel("⚡ CBPMS Spooler & Shredder Agent")
        title_label.setFont(QFont("Segoe UI", 14, QFont.Bold))
        header.addWidget(title_label)

        header.addStretch()
        header.addWidget(QLabel("Target Printer:"))
        self.printer_combo = QComboBox()
        self.printer_combo.addItems(initial_printers)
        if self.on_printer_change:
            self.printer_combo.currentTextChanged.connect(self.on_printer_change)
        header.addWidget(self.printer_combo)
        layout.addLayout(header)

        # Scanner Input Bar
        scan_layout = QHBoxLayout()
        self.scan_input = QLineEdit()
        self.scan_input.setPlaceholderText("Scan 2D Barcode (USB Scanner) or Type 4-Digit PIN...")
        self.scan_input.returnPressed.connect(self._handle_manual_submit)
        scan_layout.addWidget(self.scan_input)

        self.release_btn = QPushButton("Release Job")
        self.release_btn.clicked.connect(self._handle_manual_submit)
        scan_layout.addWidget(self.release_btn)
        layout.addLayout(scan_layout)

        # Queue Table
        layout.addWidget(QLabel("Live Counter Queue (Real-Time WebSocket Sync):"))
        self.queue_table = QTableWidget(0, 5)
        self.queue_table.setHorizontalHeaderLabels(["PIN / Token", "File Name", "Pages", "Color / Duplex", "Total Cost"])
        self.queue_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        layout.addWidget(self.queue_table)

        # Audit Log
        layout.addWidget(QLabel("Ephemeral Shredder & Spooler Audit Log:"))
        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setFixedHeight(120)
        self.log_box.append("[System] Desktop Agent started. Spooler bridge ready.")
        self.log_box.append("[Security] Local sandbox directory: %TEMP%\\cbpms_spool\\")
        layout.addWidget(self.log_box)

        self.window.setCentralWidget(central)
        self.window.show()

    def _handle_manual_submit(self):
        text = self.scan_input.text().strip()
        if text and self.on_release_callback:
            self.on_release_callback(text)
            self.scan_input.clear()

    def log(self, text: str):
        if self.log_box:
            self.log_box.append(text)
        print(f"[UI Log] {text}")

    def update_queue(self, jobs: list):
        if not self.queue_table:
            return
        self.queue_table.setRowCount(len(jobs))
        for row, j in enumerate(jobs):
            self.queue_table.setItem(row, 0, QTableWidgetItem(str(j.get("release_token", "-"))))
            self.queue_table.setItem(row, 1, QTableWidgetItem(str(j.get("file_name", "doc"))))
            self.queue_table.setItem(row, 2, QTableWidgetItem(f"{j.get('page_count', 1)} pgs ({j.get('copy_count', 1)} copies)"))
            self.queue_table.setItem(row, 3, QTableWidgetItem(f"{'Color' if j.get('is_color') else 'B&W'} / {j.get('duplex_mode', 'simplex')}"))
            self.queue_table.setItem(row, 4, QTableWidgetItem(f"₹{j.get('total_cost', 0):.2f}"))
