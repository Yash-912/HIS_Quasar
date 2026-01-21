const mongoose = require('mongoose');

/**
 * AppliedOrderSet Model
 * Tracks when an order set is applied to a patient in emergency
 * Includes execution status, created orders, and safety overrides
 */

const APPLICATION_STATUS = {
    PENDING: 'pending',
    EXECUTING: 'executing',
    COMPLETED: 'completed',
    PARTIAL: 'partial',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
};

const ORDER_STATUS = {
    PENDING: 'pending',
    CREATED: 'created',
    FAILED: 'failed',
    SKIPPED: 'skipped',
};

const appliedOrderSetSchema = new mongoose.Schema(
    {
        appliedNumber: {
            type: String,
            unique: true,
            required: true,
        },

        // Reference to original order set
        orderSet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OrderSet',
            required: [true, 'Order set reference is required'],
        },
        orderSetVersion: {
            type: Number,
            required: true,
        },
        // Full snapshot of order set at application time (for audit trail)
        orderSetSnapshot: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },

        // Patient and visit context
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: [true, 'Patient is required'],
        },
        emergency: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Emergency',
            required: [true, 'Emergency reference is required'],
        },

        // Who applied it
        appliedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Applied by user is required'],
        },
        appliedAt: {
            type: Date,
            default: Date.now,
        },

        // Execution status
        status: {
            type: String,
            enum: Object.values(APPLICATION_STATUS),
            default: APPLICATION_STATUS.PENDING,
        },

        // Created orders tracking
        createdOrders: {
            labTests: [{
                order: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'LabTest',
                },
                status: {
                    type: String,
                    enum: Object.values(ORDER_STATUS),
                    default: ORDER_STATUS.PENDING,
                },
                error: String,
            }],
            radiologyTests: [{
                order: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Radiology',
                },
                status: {
                    type: String,
                    enum: Object.values(ORDER_STATUS),
                    default: ORDER_STATUS.PENDING,
                },
                error: String,
            }],
            prescriptions: [{
                order: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Prescription',
                },
                status: {
                    type: String,
                    enum: Object.values(ORDER_STATUS),
                    default: ORDER_STATUS.PENDING,
                },
                error: String,
            }],
        },

        // Safety checks tracking
        safetyChecks: {
            allergyWarnings: [{
                allergen: { type: String, required: true },
                severity: { type: String, enum: ['mild', 'moderate', 'severe', 'life-threatening'] },
                medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
                medicineName: String,
                overridden: { type: Boolean, default: false },
                overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                overrideReason: String,
                overriddenAt: Date,
            }],
            drugInteractionWarnings: [{
                drug1: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
                drug1Name: String,
                drug2: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
                drug2Name: String,
                severity: { type: String, enum: ['critical', 'major', 'moderate', 'minor'] },
                description: String,
                recommendation: String,
                overridden: { type: Boolean, default: false },
                overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                overrideReason: String,
                overriddenAt: Date,
            }],
            duplicateOrderWarnings: [{
                orderType: { type: String, enum: ['lab', 'radiology', 'medication'] },
                existingOrderId: mongoose.Schema.Types.ObjectId,
                existingOrderNumber: String,
                itemName: String,
                overridden: { type: Boolean, default: false },
                overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                overrideReason: String,
            }],
        },

        // Any errors during execution
        errors: [{
            orderType: { type: String, enum: ['lab', 'radiology', 'prescription', 'billing', 'audit'] },
            itemName: String,
            error: String,
            timestamp: { type: Date, default: Date.now },
        }],

        // Completion tracking
        completedAt: Date,
        billingPrepared: {
            type: Boolean,
            default: false,
        },
        billingItemsCount: {
            type: Number,
            default: 0,
        },
        auditCompleted: {
            type: Boolean,
            default: false,
        },

        // Modification tracking
        modifications: [{
            type: { type: String, enum: ['removed', 'modified'] },
            orderType: { type: String, enum: ['lab', 'radiology', 'medication'] },
            itemId: mongoose.Schema.Types.ObjectId,
            itemName: String,
            originalValue: mongoose.Schema.Types.Mixed,
            newValue: mongoose.Schema.Types.Mixed,
            modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            modifiedAt: { type: Date, default: Date.now },
            reason: String,
        }],
    },
    {
        timestamps: true,
    }
);

// Indexes
appliedOrderSetSchema.index({ appliedNumber: 1 });
appliedOrderSetSchema.index({ patient: 1 });
appliedOrderSetSchema.index({ emergency: 1 });
appliedOrderSetSchema.index({ orderSet: 1 });
appliedOrderSetSchema.index({ status: 1 });
appliedOrderSetSchema.index({ appliedAt: -1 });
appliedOrderSetSchema.index({ appliedBy: 1 });

// Auto-generate appliedNumber before validation
appliedOrderSetSchema.pre('validate', async function (next) {
    if (this.isNew && !this.appliedNumber) {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const count = await mongoose.model('AppliedOrderSet').countDocuments({
            createdAt: {
                $gte: new Date(today.setHours(0, 0, 0, 0)),
                $lt: new Date(today.setHours(23, 59, 59, 999)),
            },
        });
        this.appliedNumber = `AOS${dateStr}${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

// Method to mark as completed
appliedOrderSetSchema.methods.markCompleted = function () {
    this.status = APPLICATION_STATUS.COMPLETED;
    this.completedAt = new Date();
    return this.save();
};

// Method to mark as partial (some orders failed)
appliedOrderSetSchema.methods.markPartial = function () {
    this.status = APPLICATION_STATUS.PARTIAL;
    this.completedAt = new Date();
    return this.save();
};

// Method to add error
appliedOrderSetSchema.methods.addError = function (orderType, itemName, error) {
    this.errors.push({ orderType, itemName, error, timestamp: new Date() });
    return this.save();
};

// Virtual to check if there are any warnings
appliedOrderSetSchema.virtual('hasWarnings').get(function () {
    return (
        this.safetyChecks.allergyWarnings.length > 0 ||
        this.safetyChecks.drugInteractionWarnings.length > 0 ||
        this.safetyChecks.duplicateOrderWarnings.length > 0
    );
});

// Virtual to get total created orders count
appliedOrderSetSchema.virtual('totalOrdersCount').get(function () {
    return (
        this.createdOrders.labTests.length +
        this.createdOrders.radiologyTests.length +
        this.createdOrders.prescriptions.length
    );
});

appliedOrderSetSchema.set('toJSON', { virtuals: true });
appliedOrderSetSchema.set('toObject', { virtuals: true });

const AppliedOrderSet = mongoose.model('AppliedOrderSet', appliedOrderSetSchema);

// Export constants
AppliedOrderSet.APPLICATION_STATUS = APPLICATION_STATUS;
AppliedOrderSet.ORDER_STATUS = ORDER_STATUS;

module.exports = AppliedOrderSet;
