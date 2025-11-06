// models/index.js - Updated with Fulfillment Models - FIXED SYNC
// Location: /backend/models/index.js

const sequelize = require('../config/database');
const Project = require('./Project');
const Backer = require('./Backer');
const Mapping = require('./Mapping');
const VerificationLog = require('./VerificationLog');
const User = require('./User');
const OrderAssignment = require('./OrderAssignment');

// Define relationships
Project.hasMany(Backer, { foreignKey: 'projectId' });
Backer.belongsTo(Project, { foreignKey: 'projectId' });

Project.hasMany(Mapping, { foreignKey: 'projectId' });
Mapping.belongsTo(Project, { foreignKey: 'projectId' });

// Fulfillment relationships
User.hasMany(OrderAssignment, { foreignKey: 'assignedToUserId' });
OrderAssignment.belongsTo(User, { foreignKey: 'assignedToUserId', as: 'assignedUser' });

// Sync database function
async function syncDatabase() {
  try {
    console.log('🔄 Syncing database models...');
    
    // Keep existing Kickstarter tables untouched
    await Project.sync({ alter: false });
    await Backer.sync({ alter: false });
    await Mapping.sync({ alter: false });
    
    // Create new fulfillment tables (force recreate if exists)
    await User.sync({ force: true });
    await VerificationLog.sync({ force: true });
    await OrderAssignment.sync({ force: true });
    
    console.log('✅ All models synchronized successfully');
    
    // Seed employee stations
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('🌱 Seeding employee stations...');
      await User.bulkCreate([
        { username: 'station1', displayName: 'Station 1', role: 'employee', stationNumber: 1, isActive: true },
        { username: 'station2', displayName: 'Station 2', role: 'employee', stationNumber: 2, isActive: true },
        { username: 'station3', displayName: 'Station 3', role: 'employee', stationNumber: 3, isActive: true }
      ]);
      console.log('✅ Created 3 employee stations');
    }
  } catch (error) {
    console.error('❌ Database sync failed:', error);
    throw error;
  }
}

module.exports = {
  sequelize,
  Project,
  Backer,
  Mapping,
  VerificationLog,
  User,
  OrderAssignment,
  syncDatabase
};