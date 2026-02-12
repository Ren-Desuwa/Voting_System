#!/bin/bash
echo "====================================================="
echo "     RESETTING SERVER (FACTORY WIPE)"
echo "====================================================="

# 1. Stop containers
docker-compose down

# 2. DELETE LOCAL FOLDER (The Fix)
# We use sudo because the files were created by the database (root user)
if [ -d "mysql_sealed_data" ]; then
    echo "Deleting local database files..."
    sudo rm -rf mysql_sealed_data
fi

# 3. Clean up temp files
rm -f local_ip.txt api/ts_status.json

echo ""
echo "System is Cleared."