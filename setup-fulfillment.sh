#!/bin/bash
# setup-fulfillment.sh - Setup Multi-User Fulfillment System
# Location: /setup-fulfillment.sh

echo "🚀 Setting up Multi-User Fulfillment System..."
echo ""

# Check if running from project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Step 1: Database Migration
echo "📊 Step 1: Syncing database models..."
cd backend
node -e "require('./models').syncDatabase().then(() => { console.log('✅ Database synced'); process.exit(0); }).catch(err => { console.error('❌ Error:', err); process.exit(1); })"

if [ $? -ne 0 ]; then
    echo "❌ Database sync failed"
    exit 1
fi

cd ..

# Step 2: Verify Employee Stations
echo ""
echo "👥 Step 2: Verifying employee stations..."
cd backend
node -e "
const { User } = require('./models');
User.findAll({ where: { role: 'employee' } })
  .then(employees => {
    console.log(\`✅ Found \${employees.length} employee stations:\`);
    employees.forEach(emp => {
      console.log(\`   - Station \${emp.stationNumber}: \${emp.displayName} (ID: \${emp.id})\`);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
"

if [ $? -ne 0 ]; then
    echo "❌ Employee verification failed"
    exit 1
fi

cd ..

# Step 3: Check routes registration
echo ""
echo "🛣️  Step 3: Checking routes..."
if [ -f "backend/routes/admin.js" ] && [ -f "backend/routes/employee.js" ]; then
    echo "✅ Admin routes found"
    echo "✅ Employee routes found"
else
    echo "❌ Route files missing"
    exit 1
fi

# Step 4: Verify models
echo ""
echo "📦 Step 4: Verifying models..."
if [ -f "backend/models/User.js" ] && [ -f "backend/models/OrderAssignment.js" ]; then
    echo "✅ User model found"
    echo "✅ OrderAssignment model found"
else
    echo "❌ Model files missing"
    exit 1
fi

# Step 5: Check frontend components
echo ""
echo "🎨 Step 5: Checking frontend components..."
COMPONENTS=(
    "AdminDashboard.js"
    "EmployeeStation.js"
    "PullList.js"
    "OrderScanningPage.js"
)

for component in "${COMPONENTS[@]}"; do
    if [ -f "frontend/src/components/$component" ]; then
        echo "✅ $component found"
    else
        echo "⚠️  $component not found - needs to be created"
    fi
done

# Summary
echo ""
echo "═══════════════════════════════════════════════"
echo "✅ Fulfillment System Setup Complete!"
echo "═══════════════════════════════════════════════"
echo ""
echo "🌐 Access URLs:"
echo ""
echo "  Main Dashboard:"
echo "    http://localhost:3000/dashboard"
echo ""
echo "  Admin Dashboard:"
echo "    http://localhost:3000/fulfillment/admin"
echo ""
echo "  Employee Stations:"
echo "    Station 1: http://localhost:3000/employee/1"
echo "    Station 2: http://localhost:3000/employee/2"
echo "    Station 3: http://localhost:3000/employee/3"
echo ""
echo "═══════════════════════════════════════════════"
echo ""
echo "📚 Next Steps:"
echo ""
echo "  1. Start the server:"
echo "     npm start"
echo ""
echo "  2. Navigate to admin dashboard to assign orders"
echo ""
echo "  3. Each employee accesses their station URL"
echo ""
echo "  4. Review FULFILLMENT_SYSTEM.md for full documentation"
echo ""
echo "═══════════════════════════════════════════════"
echo ""
echo "🎉 Happy Fulfilling!"