// admin.js - Admin Routes for Order Assignment
// Location: /backend/routes/admin.js

const express = require('express');
const router = express.Router();
const { User, OrderAssignment } = require('../models');
require('dotenv').config();

// Middleware to validate session - FOR CUSTOM APP
const validateSession = async (req, res, next) => {
  req.shopifySession = {
    shop: process.env.SHOPIFY_STORE_URL,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN
  };
  next();
};

// Get all employees/stations
router.get('/employees', validateSession, async (req, res) => {
  try {
    const employees = await User.findAll({
      where: { role: 'employee', isActive: true },
      order: [['stationNumber', 'ASC']]
    });
    
    res.json({
      success: true,
      employees: employees
    });
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch employees: ${error.message}`
    });
  }
});

// Get all order assignments
router.get('/assignments', validateSession, async (req, res) => {
  try {
    const assignments = await OrderAssignment.findAll({
      include: [{
        model: User,
        as: 'assignedUser',
        attributes: ['id', 'displayName', 'stationNumber']
      }],
      order: [['assignedAt', 'DESC']]
    });
    
    res.json({
      success: true,
      assignments: assignments
    });
  } catch (error) {
    console.error('Failed to fetch assignments:', error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch assignments: ${error.message}`
    });
  }
});

// Assign orders to an employee
router.post('/assign-orders', validateSession, async (req, res) => {
  const { orderIds, userId, priority, notes } = req.body;
  
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'orderIds array is required'
    });
  }
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required'
    });
  }
  
  try {
    const { fetchReadyToShipOrders } = require('../services/shopifyFulfillment');
    
    // Verify employee exists
    const employee = await User.findByPk(userId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }
    
    // Fetch orders from Shopify
    const allOrders = await fetchReadyToShipOrders();
    
    const assignments = [];
    let assigned = 0;
    let failed = 0;
    const errors = [];
    
    for (const orderId of orderIds) {
      try {
        // Find the order in the fetched list
        const order = allOrders.find(o => o.id.toString() === orderId.toString());
        
        if (!order) {
          errors.push({ orderId, error: 'Order not found or not ready to ship' });
          failed++;
          continue;
        }
        
        // Check if already assigned
        const existing = await OrderAssignment.findOne({
          where: { 
            orderId: orderId.toString(),
            status: ['assigned', 'picking', 'scanning', 'packing']
          }
        });
        
        if (existing) {
          errors.push({ orderId, error: 'Order already assigned' });
          failed++;
          continue;
        }
        
        // Create assignment
        const totalItems = order.line_items.reduce((sum, item) => sum + item.quantity, 0);
        
        const assignment = await OrderAssignment.create({
          orderId: orderId.toString(),
          assignedToUserId: userId,
          status: 'assigned',
          priority: priority || 0,
          notes: notes || null,
          orderName: order.name,
          customerEmail: order.customer?.email || null,
          totalItems: totalItems,
          orderTotal: parseFloat(order.total_price || 0)
        });
        
        assignments.push(assignment);
        assigned++;
        
        console.log(`✓ Assigned order ${order.name} to ${employee.displayName}`);
        
      } catch (err) {
        console.error(`Failed to assign order ${orderId}:`, err);
        errors.push({ orderId, error: err.message });
        failed++;
      }
    }
    
    res.json({
      success: true,
      assigned: assigned,
      failed: failed,
      errors: errors,
      assignments: assignments
    });
    
  } catch (error) {
    console.error('Failed to assign orders:', error);
    res.status(500).json({
      success: false,
      error: `Failed to assign orders: ${error.message}`
    });
  }
});

// Unassign an order
router.post('/unassign-order/:assignmentId', validateSession, async (req, res) => {
  try {
    const assignment = await OrderAssignment.findByPk(req.params.assignmentId);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }
    
    await assignment.destroy();
    
    console.log(`Unassigned order ${assignment.orderName}`);
    
    res.json({
      success: true,
      message: 'Order unassigned successfully'
    });
    
  } catch (error) {
    console.error('Failed to unassign order:', error);
    res.status(500).json({
      success: false,
      error: `Failed to unassign order: ${error.message}`
    });
  }
});

// Update assignment priority
router.put('/assignments/:assignmentId/priority', validateSession, async (req, res) => {
  const { priority } = req.body;
  
  try {
    const assignment = await OrderAssignment.findByPk(req.params.assignmentId);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }
    
    await assignment.update({ priority: priority || 0 });
    
    res.json({
      success: true,
      assignment: assignment
    });
    
  } catch (error) {
    console.error('Failed to update priority:', error);
    res.status(500).json({
      success: false,
      error: `Failed to update priority: ${error.message}`
    });
  }
});

module.exports = router;