@echo off
REM ============================================================
REM  Build SignWall.exe  (single-file Windows executable)
REM  Run this on a build machine that HAS Python + Node installed.
REM  The resulting exe needs NEITHER on the client PC.
REM ============================================================

setlocal
cd /d "%~dp0.."

echo.
echo [1/4] Installing/ensuring build tools (pyinstaller + backend deps)...
python -m pip install --upgrade pip
python -m pip install pyinstaller
python -m pip install -r backend\requirements.txt
if errorlevel 1 goto :error

echo.
echo [2/4] Building the frontend (npm run build)...
pushd frontend
call npm install
call npm run build
popd
if not exist "frontend\dist\index.html" (
    echo ERROR: frontend\dist\index.html not found - frontend build failed.
    goto :error
)

echo.
echo [3/4] Running PyInstaller...
python -m PyInstaller packaging\signwall.spec --noconfirm --distpath packaging\out --workpath packaging\build
if errorlevel 1 goto :error

echo.
echo [4/4] Copying deployment readme next to the exe...
copy /Y packaging\DEPLOY_README.txt packaging\out\DEPLOY_README.txt >nul

echo.
echo ============================================================
echo  DONE.  Deliverable is in:  packaging\out\
echo    - SignWall.exe
echo    - DEPLOY_README.txt
echo  Copy that folder to the client PC. Double-click SignWall.exe.
echo ============================================================
echo.
pause
exit /b 0

:error
echo.
echo BUILD FAILED. See messages above.
pause
exit /b 1
