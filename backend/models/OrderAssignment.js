// OrderAssignment.js - Order Assignment Model for Multi-User Fulfillment
// Location: /backend/models/OrderAssignment.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderAssignment = sequelize.define('OrderAssignment', {
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
  assignedToUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User/Employee this order is assigned to'
  },
  status: {
    type: DataTypes.ENUM('assigned', 'picking', 'scanning', 'packing', 'completed', 'cancelled'),
    defaultValue: 'assigned',
    comment: 'Current status of the order fulfillment'
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Priority level (higher = more urgent)'
  },
  assignedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'When the order was assigned'
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When employee started working on it'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the order was completed'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Admin or employee notes'
  },
  // Cached order details for quick display
  orderName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Shopify order name (e.g., #1001)'
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Customer email'
  },
  totalItems: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Total number of items in order'
  },
  orderTotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Order total amount'
  }
}, {
  tableName: 'order_assignments',
  timestamps: true,
  indexes: [
    {
      fields: ['orderId']
    },
    {
      fields: ['assignedToUserId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['assignedAt']
    }
  ]
});

module.exports = OrderAssignment;