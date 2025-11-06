// backend/models/Mapping.js - Enhanced but preserving existing functionality 
// Location: /backend/models/Mapping.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Mapping = sequelize.define('Mapping', {
  projectId: { 
    type: DataTypes.INTEGER, 
    references: { model: 'Projects', key: 'id' },
    allowNull: false
  },
  kickstarterName: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  skus: { 
    type: DataTypes.JSON, 
    allowNull: false, 
    defaultValue: [] 
  } // Array of SKUs to support multiple SKUs per product
}, {
  // Add hooks to ensure data integrity without breaking existing functionality
  hooks: {
    beforeValidate: (mapping) => {
      // Ensure skus is always an array
      if (!Array.isArray(mapping.skus)) {
        if (typeof mapping.skus === 'string') {
          mapping.skus = [mapping.skus];
        } else {
          mapping.skus = [];
        }
      }
      
      // Clean up SKUs - remove empty strings and trim whitespace
      mapping.skus = mapping.skus
        .filter(sku => sku && typeof sku === 'string')
        .map(sku => sku.trim())
        .filter(sku => sku.length > 0);
    }
  }
});

module.exports = Mapping;