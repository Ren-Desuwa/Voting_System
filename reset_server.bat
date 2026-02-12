@echo off
TITLE Resetting Election System
echo =====================================================
echo      RESETTING SERVER (FACTORY WIPE)
echo =====================================================
echo.
echo WARNING: This will delete ALL votes and database history.
echo.

:: 1. Stop Docker and remove containers
docker-compose down

:: 2. FORCE DELETE the local database folder (The Fix)
:: This is required because 'down -v' does not delete local folders
IF EXIST "mysql_sealed_data" (
    echo Deleting database files...
    rmdir /s /q "mysql_sealed_data"
)

:: 3. Delete temp files
IF EXIST "local_ip.txt" del "local_ip.txt"
IF EXIST "api\ts_status.json" del "api\ts_status.json"

echo.
echo =====================================================
echo      SYSTEM CLEARED
echo =====================================================
pause