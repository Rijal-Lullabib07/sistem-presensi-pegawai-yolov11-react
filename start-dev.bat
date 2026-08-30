@echo off
setlocal

REM Always resolve paths relative to this script, not the current CMD folder.
set "ROOT_DIR=%~dp0"
set "SERVER_DIR=%ROOT_DIR%server"
set "VENV_DIR=%SERVER_DIR%\venv"
set "PYTHON=%VENV_DIR%\Scripts\python.exe"
set "PYTHONUTF8=1"

echo ============================================================
echo   Sistem Presensi Pegawai - Development Mode
echo ============================================================
echo.

if exist "%PYTHON%" goto :check_dependencies

echo Virtualenv belum ditemukan. Membuat virtualenv baru...
where python >nul 2>&1
if errorlevel 1 goto :python_missing
python -m venv "%VENV_DIR%"
if errorlevel 1 goto :venv_failed

:check_dependencies
"%PYTHON%" -c "import cv2, flask, flask_cors, numpy, os; assert os.path.isfile(os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml'))" >nul 2>&1
if not errorlevel 1 goto :start_servers

echo Menginstall dependency backend (pertama kali saja)...
"%PYTHON%" -m pip install -r "%SERVER_DIR%\requirements.txt"
if errorlevel 1 goto :install_failed
"%PYTHON%" -c "import cv2, flask, flask_cors, numpy, os; assert os.path.isfile(os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml'))" >nul 2>&1
if errorlevel 1 goto :dependencies_failed
goto :start_servers

:start_servers

echo Backend  : http://localhost:5000
echo Frontend : http://localhost:5173
echo.

start "Flask Backend" cmd /k ""%PYTHON%" "%SERVER_DIR%\app.py""

timeout /t 3 /nobreak >nul
start "React Frontend" /D "%ROOT_DIR%" cmd /k "npm run dev"

echo Backend dan frontend sudah dijalankan.
echo Tutup jendela Flask Backend dan React Frontend untuk menghentikannya.
exit /b 0

:python_missing
echo ERROR: Python tidak ditemukan di PATH.
echo Install Python 3.10+ lalu jalankan file ini lagi.
pause
exit /b 1

:venv_failed
echo ERROR: Gagal membuat virtualenv di "%VENV_DIR%".
pause
exit /b 1

:install_failed
echo ERROR: Gagal menginstall dependency backend.
pause
exit /b 1

:dependencies_failed
echo ERROR: Dependency terinstall tetapi cv2 masih tidak dapat diimpor.
echo Coba hapus folder "%VENV_DIR%" lalu jalankan script ini lagi.
pause
exit /b 1
