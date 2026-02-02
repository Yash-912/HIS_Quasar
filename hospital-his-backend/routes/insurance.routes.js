const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insurance.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

router.use(authenticate);

/**
 * @route   POST /api/insurance/claims
 * @desc    Create a new insurance claim
 */
router.post('/claims', authorize('insurance', 'billing', 'admin'), insuranceController.createClaim);

/**
 * @route   GET /api/insurance/claims
 * @desc    Get all insurance claims
 */
router.get('/claims', authorize('insurance', 'billing', 'admin'), insuranceController.getAllClaims);

/**
 * @route   GET /api/insurance/claims/:id
 * @desc    Get claim by ID
 */
router.get('/claims/:id', insuranceController.getClaimById);

/**
 * @route   PUT /api/insurance/claims/:id
 * @desc    Update claim
 */
router.put('/claims/:id', authorize('insurance', 'admin'), insuranceController.updateClaim);

/**
 * @route   POST /api/insurance/pre-authorization
 * @desc    Request pre-authorization
 */
router.post('/pre-authorization', authorize('insurance', 'billing'), insuranceController.requestPreAuth);

/**
 * @route   GET /api/insurance/providers
 * @desc    Get insurance providers
 */
router.get('/providers', insuranceController.getProviders);

/**
 * @route   POST /api/insurance/providers
 * @desc    Add insurance provider
 */
router.post('/providers', authorize('admin'), insuranceController.addProvider);

// New routes for advanced insurance features
router.post('/claims/:id/submit', authorize('insurance', 'billing', 'admin'), insuranceController.submitClaim);
router.put('/claims/:id/pre-auth', authorize('insurance', 'billing', 'admin'), insuranceController.updatePreAuthStatus);
router.post('/claims/:id/approve', authorize('insurance', 'admin'), insuranceController.approveClaim);
router.post('/claims/:id/reject', authorize('insurance', 'admin'), insuranceController.rejectClaim);
router.post('/claims/:id/settle', authorize('insurance', 'admin'), insuranceController.settleClaim);
router.get('/claims/:id/timeline', authorize('insurance', 'billing', 'admin'), insuranceController.getClaimTimeline);
router.get('/tpa-providers', insuranceController.getTPAProviders);
router.post('/tpa-providers', authorize('admin'), insuranceController.addTPAProvider);

// ═══════════════════════════════════════════════════════════════════
// PRE-AUTH QUEUE ROUTES (Agentic Workflow)
// ═══════════════════════════════════════════════════════════════════
const preAuthQueueController = require('../controllers/preAuthQueue.controller');

/**
 * @route   POST /api/insurance/preauth-queue
 * @desc    Create a new pre-auth case (minimal input, auto-populated)
 */
router.post('/preauth-queue', authorize('insurance_staff', 'insurance', 'billing', 'admin'), preAuthQueueController.createCase);

/**
 * @route   GET /api/insurance/preauth-queue
 * @desc    Get all pre-auth queue cases
 */
router.get('/preauth-queue', authorize('insurance_staff', 'insurance', 'billing', 'admin'), preAuthQueueController.getAllCases);

/**
 * @route   GET /api/insurance/preauth-queue/:caseId
 * @desc    Get single pre-auth case details
 */
router.get('/preauth-queue/:caseId', authorize('insurance_staff', 'insurance', 'billing', 'admin'), preAuthQueueController.getCaseById);

/**
 * @route   POST /api/insurance/preauth-queue/:caseId/generate-packet
 * @desc    Run LLM agent to generate pre-auth packet
 */
router.post('/preauth-queue/:caseId/generate-packet', authorize('insurance_staff', 'insurance', 'billing', 'admin'), preAuthQueueController.generatePacket);

/**
 * @route   PUT /api/insurance/preauth-queue/:caseId/status
 * @desc    Update case status
 */
router.put('/preauth-queue/:caseId/status', authorize('insurance_staff', 'insurance', 'billing', 'admin'), preAuthQueueController.updateStatus);

/**
 * @route   PUT /api/insurance/preauth-queue/:caseId
 * @desc    Update case details (policy number, assigned user, etc.)
 */
router.put('/preauth-queue/:caseId', authorize('insurance_staff', 'insurance', 'billing', 'admin'), preAuthQueueController.updateCase);

module.exports = router;

