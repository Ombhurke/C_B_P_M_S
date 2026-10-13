# -*- mode: python ; coding: utf-8 -*-
import os
import sys

block_cipher = None

# Hidden imports needed for PySide6 + win32print + Pydantic v2
hidden_imports = [
    'PySide6.QtCore',
    'PySide6.QtWidgets',
    'PySide6.QtGui',
    'win32print',
    'win32api',
    'win32con',
    'websockets',
    'pydantic',
    'pydantic_settings',
    'requests',
    'agent',
    'agent.core',
    'agent.core.config',
    'agent.core.api_client',
    'agent.core.ws_client',
    'agent.core.lifecycle',
    'agent.spooler',
    'agent.spooler.win32_spooler',
    'agent.ui',
    'agent.ui.shell',
    'agent.ui.theme',
    'agent.ui.dashboard',
    'agent.ui.panels',
    'agent.ui.views',
]

added_files = [
    ('.env.example', '.'),
]

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=added_files,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'torch', 'tensorflow', 'PIL'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='CBPMS_CounterDesk',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
