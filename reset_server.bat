@echo off
TITLE Resetting Election System
echo =====================================================
echo      RESETTING SERVER...
echo =====================================================

:: 1. Stop Docker
docker-compose down -v

:: 2. DELETE LOCAL FOLDER (The Fix)
:: This forcefully removes the database folder so you start fresh
IF EXIST "mysql_sealed_data" (
    echo Deleting local database files...
    rmdir /s /q "mysql_sealed_data"
)

:: 3. Delete temp files
IF EXIST "local_ip.txt" del "local_ip.txt"
IF EXIST "api\ts_status.json" del "api\ts_status.json"

echo.
echo System is Cleared.
pause