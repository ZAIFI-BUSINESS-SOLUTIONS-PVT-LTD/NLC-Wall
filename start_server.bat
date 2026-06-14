@echo off
echo.
echo  ╔══════════════════════════════════════╗
echo  ║   Live Sign Wall — NLC Book Fair     ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0backend"

echo [1/2] Installing Python dependencies...
pip install -r requirements.txt --quiet

echo [2/2] Starting FastAPI server on port 8000...
echo.
echo  Input  : http://YOUR_IP:8000/
echo  Display: http://YOUR_IP:8000/display
echo.
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
