/**
 * Order Set Service
 * Core business logic for order set management and execution
 */

const OrderSet = require('../models/OrderSet');
const AppliedOrderSet = require('../models/AppliedOrderSet');
const Patient = require('../models/Patient');
const Emergency = require('../models/Emergency');
const LabTest = require('../models/LabTest');
const Radiology = require('../models/Radiology');
const Prescription = require('../models/Prescription');
const BillingItem = require('../models/BillingItem');
const AuditLog = require('../models/AuditLog');
const safetyCheckService = require('./safetyCheck.service');

/**
 * Get all active order sets with optional filters
 */
const getAllOrderSets = async (filters = {}) => {
    const query = { isActive: true };

    if (filters.type) {
        query.type = filters.type;
    }

    if (filters.triageLevel) {
        query.triageLevel = filters.triageLevel;
    }

    return OrderSet.find(query)
        .populate('labTests.test', 'testName testCode category price')
        .populate('radiologyTests.test', 'testName testCode modality price')
        .populate('medications.medicine', 'name genericName form strength sellingPrice')
        .populate('createdBy', 'profile.firstName profile.lastName')
        .sort({ type: 1, name: 1 });
};

/**
 * Get order set by ID with full population
 */
const getOrderSetById = async (id) => {
    return OrderSet.findById(id)
        .populate('labTests.test', 'testName testCode category price parameters')
        .populate('radiologyTests.test', 'testName testCode modality price')
        .populate('medications.medicine', 'name genericName form strength sellingPrice contraindications')
        .populate('createdBy', 'profile.firstName profile.lastName')
        .populate('approvedBy', 'profile.firstName profile.lastName');
};

/**
 * Get order sets by type
 */
const getOrderSetsByType = async (type) => {
    return OrderSet.getActiveByType(type);
};

/**
 * Preview order set application with safety checks
 */
const previewOrderSet = async (orderSetId, patientId, emergencyId) => {
    const orderSet = await getOrderSetById(orderSetId);
    if (!orderSet) {
        throw new Error('Order set not found');
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
        throw new Error('Patient not found');
    }

    // Run safety checks
    const safetyChecks = await safetyCheckService.runFullSafetyCheck(
        patientId,
        emergencyId,
        orderSet
    );

    return {
        orderSet,
        patient: {
            _id: patient._id,
            patientId: patient.patientId,
            fullName: `${patient.firstName} ${patient.lastName}`,
            allergies: patient.allergies,
            allergyAlerts: patient.allergyAlerts,
        },
        safetyChecks,
        estimatedItems: {
            labTests: orderSet.labTests?.length || 0,
            radiologyTests: orderSet.radiologyTests?.length || 0,
            medications: orderSet.medications?.length || 0,
            procedures: orderSet.procedures?.length || 0,
        },
    };
};

/**
 * Apply order set to a patient
 * Main execution function that creates all orders
 */
const applyOrderSetToPatient = async (
    orderSetId,
    patientId,
    emergencyId,
    appliedBy,
    overrides = {},
    modifications = []
) => {
    // 1. Validate inputs
    const orderSet = await getOrderSetById(orderSetId);
    if (!orderSet || !orderSet.isActive) {
        throw new Error('Order set not found or inactive');
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
        throw new Error('Patient not found');
    }

    const emergency = await Emergency.findById(emergencyId);
    if (!emergency) {
        throw new Error('Emergency record not found');
    }

    // 2. Run safety checks if no overrides provided
    const safetyChecks = await safetyCheckService.runFullSafetyCheck(
        patientId,
        emergencyId,
        orderSet
    );

    // If there are warnings and no overrides, return warnings for user review
    if (safetyChecks.hasWarnings && !overrides.confirmed) {
        return {
            success: false,
            requiresOverride: true,
            safetyChecks,
            message: 'Safety warnings detected. Please review and confirm with override reason.',
        };
    }

    // 3. Validate override authority for critical warnings
    if (safetyChecks.hasCriticalWarnings && overrides.confirmed) {
        const canOverride = safetyCheckService.validateOverrideAuthority(appliedBy, 'critical');
        if (!canOverride) {
            throw new Error('Insufficient authority to override critical safety warnings');
        }
    }

    // 4. Create AppliedOrderSet record
    const appliedOrderSet = new AppliedOrderSet({
        orderSet: orderSet._id,
        orderSetVersion: orderSet.version,
        orderSetSnapshot: orderSet.toObject(),
        patient: patientId,
        emergency: emergencyId,
        appliedBy: appliedBy._id || appliedBy,
        status: AppliedOrderSet.APPLICATION_STATUS.EXECUTING,
        safetyChecks: {
            allergyWarnings: safetyChecks.allergyWarnings.map(w => ({
                ...w,
                overridden: overrides.confirmed || false,
                overriddenBy: overrides.confirmed ? (appliedBy._id || appliedBy) : null,
                overrideReason: overrides.reason || null,
                overriddenAt: overrides.confirmed ? new Date() : null,
            })),
            drugInteractionWarnings: safetyChecks.drugInteractionWarnings.map(w => ({
                ...w,
                overridden: overrides.confirmed || false,
                overriddenBy: overrides.confirmed ? (appliedBy._id || appliedBy) : null,
                overrideReason: overrides.reason || null,
                overriddenAt: overrides.confirmed ? new Date() : null,
            })),
            duplicateOrderWarnings: safetyChecks.duplicateOrderWarnings.map(w => ({
                ...w,
                overridden: overrides.skipDuplicates?.includes(w.itemId?.toString()) || false,
                overrideReason: overrides.duplicateReason || null,
            })),
        },
        modifications,
    });

    await appliedOrderSet.save();

    // 5. Execute orders
    const results = {
        labTests: [],
        radiologyTests: [],
        prescriptions: [],
        errors: [],
    };

    // 5a. Create Lab Orders
    for (const labTestConfig of orderSet.labTests || []) {
        // Skip if duplicate and not overridden
        const isDuplicate = safetyChecks.duplicateOrderWarnings.some(
            w => w.orderType === 'lab' && w.itemId?.toString() === labTestConfig.test._id?.toString()
        );
        if (isDuplicate && !overrides.skipDuplicates?.includes(labTestConfig.test._id?.toString())) {
            appliedOrderSet.createdOrders.labTests.push({
                status: AppliedOrderSet.ORDER_STATUS.SKIPPED,
                error: 'Duplicate order - skipped',
            });
            continue;
        }

        try {
            const labTest = new LabTest({
                patient: patientId,
                visit: emergencyId,
                visitModel: 'Emergency',
                orderedBy: appliedBy._id || appliedBy,
                test: labTestConfig.test._id || labTestConfig.test,
                status: 'ordered',
            });
            await labTest.save();

            results.labTests.push(labTest);
            appliedOrderSet.createdOrders.labTests.push({
                order: labTest._id,
                status: AppliedOrderSet.ORDER_STATUS.CREATED,
            });
        } catch (error) {
            results.errors.push({
                orderType: 'lab',
                itemName: labTestConfig.test?.testName || 'Lab Test',
                error: error.message,
            });
            appliedOrderSet.createdOrders.labTests.push({
                status: AppliedOrderSet.ORDER_STATUS.FAILED,
                error: error.message,
            });
        }
    }

    // 5b. Create Radiology Orders
    for (const radTestConfig of orderSet.radiologyTests || []) {
        const isDuplicate = safetyChecks.duplicateOrderWarnings.some(
            w => w.orderType === 'radiology' && w.itemId?.toString() === radTestConfig.test._id?.toString()
        );
        if (isDuplicate && !overrides.skipDuplicates?.includes(radTestConfig.test._id?.toString())) {
            appliedOrderSet.createdOrders.radiologyTests.push({
                status: AppliedOrderSet.ORDER_STATUS.SKIPPED,
                error: 'Duplicate order - skipped',
            });
            continue;
        }

        try {
            const radiology = new Radiology({
                patient: patientId,
                visit: emergencyId,
                visitModel: 'Emergency',
                orderedBy: appliedBy._id || appliedBy,
                test: radTestConfig.test._id || radTestConfig.test,
                status: 'ordered',
            });
            await radiology.save();

            results.radiologyTests.push(radiology);
            appliedOrderSet.createdOrders.radiologyTests.push({
                order: radiology._id,
                status: AppliedOrderSet.ORDER_STATUS.CREATED,
            });
        } catch (error) {
            results.errors.push({
                orderType: 'radiology',
                itemName: radTestConfig.test?.testName || 'Radiology Test',
                error: error.message,
            });
            appliedOrderSet.createdOrders.radiologyTests.push({
                status: AppliedOrderSet.ORDER_STATUS.FAILED,
                error: error.message,
            });
        }
    }

    // 5c. Create Prescription (single prescription with all medications)
    if (orderSet.medications && orderSet.medications.length > 0) {
        try {
            const medicines = orderSet.medications
                .filter(med => {
                    // Skip duplicates unless overridden
                    const isDuplicate = safetyChecks.duplicateOrderWarnings.some(
                        w => w.orderType === 'medication' && w.itemId?.toString() === med.medicine._id?.toString()
                    );
                    return !isDuplicate || overrides.skipDuplicates?.includes(med.medicine._id?.toString());
                })
                .map(med => ({
                    medicine: med.medicine._id || med.medicine,
                    dosage: med.dosage,
                    frequency: med.frequency,
                    duration: med.duration || 'As directed',
                    instructions: med.instructions || '',
                    quantity: 1, // Default quantity
                }));

            if (medicines.length > 0) {
                const prescription = new Prescription({
                    patient: patientId,
                    visit: emergencyId,
                    visitModel: 'Emergency',
                    doctor: appliedBy._id || appliedBy,
                    medicines,
                    specialInstructions: `Applied from Order Set: ${orderSet.name}`,
                });
                await prescription.save();

                results.prescriptions.push(prescription);
                appliedOrderSet.createdOrders.prescriptions.push({
                    order: prescription._id,
                    status: AppliedOrderSet.ORDER_STATUS.CREATED,
                });
            }
        } catch (error) {
            results.errors.push({
                orderType: 'prescription',
                itemName: 'Prescription',
                error: error.message,
            });
            appliedOrderSet.createdOrders.prescriptions.push({
                status: AppliedOrderSet.ORDER_STATUS.FAILED,
                error: error.message,
            });
        }
    }

    // 6. Update applied order set status
    appliedOrderSet.errors = results.errors;
    if (results.errors.length === 0) {
        appliedOrderSet.status = AppliedOrderSet.APPLICATION_STATUS.COMPLETED;
    } else if (results.labTests.length > 0 || results.radiologyTests.length > 0 || results.prescriptions.length > 0) {
        appliedOrderSet.status = AppliedOrderSet.APPLICATION_STATUS.PARTIAL;
    } else {
        appliedOrderSet.status = AppliedOrderSet.APPLICATION_STATUS.FAILED;
    }
    appliedOrderSet.completedAt = new Date();
    appliedOrderSet.auditCompleted = true;
    await appliedOrderSet.save();

    // 7. Create Audit Log
    await AuditLog.create({
        user: appliedBy._id || appliedBy,
        action: 'create',
        entity: 'AppliedOrderSet',
        entityId: appliedOrderSet._id,
        description: `Applied order set "${orderSet.name}" to patient ${patient.patientId}`,
        metadata: {
            orderSetId: orderSet._id,
            orderSetName: orderSet.name,
            patientId: patient.patientId,
            emergencyId: emergency.emergencyNumber,
            createdLabTests: results.labTests.length,
            createdRadiologyTests: results.radiologyTests.length,
            createdPrescriptions: results.prescriptions.length,
            hasOverrides: overrides.confirmed || false,
            overrideReason: overrides.reason || null,
        },
    });

    // 8. Return results
    return {
        success: true,
        appliedOrderSet: appliedOrderSet._id,
        appliedNumber: appliedOrderSet.appliedNumber,
        createdOrders: {
            labTests: results.labTests.map(l => ({ _id: l._id, testNumber: l.testNumber })),
            radiologyTests: results.radiologyTests.map(r => ({ _id: r._id, testNumber: r.testNumber })),
            prescriptions: results.prescriptions.map(p => ({ _id: p._id, prescriptionNumber: p.prescriptionNumber })),
        },
        errors: results.errors,
        status: appliedOrderSet.status,
    };
};

/**
 * Get applied order sets for an emergency
 */
const getAppliedOrderSets = async (emergencyId) => {
    return AppliedOrderSet.find({ emergency: emergencyId })
        .populate('orderSet', 'orderSetCode name type')
        .populate('appliedBy', 'profile.firstName profile.lastName')
        .populate('createdOrders.labTests.order', 'testNumber status')
        .populate('createdOrders.radiologyTests.order', 'testNumber status')
        .populate('createdOrders.prescriptions.order', 'prescriptionNumber isDispensed')
        .sort({ appliedAt: -1 });
};

/**
 * Get applied order set by ID
 */
const getAppliedOrderSetById = async (id) => {
    return AppliedOrderSet.findById(id)
        .populate('orderSet')
        .populate('patient', 'patientId firstName lastName')
        .populate('emergency', 'emergencyNumber triageLevel')
        .populate('appliedBy', 'profile.firstName profile.lastName')
        .populate('createdOrders.labTests.order')
        .populate('createdOrders.radiologyTests.order')
        .populate('createdOrders.prescriptions.order');
};

/**
 * Create a new order set (admin only)
 */
const createOrderSet = async (orderSetData, createdBy) => {
    const orderSet = new OrderSet({
        ...orderSetData,
        createdBy: createdBy._id || createdBy,
    });
    await orderSet.save();
    return orderSet;
};

/**
 * Update an order set (creates new version)
 */
const updateOrderSet = async (id, updateData, updatedBy) => {
    const orderSet = await OrderSet.findById(id);
    if (!orderSet) {
        throw new Error('Order set not found');
    }

    // Update fields
    Object.assign(orderSet, updateData);
    orderSet.version += 1;

    await orderSet.save();

    // Create audit log
    await AuditLog.create({
        user: updatedBy._id || updatedBy,
        action: 'update',
        entity: 'OrderSet',
        entityId: orderSet._id,
        description: `Updated order set "${orderSet.name}" to version ${orderSet.version}`,
    });

    return orderSet;
};

/**
 * Deactivate an order set (soft delete)
 */
const deactivateOrderSet = async (id, deactivatedBy) => {
    const orderSet = await OrderSet.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
    );

    if (orderSet) {
        await AuditLog.create({
            user: deactivatedBy._id || deactivatedBy,
            action: 'delete',
            entity: 'OrderSet',
            entityId: orderSet._id,
            description: `Deactivated order set "${orderSet.name}"`,
        });
    }

    return orderSet;
};

module.exports = {
    getAllOrderSets,
    getOrderSetById,
    getOrderSetsByType,
    previewOrderSet,
    applyOrderSetToPatient,
    getAppliedOrderSets,
    getAppliedOrderSetById,
    createOrderSet,
    updateOrderSet,
    deactivateOrderSet,
};
