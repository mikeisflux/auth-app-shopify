// VerificationLog.js - Barcode Scan Verification Log Model
// Location: /backend/models/VerificationLog.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VerificationLog = sequelize.define('VerificationLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Shopify Order ID'
  },
  lineItemId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Shopify Line Item ID'
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Product SKU'
  },
  scannedBarcode: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Barcode that was scanned'
  },
  scannedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'When the item was scanned'
  },
  verifiedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'User ID who scanned (if tracked)'
  },
  scannerId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Scanner device or station identifier'
  }
}, {
  tableName: 'verification_logs',
  timestamps: true,
  indexes: [
    {
      fields: ['orderId']
    },
    {
      fields: ['lineItemId']
    },
    {
      fields: ['scannedAt']
    }
  ]
});

module.exports = VerificationLog;