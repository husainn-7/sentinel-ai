
@echo off
setlocal EnableExtensions

cd /d "%~dp0.."

title Sentinel AI - Startup

echo ==========================================
echo           SENTINEL AI STARTUP
echo ==========================================
echo.

REM ==========================================
REM VERIFY INSTALLATION
REM ==========================================

echo [1/5] Checking installation...

if not exist ".venv\Scripts\python.exe" (
    echo ERROR: Python virtual environment not found.
    echo Run scripts\setup.bat first.
    goto failure
)

if not exist "frontend\node_modules" (
    echo ERROR: Frontend dependencies not found.
    echo Run scripts\setup.bat first.
    goto failure
)

if not exist "frontend\dist\index.html" (
    echo ERROR: Production frontend build not found.
    echo Run scripts\setup.bat first.
    goto failure
)

if not exist "models\isolation_forest_final.joblib" (
    echo ERROR: Machine learning model not found.
    goto failure
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not available.
    goto failure
)

where ollama >nul 2>&1
if errorlevel 1 (
    echo ERROR: Ollama is not available.
    goto failure
)

echo Installation verified.
echo.

REM ==========================================
REM CHECK LOCAL AI SERVICE
REM ==========================================

echo [2/5] Checking Ollama service...

ollama list >nul 2>&1

if errorlevel 1 (
    echo ERROR: Ollama service is not running.
    echo Start Ollama and run this script again.
    goto failure
)

ollama show llama3.2:latest >nul 2>&1

if errorlevel 1 (
    echo ERROR: Configured language model not found.
    echo Run scripts\setup.bat first.
    goto failure
)

echo Ollama service available.
echo Language model detected.
echo.

REM ==========================================
REM CHECK PORT AVAILABILITY
REM ==========================================

echo [3/5] Checking local service ports...

".venv\Scripts\python.exe" -c "import socket,sys; sockets=[]; exec('try:\n for port in (8000,4173):\n  s=socket.socket()\n  sockets.append(s)\n  s.bind((\"127.0.0.1\",port))\nexcept OSError:\n print(\"ERROR: Required port unavailable:\",port)\n sys.exit(1)\nfinally:\n for s in sockets:\n  s.close()')"

if errorlevel 1 (
    echo Stop existing Sentinel AI servers and try again.
    goto failure
)

echo Required ports available.
echo.

REM ==========================================
REM START BACKEND
REM ==========================================

echo [4/5] Starting Sentinel AI backend...

start "Sentinel AI - Backend" /D "%CD%" cmd /k .venv\Scripts\python.exe -m uvicorn backend.api:app --host 127.0.0.1 --port 8000

echo Checking backend readiness...

".venv\Scripts\python.exe" -c "import time,urllib.request,sys; exec('for attempt in range(30):\n try:\n  with urllib.request.urlopen(\"http://127.0.0.1:8000/health\",timeout=1) as response:\n   if response.status==200:\n    print(\"Backend ready.\")\n    sys.exit(0)\n except Exception:\n  pass\n time.sleep(1)\nprint(\"ERROR: Backend did not become ready.\")\nsys.exit(1)')"

if errorlevel 1 goto failure

echo.

REM ==========================================
REM START FRONTEND
REM ==========================================

echo [5/5] Starting Sentinel AI frontend...

start "Sentinel AI - Frontend" /D "%CD%\frontend" cmd /k npm run preview -- --host 127.0.0.1 --port 4173 --strictPort

echo Checking frontend readiness...

".venv\Scripts\python.exe" -c "import time,urllib.request,sys; exec('for attempt in range(30):\n try:\n  with urllib.request.urlopen(\"http://127.0.0.1:4173\",timeout=1) as response:\n   if response.status==200:\n    print(\"Frontend ready.\")\n    sys.exit(0)\n except Exception:\n  pass\n time.sleep(1)\nprint(\"ERROR: Frontend did not become ready.\")\nsys.exit(1)')"

if errorlevel 1 goto failure

REM ==========================================
REM OPEN APPLICATION
REM ==========================================

start "" "http://127.0.0.1:4173"

echo.
echo ==========================================
echo         SENTINEL AI IS RUNNING
echo ==========================================
echo.
echo Dashboard: http://127.0.0.1:4173
echo Backend:   http://127.0.0.1:8000
echo API Docs:  http://127.0.0.1:8000/docs
echo.
echo Keep the backend and frontend windows open.
echo To stop Sentinel AI, press Ctrl+C in both
echo service windows.
echo.

endlocal
exit /b 0

REM ==========================================
REM ERROR HANDLING
REM ==========================================

:failure

echo.
echo ==========================================
echo              STARTUP FAILED
echo ==========================================
echo.
echo Review the error messages above.
echo If any service windows were opened,
echo stop those services before trying again.
echo.

endlocal
exit /b 1
