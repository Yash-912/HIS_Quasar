/**
 * Order Set Routes
 * API endpoints for emergency order sets management
 */

const express = require('express');
const router = express.Router();
const orderSetController = require('../controllers/orderSet.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

// All routes require authentication
router.use(authenticate);

// ===================
// Read Operations
// ===================

// Get all order sets (doctors, nurses, admins)
router.get(
    '/',
    authorize('doctor', 'nurse', 'admin'),
    orderSetController.getAllOrderSets
);

// Get order sets by type (e.g., /type/trauma)
router.get(
    '/type/:type',
    authorize('doctor', 'nurse', 'admin'),
    orderSetController.getOrderSetsByType
);

// Get applied order sets for an emergency
router.get(
    '/applied/emergency/:emergencyId',
    authorize('doctor', 'nurse', 'admin'),
    orderSetController.getAppliedOrderSets
);

// Get single applied order set by ID
router.get(
    '/applied/:id',
    authorize('doctor', 'nurse', 'admin'),
    orderSetController.getAppliedOrderSetById
);

// Get single order set by ID
router.get(
    '/:id',
    authorize('doctor', 'nurse', 'admin'),
    orderSetController.getOrderSetById
);

// ===================
// Apply Operations
// ===================

// Preview order set (safety checks without execution)
router.post(
    '/:id/preview',
    authorize('doctor', 'admin'),
    orderSetController.previewOrderSet
);

// Apply order set to patient
router.post(
    '/:id/apply',
    authorize('doctor', 'admin'),
    orderSetController.applyOrderSet
);

// ===================
// Admin Operations
// ===================

// Create new order set
router.post(
    '/',
    authorize('admin'),
    orderSetController.createOrderSet
);

// Update order set
router.put(
    '/:id',
    authorize('admin'),
    orderSetController.updateOrderSet
);

// Delete (deactivate) order set
router.delete(
    '/:id',
    authorize('admin'),
    orderSetController.deleteOrderSet
);

module.exports = router;

