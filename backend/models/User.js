// User.js - Employee/Station User Model for Multi-User Fulfillment - FIXED
// Location: /backend/models/User.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    comment: 'Station username (e.g., station1, station2)'
  },
  displayName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Display name for UI'
  },
  role: {
    type: DataTypes.ENUM('admin', 'employee'),
    defaultValue: 'employee',
    comment: 'User role'
  },
  stationNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Physical station number'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether station is active'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last login timestamp'
  }
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['username']
    }
  ]
});

module.exports = User;