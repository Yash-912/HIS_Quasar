const mongoose = require('mongoose');
const { DRAFT_PURCHASE_REQUEST_STATUS } = require('../config/constants');

/**
 * DraftPurchaseRequest Model
 * Represents AI-generated draft purchase requests for low-stock items
 * Created by the Agentic Reorder Workflow
 */

// Schema for items in the draft
const draftItemSchema = new mongoose.Schema({
    itemCode: {
        type: String,
        required: true,
        trim: true,
    },
    itemName: {
        type: String,
        required: true,
        trim: true,
    },
    uom: {
        type: String,
        required: true,
        trim: true,
    },
    availableStock: {
        type: Number,
        required: true,
        min: 0,
    },
    minLevel: {
        type: Number,
        required: true,
        min: 0,
    },
    targetLevel: {
        type: Number,
        required: true,
        min: 0,
    },
    recommendedOrderQty: {
        type: Number,
        required: true,
        min: 0,
    },
    unitCost: {
        type: Number,
        required: true,
        min: 0,
    },
    estimatedCost: {
        type: Number,
        required: true,
        min: 0,
    },
    urgencyScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    priority: {
        type: Number,
        min: 1,
        max: 5,
    },
    leadTimeDays: {
        type: Number,
        min: 0,
    },
    flags: [{
        type: String,
        enum: ['STOCKOUT', 'BELOW_MIN', 'HIGH_PRIORITY', 'LONG_LEAD_TIME'],
    }],
});

const draftPurchaseRequestSchema = new mongoose.Schema(
    {
        draftNumber: {
            type: String,
            unique: true,
            sparse: true, // Allows null/undefined during creation, required after save
        },
        status: {
            type: String,
            enum: Object.values(DRAFT_PURCHASE_REQUEST_STATUS),
            default: DRAFT_PURCHASE_REQUEST_STATUS.PENDING_APPROVAL,
        },
        policyCategory: {
            type: String,
            required: true,
            default: 'general_stores',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        budgetCap: {
            type: Number,
            required: true,
            min: 0,
        },
        totals: {
            totalCostAll: {
                type: Number,
                default: 0,
            },
            totalCostIncluded: {
                type: Number,
                default: 0,
            },
            itemsEvaluated: {
                type: Number,
                default: 0,
            },
            itemsIncluded: {
                type: Number,
                default: 0,
            },
            itemsDeferred: {
                type: Number,
                default: 0,
            },
        },
        withinBudgetItems: [draftItemSchema],
        deferredItems: [draftItemSchema],
        explanationText: {
            type: String,
            trim: true,
        },
        requiredApproverRole: {
            type: String,
            trim: true,
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        approvedAt: {
            type: Date,
        },
        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        rejectedAt: {
            type: Date,
        },
        rejectionReason: {
            type: String,
            trim: true,
        },
        convertedToPR: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PurchaseRequisition',
        },
        agentRunMetadata: {
            modelUsed: String,
            toolCallsCount: Number,
            executionTimeMs: Number,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
draftPurchaseRequestSchema.index({ draftNumber: 1 });
draftPurchaseRequestSchema.index({ status: 1 });
draftPurchaseRequestSchema.index({ policyCategory: 1 });
draftPurchaseRequestSchema.index({ createdBy: 1 });
draftPurchaseRequestSchema.index({ requiredApproverRole: 1 });
draftPurchaseRequestSchema.index({ createdAt: -1 });

// Auto-generate draft number before saving
draftPurchaseRequestSchema.pre('save', async function (next) {
    if (this.isNew && !this.draftNumber) {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const count = await mongoose.model('DraftPurchaseRequest').countDocuments();
        this.draftNumber = `DPR${dateStr}${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

const DraftPurchaseRequest = mongoose.model('DraftPurchaseRequest', draftPurchaseRequestSchema);

module.exports = DraftPurchaseRequest;
