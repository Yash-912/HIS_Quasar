const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergency.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

// Public test route removed

router.use(authenticate);

/**
 * @route   POST /api/emergency/cases
 * @desc    Register a new emergency case
 */
router.post('/cases', authorize('receptionist', 'nurse', 'doctor', 'admin'), emergencyController.createEmergencyCase);

/**
 * @route   GET /api/emergency/cases
 * @desc    Get all emergency cases
 */
router.get('/cases', emergencyController.getAllEmergencyCases);

/**
 * @route   GET /api/emergency/cases/:id
 * @desc    Get emergency case by ID
 */
router.get('/cases/:id', emergencyController.getEmergencyCaseById);

/**
 * @route   PUT /api/emergency/cases/:id
 * @desc    Update emergency case
 */
router.put('/cases/:id', authorize('doctor', 'nurse', 'admin'), emergencyController.updateEmergencyCase);

/**
 * @route   GET /api/emergency/queue
 * @desc    Get emergency queue sorted by triage
 */
router.get('/queue', emergencyController.getEmergencyQueue);

/**
 * @route   GET /api/emergency/dashboard
 * @desc    Get emergency dashboard stats
 */
router.get('/dashboard', emergencyController.getDashboard);

module.exports = router;
