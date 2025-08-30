@echo off
:menu
cls
echo ==========================================
echo Nursing System - Production Management
echo ==========================================
echo.
echo 1. Start Server
echo 2. Stop Server
echo 3. Restart Server
echo 4. Check Server Status
echo 5. View Logs (Last 20 lines)
echo 6. Monitor Logs (Real-time)
echo 7. Advanced Monitor
echo 8. Exit
echo.
set /p choice="Select option (1-8): "

if "%choice%"=="1" goto start_server
if "%choice%"=="2" goto stop_server
if "%choice%"=="3" goto restart_server
if "%choice%"=="4" goto check_status
if "%choice%"=="5" goto view_logs
if "%choice%"=="6" goto monitor_logs
if "%choice%"=="7" goto advanced_monitor
if "%choice%"=="8" goto exit

echo Invalid option, please try again...
pause
goto menu

:start_server
echo Starting server...
cd production-build
call start-production.bat
cd ..
goto menu

:stop_server
echo Stopping server...
cd production-build
call stop-production.bat
cd ..
pause
goto menu

:restart_server
echo Restarting server...
cd production-build
call restart-production.bat
cd ..
goto menu

:check_status
echo Checking server status...
curl -s http://localhost:5009/api/health
echo.
echo.
pause
goto menu

:view_logs
echo Last 20 lines of production log:
echo ================================
if exist "logs\production.log" (
    powershell -Command "Get-Content 'logs\production.log' -Tail 20"
) else (
    echo Log file not found
)
echo.
pause
goto menu

:monitor_logs
echo Starting real-time log monitor...
echo Press Ctrl+C to return to menu
cd production-build
call ..\scripts\monitor-logs.bat
cd ..
goto menu

:advanced_monitor
echo Starting advanced monitor...
echo Press Ctrl+C to return to menu
node monitor-system.js
goto menu

:exit
echo Goodbye!
exit 