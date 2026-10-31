const Patient = require('../models/Patient');
const EMR = require('../models/EMR');
const Appointment = require('../models/Appointment');
const Admission = require('../models/Admission');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const aiOcrService = require('../services/aiOcr.service');
const emailService = require('../services/email.service');

/**
 * @desc    Scan government ID card and extract patient details
 * @route   POST /api/patients/scan-id
 * @access  Receptionist, Admin
 */
exports.scanIdCard = asyncHandler(async (req, res, next) => {
    // Check if file was uploaded
    if (!req.file) {
        return next(new ErrorResponse('Please upload an ID card image', 400));
    }

    const { buffer, originalname, mimetype } = req.file;

    try {
        // Call AI OCR service to extract details
        const extractedData = await aiOcrService.extractIdDetails(
            buffer,
            originalname,
            mimetype
        );

        // Return extracted data (already masked by AI service)
        res.status(200).json({
            success: true,
            message: 'ID card scanned successfully',
            data: {
                firstName: extractedData.firstName || '',
                lastName: extractedData.lastName || '',
                dateOfBirth: extractedData.dateOfBirth || null,
                gender: extractedData.gender || null,
                phone: extractedData.phone || null,
                maskedAadhaar: extractedData.maskedAadhaar || null,
                maskedImageUrl: extractedData.maskedImageUrl || null,
                confidence: extractedData.confidence || 'low'
            }
        });
    } catch (error) {
        // Handle AI service errors gracefully
        return next(new ErrorResponse(
            error.message || 'Failed to extract ID details. Please try again or enter manually.',
            500
        ));
    }
});
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * @desc    Create a new patient
 * @route   POST /api/patients
 */
exports.createPatient = asyncHandler(async (req, res, next) => {
    const patientData = { ...req.body };
    // Optional enum field: treat empty string as not provided
    if (!patientData.bloodGroup) delete patientData.bloodGroup;

    // Handle ID Document Image Upload
    if (req.body.idDocumentImage) {
        try {
            // Extract base64 data
            const base64Data = req.body.idDocumentImage.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            // Create unique filename
            const timestamp = Date.now();
            const filename = `id_${timestamp}.jpg`;
            const uploadDir = path.join(__dirname, '..', 'uploads', 'id-documents');

            // Ensure directory exists
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const filePath = path.join(uploadDir, filename);
            fs.writeFileSync(filePath, buffer);

            // Set idDocument fields
            patientData.idDocument = {
                hasOptedIn: true,
                imagePath: `uploads/id-documents/${filename}`,
                capturedAt: new Date(),
                capturedBy: req.user?.id || null,
                disclaimer: 'For identification assistance only. Not government authentication.'
            };

            logger.info(`[PatientRegistration] ID Document captured for new patient by user ${req.user?.id}`);
        } catch (err) {
            logger.error(`[PatientRegistration] Failed to save ID document: ${err.message}`);
            // Don't block registration if ID save fails
        }

        // Remove base64 from data being saved to DB
        delete patientData.idDocumentImage;
    }

    // Handle Referral Information (Optional)
    if (req.body.referral && (req.body.referral.doctorName || req.body.referral.doctorId)) {
        try {
            const referralData = {
                type: req.body.referral.type || 'EXTERNAL',
                doctorName: req.body.referral.doctorName,
                clinicName: req.body.referral.clinicName || null,
                email: req.body.referral.email || null,
                phone: req.body.referral.phone || null,
                recordedBy: req.user?.id || null,
                recordedAt: new Date(),
            };

            // For INTERNAL referrals, fetch doctor email from User model
            if (req.body.referral.type === 'INTERNAL' && req.body.referral.doctorId) {
                const doctor = await User.findById(req.body.referral.doctorId).select('email profile');
                if (doctor) {
                    referralData.doctorId = doctor._id;
                    referralData.email = doctor.email;
                    referralData.doctorName = `${doctor.profile?.firstName || ''} ${doctor.profile?.lastName || ''}`.trim();
                }
            }

            patientData.referral = referralData;
            logger.info(`[PatientRegistration] Referral recorded: ${referralData.type} - ${referralData.doctorName}`);
        } catch (err) {
            logger.error(`[PatientRegistration] Failed to process referral: ${err.message}`);
            // Don't block registration if referral processing fails
        }
    }

    const patient = await Patient.create(patientData);

    // Send referral notification email (async - don't block response)
    if (patient.referral?.email) {
        // Calculate patient age
        const calculateAge = (dob) => {
            if (!dob) return 'N/A';
            const today = new Date();
            const birthDate = new Date(dob);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return age;
        };

        // Send email asynchronously (non-blocking)
        emailService.sendReferralNotification({
            doctorEmail: patient.referral.email,
            doctorName: patient.referral.doctorName,
            patientName: `${patient.firstName} ${patient.lastName}`,
            patientAge: calculateAge(patient.dateOfBirth),
            patientGender: patient.gender,
            patientId: patient.patientId,
            registrationTime: new Date(),
            referralType: patient.referral.type,
        }).then(async (result) => {
            // Update patient record with email status (async)
            try {
                await Patient.findByIdAndUpdate(patient._id, {
                    'referral.emailSent': result.success,
                    'referral.emailSentAt': result.success ? result.sentAt : null,
                    'referral.emailError': result.success ? null : result.error,
                });
                if (result.success) {
                    logger.info(`[PatientRegistration] Referral email sent for patient ${patient.patientId}`);
                } else {
                    logger.warn(`[PatientRegistration] Referral email failed for patient ${patient.patientId}: ${result.error}`);
                }
            } catch (updateErr) {
                logger.error(`[PatientRegistration] Failed to update email status: ${updateErr.message}`);
            }
        }).catch((err) => {
            logger.error(`[PatientRegistration] Email service error: ${err.message}`);
        });
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
        io.emit('patient-registered', {
            id: patient._id,
            name: `${patient.firstName} ${patient.lastName}`,
            time: new Date(),
            hasReferral: !!patient.referral?.doctorName,
        });
    }

    logger.info(`[PatientRegistration] New patient registered: ${patient.patientId} - ${patient.firstName} ${patient.lastName}${patient.referral?.doctorName ? ` (Referred by: ${patient.referral.doctorName})` : ''}`);

    res.status(201).json({
        success: true,
        data: patient,
    });
});

/**
 * @desc    Get all patients with pagination
 * @route   GET /api/patients
 */
exports.getAllPatients = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const patients = await Patient.find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

    const total = await Patient.countDocuments();

    res.status(200).json({
        success: true,
        count: patients.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: patients,
    });
});

/**
 * @desc    Search patients
 * @route   GET /api/patients/search
 */
exports.searchPatients = asyncHandler(async (req, res, next) => {
    const { query } = req.query;

    if (!query) {
        return next(new ErrorResponse('Search query is required', 400));
    }

    const patients = await Patient.find({
        $or: [
            { patientId: { $regex: query, $options: 'i' } },
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } },
            { phone: { $regex: query, $options: 'i' } },
        ],
    }).limit(20);

    res.status(200).json({
        success: true,
        count: patients.length,
        data: patients,
    });
});

/**
 * @desc    Get patient by ID
 * @route   GET /api/patients/:id
 */
exports.getPatientById = asyncHandler(async (req, res, next) => {
    const patient = await Patient.findById(req.params.id).populate('insuranceDetails.provider');

    if (!patient) {
        return next(new ErrorResponse('Patient not found', 404));
    }

    res.status(200).json({
        success: true,
        data: patient,
    });
});

/**
 * @desc    Update patient
 * @route   PUT /api/patients/:id
 */
exports.updatePatient = asyncHandler(async (req, res, next) => {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!patient) {
        return next(new ErrorResponse('Patient not found', 404));
    }

    res.status(200).json({
        success: true,
        data: patient,
    });
});

/**
 * @desc    Delete patient (soft delete)
 * @route   DELETE /api/patients/:id
 */
exports.deletePatient = asyncHandler(async (req, res, next) => {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
        return next(new ErrorResponse('Patient not found', 404));
    }

    // Soft delete by marking as inactive (if such field exists) or actual delete
    await patient.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Patient deleted successfully',
    });
});

/**
 * @desc    Get patient visit history
 * @route   GET /api/patients/:id/history
 */
exports.getPatientHistory = asyncHandler(async (req, res, next) => {
    const patientId = req.params.id;

    const [appointments, admissions] = await Promise.all([
        Appointment.find({ patient: patientId }).populate('doctor department').sort({ scheduledDate: -1 }),
        Admission.find({ patient: patientId }).populate('doctor department ward bed').sort({ admissionDate: -1 }),
    ]);

    res.status(200).json({
        success: true,
        data: {
            appointments,
            admissions,
        },
    });
});

/**
 * @desc    Get patient EMR records
 * @route   GET /api/patients/:id/emr
 */
exports.getPatientEMR = asyncHandler(async (req, res, next) => {
    const emrRecords = await EMR.find({ patient: req.params.id })
        .populate('doctor', 'profile.firstName profile.lastName')
        .sort({ date: -1 });

    res.status(200).json({
        success: true,
        count: emrRecords.length,
        data: emrRecords,
    });
});


/**
 * @desc    Get referral statistics
 * @route   GET /api/patients/referral-stats
 */
exports.getReferralStats = asyncHandler(async (req, res, next) => {
    // 1. Overall stats (Internal vs External vs None)
    const overallStats = await Patient.aggregate([
        {
            $group: {
                _id: "$referral.type",
                count: { $sum: 1 }
            }
        }
    ]);

    // 2. Top Internal Doctors
    const topInternal = await Patient.aggregate([
        { $match: { "referral.type": "INTERNAL" } },
        {
            $group: {
                _id: "$referral.doctorId",
                name: { $first: "$referral.doctorName" },
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
    ]);

    // 3. Top External Clinics/Doctors
    const topExternal = await Patient.aggregate([
        { $match: { "referral.type": "EXTERNAL" } },
        {
            $group: {
                _id: { name: "$referral.doctorName", clinic: "$referral.clinicName" },
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
    ]);

    // 4. Recent Referrals (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTrend = await Patient.aggregate([
        {
            $match: {
                createdAt: { $gte: thirtyDaysAgo },
                "referral.type": { $in: ["INTERNAL", "EXTERNAL"] }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
        success: true,
        data: {
            overall: overallStats,
            topInternal,
            topExternal,
            recentTrend
        }
    });
});
