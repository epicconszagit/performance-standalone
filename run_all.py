#!/usr/bin/env python3
"""Run the whole Performance system (backend + frontend) with one command:

    python run_all.py

Sets up the backend venv / database and frontend node_modules on first run,
then starts both servers and opens the app in your browser. Press Ctrl+C in
this terminal to stop everything.
"""
import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV_PYTHON = BACKEND / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
NPM = "npm.cmd" if os.name == "nt" else "npm"


def run(cmd, **kwargs):
    print(f"$ {' '.join(str(c) for c in cmd)}")
    subprocess.run(cmd, check=True, **kwargs)


def ensure_backend_ready():
    if not VENV_PYTHON.exists():
        print("[backend] setting up virtual environment (first run only)...")
        run([sys.executable, "-m", "venv", str(BACKEND / "venv")])
        run([str(VENV_PYTHON), "-m", "pip", "install", "--quiet", "--upgrade", "pip"])
        run([str(VENV_PYTHON), "-m", "pip", "install", "--quiet", "-r", str(BACKEND / "requirements.txt")])
    else:
        print("[backend] virtual environment found.")

    if not (BACKEND / "app.db").exists():
        print("[backend] creating database...")
        env = os.environ.copy()
        env["FLASK_APP"] = "run.py"
        run([str(VENV_PYTHON), "-m", "flask", "db", "upgrade"], cwd=BACKEND, env=env)
    else:
        print("[backend] database found.")


def ensure_frontend_ready():
    if not (FRONTEND / "node_modules").exists():
        print("[frontend] installing dependencies (first run only)...")
        run([NPM, "install"], cwd=FRONTEND)
    else:
        print("[frontend] dependencies found.")


def kill_proc_tree(proc, label):
    if proc is None or proc.poll() is not None:
        return
    print(f"Stopping {label}...")
    if os.name == "nt":
        subprocess.call(
            ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        proc.terminate()


def main():
    print("=" * 50)
    print("  Performance System - Starting Up")
    print("=" * 50)

    ensure_backend_ready()
    ensure_frontend_ready()

    print("\nLaunching backend and frontend (logs from both appear below)...\n")

    backend_proc = subprocess.Popen([str(VENV_PYTHON), "run.py"], cwd=BACKEND)
    time.sleep(2)
    frontend_proc = subprocess.Popen([NPM, "run", "dev"], cwd=FRONTEND)

    time.sleep(4)
    webbrowser.open("http://localhost:5173")

    print("\n" + "=" * 50)
    print("  Backend:  http://localhost:5000")
    print("  Frontend: http://localhost:5173")
    print("  Press Ctrl+C in this window to stop everything.")
    print("=" * 50 + "\n")

    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print("Backend process exited unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("Frontend process exited unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        kill_proc_tree(backend_proc, "backend")
        kill_proc_tree(frontend_proc, "frontend")


if __name__ == "__main__":
    main()
