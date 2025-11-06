const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Project = sequelize.define('Project', {
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('active', 'archived'), defaultValue: 'active' },
  csvFile: { type: DataTypes.STRING },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = Project;