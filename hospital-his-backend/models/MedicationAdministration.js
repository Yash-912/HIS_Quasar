const mongoose = require('mongoose');

/**
 * MedicationAdministration Model (MAR - Medication Administration Record)
 * 
 * Tracks the actual administration of medications to inpatients by nurses.
 * This is the final step in the medication workflow:
 * Prescription → Dispense → MAR Administration
 * 
 * CRITICAL FOR:
 * - Patient safety (correct drug, dose, route, time)
 * - Medication error investigation
 * - Drug recall backtracking
 * - Nursing workflow
 * - Legal compliance
 */

const MED_ROUTES = ['oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'sublingual', 'rectal', 'nasal', 'ophthalmic', 'otic', 'other'];
const MAR_STATUS = ['scheduled', 'given', 'held', 'refused', 'missed', 'self-administered'];

const medicationAdministrationSchema = new mongoose.Schema(
    {
        // MAR identification
        marNumber: {
            type: String,
            unique: true,
        },

        // Patient context
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: [true, 'Patient is required'],
        },
        admission: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admission',
            required: [true, 'Admission is required for MAR'],
        },

        // Link to dispense record
        dispenseItem: {
            dispenseRef: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'PharmacyDispense',
            },
            itemIndex: Number, // Index in dispense.items array
        },

        // Medication details (denormalized for quick access)
        medicine: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Medicine',
            required: true,
        },
        medicineName: String, // Cached for quick display

        // Batch traceability (CRITICAL for recalls)
        batch: {
            batchNumber: {
                type: String,
                required: true,
            },
            inventoryRef: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'PharmacyInventory',
            },
            expiryDate: Date,
        },

        // Scheduling
        scheduledTime: {
            type: Date,
            required: true,
        },
        dueWindow: {
            early: Date, // 30 min before scheduled
            late: Date,  // 30 min after scheduled
        },

        // Administration details
        administeredTime: Date,
        status: {
            type: String,
            enum: MAR_STATUS,
            default: 'scheduled',
        },

        // Dose details
        dose: {
            type: String,
            required: true,
            // e.g., "500mg", "10ml", "2 tablets"
        },
        route: {
            type: String,
            enum: MED_ROUTES,
            required: true,
        },
        site: String, // e.g., "left deltoid" for IM injections

        // Nursing workflow
        administeredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        witnessedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            // Required for controlled substances
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            // Double-check for high-risk medications
        },

        // Notes
        notes: {
            type: String,
            trim: true,
        },

        // Hold/Refusal details
        holdReason: {
            type: String,
            enum: ['npo', 'patient_not_available', 'vital_signs', 'lab_values', 'doctor_order', 'other'],
        },
        holdDetails: String,
        refusalReason: String,

        // Safety checks (re-verified before administration)
        safetyChecks: {
            interactionChecked: {
                type: Boolean,
                default: false,
            },
            allergyChecked: {
                type: Boolean,
                default: false,
            },
            recallChecked: {
                type: Boolean,
                default: false,
            },
            checkedAt: Date,
            checkedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        },

        // Safety override (if interaction warning was overridden)
        safetyOverride: {
            required: {
                type: Boolean,
                default: false,
            },
            approvedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
            reason: String,
            approvedAt: Date,
        },

        // Vitals at time of administration (optional)
        vitalsAtAdmin: {
            bloodPressure: String,
            pulse: Number,
            respiratoryRate: Number,
            temperature: Number,
            oxygenSaturation: Number,
        },

        // For PRN (as needed) medications
        isPRN: {
            type: Boolean,
            default: false,
        },
        prnReason: String,
        effectivenessCheck: {
            checkedAt: Date,
            checkedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
            effective: Boolean,
            notes: String,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
medicationAdministrationSchema.index({ marNumber: 1 });
medicationAdministrationSchema.index({ patient: 1, admission: 1 });
medicationAdministrationSchema.index({ scheduledTime: 1 });
medicationAdministrationSchema.index({ status: 1 });
medicationAdministrationSchema.index({ administeredBy: 1 });
medicationAdministrationSchema.index({ 'batch.batchNumber': 1 });
medicationAdministrationSchema.index({ medicine: 1 });

// Compound index for finding due medications
medicationAdministrationSchema.index({
    admission: 1,
    status: 1,
    scheduledTime: 1
});

// Auto-generate marNumber
medicationAdministrationSchema.pre('save', async function (next) {
    if (this.isNew && !this.marNumber) {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const count = await mongoose.model('MedicationAdministration').countDocuments();
        this.marNumber = `MAR${dateStr}${String(count + 1).padStart(6, '0')}`;

        // Set due window (default ±30 minutes)
        if (this.scheduledTime) {
            this.dueWindow = {
                early: new Date(this.scheduledTime.getTime() - 30 * 60 * 1000),
                late: new Date(this.scheduledTime.getTime() + 30 * 60 * 1000),
            };
        }
    }
    next();
});

/**
 * Static method to get MAR schedule for an admission.
 */
medicationAdministrationSchema.statics.getScheduleForAdmission = async function (admissionId, options = {}) {
    const { date, status } = options;

    const query = { admission: admissionId };

    if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        query.scheduledTime = { $gte: startOfDay, $lte: endOfDay };
    }

    if (status) {
        query.status = status;
    }

    return this.find(query)
        .populate('medicine', 'name genericName form strength')
        .populate('administeredBy', 'profile.firstName profile.lastName')
        .sort({ scheduledTime: 1 });
};

/**
 * Static method to get overdue medications.
 */
medicationAdministrationSchema.statics.getOverdueMedications = async function (admissionId) {
    const now = new Date();
    return this.find({
        admission: admissionId,
        status: 'scheduled',
        'dueWindow.late': { $lt: now },
    })
        .populate('medicine', 'name genericName')
        .sort({ scheduledTime: 1 });
};

const MedicationAdministration = mongoose.model('MedicationAdministration', medicationAdministrationSchema);

module.exports = MedicationAdministration;
