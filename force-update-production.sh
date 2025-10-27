#!/bin/bash

echo "=== Force Updating Production Server ==="
echo ""

cd /home/ec2-user/verify-my-collectible || exit 1

echo "1. Stopping PM2 process..."
pm2 stop verify-my-collectible

echo ""
echo "2. Backing up current server.js..."
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)

echo ""
echo "3. Stashing any local changes..."
git stash

echo ""
echo "4. Fetching latest from origin..."
git fetch origin

echo ""
echo "5. Hard reset to remote branch..."
git checkout claude/resolve-react-errors-011CUV9T3ER6nCA2JbCaRoCP
git reset --hard origin/claude/resolve-react-errors-011CUV9T3ER6nCA2JbCaRoCP

echo ""
echo "6. Verifying server.js has the fix..."
echo "Line 72 should contain 'express.text':"
sed -n '72p' server.js

echo ""
echo "7. Checking syntax..."
node --check server.js
if [ $? -ne 0 ]; then
    echo "ERROR: Syntax check failed! Restoring backup..."
    cp server.js.backup.* server.js
    exit 1
fi

echo ""
echo "8. Starting PM2 process..."
pm2 start verify-my-collectible

echo ""
echo "9. Checking status..."
sleep 3
pm2 status

echo ""
echo "10. Checking logs for errors..."
pm2 logs verify-my-collectible --lines 30 --nostream

echo ""
echo "=== Update Complete ==="
