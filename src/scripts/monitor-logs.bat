@echo off
echo ======================================
echo Nursing System - Log Monitor
echo ======================================
echo.
echo Real-time log monitoring...
echo Press Ctrl+C to stop
echo.

REM Check if log file exists
if not exist "..\logs\production.log" (
    echo Log file not found: ..\logs\production.log
    echo Make sure server is running
    pause
    exit /b 1
)

REM Monitor log file (PowerShell method)
powershell -Command "Get-Content '..\logs\production.log' -Wait -Tail 10" 