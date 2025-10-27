#!/bin/bash

echo "=== Diagnosing Production Server Issue ==="
echo ""

cd /home/ec2-user/verify-my-collectible || exit 1

echo "1. Current git branch:"
git branch -v

echo ""
echo "2. Current git status:"
git status

echo ""
echo "3. Git remote branches:"
git branch -r | grep claude

echo ""
echo "4. Last 5 commits on current branch:"
git log --oneline -5

echo ""
echo "5. Checking line 70-75 of server.js (should have express.text):"
sed -n '70,75p' server.js

echo ""
echo "6. Checking line 170-175 of server.js (the error line):"
sed -n '170,175p' server.js

echo ""
echo "7. Git diff from origin:"
git fetch origin
git diff HEAD origin/claude/resolve-react-errors-011CUV9T3ER6nCA2JbCaRoCP --stat

echo ""
echo "=== Diagnosis Complete ==="
