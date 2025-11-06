// employee.js - Employee Station Routes
// Location: /backend/routes/employee.js

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

// Get employee assignments
router.get('/:userId/assignments', validateSession, async (req, res) => {
  try {
    const employee = await User.findByPk(req.params.userId);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }
    
    const assignments = await OrderAssignment.findAll({
      where: { 
        assignedToUserId: req.params.userId,
        status: ['assigned', 'picking', 'scanning', 'packing']
      },
      order: [
        ['priority', 'DESC'],
        ['assignedAt', 'ASC']
      ]
    });
    
    res.json({
      success: true,
      employee: employee,
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

// Get assignment details with order info
router.get('/:userId/assignments/:assignmentId/details', validateSession, async (req, res) => {
  try {
    const assignment = await OrderAssignment.findByPk(req.params.assignmentId);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }
    
    // Fetch order from Shopify
    const { getOrderForFulfillment } = require('../services/shopifyFulfillment');
    const order = await getOrderForFulfillment(assignment.orderId);
    
    // Get verification logs
    const { VerificationLog } = require('../models');
    const verifications = await VerificationLog.findAll({
      where: { orderId: assignment.orderId }
    });
    
    res.json({
      success: true,
      assignment: assignment,
      order: order,
      verifications: verifications
    });
    
  } catch (error) {
    console.error('Failed to fetch assignment details:', error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch assignment details: ${error.message}`
    });
  }
});

// Start working on an assignment (change status to picking)
router.post('/:userId/assignments/:assignmentId/start', validateSession, async (req, res) => {
  try {
    const assignment = await OrderAssignment.findByPk(req.params.assignmentId);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }
    
    await assignment.update({
      status: 'picking',
      startedAt: new Date()
    });
    
    res.json({
      success: true,
      assignment: assignment
    });
    
  } catch (error) {
    console.error('Failed to start assignment:', error);
    res.status(500).json({
      success: false,
      error: `Failed to start assignment: ${error.message}`
    });
  }
});

// Move to scanning status
router.post('/:userId/assignments/:assignmentId/move-to-scanning', validateSession, async (req, res) => {
  try {
    const assignment = await OrderAssignment.findByPk(req.params.assignmentId);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }
    
    await assignment.update({ status: 'scanning' });
    
    res.json({
      success: true,
      assignment: assignment
    });
    
  } catch (error) {
    console.error('Failed to move to scanning:', error);
    res.status(500).json({
      success: false,
      error: `Failed to move to scanning: ${error.message}`
    });
  }
});

// Move to packing status
router.post('/:userId/assignments/:assignmentId/move-to-packing', validateSession, async (req, res) => {
  try {
    const assignment = await OrderAssignment.findByPk(req.params.assignmentId);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }
    
    await assignment.update({ status: 'packing' });
    
    res.json({
      success: true,
      assignment: assignment
    });
    
  } catch (error) {
    console.error('Failed to move to packing:', error);
    res.status(500).json({
      success: false,
      error: `Failed to move to packing: ${error.message}`
    });
  }
});

// Complete an assignment
router.post('/:userId/assignments/:assignmentId/complete', validateSession, async (req, res) => {
  try {
    const assignment = await OrderAssignment.findByPk(req.params.assignmentId);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }
    
    await assignment.update({
      status: 'completed',
      completedAt: new Date()
    });
    
    console.log(`✓ Completed order ${assignment.orderName} by user ${req.params.userId}`);
    
    res.json({
      success: true,
      assignment: assignment
    });
    
  } catch (error) {
    console.error('Failed to complete assignment:', error);
    res.status(500).json({
      success: false,
      error: `Failed to complete assignment: ${error.message}`
    });
  }
});

module.exports = router;