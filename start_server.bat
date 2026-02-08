@echo off
TITLE Election System Manager
echo =====================================================
echo      STARTING ELECTION SERVER (Please Wait...)
echo =====================================================

:: 1. Check if Docker is running
docker info >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker Desktop is not running!
    echo Please open "Docker Desktop" first and try again.
    pause
    exit
)

:: 2. Start the containers
echo.
echo [1/3] Booting up database and web server...
docker-compose up -d

:: 3. Wait for database to initialize (Prevent "Connection Refused")
echo [2/3] Waiting for database to initialize (15 seconds)...
timeout /t 15 /nobreak >nul

:: 4. Open the Admin Panel automatically
echo [3/3] System Ready! Opening Admin Panel...
start http://localhost:8080/admin.html

echo.
echo =====================================================
echo    SYSTEM IS ONLINE. DO NOT CLOSE THIS WINDOW.
echo    Minimize it to keep the server running.
echo =====================================================
pause