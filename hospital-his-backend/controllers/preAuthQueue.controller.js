/**
 * PreAuth Queue Controller
 * Handles API endpoints for insurance pre-authorization queue
 */

const preAuthQueueService = require('../services/preAuthQueue.service');
const preAuthAgentService = require('../services/preAuthAgentLLM.service');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Create a new pre-auth case
 * @route   POST /api/insurance/preauth-queue
 * @access  Private (insurance_staff, insurance, admin)
 */
exports.createCase = asyncHandler(async (req, res, next) => {
    const { patientId, insurerName, tpaName, policyNumber } = req.body;

    if (!patientId || !insurerName) {
        return next(new ErrorResponse('Patient ID and insurer name are required', 400));
    }

    const preAuthCase = await preAuthQueueService.createCase(
        patientId,
        insurerName,
        tpaName,
        policyNumber,
        req.user.id
    );

    res.status(201).json({
        success: true,
        message: 'Pre-auth case created and auto-populated',
        data: preAuthCase,
    });
});

/**
 * @desc    Get all pre-auth cases
 * @route   GET /api/insurance/preauth-queue
 * @access  Private (insurance_staff, insurance, admin)
 */
exports.getAllCases = asyncHandler(async (req, res, next) => {
    const { status, page = 1, limit = 20 } = req.query;

    const result = await preAuthQueueService.getAllCases(
        { status },
        parseInt(page),
        parseInt(limit)
    );

    res.status(200).json({
        success: true,
        count: result.cases.length,
        total: result.total,
        page: result.page,
        pages: result.pages,
        data: result.cases,
    });
});

/**
 * @desc    Get single pre-auth case by ID
 * @route   GET /api/insurance/preauth-queue/:caseId
 * @access  Private (insurance_staff, insurance, admin)
 */
exports.getCaseById = asyncHandler(async (req, res, next) => {
    const caseData = await preAuthQueueService.getCaseById(req.params.caseId);

    if (!caseData) {
        return next(new ErrorResponse('Pre-auth case not found', 404));
    }

    // Add audit entry for view
    await preAuthQueueService.addAuditEntry(
        req.params.caseId,
        'case_viewed',
        req.user.id,
        ['all']
    );

    res.status(200).json({
        success: true,
        data: caseData,
    });
});

/**
 * @desc    Generate pre-auth packet using LLM agent
 * @route   POST /api/insurance/preauth-queue/:caseId/generate-packet
 * @access  Private (insurance_staff, insurance, admin)
 */
exports.generatePacket = asyncHandler(async (req, res, next) => {
    const { useDirect } = req.query; // Optional: use direct generation (no LLM)
    const logger = require('../utils/logger');

    let result;
    let usedFallback = false;

    if (useDirect === 'true' || !process.env.OPENROUTER_AGENTIC_INSURANCE_API) {
        // Use direct generation if no API key or explicitly requested
        result = await preAuthAgentService.generatePreAuthPacketDirect(
            req.params.caseId,
            req.user.id
        );
    } else {
        try {
            result = await preAuthAgentService.generatePreAuthPacket(
                req.params.caseId,
                req.user.id
            );
        } catch (llmError) {
            // Fall back to direct generation if LLM fails
            logger.warn(`[PreAuthQueue] LLM failed, falling back to direct generation: ${llmError.message}`);
            result = await preAuthAgentService.generatePreAuthPacketDirect(
                req.params.caseId,
                req.user.id
            );
            usedFallback = true;
        }
    }

    res.status(200).json({
        success: true,
        message: usedFallback
            ? 'Pre-auth packet generated (LLM unavailable, used direct generation)'
            : 'Pre-auth packet generated successfully',
        data: result,
    });
});

/**
 * @desc    Update case status
 * @route   PUT /api/insurance/preauth-queue/:caseId/status
 * @access  Private (insurance_staff, insurance, admin)
 */
exports.updateStatus = asyncHandler(async (req, res, next) => {
    const { status } = req.body;

    if (!status) {
        return next(new ErrorResponse('Status is required', 400));
    }

    const caseData = await preAuthQueueService.updateCaseStatus(
        req.params.caseId,
        status,
        req.user.id
    );

    res.status(200).json({
        success: true,
        message: `Case status updated to ${status}`,
        data: caseData,
    });
});

/**
 * @desc    Update case details (policy number, notes, etc.)
 * @route   PUT /api/insurance/preauth-queue/:caseId
 * @access  Private (insurance_staff, insurance, admin)
 */
exports.updateCase = asyncHandler(async (req, res, next) => {
    const PreAuthQueue = require('../models/PreAuthQueue');
    const allowedFields = ['policyNumber', 'tpaName', 'assignedTo'];

    const updates = {};
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    }

    if (Object.keys(updates).length === 0) {
        return next(new ErrorResponse('No valid fields to update', 400));
    }

    const caseData = await PreAuthQueue.findByIdAndUpdate(
        req.params.caseId,
        {
            ...updates,
            $push: {
                auditTrail: {
                    action: 'case_updated',
                    userId: req.user.id,
                    timestamp: new Date(),
                    fieldsAccessed: Object.keys(updates),
                    details: { updates },
                },
            },
        },
        { new: true, runValidators: true }
    );

    if (!caseData) {
        return next(new ErrorResponse('Pre-auth case not found', 404));
    }

    res.status(200).json({
        success: true,
        message: 'Case updated successfully',
        data: caseData,
    });
});
