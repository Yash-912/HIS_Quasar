/**
 * Lab Report Routes
 * Handles PDF lab report uploads and AI summarization
 */

const express = require('express');
const router = express.Router();
const labReportController = require('../controllers/labReport.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');
const { uploadLabReport } = require('../middleware/upload.middleware');

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/lab-reports/all
 * @desc    Get all lab reports for doctor listing
 * @access  Doctor, Admin only
 */
router.get(
    '/all',
    authorize('doctor', 'admin'),
    labReportController.getAllReports
);

/**
 * @route   POST /api/v1/lab-reports/:patientId/upload
 * @desc    Upload PDF lab report for a patient
 * @access  Lab Tech only
 */
router.post(
    '/:patientId/upload',
    authorize('lab_tech'),
    uploadLabReport.single('report'),
    labReportController.uploadReport
);

/**
 * @route   GET /api/v1/lab-reports/:reportId
 * @desc    Get lab report by ID (PDF URL + AI summary)
 * @access  Doctor, Admin only
 */
router.get(
    '/:reportId',
    authorize('doctor', 'admin'),
    labReportController.getReportById
);

/**
 * @route   POST /api/v1/lab-reports/:reportId/summarize
 * @desc    Trigger AI summary generation or return existing summary
 * @access  Doctor, Admin only
 */
router.post(
    '/:reportId/summarize',
    authorize('doctor', 'admin'),
    labReportController.triggerSummary
);

/**
 * @route   GET /api/v1/lab-reports/patient/:patientId
 * @desc    Get all lab reports for a patient
 * @access  Doctor, Admin only
 */
router.get(
    '/patient/:patientId',
    authorize('doctor', 'admin'),
    labReportController.getReportsByPatient
);

module.exports = router;
