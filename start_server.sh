#!/bin/bash

echo "====================================================="
echo "     STARTING ELECTION SERVER (Linux/Mac)"
echo "====================================================="

# 1. Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running or permission denied."
    echo "Try running this script with sudo: sudo ./start_server.sh"
    exit 1
fi

# 2. Start Containers
echo ""
echo "[1/5] Booting up database and web server..."
docker-compose up -d

# 3. Wait for Database
echo "[2/5] Waiting for database (5 seconds)..."
sleep 5

# 4. Generate Tailscale Status
echo "[3/5] Fetching Tailscale Connection Info..."
docker exec election-tailscale tailscale status --json > api/ts_status.json

# 5. Extract Local IP (IMPROVED DETECTION)
echo "[4/5] Analyzing Network..."

# Try Method A: hostname -I (common on Linux)
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

# Try Method B: ip route (backup for Linux)
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
fi

# Try Method C: ifconfig (backup for Mac/older Linux)
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | awk '{print $2}' | head -n 1)
fi

# If STILL empty, ask the user
if [ -z "$LOCAL_IP" ]; then
    echo "⚠️  Could not detect your IP address automatically."
    read -p "Please enter your LAN IP (e.g., 192.168.1.40): " USER_IP
    LOCAL_IP=$USER_IP
fi

# Save to file
echo "$LOCAL_IP" > local_ip.txt

# Extract Tailscale URL
TAILSCALE_URL=$(grep -o '"DNSName": "[^"]*' api/ts_status.json | grep -o '[^"]*$' | head -n 1 | sed 's/\.$//')
if [ -n "$TAILSCALE_URL" ]; then
    TAILSCALE_URL="https://$TAILSCALE_URL"
else
    TAILSCALE_URL="Unknown"
fi

# 6. Open Admin Panel
echo "[5/5] System Ready!"
# Try opening the browser (silently fail if no GUI)
if which xdg-open > /dev/null; then
    xdg-open "http://localhost:8080/admin.html" > /dev/null 2>&1
elif which open > /dev/null; then
    open "http://localhost:8080/admin.html" > /dev/null 2>&1
fi

# 7. Final Display
clear
echo "====================================================="
echo "               ELECTION SYSTEM ONLINE"
echo "====================================================="
echo ""
echo "   [ ADMIN DASHBOARD ]"
echo "   - Local Access:     http://localhost:8080/admin.html"
echo ""
echo "   [ VOTER ACCESS LINKS ]"
echo "   - For Lab Computers (LAN):   http://$LOCAL_IP:8080"
echo "   - For Remote Users (Web):    $TAILSCALE_URL"
echo ""
echo "====================================================="
echo "   Press Ctrl+C to stop the server logs (Server stays running)"
echo "====================================================="