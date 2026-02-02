/**
 * PreAuth Queue Service
 * Handles auto-population of pre-auth cases from linked patient/encounter data
 */

const PreAuthQueue = require('../models/PreAuthQueue');
const Patient = require('../models/Patient');
const Admission = require('../models/Admission');
const Appointment = require('../models/Appointment');
const Emergency = require('../models/Emergency');
const LabTest = require('../models/LabTest');
const Radiology = require('../models/Radiology');
const Prescription = require('../models/Prescription');
const Surgery = require('../models/Surgery');
const Bed = require('../models/Bed');
const Tariff = require('../models/Tariff');

/**
 * Find the latest encounter (Admission, Appointment, or Emergency) for a patient
 * Priority: Active Admission > Recent Appointment > Emergency
 */
const findLatestEncounter = async (patientId) => {
    // Check for active admission first
    const activeAdmission = await Admission.findOne({
        patient: patientId,
        status: 'admitted',
    })
        .populate('doctor', 'profile.firstName profile.lastName')
        .populate('department', 'name')
        .populate('bed')
        .sort({ admissionDate: -1 });

    if (activeAdmission) {
        return {
            encounterId: activeAdmission._id,
            encounterModel: 'Admission',
            encounter: activeAdmission,
            doctor: activeAdmission.doctor,
            department: activeAdmission.department,
            diagnosis: activeAdmission.diagnosis,
            bed: activeAdmission.bed,
        };
    }

    // Check for recent appointment (last 7 days)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);

    const recentAppointment = await Appointment.findOne({
        patient: patientId,
        scheduledDate: { $gte: recentDate },
        status: { $in: ['completed', 'in-consultation', 'checked-in', 'scheduled'] },
    })
        .populate('doctor', 'profile.firstName profile.lastName')
        .populate('department', 'name')
        .sort({ scheduledDate: -1 });

    if (recentAppointment) {
        return {
            encounterId: recentAppointment._id,
            encounterModel: 'Appointment',
            encounter: recentAppointment,
            doctor: recentAppointment.doctor,
            department: recentAppointment.department,
            diagnosis: recentAppointment.diagnosis,
            bed: null,
        };
    }

    // Check for any emergency
    const emergency = await Emergency.findOne({ patient: patientId })
        .populate('attendingDoctor', 'profile.firstName profile.lastName')
        .populate('department', 'name')
        .sort({ createdAt: -1 });

    if (emergency) {
        return {
            encounterId: emergency._id,
            encounterModel: 'Emergency',
            encounter: emergency,
            doctor: emergency.attendingDoctor,
            department: emergency.department,
            diagnosis: emergency.chiefComplaint,
            bed: null,
        };
    }

    return null;
};

/**
 * Discover attached documents for the encounter
 */
const discoverDocuments = async (patientId, encounterId, encounterModel) => {
    const documents = [];

    // Find lab tests for this encounter
    const labTests = await LabTest.find({
        patient: patientId,
        visit: encounterId,
        visitModel: encounterModel,
    }).populate('test', 'name');

    for (const lab of labTests) {
        documents.push({
            docType: 'lab_report',
            docId: lab._id,
            docModel: 'LabTest',
            filePath: lab.reportPdf || null,
            exists: !!lab.reportPdf || lab.status === 'completed',
            description: lab.test?.name || lab.testNumber,
        });
    }

    // Find radiology for this encounter
    const radiologyTests = await Radiology.find({
        patient: patientId,
        visit: encounterId,
        visitModel: encounterModel,
    }).populate('test', 'name');

    for (const rad of radiologyTests) {
        documents.push({
            docType: 'radiology_report',
            docId: rad._id,
            docModel: 'Radiology',
            filePath: rad.scanImage || rad.reportUrl || null,
            exists: !!rad.scanImage || !!rad.reportUrl || rad.status === 'completed',
            description: rad.test?.name || rad.testNumber,
        });
    }

    // Find prescriptions for this encounter
    const prescriptions = await Prescription.find({
        patient: patientId,
        visit: encounterId,
        visitModel: encounterModel,
    });

    for (const rx of prescriptions) {
        documents.push({
            docType: 'prescription',
            docId: rx._id,
            docModel: 'Prescription',
            filePath: null,
            exists: true,
            description: `Prescription with ${rx.medicines?.length || 0} medicines`,
        });
    }

    return documents;
};

/**
 * Pull existing AI summaries from lab/radiology records
 */
const pullAISummaries = async (patientId, encounterId, encounterModel) => {
    const summaries = { lab: null, radiology: null };

    // Get lab AI summaries
    const labWithSummary = await LabTest.findOne({
        patient: patientId,
        visit: encounterId,
        visitModel: encounterModel,
        aiSummary: { $exists: true, $ne: null },
    }).sort({ summaryGeneratedAt: -1 });

    if (labWithSummary?.aiSummary) {
        summaries.lab = labWithSummary.aiSummary;
    }

    // Get radiology summaries
    const radWithSummary = await Radiology.findOne({
        patient: patientId,
        visit: encounterId,
        visitModel: encounterModel,
        reportSummary: { $exists: true, $ne: null },
    }).sort({ completedAt: -1 });

    if (radWithSummary?.reportSummary) {
        summaries.radiology = radWithSummary.reportSummary;
    }

    return summaries;
};

/**
 * Compute estimated cost from various sources
 */
const computeEstimatedCost = async (encounterId, encounterModel, encounterData) => {
    const breakdown = [];
    let totalAmount = 0;
    let isExact = true;

    // Bed charges (for admissions)
    if (encounterModel === 'Admission' && encounterData?.bed) {
        const bed = await Bed.findById(encounterData.bed._id || encounterData.bed);
        if (bed?.tariff) {
            // Estimate 3 days if still admitted
            const admission = await Admission.findById(encounterId);
            let days = 3; // default estimate
            if (admission?.admissionDate) {
                const now = new Date();
                const admitDate = new Date(admission.admissionDate);
                days = Math.max(1, Math.ceil((now - admitDate) / (1000 * 60 * 60 * 24)));
                if (admission.status === 'admitted') {
                    days += 2; // Add estimated remaining days
                    isExact = false;
                }
            }
            const bedAmount = bed.tariff * days;
            breakdown.push({
                component: 'bed_charges',
                description: `${bed.bedType} bed - ${days} days @ ₹${bed.tariff}/day`,
                amount: bedAmount,
                quantity: days,
                unitRate: bed.tariff,
            });
            totalAmount += bedAmount;
        }
    }

    // Surgery costs
    const surgeries = await Surgery.find({
        admission: encounterId,
        status: { $in: ['scheduled', 'in-progress', 'completed'] },
    });

    for (const surgery of surgeries) {
        // Get procedure tariff
        const procedureTariff = await Tariff.findOne({
            name: { $regex: new RegExp(surgery.surgeryType, 'i') },
            serviceType: 'procedure',
            isActive: true,
        });

        if (procedureTariff) {
            breakdown.push({
                component: 'procedure',
                description: `Surgery: ${surgery.surgeryType}`,
                amount: procedureTariff.basePrice,
                quantity: 1,
                unitRate: procedureTariff.basePrice,
            });
            totalAmount += procedureTariff.basePrice;
        } else {
            // Estimate surgery cost
            breakdown.push({
                component: 'surgery',
                description: `Surgery: ${surgery.surgeryType} (estimated)`,
                amount: 25000, // Default estimate
                quantity: 1,
                unitRate: 25000,
            });
            totalAmount += 25000;
            isExact = false;
        }

        // Consumables from surgery
        if (surgery.implantsAndConsumables?.length > 0) {
            for (const item of surgery.implantsAndConsumables) {
                const itemAmount = (item.unitCost || 0) * (item.quantity || 1);
                if (itemAmount > 0) {
                    breakdown.push({
                        component: 'consumables',
                        description: `${item.itemType}: ${item.itemName}`,
                        amount: itemAmount,
                        quantity: item.quantity || 1,
                        unitRate: item.unitCost,
                    });
                    totalAmount += itemAmount;
                }
            }
        }
    }

    // Lab test costs
    const labTests = await LabTest.find({
        visit: encounterId,
        visitModel: encounterModel,
    }).populate('test', 'price');

    for (const lab of labTests) {
        const labPrice = lab.test?.price || 500; // Default estimate
        breakdown.push({
            component: 'lab',
            description: `Lab: ${lab.test?.name || lab.testNumber}`,
            amount: labPrice,
            quantity: 1,
            unitRate: labPrice,
        });
        totalAmount += labPrice;
        if (!lab.test?.price) isExact = false;
    }

    // Radiology costs
    const radiologyTests = await Radiology.find({
        visit: encounterId,
        visitModel: encounterModel,
    }).populate('test', 'price');

    for (const rad of radiologyTests) {
        const radPrice = rad.test?.price || 1000; // Default estimate
        breakdown.push({
            component: 'radiology',
            description: `Radiology: ${rad.test?.name || rad.testNumber}`,
            amount: radPrice,
            quantity: 1,
            unitRate: radPrice,
        });
        totalAmount += radPrice;
        if (!rad.test?.price) isExact = false;
    }

    // If no items found, provide a minimum estimate
    if (breakdown.length === 0) {
        breakdown.push({
            component: 'other',
            description: 'Basic consultation and services (estimated)',
            amount: 5000,
            quantity: 1,
            unitRate: 5000,
        });
        totalAmount = 5000;
        isExact = false;
    }

    return {
        estimatedAmount: totalAmount,
        estimationBreakdown: breakdown,
        estimationBasis: isExact ? 'exact' : 'estimated',
    };
};

/**
 * Create a new pre-auth queue case with auto-population
 */
const createCase = async (patientId, insurerName, tpaName, policyNumber, userId) => {
    // Get patient details
    const patient = await Patient.findById(patientId);
    if (!patient) {
        throw new Error('Patient not found');
    }

    // Find latest encounter
    const encounterInfo = await findLatestEncounter(patientId);
    if (!encounterInfo) {
        throw new Error('No active admission or recent appointment found for this patient');
    }

    // Discover attached documents
    const documents = await discoverDocuments(
        patientId,
        encounterInfo.encounterId,
        encounterInfo.encounterModel
    );

    // Pull AI summaries
    const aiSummaries = await pullAISummaries(
        patientId,
        encounterInfo.encounterId,
        encounterInfo.encounterModel
    );

    // Compute estimated cost
    const costEstimate = await computeEstimatedCost(
        encounterInfo.encounterId,
        encounterInfo.encounterModel,
        encounterInfo
    );

    // Build clinical justification snippet
    let clinicalJustification = '';
    if (encounterInfo.diagnosis) {
        clinicalJustification += `• Primary Diagnosis: ${encounterInfo.diagnosis}\n`;
    }
    if (encounterInfo.encounterModel === 'Admission') {
        clinicalJustification += `• Patient admitted on ${new Date(encounterInfo.encounter.admissionDate).toLocaleDateString()}\n`;
    }
    if (documents.filter(d => d.docType === 'lab_report').length > 0) {
        clinicalJustification += `• Lab investigations ordered: ${documents.filter(d => d.docType === 'lab_report').length}\n`;
    }
    if (documents.filter(d => d.docType === 'radiology_report').length > 0) {
        clinicalJustification += `• Radiology investigations: ${documents.filter(d => d.docType === 'radiology_report').length}\n`;
    }

    // Create the case
    const caseData = {
        patient: patientId,
        insurerName,
        tpaName: tpaName || undefined,
        policyNumber: policyNumber || patient.insuranceDetails?.policyNumber || undefined,
        latestEncounterId: encounterInfo.encounterId,
        encounterModel: encounterInfo.encounterModel,
        treatingDoctor: encounterInfo.doctor?._id,
        department: encounterInfo.department?._id,
        diagnosisSummary: encounterInfo.diagnosis || 'Pending diagnosis',
        plannedProcedure: encounterInfo.encounter?.surgeryType || encounterInfo.encounter?.procedure || '',
        clinicalJustificationSnippet: clinicalJustification.trim(),
        attachedDocuments: documents,
        aiSummaries,
        ...costEstimate,
        status: 'draft',
        createdBy: userId,
        auditTrail: [
            {
                action: 'case_created',
                userId,
                timestamp: new Date(),
                fieldsAccessed: ['patient', 'encounter', 'documents', 'cost'],
                details: {
                    encounterModel: encounterInfo.encounterModel,
                    documentsCount: documents.length,
                },
            },
        ],
    };

    const preAuthCase = await PreAuthQueue.create(caseData);
    return preAuthCase;
};

/**
 * Get case by ID with population
 */
const getCaseById = async (caseId) => {
    const caseData = await PreAuthQueue.findById(caseId)
        .populate('patient', 'patientId firstName lastName phone dateOfBirth gender')
        .populate('treatingDoctor', 'profile.firstName profile.lastName')
        .populate('department', 'name')
        .populate('createdBy', 'profile.firstName profile.lastName')
        .populate('assignedTo', 'profile.firstName profile.lastName');

    return caseData;
};

/**
 * Get all cases with optional filters
 */
const getAllCases = async (filters = {}, page = 1, limit = 20) => {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.createdBy) query.createdBy = filters.createdBy;

    const skip = (page - 1) * limit;

    const cases = await PreAuthQueue.find(query)
        .populate('patient', 'patientId firstName lastName')
        .populate('treatingDoctor', 'profile.firstName profile.lastName')
        .populate('department', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

    const total = await PreAuthQueue.countDocuments(query);

    return { cases, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Update case status
 */
const updateCaseStatus = async (caseId, status, userId) => {
    const caseData = await PreAuthQueue.findById(caseId);
    if (!caseData) {
        throw new Error('Case not found');
    }

    caseData.status = status;
    caseData.auditTrail.push({
        action: `status_changed_to_${status}`,
        userId,
        timestamp: new Date(),
        fieldsAccessed: ['status'],
    });

    await caseData.save();
    return caseData;
};

/**
 * Add audit entry to case
 */
const addAuditEntry = async (caseId, action, userId, fieldsAccessed = [], details = {}) => {
    await PreAuthQueue.findByIdAndUpdate(caseId, {
        $push: {
            auditTrail: {
                action,
                userId,
                timestamp: new Date(),
                fieldsAccessed,
                details,
            },
        },
    });
};

module.exports = {
    findLatestEncounter,
    discoverDocuments,
    pullAISummaries,
    computeEstimatedCost,
    createCase,
    getCaseById,
    getAllCases,
    updateCaseStatus,
    addAuditEntry,
};
