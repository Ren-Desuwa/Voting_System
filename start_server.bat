@echo off
TITLE Election System Manager
setlocal EnableDelayedExpansion

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
echo [1/5] Booting up database and web server...
docker-compose up -d

:: 3. Wait for database to initialize
echo [2/5] Waiting for database to initialize (10 seconds)...
timeout /t 10 /nobreak >nul

:: 4. Generate Tailscale Status File (For Remote Link)
echo [3/5] Fetching Tailscale Connection Info...
docker exec election-tailscale tailscale status --json > api/ts_status.json

:: 5. EXTRACT LOCAL IP (The Missing Link)
echo [4/5] Analyzing Network...

:: --- SMART IP DETECTION (Replaces the brittle 'tokens=14' method) ---
:: This asks PowerShell for the first real IPv4 address (Wi-Fi or Ethernet)
SET LOCAL_IP=Unknown
FOR /F "usebackq tokens=*" %%a IN (`powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-Fi|Ethernet' -and $_.PrefixOrigin -neq 'Manual' } | Select-Object -ExpandProperty IPAddress | Select-Object -First 1"`) DO (
    SET LOCAL_IP=%%a
)

:: --- SAVE IP TO FILE ---
:: The single '>' symbol means "Overwrite". It creates a fresh file every time.
echo %LOCAL_IP% > local_ip.txt
:: --- Get Tailscale URL ---
SET TAILSCALE_URL=Unknown
FOR /F "usebackq tokens=*" %%A IN (`powershell -NoProfile -Command "$json = Get-Content 'api/ts_status.json' -Raw | ConvertFrom-Json; $dns = $json.Self.DNSName.TrimEnd('.'); Write-Output $dns"`) DO (
    SET TAILSCALE_URL=https://%%A
)

:: 6. Open the Admin Panel
echo [5/5] System Ready!
echo Opening Admin Panel...
start http://localhost:8080/admin.html

:: 7. FINAL DISPLAY
CLS
echo =====================================================
echo                ELECTION SYSTEM ONLINE
echo =====================================================
echo.
echo    [ ADMIN DASHBOARD ]
echo    - Local Access:     http://localhost:8080/admin.html
echo.
echo    [ VOTER ACCESS LINKS ]
echo    - For Lab Computers (LAN):   http://%LOCAL_IP%:8080
echo    - For Remote Users (Web):    %TAILSCALE_URL%
echo.
echo =====================================================
echo    DO NOT CLOSE THIS WINDOW.
echo    Minimize it to keep the server running.
echo =====================================================

pause