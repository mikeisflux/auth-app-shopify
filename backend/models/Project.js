// Project Model - Fixed to use VARCHAR instead of ENUM
// Location: /backend/models/

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Project = sequelize.define('Project', {
  name: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  status: { 
    type: DataTypes.STRING,  // Changed from ENUM to STRING
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'archived']]  // Validate values without using ENUM
    }
  },
  csvFile: { 
    type: DataTypes.STRING,
    allowNull: true
  },
  csvFilePath: { 
    type: DataTypes.STRING,
    allowNull: true
  }
});

module.exports = Project;