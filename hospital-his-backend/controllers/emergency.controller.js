const Emergency = require('../models/Emergency');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Create emergency case
 * @route   POST /api/emergency/cases
 */
exports.createEmergencyCase = asyncHandler(async (req, res, next) => {
    console.log('Emergency Controller: createEmergencyCase called');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    req.body.createdBy = req.user.id;

    const emergencyCase = await Emergency.create(req.body);
    await emergencyCase.populate(['patient', 'assignedDoctor', 'assignedNurse']);

    res.status(201).json({
        success: true,
        data: emergencyCase,
    });
});

/**
 * @desc    Get all emergency cases
 * @route   GET /api/emergency/cases
 */
exports.getAllEmergencyCases = asyncHandler(async (req, res, next) => {
    const { status, triageLevel, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (triageLevel) query.triageLevel = triageLevel;

    const skip = (page - 1) * limit;

    const cases = await Emergency.find(query)
        .populate('patient', 'patientId firstName lastName phone')
        .populate('assignedDoctor', 'profile.firstName profile.lastName')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ arrivalTime: -1 });

    const total = await Emergency.countDocuments(query);

    res.status(200).json({
        success: true,
        count: cases.length,
        total,
        page: parseInt(page),
        data: cases,
    });
});

/**
 * @desc    Get emergency case by ID
 * @route   GET /api/emergency/cases/:id
 */
exports.getEmergencyCaseById = asyncHandler(async (req, res, next) => {
    const emergencyCase = await Emergency.findById(req.params.id)
        .populate('patient')
        .populate('assignedDoctor', 'profile')
        .populate('assignedNurse', 'profile');

    if (!emergencyCase) {
        return next(new ErrorResponse('Emergency case not found', 404));
    }

    res.status(200).json({
        success: true,
        data: emergencyCase,
    });
});

/**
 * @desc    Update emergency case
 * @route   PUT /api/emergency/cases/:id
 */
exports.updateEmergencyCase = asyncHandler(async (req, res, next) => {
    const emergencyCase = await Emergency.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    }).populate(['patient', 'assignedDoctor', 'assignedNurse']);

    if (!emergencyCase) {
        return next(new ErrorResponse('Emergency case not found', 404));
    }

    res.status(200).json({
        success: true,
        data: emergencyCase,
    });
});

/**
 * @desc    Get emergency queue sorted by triage
 * @route   GET /api/emergency/queue
 */
exports.getEmergencyQueue = asyncHandler(async (req, res, next) => {
    const activeStatuses = [
        Emergency.EMERGENCY_STATUS.REGISTERED,
        Emergency.EMERGENCY_STATUS.TRIAGE,
        Emergency.EMERGENCY_STATUS.IN_TREATMENT,
        Emergency.EMERGENCY_STATUS.OBSERVATION,
    ];

    const triagePriority = {
        [Emergency.TRIAGE_LEVELS.CRITICAL]: 1,
        [Emergency.TRIAGE_LEVELS.URGENT]: 2,
        [Emergency.TRIAGE_LEVELS.LESS_URGENT]: 3,
        [Emergency.TRIAGE_LEVELS.NON_URGENT]: 4,
    };

    const queue = await Emergency.find({ status: { $in: activeStatuses } })
        .populate('patient', 'patientId firstName lastName')
        .populate('assignedDoctor', 'profile.firstName profile.lastName');

    // Sort by triage level priority
    queue.sort((a, b) => {
        const priorityA = triagePriority[a.triageLevel] || 5;
        const priorityB = triagePriority[b.triageLevel] || 5;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(a.arrivalTime) - new Date(b.arrivalTime);
    });

    res.status(200).json({
        success: true,
        count: queue.length,
        data: queue,
    });
});

/**
 * @desc    Get emergency dashboard stats
 * @route   GET /api/emergency/dashboard
 */
exports.getDashboard = asyncHandler(async (req, res, next) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeCount, todayCount, triageBreakdown] = await Promise.all([
        Emergency.countDocuments({
            status: { $nin: [Emergency.EMERGENCY_STATUS.DISCHARGED, Emergency.EMERGENCY_STATUS.ADMITTED, Emergency.EMERGENCY_STATUS.TRANSFERRED] },
        }),
        Emergency.countDocuments({ arrivalTime: { $gte: today } }),
        Emergency.aggregate([
            { $match: { arrivalTime: { $gte: today } } },
            { $group: { _id: '$triageLevel', count: { $sum: 1 } } },
        ]),
    ]);

    res.status(200).json({
        success: true,
        data: {
            activeCount,
            todayCount,
            triageBreakdown: triageBreakdown.reduce((acc, curr) => {
                acc[curr._id] = curr.count;
                return acc;
            }, {}),
        },
    });
});
