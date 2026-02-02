const mongoose = require('mongoose');
const { PREAUTH_QUEUE_STATUS } = require('../config/constants');

/**
 * PreAuthQueue Model
 * Queue-gated access for insurance pre-authorization workflow
 * Auto-populated with clinical context from linked encounter
 */

const attachedDocumentSchema = new mongoose.Schema(
    {
        docType: {
            type: String,
            enum: ['lab_report', 'radiology_report', 'prescription', 'discharge_summary', 'doctor_note', 'investigation', 'other'],
            required: true,
        },
        docId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        docModel: {
            type: String,
            enum: ['LabTest', 'Radiology', 'Prescription', 'Admission', 'NursingNote', 'Other'],
            required: true,
        },
        filePath: {
            type: String,
        },
        exists: {
            type: Boolean,
            default: false,
        },
        description: {
            type: String,
        },
    },
    { _id: false }
);

const estimationBreakdownSchema = new mongoose.Schema(
    {
        component: {
            type: String,
            enum: ['bed_charges', 'procedure', 'surgery', 'consumables', 'lab', 'radiology', 'pharmacy', 'other'],
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        quantity: {
            type: Number,
            default: 1,
        },
        unitRate: {
            type: Number,
        },
    },
    { _id: false }
);

const auditEntrySchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        fieldsAccessed: [String],
        details: mongoose.Schema.Types.Mixed,
    },
    { _id: false }
);

const preAuthQueueSchema = new mongoose.Schema(
    {
        // Auto-generated case number
        caseNumber: {
            type: String,
            unique: true,
        },

        // ═══════════════════════════════════════════════════════════════════
        // MANUAL ENTRY FIELDS (Insurance staff fills only these)
        // ═══════════════════════════════════════════════════════════════════
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: [true, 'Patient is required'],
        },
        insurerName: {
            type: String,
            required: [true, 'Insurer name is required'],
            trim: true,
        },
        tpaName: {
            type: String,
            trim: true,
        },
        policyNumber: {
            type: String,
            trim: true,
        },

        // ═══════════════════════════════════════════════════════════════════
        // AUTO-POPULATED FIELDS (System fills from linked data)
        // ═══════════════════════════════════════════════════════════════════

        // Encounter reference
        latestEncounterId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'encounterModel',
        },
        encounterModel: {
            type: String,
            enum: ['Admission', 'Appointment', 'Emergency'],
        },

        // Treating doctor and department
        treatingDoctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
        },

        // Clinical context
        diagnosisSummary: {
            type: String,
            trim: true,
        },
        plannedProcedure: {
            type: String,
            trim: true,
        },
        clinicalJustificationSnippet: {
            type: String,
            trim: true,
        },

        // Attached documents (auto-discovered)
        attachedDocuments: [attachedDocumentSchema],

        // AI summaries pulled from existing records
        aiSummaries: {
            lab: { type: String },
            radiology: { type: String },
        },

        // ═══════════════════════════════════════════════════════════════════
        // ESTIMATED COST (Auto-computed)
        // ═══════════════════════════════════════════════════════════════════
        estimatedAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        estimationBreakdown: [estimationBreakdownSchema],
        estimationBasis: {
            type: String,
            enum: ['exact', 'estimated'],
            default: 'estimated',
        },

        // ═══════════════════════════════════════════════════════════════════
        // WORKFLOW FIELDS
        // ═══════════════════════════════════════════════════════════════════
        status: {
            type: String,
            enum: Object.values(PREAUTH_QUEUE_STATUS),
            default: PREAUTH_QUEUE_STATUS.DRAFT,
        },

        // Agent output (packet draft, checklist, warnings)
        agentOutput: {
            packetDraft: {
                patientIdentity: mongoose.Schema.Types.Mixed,
                insurerName: String,
                diagnosisSummary: String,
                plannedProcedure: String,
                clinicalJustification: String,
                estimatedAmount: Number,
                estimationBasis: String,
                treatingDoctor: String,
                department: String,
                encounterReference: String,
            },
            attachmentsChecklist: [{
                doc: String,
                exists: Boolean,
            }],
            riskWarnings: [String],
            nextActions: [String],
            generatedAt: Date,
            modelUsed: String,
        },

        // ═══════════════════════════════════════════════════════════════════
        // AUDIT & OWNERSHIP
        // ═══════════════════════════════════════════════════════════════════
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        auditTrail: [auditEntrySchema],
    },
    {
        timestamps: true,
    }
);

// Indexes
preAuthQueueSchema.index({ caseNumber: 1 });
preAuthQueueSchema.index({ patient: 1 });
preAuthQueueSchema.index({ status: 1 });
preAuthQueueSchema.index({ createdBy: 1 });
preAuthQueueSchema.index({ createdAt: -1 });

// Auto-generate caseNumber before saving
preAuthQueueSchema.pre('save', async function (next) {
    if (this.isNew && !this.caseNumber) {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const count = await mongoose.model('PreAuthQueue').countDocuments();
        this.caseNumber = `PAQ${dateStr}${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

const PreAuthQueue = mongoose.model('PreAuthQueue', preAuthQueueSchema);

module.exports = PreAuthQueue;
