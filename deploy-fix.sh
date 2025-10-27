#!/bin/bash

echo "=== Deploying Webhook Fix to Production ==="
echo ""

# Navigate to production directory
cd /home/ec2-user/verify-my-collectible || exit 1

echo "1. Fetching latest changes..."
git fetch origin

echo ""
echo "2. Checking out branch..."
git checkout claude/resolve-react-errors-011CUV9T3ER6nCA2JbCaRoCP

echo ""
echo "3. Pulling latest changes..."
git pull origin claude/resolve-react-errors-011CUV9T3ER6nCA2JbCaRoCP

echo ""
echo "4. Checking syntax..."
node --check server.js
if [ $? -ne 0 ]; then
    echo "ERROR: Syntax check failed!"
    exit 1
fi

echo ""
echo "5. Restarting application..."
pm2 restart verify-my-collectible

echo ""
echo "6. Checking PM2 status..."
pm2 status

echo ""
echo "7. Checking recent logs..."
sleep 2
pm2 logs verify-my-collectible --lines 20 --nostream

echo ""
echo "=== Deployment Complete ==="
