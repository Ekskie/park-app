@echo off
REM Bootstrap and run the backend with Python 3.11 in a virtual environment.
REM This script should be executed from anywhere; it will cd to the backend folder automatically.

setlocal
pushd "%~dp0"

REM Create venv if it does not exist
if not exist ".venv\Scripts\python.exe" (
    echo [setup] Creating Python 3.11 virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo [error] Failed to create virtual environment with Python 3.11.
        popd
        exit /b 1
    )
)

REM Upgrade pip and install dependencies (quiet/fastresolve to avoid resolver noise)
echo [setup] Upgrading pip and installing requirements...
call ".venv\Scripts\python.exe" -m pip install --upgrade pip
REM Remove any old lap build to avoid numpy ABI mismatch
call ".venv\Scripts\python.exe" -m pip uninstall -y lap 2>nul
REM Install with legacy resolver to avoid over-backtracking on pinned stack
call ".venv\Scripts\python.exe" -m pip install --use-deprecated=legacy-resolver -r requirements.txt
if errorlevel 1 (
    echo [error] Failed to install dependencies.
    popd
    exit /b 1
)

REM Run the Flask server
echo [run] Starting backend server...
call ".venv\Scripts\python.exe" app.py

popd
endlocal
