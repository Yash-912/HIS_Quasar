const mongoose = require('mongoose');
const {
    LAB_REPORT_EXTRACTION_STATUS,
    LAB_REPORT_AI_STATUS,
} = require('../config/constants');

/**
 * LabReport Model
 * Represents externally uploaded PDF lab reports with AI summarization
 */
const labReportSchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: [true, 'Patient is required'],
        },
        type: {
            type: String,
            default: 'lab',
        },
        source: {
            type: String,
            default: 'pdf',
        },
        pdf: {
            url: {
                type: String,
            },
            fileName: {
                type: String,
            },
            uploadedAt: {
                type: Date,
            },
            extractedText: {
                type: String,
            },
            extractionStatus: {
                type: String,
                enum: Object.values(LAB_REPORT_EXTRACTION_STATUS),
                default: LAB_REPORT_EXTRACTION_STATUS.PENDING,
            },
            extractionMethod: {
                type: String,
                enum: ['pdf-parse', 'ocr-tesseract', 'failed', 'none'],
                default: 'none',
            },
        },
        ai: {
            status: {
                type: String,
                enum: Object.values(LAB_REPORT_AI_STATUS),
                default: LAB_REPORT_AI_STATUS.NOT_STARTED,
            },
            summaryJson: {
                type: mongoose.Schema.Types.Mixed,
            },
            createdAt: {
                type: Date,
            },
            error: {
                type: String,
            },
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Creator is required'],
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient querying
labReportSchema.index({ patientId: 1 });
labReportSchema.index({ 'pdf.extractionStatus': 1 });
labReportSchema.index({ 'ai.status': 1 });
labReportSchema.index({ createdAt: -1 });

const LabReport = mongoose.model('LabReport', labReportSchema);

module.exports = LabReport;
