const express = require('express');
const nursingController = require('../controllers/nursing.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { USER_ROLES } = require('../config/constants');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================================
// MEDICATION ADMINISTRATION RECORD (MAR)
// ============================================================

/**
 * @route   GET /api/nursing/mar/:admissionId
 * @desc    Get MAR schedule for an admission
 * @access  Nurse, Doctor
 */
router.get(
    '/mar/:admissionId',
    authorize(USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN),
    nursingController.getMARSchedule
);

/**
 * @route   GET /api/nursing/mar/:admissionId/overdue
 * @desc    Get overdue medications for an admission
 * @access  Nurse, Doctor
 */
router.get(
    '/mar/:admissionId/overdue',
    authorize(USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN),
    nursingController.getOverdueMedications
);

/**
 * @route   GET /api/nursing/mar/record/:marId
 * @desc    Get single MAR record details
 * @access  Nurse, Doctor
 */
router.get(
    '/mar/record/:marId',
    authorize(USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN),
    nursingController.getMARRecord
);

/**
 * @route   POST /api/nursing/mar/:marId/safety-check
 * @desc    Perform pre-administration safety check
 * @access  Nurse
 */
router.post(
    '/mar/:marId/safety-check',
    authorize(USER_ROLES.NURSE, USER_ROLES.DOCTOR),
    nursingController.preAdminSafetyCheck
);

/**
 * @route   POST /api/nursing/mar/:marId/administer
 * @desc    Record medication administration
 * @access  Nurse
 */
router.post(
    '/mar/:marId/administer',
    authorize(USER_ROLES.NURSE),
    nursingController.recordAdministration
);

/**
 * @route   POST /api/nursing/mar/:marId/hold
 * @desc    Hold a medication
 * @access  Nurse
 */
router.post(
    '/mar/:marId/hold',
    authorize(USER_ROLES.NURSE),
    nursingController.holdMedication
);

/**
 * @route   POST /api/nursing/mar/:marId/refuse
 * @desc    Record patient refusal
 * @access  Nurse
 */
router.post(
    '/mar/:marId/refuse',
    authorize(USER_ROLES.NURSE),
    nursingController.recordRefusal
);

/**
 * @route   POST /api/nursing/mar/create-schedule
 * @desc    Manually create MAR schedule from dispense
 * @access  Nurse, Pharmacist
 */
router.post(
    '/mar/create-schedule',
    authorize(USER_ROLES.NURSE, USER_ROLES.PHARMACIST),
    nursingController.createMARSchedule
);

module.exports = router;
