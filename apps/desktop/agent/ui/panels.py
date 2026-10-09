import os
from typing import TYPE_CHECKING
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QComboBox, QTextEdit,
    QFrame, QGridLayout
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont

if TYPE_CHECKING:
    from agent.ui.dashboard import DesktopDashboard


def create_card(title: str = "") -> tuple[QFrame, QVBoxLayout]:
    card = QFrame()
    card.setStyleSheet("""
        QFrame {
            background-color: #ffffff;
            border: 1px solid #e2dad0;
            border-radius: 12px;
            padding: 12px;
        }
    """)
    layout = QVBoxLayout(card)
    layout.setSpacing(10)
    layout.setContentsMargins(16, 16, 16, 16)
    if title:
        lbl = QLabel(title)
        lbl.setStyleSheet("font-size: 15px; font-weight: bold; color: #251c17; border: none;")
        layout.addWidget(lbl)
    return card, layout


def build_connect_panel(dash: "DesktopDashboard") -> QWidget:
    w = QWidget()
    layout = QVBoxLayout(w)
    layout.setSpacing(16)
    layout.setContentsMargins(24, 24, 24, 24)

    header = QLabel("Station Configuration & Link")
    header.setStyleSheet("font-size: 22px; font-weight: bold; color: #251c17;")
    layout.addWidget(header)

    card, c_layout = create_card("Active Station Binding")
    c_layout.addWidget(QLabel("Bound Shop ID: " + str(dash.shop_id)))
    c_layout.addWidget(QLabel("Authenticated Operator: " + str(dash.operator_username)))
    c_layout.addWidget(QLabel("Connection: Online · Mumbai Secure Gateway"))

    pr_card, pr_layout = create_card("Local Printer Mapping")
    pr_layout.addWidget(QLabel("Primary Hardware Spooler:"))
    pr_layout.addWidget(dash.printer_combo)
    
    layout.addWidget(card)
    layout.addWidget(pr_card)
    layout.addStretch()
    return w


def build_release_panel(dash: "DesktopDashboard") -> QWidget:
    w = QWidget()
    layout = QVBoxLayout(w)
    layout.setSpacing(16)
    layout.setContentsMargins(24, 24, 24, 24)

    header = QLabel("Release Desk")
    header.setStyleSheet("font-size: 22px; font-weight: bold; color: #251c17;")
    layout.addWidget(header)

    # Scan Card
    scan_card, scan_layout = create_card("Enter Release Code or Barcode")
    input_row = QHBoxLayout()
    dash.scan_input = QLineEdit()
    dash.scan_input.setPlaceholderText("Scan 2D Barcode (USB Scanner) or Type 4-Digit Release PIN...")
    dash.scan_input.setStyleSheet("""
        QLineEdit {
            background-color: #fbf9f6;
            border: 2px solid #e2dad0;
            border-radius: 10px;
            padding: 10px 14px;
            font-size: 14px;
            color: #251c17;
            font-weight: 600;
        }
        QLineEdit:focus { border: 2px solid #ea7c50; }
    """)
    dash.scan_input.returnPressed.connect(dash._handle_manual_submit)
    input_row.addWidget(dash.scan_input)

    dash.release_btn = QPushButton("Release Job")
    dash.release_btn.setStyleSheet("""
        QPushButton {
            background-color: #ea7c50;
            color: #ffffff;
            font-weight: bold;
            border-radius: 10px;
            padding: 11px 22px;
            font-size: 13px;
        }
        QPushButton:hover { background-color: #d75d31; }
    """)
    dash.release_btn.clicked.connect(dash._handle_manual_submit)
    input_row.addWidget(dash.release_btn)
    scan_layout.addLayout(input_row)
    layout.addWidget(scan_card)

    # Queue Table Card
    q_card, q_layout = create_card("Live Counter Queue (Real-Time WebSocket Sync)")
    dash.queue_table = QTableWidget(0, 5)
    dash.queue_table.setHorizontalHeaderLabels(["Status", "File Name", "Pages", "Color / Duplex", "Total"])
    dash.queue_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
    dash.queue_table.setStyleSheet("""
        QTableWidget {
            background-color: #ffffff;
            border: 1px solid #f0eae1;
            border-radius: 8px;
            color: #251c17;
            font-size: 12px;
            gridline-color: #f7f3ed;
        }
        QHeaderView::section {
            background-color: #fbf9f6;
            color: #70645a;
            padding: 8px;
            font-weight: 600;
            border: none;
            border-bottom: 1px solid #e2dad0;
        }
    """)
    q_layout.addWidget(dash.queue_table)
    layout.addWidget(q_card)
    return w


def build_review_panel(dash: "DesktopDashboard") -> QWidget:
    w = QWidget()
    layout = QVBoxLayout(w)
    layout.setSpacing(16)
    layout.setContentsMargins(24, 24, 24, 24)

    header = QLabel("Review Before Printing")
    header.setStyleSheet("font-size: 22px; font-weight: bold; color: #251c17;")
    layout.addWidget(header)

    card, c_layout = create_card("Active Released Job Inspection")
    dash.review_file_lbl = QLabel("No released job in review queue.")
    dash.review_file_lbl.setStyleSheet("font-size: 15px; font-weight: bold; color: #251c17; border: none;")
    c_layout.addWidget(dash.review_file_lbl)

    dash.review_specs_lbl = QLabel("Scan or input a release code on the Release Desk to prepare for printing.")
    dash.review_specs_lbl.setStyleSheet("color: #70645a; border: none; font-size: 12px;")
    c_layout.addWidget(dash.review_specs_lbl)

    dash.proceed_btn = QPushButton("Confirm & Dispatch to Spooler")
    dash.proceed_btn.setEnabled(False)
    dash.proceed_btn.setStyleSheet("""
        QPushButton {
            background-color: #3b5232;
            color: #ffffff;
            font-weight: bold;
            border-radius: 10px;
            padding: 12px 24px;
            font-size: 13px;
        }
        QPushButton:hover { background-color: #2d4026; }
        QPushButton:disabled { background-color: #e2dad0; color: #91857a; }
    """)
    dash.proceed_btn.clicked.connect(dash._handle_proceed_print)
    c_layout.addWidget(dash.proceed_btn)

    layout.addWidget(card)
    layout.addStretch()
    return w


def build_monitor_panel(dash: "DesktopDashboard") -> QWidget:
    w = QWidget()
    layout = QVBoxLayout(w)
    layout.setSpacing(16)
    layout.setContentsMargins(24, 24, 24, 24)

    header = QLabel("Print Monitor")
    header.setStyleSheet("font-size: 22px; font-weight: bold; color: #251c17;")
    layout.addWidget(header)

    card, c_layout = create_card("Physical Spool Execution Stages")
    dash.stage1_lbl = QLabel("Stage 1: Verified Document Download — Ready")
    dash.stage2_lbl = QLabel("Stage 2: Windows Spooler Submission — Ready")
    dash.stage3_lbl = QLabel("Stage 3: Physical Output Confirmation — Awaiting Spool")
    for lbl in (dash.stage1_lbl, dash.stage2_lbl, dash.stage3_lbl):
        lbl.setStyleSheet("font-size: 13px; color: #52473f; border: none; padding: 4px 0;")
        c_layout.addWidget(lbl)

    actions = QHBoxLayout()
    dash.confirm_output_btn = QPushButton("Confirm Output Printed")
    dash.confirm_output_btn.setStyleSheet("""
        QPushButton { background-color: #15803d; color: #ffffff; font-weight: bold; border-radius: 10px; padding: 10px 18px; }
        QPushButton:hover { background-color: #166534; }
    """)
    dash.confirm_output_btn.clicked.connect(dash._handle_confirm_output)

    dash.report_issue_btn = QPushButton("Report Issue / Jam")
    dash.report_issue_btn.setStyleSheet("""
        QPushButton { background-color: #b91c1c; color: #ffffff; font-weight: bold; border-radius: 10px; padding: 10px 18px; }
        QPushButton:hover { background-color: #991b1b; }
    """)
    dash.report_issue_btn.clicked.connect(dash._handle_report_issue)

    actions.addWidget(dash.confirm_output_btn)
    actions.addWidget(dash.report_issue_btn)
    c_layout.addLayout(actions)
    layout.addWidget(card)
    layout.addStretch()
    return w


def build_history_panel(dash: "DesktopDashboard") -> QWidget:
    w = QWidget()
    layout = QVBoxLayout(w)
    layout.setSpacing(16)
    layout.setContentsMargins(24, 24, 24, 24)

    header = QLabel("History & Recovery")
    header.setStyleSheet("font-size: 22px; font-weight: bold; color: #251c17;")
    layout.addWidget(header)

    card, c_layout = create_card("Ephemeral Shredder & Spooler Audit Log")
    dash.log_box = QTextEdit()
    dash.log_box.setReadOnly(True)
    dash.log_box.setStyleSheet("""
        QTextEdit {
            background-color: #fbf9f6;
            border: 1px solid #e2dad0;
            border-radius: 8px;
            color: #251c17;
            font-family: 'Consolas', monospace;
            font-size: 11px;
            padding: 8px;
        }
    """)
    c_layout.addWidget(dash.log_box)
    layout.addWidget(card)
    return w


def build_settings_panel(dash: "DesktopDashboard") -> QWidget:
    w = QWidget()
    layout = QVBoxLayout(w)
    layout.setSpacing(16)
    layout.setContentsMargins(24, 24, 24, 24)

    header = QLabel("Station Settings")
    header.setStyleSheet("font-size: 22px; font-weight: bold; color: #251c17;")
    layout.addWidget(header)

    card, c_layout = create_card("Diagnostics & Temporary Storage")
    from agent.core.config import agent_settings
    c_layout.addWidget(QLabel(f"Spool Directory: {agent_settings.LOCAL_SPOOL_DIR}"))
    c_layout.addWidget(QLabel(f"State Directory: {agent_settings.LOCAL_STATE_DIR}"))
    c_layout.addWidget(QLabel(f"Mock Printing Mode: {agent_settings.MOCK_PRINTING}"))

    purge_btn = QPushButton("Clean Temp Spool Cache")
    purge_btn.setStyleSheet("""
        QPushButton { background-color: #70645a; color: white; border-radius: 8px; padding: 8px 16px; font-weight: bold; }
        QPushButton:hover { background-color: #52473f; }
    """)
    purge_btn.clicked.connect(dash._handle_purge_cache)
    c_layout.addWidget(purge_btn)

    layout.addWidget(card)
    layout.addStretch()
    return w
