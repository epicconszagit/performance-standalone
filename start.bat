@echo off
setlocal

set "ROOT=%~dp0"

echo ============================================
echo   Performance System - Starting Up
echo ============================================
echo.

if not exist "%ROOT%backend\venv\Scripts\python.exe" (
    echo [1/4] Setting up backend virtual environment (first run only)...
    python -m venv "%ROOT%backend\venv"
    "%ROOT%backend\venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
    "%ROOT%backend\venv\Scripts\python.exe" -m pip install --quiet -r "%ROOT%backend\requirements.txt"
) else (
    echo [1/4] Backend virtual environment found.
)

if not exist "%ROOT%backend\app.db" (
    echo [2/4] Creating database...
    pushd "%ROOT%backend"
    set "FLASK_APP=run.py"
    "%ROOT%backend\venv\Scripts\python.exe" -m flask db upgrade
    popd
) else (
    echo [2/4] Database already exists.
)

if not exist "%ROOT%frontend\node_modules" (
    echo [3/4] Installing frontend dependencies (first run only)...
    pushd "%ROOT%frontend"
    call npm install
    popd
) else (
    echo [3/4] Frontend dependencies found.
)

echo [4/4] Launching backend and frontend...
echo.

start "Performance - Backend (Flask)" cmd /k "cd /d "%ROOT%backend" && venv\Scripts\python.exe run.py"

timeout /t 3 /nobreak >nul

start "Performance - Frontend (Vite)" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

timeout /t 4 /nobreak >nul

start http://localhost:5173

echo.
echo Both servers are running in their own windows:
echo   - Backend (Flask):  http://localhost:5000
echo   - Frontend (Vite):  http://localhost:5173
echo.
echo Close those two windows to stop the system.
echo This window can be closed safely.
echo.
pause
