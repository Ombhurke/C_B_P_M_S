"""Staff & Shop View (08-team) for Counter Desk Desktop.
Displays team memberships and shop profile details.
Displays existing staff only, with owner-gated profile updates.
"""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QFrame, QAbstractItemView,
    QInputDialog
)
from PySide6.QtCore import Qt, Signal
from agent.ui.theme import (
    COLOR_BORDER, COLOR_TEXT_MUTED, COLOR_OLIVE, COLOR_TERRACOTTA
)


class StaffView(QWidget):
    update_profile_requested = Signal(dict)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.team_members = []
        self.shop_profile = {}
        self.is_owner = False
        self._init_ui()

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(32, 28, 32, 28)
        main_layout.setSpacing(18)

        # Header
        title_lbl = QLabel("The right access, at your counter.")
        title_lbl.setObjectName("headerTitle")
        sub_lbl = QLabel("View existing staff memberships and manage shop profile information.")
        sub_lbl.setObjectName("headerSubtitle")
        main_layout.addWidget(title_lbl)
        main_layout.addWidget(sub_lbl)

        # Workspace (65% Team Roster, 35% Permissions & Profile)
        workspace = QHBoxLayout()
        workspace.setSpacing(24)

        # Left: Team table
        left_box = QVBoxLayout()
        left_box.setSpacing(12)

        hdr_row = QHBoxLayout()
        t_title = QLabel("Staff memberships")
        t_title.setObjectName("cardTitle")
        hdr_row.addWidget(t_title)
        hdr_row.addStretch()

        left_box.addLayout(hdr_row)

        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Staff username", "Role", "Status", "Last active"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.verticalHeader().setVisible(False)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        left_box.addWidget(self.table)
        workspace.addLayout(left_box, 65)

        # Right: Permissions summary & Shop profile
        right_box = QVBoxLayout()
        right_box.setSpacing(16)

        # Permissions card
        perm_card = QFrame()
        perm_card.setObjectName("card")
        pc_layout = QVBoxLayout(perm_card)
        pc_title = QLabel("Role boundaries")
        pc_title.setObjectName("cardTitle")
        pc_layout.addWidget(pc_title)

        op_lbl = QLabel("• Operator: Review jobs, verify release grants, confirm output")
        op_lbl.setStyleSheet(f"font-size: 13px; color: {COLOR_TEXT_MUTED};")
        op_lbl.setWordWrap(True)
        pc_layout.addWidget(op_lbl)

        ow_lbl = QLabel("• Owner / Admin: Manage rates, view staff, edit shop profile")
        ow_lbl.setStyleSheet(f"font-size: 13px; color: {COLOR_TEXT_MUTED};")
        ow_lbl.setWordWrap(True)
        pc_layout.addWidget(ow_lbl)

        priv_lbl = QLabel("Privacy guarantee: Station staff cannot browse customer private libraries.")
        priv_lbl.setStyleSheet(f"font-size: 13px; color: {COLOR_OLIVE}; font-style: italic;")
        priv_lbl.setWordWrap(True)
        pc_layout.addWidget(priv_lbl)
        right_box.addWidget(perm_card)

        # Shop Profile card
        self.profile_card = QFrame()
        self.profile_card.setObjectName("card")
        pr_layout = QVBoxLayout(self.profile_card)
        pr_title = QLabel("Shop profile")
        pr_title.setObjectName("cardTitle")
        pr_layout.addWidget(pr_title)

        self.lbl_shop_name = QLabel("Name: —")
        self.lbl_shop_addr = QLabel("Address: —")
        self.lbl_shop_phone = QLabel("Contact: —")
        for lbl in (self.lbl_shop_name, self.lbl_shop_addr, self.lbl_shop_phone):
            lbl.setObjectName("cardMeta")
            lbl.setWordWrap(True)
            pr_layout.addWidget(lbl)

        self.btn_edit_profile = QPushButton("Edit shop details")
        self.btn_edit_profile.clicked.connect(self._on_edit_profile)
        pr_layout.addWidget(self.btn_edit_profile)
        right_box.addWidget(self.profile_card)

        right_box.addStretch()
        workspace.addLayout(right_box, 35)
        main_layout.addLayout(workspace)

    def update_data(self, team: list, shop: dict, is_owner: bool):
        self.team_members = team or []
        self.shop_profile = shop or {}
        self.is_owner = is_owner

        self.btn_edit_profile.setEnabled(is_owner)

        self.lbl_shop_name.setText(f"Name: {self.shop_profile.get('name', 'QuickPrints')}")
        self.lbl_shop_addr.setText(f"Address: {self.shop_profile.get('address', 'Not set')}")
        self.lbl_shop_phone.setText(f"Contact: {self.shop_profile.get('phone') or self.shop_profile.get('contact_number', 'Not set')}")

        self.table.setRowCount(len(self.team_members))
        for row, member in enumerate(self.team_members):
            uname = member.get("username", "")
            role = member.get("role", "operator").capitalize()
            status = "Active" if member.get("active", True) else "Inactive"
            last_act = member.get("last_active") or "Unknown / Never recorded"

            for col, text in enumerate((uname, role, status, last_act)):
                item = QTableWidgetItem(str(text))
                item.setFlags(Qt.ItemIsSelectable | Qt.ItemIsEnabled)
                self.table.setItem(row, col, item)

    def _on_edit_profile(self):
        name, ok = QInputDialog.getText(self, "Edit Shop Name", "Shop name:", text=self.shop_profile.get("name", ""))
        if not ok or not name.strip():
            return
        addr, ok2 = QInputDialog.getText(self, "Edit Address", "Shop address:", text=self.shop_profile.get("address", ""))
        if not ok2:
            return
        phone, ok3 = QInputDialog.getText(self, "Edit Phone", "Contact phone:", text=self.shop_profile.get("phone") or self.shop_profile.get("contact_number", ""))
        if ok3:
            self.update_profile_requested.emit({
                "name": name.strip(),
                "address": addr.strip(),
                "phone": phone.strip()
            })
