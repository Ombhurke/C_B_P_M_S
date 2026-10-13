"""
Build script to package CBPMS Counter Desk into a standalone Windows executable (.exe).

Usage:
    python build_exe.py [--debug] [--onedir]

Prerequisites:
    pip install pyinstaller
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path


def main():
    desktop_dir = Path(__file__).resolve().parent
    os.chdir(desktop_dir)

    print("=" * 60)
    print("  CBPMS Counter Desk - Windows Executable Packager")
    print("=" * 60)

    # 1. Verify PyInstaller installation
    try:
        import PyInstaller  # noqa: F401
        print(f"[OK] PyInstaller detected: {PyInstaller.__version__}")
    except ImportError:
        print("[!] PyInstaller is not installed in the active environment.")
        print("    Installing PyInstaller now...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    # 2. Determine options
    is_debug = "--debug" in sys.argv or "--console" in sys.argv
    is_onedir = "--onedir" in sys.argv

    # 3. Clean previous build artifacts
    for folder in ["build", "dist"]:
        target = desktop_dir / folder
        if target.exists():
            print(f"[*] Cleaning previous {folder}/ folder...")
            try:
                shutil.rmtree(target)
            except Exception as e:
                print(f"[!] Warning cleaning {folder}: {e}")

    # 4. Assemble PyInstaller command
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=CBPMS_CounterDesk",
        "--paths=.",
        "--hidden-import=PySide6.QtCore",
        "--hidden-import=PySide6.QtWidgets",
        "--hidden-import=PySide6.QtGui",
        "--hidden-import=win32print",
        "--hidden-import=win32api",
        "--hidden-import=win32con",
        "--hidden-import=websockets",
        "--hidden-import=pydantic",
        "--hidden-import=pydantic_settings",
        "--hidden-import=requests",
        "--add-data=.env.example;.",
        "--exclude-module=tkinter",
        "--exclude-module=matplotlib",
        "--exclude-module=scipy",
        "--exclude-module=torch",
        "--exclude-module=tensorflow",
        "--clean",
        "--y",
    ]

    if is_debug:
        print("[*] Building in DEBUG mode (console output enabled)")
        cmd.append("--console")
    else:
        print("[*] Building in PRODUCTION mode (GUI only, no console)")
        cmd.append("--windowed")

    if is_onedir:
        print("[*] Building in ONEDIR mode (directory bundle)")
        cmd.append("--onedir")
    else:
        print("[*] Building in ONEFILE mode (single standalone .exe)")
        cmd.append("--onefile")

    cmd.append("main.py")

    print(f"[*] Executing PyInstaller command...")
    subprocess.check_call(cmd)

    dist_path = desktop_dir / "dist"
    print("\n" + "=" * 60)
    print("  BUILD SUCCESSFUL!")
    print("=" * 60)
    if is_onedir:
        exe_loc = dist_path / "CBPMS_CounterDesk" / "CBPMS_CounterDesk.exe"
    else:
        exe_loc = dist_path / "CBPMS_CounterDesk.exe"

    print(f"\nTarget Executable:\n  {exe_loc}")
    print("\nDeployment instructions:")
    print("  1. Copy 'CBPMS_CounterDesk.exe' to target workstation.")
    print("  2. Place '.env' beside 'CBPMS_CounterDesk.exe' with:")
    print("       SHOP_ID=<your-shop-id>")
    print("       CLOUD_API_URL=https://<your-render-app>.onrender.com/api/v1")
    print("       CLOUD_WS_URL=wss://<your-render-app>.onrender.com/ws/queue")
    print("       MOCK_PRINTING=false")
    print("=" * 60)


if __name__ == "__main__":
    main()
