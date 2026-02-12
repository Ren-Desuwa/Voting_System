#!/bin/bash
echo "====================================================="
echo "     RESETTING SERVER (FACTORY WIPE)"
echo "====================================================="
echo "⚠️  WARNING: This will delete ALL votes and database history."
echo "====================================================="

# 1. Stop containers and remove internal volumes
docker-compose down -v

# 2. FORCE DELETE the local database folder
# Since we switched to 'bind mounts', the previous command ignores this folder.
# We must delete it manually to truly reset the system.
if [ -d "mysql_sealed_data" ]; then
    echo "Deleting local database files..."
    # Try standard delete first, then sudo if permission denied
    rm -rf mysql_sealed_data 2>/dev/null || sudo rm -rf mysql_sealed_data
    echo "✓ Database cleared."
fi

# 3. Clean up temp files
rm -f local_ip.txt api/ts_status.json

echo ""
echo "System is Cleared. You can start fresh now."