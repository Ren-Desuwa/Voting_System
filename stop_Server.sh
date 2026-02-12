#!/bin/bash
echo "====================================================="
echo "     SHUTTING DOWN SERVER..."
echo "====================================================="

# Stop containers
docker-compose down

echo ""
echo "System is offline."