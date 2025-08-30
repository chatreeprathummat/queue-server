@echo off
chcp 65001 >nul
title PM2 Management Commands

:menu
cls
echo ===================================
echo     PM2 Nursing System Manager
echo ===================================
echo.
echo QUICK ACTIONS:
echo 1. Stop Production Server
echo 2. Stop Development Server  
echo 3. Stop All Servers
echo.
echo DEVELOPMENT:
echo 4. Start Dev Server
echo 5. Restart Dev Server
echo 6. View Dev Logs
echo.
echo PRODUCTION:
echo 7. Start Production Server
echo 8. Restart Production Server
echo 9. View Production Logs
echo.
echo MONITORING:
echo 10. View All Processes
echo 11. Real-time Logs (All)
echo 12. System Monitor
echo 13. Health Check
echo.
echo MANAGEMENT:
echo 14. Start All Servers
echo 15. Restart All Servers
echo 16. Delete All Processes
echo 17. Setup Auto-startup
echo 18. Zero-Downtime Reload
echo.
echo 0. Exit
echo.
set /p choice=Select option (0-18): 

if "%choice%"=="0" goto :end
if "%choice%"=="1" goto :stop_prod
if "%choice%"=="2" goto :stop_dev
if "%choice%"=="3" goto :stop_all
if "%choice%"=="4" goto :start_dev
if "%choice%"=="5" goto :restart_dev
if "%choice%"=="6" goto :logs_dev
if "%choice%"=="7" goto :start_prod
if "%choice%"=="8" goto :restart_prod
if "%choice%"=="9" goto :logs_prod
if "%choice%"=="10" goto :list
if "%choice%"=="11" goto :logs_all
if "%choice%"=="12" goto :monitor
if "%choice%"=="13" goto :health
if "%choice%"=="14" goto :start_all
if "%choice%"=="15" goto :restart_all
if "%choice%"=="16" goto :delete_all
if "%choice%"=="17" goto :startup
if "%choice%"=="18" goto :reload
goto :invalid

:stop_prod
echo Stopping Production Server...
pm2 stop nursing-system-prod
pause
goto :menu

:stop_dev  
echo Stopping Development Server...
pm2 stop nursing-system-dev
pause
goto :menu

:stop_all
echo Stopping All Servers...
pm2 stop all
pause
goto :menu

:start_prod
echo Starting Production Server with PM2...
pm2 start ecosystem.config.js --only nursing-system-prod
echo.
echo Production server started!
pause
goto menu

:start_dev
echo Starting Development Server with PM2...
pm2 start ecosystem.config.js --only nursing-system-dev
echo.
echo Development server started!
pause
goto menu

:restart_prod
echo Restarting Production Server...
pm2 restart nursing-system-prod
echo.
echo Production server restarted!
pause
goto menu

:restart_dev
echo Restarting Development Server...
pm2 restart nursing-system-dev
echo.
echo Development server restarted!
pause
goto menu

:logs_dev
echo Real-time logs (Press Ctrl+C to return):
echo =======================================
pm2 logs nursing-system-dev --lines 50
goto menu

:logs_prod
echo Real-time logs (Press Ctrl+C to return):
echo =======================================
pm2 logs nursing-system-prod --lines 50
goto menu

:list
echo Current PM2 Status:
echo ==================
pm2 list
echo.
echo Detailed info:
pm2 info nursing-system-prod
echo.
pause
goto menu

:monitor
echo Real-time monitoring (Press Ctrl+C to return):
echo =============================================
pm2 monit
goto menu

:health
echo Health Check:
echo =============
pm2 health
goto menu

:start_all
echo Starting all servers...
pm2 start all
echo.
echo All servers started!
pause
goto menu

:restart_all
echo Restarting all servers...
pm2 restart all
echo.
echo All servers restarted!
pause
goto menu

:delete_all
echo Deleting all processes...
pm2 delete all
echo.
echo All processes deleted!
pause
goto menu

:reload
echo Zero Downtime Reload Production Server...
pm2 reload nursing-system-prod
echo.
echo Production server reloaded without downtime!
pause
goto menu

:startup
echo Setting up PM2 auto startup...
pm2 startup
echo.
echo Follow the instructions above to complete setup
echo Then save current PM2 configuration:
pm2 save
echo.
pause
goto menu

:end
echo Goodbye!
exit 