"""Counter Desk styling tokens and PySide6 QSS stylesheet.
Colors:
- Canvas: #fcfaf7 (warm ivory)
- Sidebar: #f5f0e8 (parchment)
- Text Primary: #251c17 (espresso)
- Text Secondary: #6e6259
- Borders: #e3dacd
- Selection/Active: #3b5232 (olive)
- Primary Physical Print Action: #c05634 (terracotta)
- Surface Cards: #ffffff
- Warning/Blocked: #a63a24
- Success/Verified: #2d6a4f
"""

COLOR_CANVAS = "#fcfaf7"
COLOR_SIDEBAR = "#f5f0e8"
COLOR_TEXT_PRIMARY = "#251c17"
COLOR_TEXT_MUTED = "#6e6259"
COLOR_BORDER = "#e3dacd"
COLOR_OLIVE = "#3b5232"
COLOR_OLIVE_LIGHT = "#eef3ec"
COLOR_TERRACOTTA = "#c05634"
COLOR_TERRACOTTA_HOVER = "#a8482b"
COLOR_CARD_BG = "#ffffff"
COLOR_WARNING_BG = "#fff4f2"
COLOR_SUCCESS_BG = "#f2f8f4"

COUNTER_DESK_STYLESHEET = f"""
QMainWindow, QDialog {{
    background-color: {COLOR_CANVAS};
    color: {COLOR_TEXT_PRIMARY};
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    font-size: 15px;
}}

QWidget#sidebar {{
    background-color: {COLOR_SIDEBAR};
    border-right: 1px solid {COLOR_BORDER};
}}

QWidget#contentArea {{
    background-color: {COLOR_CANVAS};
}}

QFrame#card {{
    background-color: {COLOR_CARD_BG};
    border: 1px solid {COLOR_BORDER};
    border-radius: 8px;
    padding: 18px;
}}

QLabel {{
    color: {COLOR_TEXT_PRIMARY};
}}

QLabel#headerTitle {{
    font-size: 32px;
    font-weight: 600;
    color: {COLOR_TEXT_PRIMARY};
    letter-spacing: -0.5px;
}}

QLabel#headerSubtitle {{
    font-size: 15px;
    color: {COLOR_TEXT_MUTED};
}}

QLabel#cardTitle {{
    font-size: 17px;
    font-weight: 600;
    color: {COLOR_TEXT_PRIMARY};
}}

QLabel#cardMeta {{
    font-size: 14px;
    color: {COLOR_TEXT_MUTED};
}}

QPushButton {{
    background-color: #ffffff;
    color: {COLOR_TEXT_PRIMARY};
    border: 1px solid {COLOR_BORDER};
    border-radius: 6px;
    padding: 10px 18px;
    font-size: 15px;
    font-weight: 500;
    min-height: 44px;
}}

QPushButton:hover {{
    background-color: #f7f3ed;
    border-color: #cfc4b4;
}}

QPushButton:pressed {{
    background-color: #ede7de;
}}

QPushButton:disabled {{
    background-color: #f5f2ed;
    color: #a89f95;
    border-color: #e5ded4;
}}

QPushButton#primaryAction {{
    background-color: {COLOR_OLIVE};
    color: #ffffff;
    border: 1px solid {COLOR_OLIVE};
    font-weight: 600;
}}

QPushButton#primaryAction:hover {{
    background-color: #314429;
}}

QPushButton#printAction {{
    background-color: {COLOR_TERRACOTTA};
    color: #ffffff;
    border: 1px solid {COLOR_TERRACOTTA};
    font-size: 16px;
    font-weight: 600;
    min-height: 48px;
}}

QPushButton#printAction:hover {{
    background-color: {COLOR_TERRACOTTA_HOVER};
}}

QPushButton#printAction:disabled {{
    background-color: #e2b7a9;
    border-color: #e2b7a9;
    color: #ffffff;
}}

QPushButton#dangerAction {{
    background-color: #ffffff;
    color: #b3261e;
    border: 1px solid #f1c3be;
}}

QPushButton#dangerAction:hover {{
    background-color: #fdf2f1;
}}

QPushButton#navButton {{
    background-color: transparent;
    border: none;
    border-radius: 6px;
    text-align: left;
    padding: 12px 14px;
    color: {COLOR_TEXT_PRIMARY};
    font-size: 15px;
    font-weight: 500;
    min-height: 42px;
}}

QPushButton#navButton:hover {{
    background-color: #ebe4d8;
}}

QPushButton#navButton[active="true"] {{
    background-color: {COLOR_OLIVE_LIGHT};
    color: {COLOR_OLIVE};
    font-weight: 600;
}}

QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox {{
    background-color: #ffffff;
    color: {COLOR_TEXT_PRIMARY};
    border: 1px solid {COLOR_BORDER};
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 15px;
    min-height: 40px;
}}

QLineEdit:focus, QComboBox:focus {{
    border: 1px solid {COLOR_OLIVE};
}}

QTableWidget {{
    background-color: #ffffff;
    alternate-background-color: #faf7f2;
    border: 1px solid {COLOR_BORDER};
    border-radius: 8px;
    gridline-color: #f0ebe2;
    selection-background-color: {COLOR_OLIVE_LIGHT};
    selection-color: {COLOR_TEXT_PRIMARY};
    font-size: 14px;
}}

QHeaderView::section {{
    background-color: {COLOR_SIDEBAR};
    color: {COLOR_TEXT_MUTED};
    padding: 10px;
    border: none;
    border-bottom: 1px solid {COLOR_BORDER};
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}}

QScrollBar:vertical {{
    background: {COLOR_CANVAS};
    width: 10px;
    margin: 0px;
}}

QScrollBar::handle:vertical {{
    background: #d8cfc2;
    min-height: 20px;
    border-radius: 5px;
}}

QScrollBar::handle:vertical:hover {{
    background: #b8ac9d;
}}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0px;
}}
"""
