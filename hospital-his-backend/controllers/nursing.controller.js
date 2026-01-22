const MedicationAdministration = require('../models/MedicationAdministration');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const marService = require('../services/mar.service');

/**
 * Nursing Controller
 * 
 * Handles medication administration record (MAR) workflows.
 * Critical for patient safety and nursing workflow.
 */

/**
 * @desc    Get MAR schedule for an admission
 * @route   GET /api/nursing/mar/:admissionId
 */
exports.getMARSchedule = asyncHandler(async (req, res, next) => {
    const { admissionId } = req.params;
    const { date, status } = req.query;

    const schedule = await marService.getMARSchedule(admissionId, { date, status });

    // Group by time for easier viewing
    const groupedSchedule = {};
    for (const mar of schedule) {
        const timeKey = mar.scheduledTime.toISOString().slice(0, 13); // Group by hour
        if (!groupedSchedule[timeKey]) {
            groupedSchedule[timeKey] = [];
        }
        groupedSchedule[timeKey].push(mar);
    }

    res.status(200).json({
        success: true,
        count: schedule.length,
        data: schedule,
        grouped: groupedSchedule,
    });
});

/**
 * @desc    Get overdue medications
 * @route   GET /api/nursing/mar/:admissionId/overdue
 */
exports.getOverdueMedications = asyncHandler(async (req, res, next) => {
    const { admissionId } = req.params;

    const overdue = await marService.getOverdueMedications(admissionId);

    res.status(200).json({
        success: true,
        count: overdue.length,
        data: overdue,
    });
});

/**
 * @desc    Get single MAR record
 * @route   GET /api/nursing/mar/record/:marId
 */
exports.getMARRecord = asyncHandler(async (req, res, next) => {
    const mar = await MedicationAdministration.findById(req.params.marId)
        .populate('patient', 'patientId firstName lastName allergies')
        .populate('medicine', 'name genericName form strength')
        .populate('administeredBy', 'profile.firstName profile.lastName')
        .populate('witnessedBy', 'profile.firstName profile.lastName');

    if (!mar) {
        return next(new ErrorResponse('MAR record not found', 404));
    }

    res.status(200).json({
        success: true,
        data: mar,
    });
});

/**
 * @desc    Pre-administration safety check
 * @route   POST /api/nursing/mar/:marId/safety-check
 */
exports.preAdminSafetyCheck = asyncHandler(async (req, res, next) => {
    const { marId } = req.params;

    const result = await marService.preAdminSafetyCheck(marId);

    res.status(200).json({
        success: true,
        data: result,
    });
});

/**
 * @desc    Record medication administration
 * @route   POST /api/nursing/mar/:marId/administer
 */
exports.recordAdministration = asyncHandler(async (req, res, next) => {
    const { marId } = req.params;
    const { notes, vitalsAtAdmin, site, witnessId } = req.body;

    const mar = await marService.recordAdministration(
        marId,
        { notes, vitalsAtAdmin, site },
        req.user.id,
        witnessId
    );

    res.status(200).json({
        success: true,
        message: 'Medication administered successfully',
        data: mar,
    });
});

/**
 * @desc    Hold medication
 * @route   POST /api/nursing/mar/:marId/hold
 */
exports.holdMedication = asyncHandler(async (req, res, next) => {
    const { marId } = req.params;
    const { holdReason, holdDetails } = req.body;

    if (!holdReason) {
        return next(new ErrorResponse('Hold reason is required', 400));
    }

    const mar = await marService.holdMedication(
        marId,
        holdReason,
        holdDetails,
        req.user.id
    );

    res.status(200).json({
        success: true,
        message: 'Medication held',
        data: mar,
    });
});

/**
 * @desc    Record patient refusal
 * @route   POST /api/nursing/mar/:marId/refuse
 */
exports.recordRefusal = asyncHandler(async (req, res, next) => {
    const { marId } = req.params;
    const { refusalReason } = req.body;

    if (!refusalReason) {
        return next(new ErrorResponse('Refusal reason is required', 400));
    }

    const mar = await marService.recordRefusal(
        marId,
        refusalReason,
        req.user.id
    );

    res.status(200).json({
        success: true,
        message: 'Patient refusal recorded',
        data: mar,
    });
});

/**
 * @desc    Manually create MAR schedule from dispense
 * @route   POST /api/nursing/mar/create-schedule
 */
exports.createMARSchedule = asyncHandler(async (req, res, next) => {
    const { dispenseId, admissionId } = req.body;

    if (!dispenseId || !admissionId) {
        return next(new ErrorResponse('Dispense ID and Admission ID are required', 400));
    }

    const schedule = await marService.createMARSchedule(dispenseId, admissionId);

    res.status(201).json({
        success: true,
        message: `Created ${schedule.length} MAR entries`,
        count: schedule.length,
        data: schedule,
    });
});
