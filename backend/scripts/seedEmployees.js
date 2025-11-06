// seedEmployees.js - Initialize 3 Employee Stations
// Location: /backend/scripts/seedEmployees.js

const { User } = require('../models');

async function seedEmployees() {
  try {
    console.log('🌱 Seeding employee stations...');

    // Check if employees already exist
    const existingEmployees = await User.findAll({
      where: { role: 'employee' }
    });

    if (existingEmployees.length > 0) {
      console.log(`✓ Found ${existingEmployees.length} existing employees`);
      existingEmployees.forEach(emp => {
        console.log(`  - Station ${emp.stationNumber}: ${emp.displayName} (${emp.username})`);
      });
      return existingEmployees;
    }

    // Create 3 employee stations
    const employees = [
      {
        username: 'station1',
        displayName: 'Station 1',
        role: 'employee',
        stationNumber: 1,
        isActive: true
      },
      {
        username: 'station2',
        displayName: 'Station 2',
        role: 'employee',
        stationNumber: 2,
        isActive: true
      },
      {
        username: 'station3',
        displayName: 'Station 3',
        role: 'employee',
        stationNumber: 3,
        isActive: true
      }
    ];

    const createdEmployees = await User.bulkCreate(employees);

    console.log('✅ Successfully created 3 employee stations:');
    createdEmployees.forEach(emp => {
      console.log(`  - Station ${emp.stationNumber}: ${emp.displayName} (ID: ${emp.id})`);
    });

    return createdEmployees;

  } catch (error) {
    console.error('❌ Error seeding employees:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  const sequelize = require('../config/database');
  
  sequelize.authenticate()
    .then(() => {
      console.log('✅ Database connected');
      return seedEmployees();
    })
    .then(() => {
      console.log('✅ Seeding complete');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = seedEmployees;