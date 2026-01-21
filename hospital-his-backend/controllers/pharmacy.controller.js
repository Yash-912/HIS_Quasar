const PharmacyInventory = require('../models/PharmacyInventory');
const Medicine = require('../models/Medicine');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription'); // Add Prescription model
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { APPOINTMENT_STATUS, INVENTORY_STATUS } = require('../config/constants');

/**
 * @desc    Get Pending Prescriptions Queue (Aggregates Appointments and Emergency Prescriptions)
 * @route   GET /api/pharmacy/queue
 */
exports.getPendingQueue = asyncHandler(async (req, res, next) => {
    // 1. Fetch Appointments with pending pharmacy status
    const pendingAppointments = await Appointment.find({
        status: APPOINTMENT_STATUS.COMPLETED,
        prescription: { $exists: true, $not: { $size: 0 } },
        // Check if NOT already cleared (though status should be PHARMACY_CLEARED if so)
    })
        .populate('patient', 'firstName lastName patientId gender age')
        .populate('doctor', 'profile.firstName profile.lastName')
        .sort({ updatedAt: -1 });

    // 2. Fetch Standalone Prescriptions (Emergency / IPD)
    const pendingPrescriptions = await Prescription.find({
        isDispensed: false
    })
        .populate('patient', 'firstName lastName patientId gender age')
        .populate('doctor', 'profile.firstName profile.lastName')
        .populate('medicines.medicine', 'name genericName') // Add population for medicine details
        .sort({ createdAt: -1 });

    // 3. Normalize Data Structure for Frontend
    const queue = [];

    // Map Appointments
    pendingAppointments.forEach(appt => {
        queue.push({
            _id: appt._id,
            sourceType: 'appointment',
            tokenNumber: appt.tokenNumber || 'OPD',
            patient: appt.patient,
            doctor: appt.doctor,
            updatedAt: appt.updatedAt,
            prescription: appt.prescription, // Array of medicines
            diagnosis: appt.diagnosis
        });
    });

    // Map Prescriptions
    pendingPrescriptions.forEach(rx => {
        queue.push({
            _id: rx._id,
            sourceType: 'prescription',
            tokenNumber: rx.prescriptionNumber || 'RX',
            patient: rx.patient,
            doctor: rx.doctor,
            updatedAt: rx.createdAt,
            prescription: rx.medicines.map(m => ({ // Map to match frontend expectations
                name: m.medicine.name || 'Unknown Medicine', // Need populate in query if deep
                dosage: m.dosage,
                frequency: m.frequency,
                duration: m.duration,
                quantity: m.quantity
            })),
            diagnosis: rx.specialInstructions // Use special instructions as diagnosis/notes
        });
    });

    // Sort combined queue by date
    queue.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.status(200).json({
        success: true,
        count: queue.length,
        data: queue
    });
});

/**
 * @desc    Get all pharmacy inventory items (Batches)
 * @route   GET /api/pharmacy/inventory
 */
exports.getInventory = asyncHandler(async (req, res, next) => {
    const { search } = req.query;
    let query = {};

    // If search term is provided, find matching medicines first
    if (search) {
        const matchingMedicines = await Medicine.find({
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { genericName: { $regex: search, $options: 'i' } },
                { medicineCode: { $regex: search, $options: 'i' } }
            ]
        }).select('_id');

        const medicineIds = matchingMedicines.map(m => m._id);
        query.medicine = { $in: medicineIds };
    }

    const inventory = await PharmacyInventory.find(query)
        .populate('medicine', 'name genericName category form strength unit')
        .sort({ expiryDate: 1 }); // Show expiring first

    res.status(200).json({
        success: true,
        count: inventory.length,
        data: inventory,
    });
});

/**
 * @desc    Add stock (Create Medicine if new, then add Inventory Batch)
 * @route   POST /api/pharmacy/inventory
 */
exports.addMedicine = asyncHandler(async (req, res, next) => {
    const {
        // Medicine Master Fields
        name, genericName, category, form, strength, unit, mrp, manufacturer, medicineCode,
        // Inventory Batch Fields
        batchNumber, expiryDate, quantity, purchaseRate, sellingRate, supplier, invoiceNumber
    } = req.body;

    // 1. Find or Create Medicine Master
    // Use medicineCode if available for precise match, otherwise Name
    let medicine;

    if (medicineCode) {
        medicine = await Medicine.findOne({ medicineCode });
    } else {
        medicine = await Medicine.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    }

    if (!medicine) {
        // Create new Medicine Master
        // Use 'category' from frontend as 'form' (lowercase) and 'category' fields
        const formValue = (category || 'tablet').toLowerCase();
        medicine = await Medicine.create({
            name,
            genericName,
            category: category || 'General',
            form: formValue,
            strength,
            unit,
            mrp: mrp || sellingRate, // Use sellingRate if mrp not provided
            manufacturer,
            medicineCode: medicineCode || `MED-${Date.now()}`, // Auto-generate if not provided
            sellingPrice: sellingRate // Default selling price from this batch
        });
    }

    // 2. Create Inventory Batch
    const inventoryItem = await PharmacyInventory.create({
        medicine: medicine._id,
        batchNumber,
        expiryDate,
        quantity,
        purchaseRate,
        sellingRate,
        supplier,
        invoiceNumber,
        status: INVENTORY_STATUS.AVAILABLE
    });

    res.status(201).json({
        success: true,
        data: inventoryItem,
        medicine: medicine
    });
});

/**
 * @desc    Dispense Medicines (Deduct Stock using FEFO)
 * @route   POST /api/pharmacy/dispense
 */
exports.dispenseMedicines = asyncHandler(async (req, res, next) => {
    const { appointmentId, prescriptionId } = req.body;

    let appointment, prescriptionDoc;
    let medicines = [];
    let patientId;
    let visitId;

    // Handle Appointment-based Dispensing (OPD)
    if (appointmentId) {
        appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }
        if (appointment.status === APPOINTMENT_STATUS.PHARMACY_CLEARED) {
            return next(new ErrorResponse('Medicines already dispensed', 400));
        }
        medicines = appointment.prescription;
        patientId = appointment.patient;
        visitId = appointment._id;
    }
    // Handle Standalone Prescription Dispensing (Emergency/IPD)
    else if (prescriptionId) {
        prescriptionDoc = await Prescription.findById(prescriptionId).populate('medicines.medicine');
        if (!prescriptionDoc) {
            return next(new ErrorResponse('Prescription not found', 404));
        }
        if (prescriptionDoc.isDispensed) {
            return next(new ErrorResponse('Medicines already dispensed', 400));
        }
        // Map to flat structure for processing
        medicines = prescriptionDoc.medicines.map(m => ({
            name: m.medicine.name, // Use populated name
            dosage: m.dosage,
            frequency: m.frequency,
            quantity: m.quantity, // Prioritize quantity if available
            duration: m.duration
        }));
        patientId = prescriptionDoc.patient;
        visitId = prescriptionDoc.visit;
    } else {
        return next(new ErrorResponse('Appointment ID or Prescription ID required', 400));
    }


    const dispenseLog = [];
    const errors = [];

    // Billing Integration
    const billingItems = [];

    // Process each prescribed medicine
    for (const med of medicines) {
        // Find Medicine ID by name
        const medicineMaster = await Medicine.findOne({ name: { $regex: new RegExp(`^${med.name}$`, 'i') } });

        if (!medicineMaster) {
            errors.push(`${med.name}: Medicine not found in master records`);
            continue;
        }

        // Calculate Quantity (Logic needs improvement, defaulting to 1 strip/unit for prototype)
        // Ideally parse 'duration' * 'frequency'
        let quantityToDispense = 1; // Placeholder quantity

        // Find Batches for this medicine, sorted by Expiry Date (FEFO)
        const batches = await PharmacyInventory.find({
            medicine: medicineMaster._id,
            status: { $in: [INVENTORY_STATUS.AVAILABLE, INVENTORY_STATUS.LOW_STOCK] },
            quantity: { $gt: 0 }
        }).sort({ expiryDate: 1 });

        if (batches.length === 0) {
            errors.push(`${med.name}: Out of Stock`);
            continue;
        }

        let remainingToDispense = quantityToDispense;

        for (const batch of batches) {
            if (remainingToDispense <= 0) break;

            if (batch.quantity >= remainingToDispense) {
                // Batch has enough
                batch.quantity -= remainingToDispense;
                remainingToDispense = 0;
            } else {
                // Batch has partial
                remainingToDispense -= batch.quantity;
                batch.quantity = 0;
                batch.status = INVENTORY_STATUS.OUT_OF_STOCK;
            }

            // Update Status if low/out
            if (batch.quantity === 0) batch.status = INVENTORY_STATUS.OUT_OF_STOCK;
            else if (batch.quantity < 10) batch.status = INVENTORY_STATUS.LOW_STOCK;

            await batch.save();
        }

        if (remainingToDispense > 0) {
            errors.push(`${med.name}: Insufficient Stock (Short by ${remainingToDispense})`);
        } else {
            dispenseLog.push({ name: med.name, status: 'Dispensed' });
            // Add to billing list
            billingItems.push({
                itemType: 'medicine',
                itemReference: medicineMaster._id,
                description: `Pharmacy: ${medicineMaster.name} (${medicineMaster.strength || ''} ${medicineMaster.unit || ''})`,
                quantity: quantityToDispense,
                rate: medicineMaster.sellingPrice || medicineMaster.mrp || 0
            });
        }
    }

    // Only update appointment if at least one item was dispensed or we decide to allow partial
    // For now, mark cleared if no critical blocking errors? 
    // Let's mark cleared regardless for Prototype, but return errors.

    // Finalize Status Update
    if (appointment) {
        appointment.status = APPOINTMENT_STATUS.PHARMACY_CLEARED;
        await appointment.save();
    } else if (prescriptionDoc) {
        prescriptionDoc.isDispensed = true;
        prescriptionDoc.dispensedBy = req.user.id;
        prescriptionDoc.dispensedAt = new Date();
        await prescriptionDoc.save();
    }

    // Trigger Automated Billing
    if (billingItems.length > 0) {
        try {
            const { addItemToBill } = require('../services/billing.internal.service');
            for (const item of billingItems) {
                await addItemToBill({
                    patientId: patientId,
                    visitId: visitId,
                    visitType: appointment ? 'opd' : 'emergency', // Infer type
                    itemType: item.itemType,
                    itemReference: item.itemReference,
                    description: item.description,
                    quantity: item.quantity,
                    rate: item.rate,
                    generatedBy: req.user.id
                });
            }
        } catch (err) {
            console.error('Failed to trigger pharmacy billing:', err);
        }
    }


    res.status(200).json({
        success: true,
        message: 'Prescription processed',
        details: dispenseLog,
        errors: errors.length > 0 ? errors : null,
        data: appointment
    });
});
