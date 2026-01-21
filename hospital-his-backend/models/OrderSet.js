const mongoose = require('mongoose');

/**
 * OrderSet Model
 * Represents predefined order set templates (trauma, cardiac, stroke protocols)
 */

const ORDER_SET_TYPES = {
    TRAUMA: 'trauma',
    CARDIAC: 'cardiac',
    STROKE: 'stroke',
    SEPSIS: 'sepsis',
    RESPIRATORY: 'respiratory',
    PEDIATRIC: 'pediatric',
    CUSTOM: 'custom',
};

const PRIORITY_LEVELS = {
    STAT: 'stat',
    URGENT: 'urgent',
    ROUTINE: 'routine',
};

const MEDICATION_ROUTES = ['IV', 'IM', 'PO', 'SC', 'SL', 'Nebulizer', 'Topical', 'PR', 'Inhalation', 'Other'];

const orderSetSchema = new mongoose.Schema(
    {
        orderSetCode: {
            type: String,
            unique: true,
            required: [true, 'Order set code is required'],
            trim: true,
            uppercase: true,
        },
        name: {
            type: String,
            required: [true, 'Order set name is required'],
            trim: true,
        },
        type: {
            type: String,
            enum: Object.values(ORDER_SET_TYPES),
            required: [true, 'Order set type is required'],
        },
        description: {
            type: String,
            trim: true,
        },
        triageLevel: [{
            type: String,
            enum: ['critical', 'urgent', 'less-urgent', 'non-urgent'],
        }],
        
        // Lab tests to order
        labTests: [{
            test: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'LabTestMaster',
                required: true,
            },
            priority: {
                type: String,
                enum: Object.values(PRIORITY_LEVELS),
                default: PRIORITY_LEVELS.STAT,
            },
            notes: {
                type: String,
                trim: true,
            },
        }],
        
        // Radiology investigations
        radiologyTests: [{
            test: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'RadiologyMaster',
                required: true,
            },
            priority: {
                type: String,
                enum: Object.values(PRIORITY_LEVELS),
                default: PRIORITY_LEVELS.STAT,
            },
            notes: {
                type: String,
                trim: true,
            },
        }],
        
        // Medications to prescribe
        medications: [{
            medicine: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Medicine',
                required: true,
            },
            dosage: {
                type: String,
                required: true,
                trim: true,
            },
            route: {
                type: String,
                enum: MEDICATION_ROUTES,
                required: true,
            },
            frequency: {
                type: String,
                required: true,
                trim: true,
            },
            duration: {
                type: String,
                trim: true,
            },
            priority: {
                type: String,
                enum: Object.values(PRIORITY_LEVELS),
                default: PRIORITY_LEVELS.STAT,
            },
            instructions: {
                type: String,
                trim: true,
            },
        }],
        
        // Procedures/instructions
        procedures: [{
            name: {
                type: String,
                required: true,
                trim: true,
            },
            description: {
                type: String,
                trim: true,
            },
            priority: {
                type: String,
                enum: Object.values(PRIORITY_LEVELS),
                default: PRIORITY_LEVELS.URGENT,
            },
        }],
        
        nursingInstructions: [{ type: String, trim: true }],
        monitoringInstructions: [{ type: String, trim: true }],
        
        // Status and versioning
        isActive: {
            type: Boolean,
            default: true,
        },
        version: {
            type: Number,
            default: 1,
        },
        
        // Audit
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        approvedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
orderSetSchema.index({ orderSetCode: 1 });
orderSetSchema.index({ type: 1 });
orderSetSchema.index({ isActive: 1 });
orderSetSchema.index({ name: 'text', description: 'text' });

// Static method to get active order sets by type
orderSetSchema.statics.getActiveByType = function (type) {
    return this.find({ type, isActive: true })
        .populate('labTests.test', 'testName testCode category')
        .populate('radiologyTests.test', 'testName testCode modality')
        .populate('medications.medicine', 'name genericName form strength');
};

// Method to increment version
orderSetSchema.methods.incrementVersion = function () {
    this.version += 1;
    return this.save();
};

const OrderSet = mongoose.model('OrderSet', orderSetSchema);

// Export constants
OrderSet.ORDER_SET_TYPES = ORDER_SET_TYPES;
OrderSet.PRIORITY_LEVELS = PRIORITY_LEVELS;
OrderSet.MEDICATION_ROUTES = MEDICATION_ROUTES;

module.exports = OrderSet;
