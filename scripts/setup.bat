
@echo off
setlocal EnableExtensions

cd /d "%~dp0.."

title Sentinel AI - Installation

echo ==========================================
echo          SENTINEL AI INSTALLATION
echo ==========================================
echo.

REM ==========================================
REM CHECK SYSTEM REQUIREMENTS
REM ==========================================

echo [1/7] Checking system requirements...

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    goto failure
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    goto failure
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not available.
    goto failure
)

where ollama >nul 2>&1
if errorlevel 1 (
    echo ERROR: Ollama is not installed or not in PATH.
    goto failure
)

python --version
node --version
call npm --version
ollama --version

echo System requirements detected.
echo.

REM ==========================================
REM CREATE VIRTUAL ENVIRONMENT
REM ==========================================

echo [2/7] Preparing Python virtual environment...

if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if errorlevel 1 goto failure
) else (
    echo Existing virtual environment detected.
)

echo Virtual environment ready.
echo.

REM ==========================================
REM INSTALL PYTHON DEPENDENCIES
REM ==========================================

echo [3/7] Installing Python dependencies...

".venv\Scripts\python.exe" -m pip install -r requirements.txt

if errorlevel 1 goto failure

echo Python dependencies installed.
echo.

REM ==========================================
REM PREPARE LOCAL AI MODEL
REM ==========================================

echo [4/7] Preparing local language model...

ollama list >nul 2>&1

if errorlevel 1 (
    echo ERROR: Ollama service is unavailable.
    echo Start Ollama and run this script again.
    goto failure
)

ollama pull llama3.2:latest

if errorlevel 1 goto failure

echo Local AI model ready.
echo.

REM ==========================================
REM VERIFY MACHINE LEARNING MODEL
REM ==========================================

echo [5/7] Checking machine learning model...

if not exist "models\isolation_forest_final.joblib" (
    echo ERROR: Final machine learning model is missing.
    goto failure
)

echo Machine learning model file detected.
echo.

REM ==========================================
REM INSTALL AND BUILD FRONTEND
REM ==========================================


echo [6/7] Installing frontend dependencies...

pushd frontend
if errorlevel 1 goto failure

call npm ci

if errorlevel 1 (
    popd
    echo ERROR: Frontend dependency installation failed.
    echo Ensure all Sentinel AI frontend processes are stopped.
    goto failure
)

echo Building frontend application...

call npm run build

if errorlevel 1 (
    popd
    echo ERROR: Frontend production build failed.
    goto failure
)

popd

echo Frontend dependencies installed.
echo Frontend production build completed.
echo.


pushd frontend

call npm ci

if errorlevel 1 (
    popd
    goto failure
)

echo Building frontend application...

call npm run build

if errorlevel 1 (
    popd
    goto failure
)

popd

echo Frontend build completed.
echo.

REM ==========================================
REM INITIALIZE DATABASE
REM ==========================================

echo [7/7] Initializing local database...

".venv\Scripts\python.exe" -c "from database.db import initialize_database; initialize_database(); print('Database initialized successfully.')"

if errorlevel 1 goto failure

echo.

REM ==========================================
REM INSTALLATION COMPLETE
REM ==========================================

echo ==========================================
echo       INSTALLATION COMPLETED
echo ==========================================
echo.
echo Sentinel AI dependencies are ready.
echo Existing saved investigations are preserved.
echo.
echo See README.md for startup instructions.
echo.

endlocal
exit /b 0

REM ==========================================
REM ERROR HANDLING
REM ==========================================

:failure

echo.
echo ==========================================
echo          INSTALLATION FAILED
echo ==========================================
echo.
echo Review the error messages above.
echo Resolve the issue and run setup.bat again.
echo.

endlocal
exit /b 1
