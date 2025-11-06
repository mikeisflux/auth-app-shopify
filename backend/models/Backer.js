// Location /backend/models/Backer.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Backer = sequelize.define('Backer', {
  projectId: { 
    type: DataTypes.INTEGER, 
    references: { model: 'Projects', key: 'id' } 
  },
  
  // Backer identification
  backerNumber: { type: DataTypes.STRING },
  backerUID: { type: DataTypes.STRING }, // Some CSVs have this
  name: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  
  // Main reward
  reward: { 
    type: DataTypes.JSON 
    // Structure: { name: "Reward Title", sku: "P1-BASE", quantity: 1 }
  },
  
  // Additional products/add-ons
  addOns: { 
    type: DataTypes.JSON 
    // Structure: [{ name: "Add-on 1", sku: "P1-21F-Y", quantity: 2 }]
  },
  
  // Clean products structure (NEW)
  products: {
    type: DataTypes.JSON
    // Structure: { "P1-21F-Y": { name: "Product Name", quantity: 2 } }
  },
  
  // For backward compatibility with existing code
  skuColumns: { 
    type: DataTypes.JSON 
    // Stores the same as products for now
  },
  
  // Financial
  pledgeAmount: { type: DataTypes.FLOAT },
  
  // Notes
  notes: { type: DataTypes.TEXT },
  
  // Shipping fields (all variants we've used)
  shippingName: { type: DataTypes.STRING },
  shippingAddress: { type: DataTypes.STRING }, // Some versions use this
  shippingAddress1: { type: DataTypes.STRING }, // More common
  shippingAddress2: { type: DataTypes.STRING },
  shippingCity: { type: DataTypes.STRING },
  shippingState: { type: DataTypes.STRING },
  shippingPostal: { type: DataTypes.STRING }, // Alternative name
  shippingPostalCode: { type: DataTypes.STRING }, // More common
  shippingZip: { type: DataTypes.STRING }, // Another alternative
  shippingCountry: { type: DataTypes.STRING },
  shippingPhone: { type: DataTypes.STRING },
  shippingNotes: { type: DataTypes.TEXT },
  
  // Import tracking fields
  imported: { type: DataTypes.BOOLEAN, defaultValue: false },
  importedAt: { type: DataTypes.DATE, allowNull: true },
  importAttemptedAt: { type: DataTypes.DATE, allowNull: true },
  importError: { type: DataTypes.TEXT, allowNull: true },
  
  // Shopify fields
  shopifyOrderId: { type: DataTypes.STRING, allowNull: true },
  shopifyOrderNumber: { type: DataTypes.STRING, allowNull: true },
  
  // Marketing
  acceptsMarketing: { type: DataTypes.BOOLEAN, defaultValue: false }
});

module.exports = Backer;