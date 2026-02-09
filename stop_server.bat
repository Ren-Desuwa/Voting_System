@echo off
TITLE Stopping Election System
echo =====================================================
echo      SHUTTING DOWN SERVER...
echo =====================================================

docker-compose down

echo.
echo System is offline. You can close this window.
pause