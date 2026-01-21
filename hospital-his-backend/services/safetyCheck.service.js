/**
 * Safety Check Service
 * Handles allergy checking, drug-drug interactions, and duplicate order detection
 */

const Patient = require('../models/Patient');
const Medicine = require('../models/Medicine');
const DrugInteraction = require('../models/DrugInteraction');
const LabTest = require('../models/LabTest');
const Radiology = require('../models/Radiology');
const Prescription = require('../models/Prescription');

/**
 * Check patient allergies against a list of medicines
 * @param {ObjectId} patientId - Patient ID
 * @param {Array} medicines - Array of medicine objects with medicine ID
 * @returns {Array} Array of allergy warnings
 */
const checkAllergies = async (patientId, medicines) => {
    const patient = await Patient.findById(patientId).lean();
    if (!patient) {
        throw new Error('Patient not found');
    }

    const warnings = [];

    // Get all patient allergies (both simple and structured)
    const allergens = [];

    // Add simple allergies (lowercase for comparison)
    if (patient.allergies && patient.allergies.length > 0) {
        allergens.push(...patient.allergies.map(a => a.toLowerCase()));
    }

    // Add structured allergy alerts
    if (patient.allergyAlerts && patient.allergyAlerts.length > 0) {
        patient.allergyAlerts
            .filter(a => a.isActive)
            .forEach(a => {
                allergens.push({
                    name: a.allergen.toLowerCase(),
                    severity: a.severity,
                    reaction: a.reaction,
                    type: a.allergenType,
                });
            });
    }

    // Check each medicine against allergies
    for (const med of medicines) {
        const medicine = await Medicine.findById(med.medicine || med).lean();
        if (!medicine) continue;

        const medicineName = medicine.name?.toLowerCase() || '';
        const genericName = medicine.genericName?.toLowerCase() || '';
        const category = medicine.category?.toLowerCase() || '';

        for (const allergen of allergens) {
            const allergenName = typeof allergen === 'string' ? allergen : allergen.name;

            // Check if medicine name, generic name, or category matches allergen
            if (
                medicineName.includes(allergenName) ||
                genericName.includes(allergenName) ||
                allergenName.includes(medicineName) ||
                allergenName.includes(genericName) ||
                category.includes(allergenName)
            ) {
                warnings.push({
                    allergen: typeof allergen === 'string' ? allergen : allergen.name,
                    severity: typeof allergen === 'string' ? 'moderate' : allergen.severity,
                    reaction: typeof allergen === 'string' ? null : allergen.reaction,
                    medicine: medicine._id,
                    medicineName: medicine.name,
                    genericName: medicine.genericName,
                });
            }
        }
    }

    return warnings;
};

/**
 * Check for drug-drug interactions
 * @param {Array} newMedicines - Array of new medicine IDs to prescribe
 * @param {ObjectId} patientId - Patient ID to check existing prescriptions
 * @returns {Array} Array of interaction warnings
 */
const checkDrugInteractions = async (newMedicines, patientId) => {
    const warnings = [];
    const medicineIds = newMedicines.map(m => m.medicine || m);

    // Get existing active prescriptions for the patient
    const existingPrescriptions = await Prescription.find({
        patient: patientId,
        isDispensed: false,
    }).populate('medicines.medicine', 'name genericName');

    // Collect all existing medicine IDs
    const existingMedicineIds = [];
    existingPrescriptions.forEach(rx => {
        rx.medicines.forEach(m => {
            if (m.medicine) {
                existingMedicineIds.push(m.medicine._id);
            }
        });
    });

    // Combine new and existing medicines
    const allMedicineIds = [...medicineIds, ...existingMedicineIds];

    // Check interactions between new medicines
    const newMedicineInteractions = await DrugInteraction.checkMultipleMedicines(medicineIds);
    for (const interaction of newMedicineInteractions) {
        warnings.push({
            drug1: interaction.drug1._id,
            drug1Name: interaction.drug1.name,
            drug2: interaction.drug2._id,
            drug2Name: interaction.drug2.name,
            severity: interaction.severity,
            interactionType: interaction.interactionType,
            description: interaction.description,
            recommendation: interaction.recommendation,
            source: 'new-order',
        });
    }

    // Check interactions between new medicines and existing prescriptions
    for (const newMedId of medicineIds) {
        for (const existingMedId of existingMedicineIds) {
            const interaction = await DrugInteraction.checkInteraction(newMedId, existingMedId);
            if (interaction) {
                warnings.push({
                    drug1: interaction.drug1._id,
                    drug1Name: interaction.drug1.name,
                    drug2: interaction.drug2._id,
                    drug2Name: interaction.drug2.name,
                    severity: interaction.severity,
                    interactionType: interaction.interactionType,
                    description: interaction.description,
                    recommendation: interaction.recommendation,
                    source: 'existing-prescription',
                });
            }
        }
    }

    return warnings;
};

/**
 * Check for duplicate orders
 * @param {ObjectId} patientId - Patient ID
 * @param {ObjectId} emergencyId - Emergency ID (optional)
 * @param {Object} orderSet - Order set with labTests, radiologyTests, medications
 * @returns {Array} Array of duplicate warnings
 */
const checkDuplicateOrders = async (patientId, emergencyId, orderSet) => {
    const warnings = [];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check duplicate lab orders
    if (orderSet.labTests && orderSet.labTests.length > 0) {
        for (const labTest of orderSet.labTests) {
            const existingLab = await LabTest.findOne({
                patient: patientId,
                test: labTest.test,
                status: { $in: ['ordered', 'sample-collected', 'in-progress'] },
                createdAt: { $gte: twentyFourHoursAgo },
            }).populate('test', 'testName testCode');

            if (existingLab) {
                warnings.push({
                    orderType: 'lab',
                    existingOrderId: existingLab._id,
                    existingOrderNumber: existingLab.testNumber,
                    itemName: existingLab.test?.testName || 'Lab Test',
                    itemId: labTest.test,
                    createdAt: existingLab.createdAt,
                });
            }
        }
    }

    // Check duplicate radiology orders
    if (orderSet.radiologyTests && orderSet.radiologyTests.length > 0) {
        for (const radTest of orderSet.radiologyTests) {
            const existingRad = await Radiology.findOne({
                patient: patientId,
                test: radTest.test,
                status: { $in: ['ordered', 'scheduled', 'in-progress'] },
                createdAt: { $gte: twentyFourHoursAgo },
            }).populate('test', 'testName testCode');

            if (existingRad) {
                warnings.push({
                    orderType: 'radiology',
                    existingOrderId: existingRad._id,
                    existingOrderNumber: existingRad.testNumber,
                    itemName: existingRad.test?.testName || 'Radiology Test',
                    itemId: radTest.test,
                    createdAt: existingRad.createdAt,
                });
            }
        }
    }

    // Check duplicate medication orders (active prescriptions with same medicine)
    if (orderSet.medications && orderSet.medications.length > 0) {
        for (const med of orderSet.medications) {
            const existingRx = await Prescription.findOne({
                patient: patientId,
                'medicines.medicine': med.medicine,
                isDispensed: false,
                createdAt: { $gte: twentyFourHoursAgo },
            }).populate('medicines.medicine', 'name');

            if (existingRx) {
                const matchingMed = existingRx.medicines.find(
                    m => m.medicine._id.toString() === med.medicine.toString()
                );
                warnings.push({
                    orderType: 'medication',
                    existingOrderId: existingRx._id,
                    existingOrderNumber: existingRx.prescriptionNumber,
                    itemName: matchingMed?.medicine?.name || 'Medication',
                    itemId: med.medicine,
                    createdAt: existingRx.createdAt,
                });
            }
        }
    }

    return warnings;
};

/**
 * Run all safety checks for an order set
 * @param {ObjectId} patientId - Patient ID
 * @param {ObjectId} emergencyId - Emergency ID
 * @param {Object} orderSet - Full order set object
 * @returns {Object} All safety warnings
 */
const runFullSafetyCheck = async (patientId, emergencyId, orderSet) => {
    const result = {
        hasWarnings: false,
        hasCriticalWarnings: false,
        allergyWarnings: [],
        drugInteractionWarnings: [],
        duplicateOrderWarnings: [],
    };

    // Check allergies
    if (orderSet.medications && orderSet.medications.length > 0) {
        result.allergyWarnings = await checkAllergies(patientId, orderSet.medications);
    }

    // Check drug interactions
    if (orderSet.medications && orderSet.medications.length > 0) {
        result.drugInteractionWarnings = await checkDrugInteractions(
            orderSet.medications,
            patientId
        );
    }

    // Check duplicate orders
    result.duplicateOrderWarnings = await checkDuplicateOrders(patientId, emergencyId, orderSet);

    // Determine if there are any warnings
    result.hasWarnings =
        result.allergyWarnings.length > 0 ||
        result.drugInteractionWarnings.length > 0 ||
        result.duplicateOrderWarnings.length > 0;

    // Check for critical warnings (life-threatening allergies or critical interactions)
    result.hasCriticalWarnings =
        result.allergyWarnings.some(w => w.severity === 'life-threatening' || w.severity === 'severe') ||
        result.drugInteractionWarnings.some(w => w.severity === 'critical');

    return result;
};

/**
 * Validate if a user has override authority for safety warnings
 * @param {Object} user - User object with role
 * @param {String} warningType - Type of warning being overridden
 * @returns {Boolean} Whether user can override
 */
const validateOverrideAuthority = (user, warningType) => {
    const overrideRoles = ['doctor', 'admin'];
    const criticalOverrideRoles = ['doctor', 'admin']; // Senior doctors only for critical

    if (!user || !user.role) return false;

    if (warningType === 'critical') {
        return criticalOverrideRoles.includes(user.role);
    }

    return overrideRoles.includes(user.role);
};

module.exports = {
    checkAllergies,
    checkDrugInteractions,
    checkDuplicateOrders,
    runFullSafetyCheck,
    validateOverrideAuthority,
};
