@echo off
echo.
echo  Building frontend for production...
echo.
cd /d "%~dp0frontend"
call npm install
call npm run build
echo.
echo  Done! Frontend built to frontend\dist\
echo  Now run start_server.bat to serve everything.
echo.
pause
