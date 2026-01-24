/**
 * Lab Report Controller
 * Handles PDF upload, text extraction, AI summarization, and report retrieval
 */

const LabReport = require('../models/LabReport');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const path = require('path');
const fs = require('fs');
const {
    LAB_REPORT_EXTRACTION_STATUS,
    LAB_REPORT_AI_STATUS,
} = require('../config/constants');

/**
 * @desc    Upload PDF lab report for a patient
 * @route   POST /api/v1/lab-reports/:patientId/upload
 * @access  Lab Tech only
 */
exports.uploadReport = asyncHandler(async (req, res, next) => {
    const { patientId } = req.params;

    if (!req.file) {
        return next(new ErrorResponse('Please upload a PDF file', 400));
    }

    // Create lab report document
    const labReport = await LabReport.create({
        patientId,
        pdf: {
            url: `/uploads/lab-reports/${req.file.filename}`,
            fileName: req.file.originalname,
            uploadedAt: new Date(),
            extractionStatus: LAB_REPORT_EXTRACTION_STATUS.PENDING,
        },
        ai: {
            status: LAB_REPORT_AI_STATUS.NOT_STARTED,
        },
        createdBy: req.user._id,
    });

    // Start async text extraction (non-blocking)
    extractTextFromPdfAsync(labReport._id, req.file.path);

    res.status(201).json({
        success: true,
        message: 'Lab report uploaded successfully',
        data: {
            reportId: labReport._id,
            patientId: labReport.patientId,
            fileName: labReport.pdf.fileName,
            extractionStatus: labReport.pdf.extractionStatus,
        },
    });
});

/**
 * Async function to extract text from PDF and update the report
 * Runs in the background after upload response is sent
 * Uses pdfExtractor with OCR fallback for scanned PDFs
 */
const extractTextFromPdfAsync = async (reportId, filePath) => {
    try {
        const { extractTextFromPdf } = require('../utils/pdfExtractor');

        // Extract text with OCR fallback
        const { text: extractedText, method: extractionMethod } = await extractTextFromPdf(filePath);

        // Determine status based on result
        const hasText = extractedText && extractedText.length > 10;
        const status = hasText
            ? LAB_REPORT_EXTRACTION_STATUS.DONE
            : LAB_REPORT_EXTRACTION_STATUS.FAILED;

        await LabReport.findByIdAndUpdate(reportId, {
            'pdf.extractedText': extractedText || '',
            'pdf.extractionStatus': status,
            'pdf.extractionMethod': extractionMethod, // Track method used
        });

        console.log(`[LabReport] Text extraction completed for report: ${reportId} (method: ${extractionMethod}, status: ${status})`);
    } catch (error) {
        console.error(`[LabReport] Text extraction failed for report: ${reportId}`, error.message);

        await LabReport.findByIdAndUpdate(reportId, {
            'pdf.extractionStatus': LAB_REPORT_EXTRACTION_STATUS.FAILED,
            'pdf.extractionMethod': 'failed',
        });
    }
};

/**
 * @desc    Get lab report by ID (PDF URL + AI summary)
 * @route   GET /api/v1/lab-reports/:reportId
 * @access  Doctor, Admin only
 */
exports.getReportById = asyncHandler(async (req, res, next) => {
    const { reportId } = req.params;

    const report = await LabReport.findById(reportId)
        .populate('patientId', 'firstName lastName uhid')
        .populate('createdBy', 'name email');

    if (!report) {
        return next(new ErrorResponse('Lab report not found', 404));
    }

    res.status(200).json({
        success: true,
        data: {
            _id: report._id,
            patient: report.patientId,
            type: report.type,
            source: report.source,
            pdf: {
                url: report.pdf.url,
                fileName: report.pdf.fileName,
                uploadedAt: report.pdf.uploadedAt,
                extractionStatus: report.pdf.extractionStatus,
                extractionMethod: report.pdf.extractionMethod,
            },
            ai: {
                status: report.ai.status,
                summaryJson: report.ai.summaryJson,
                createdAt: report.ai.createdAt,
                error: report.ai.error,
            },
            createdBy: report.createdBy,
            createdAt: report.createdAt,
        },
    });
});

/**
 * @desc    Trigger AI summary generation or return existing summary
 * @route   POST /api/v1/lab-reports/:reportId/summarize
 * @access  Doctor, Admin only
 */
exports.triggerSummary = asyncHandler(async (req, res, next) => {
    const { reportId } = req.params;

    const report = await LabReport.findById(reportId);

    if (!report) {
        return next(new ErrorResponse('Lab report not found', 404));
    }

    // If summary already exists, return it
    if (report.ai.status === LAB_REPORT_AI_STATUS.READY && report.ai.summaryJson) {
        return res.status(200).json({
            success: true,
            message: 'Existing summary returned',
            data: {
                status: report.ai.status,
                summaryJson: report.ai.summaryJson,
                createdAt: report.ai.createdAt,
            },
        });
    }

    // Check if text extraction is complete
    if (report.pdf.extractionStatus !== LAB_REPORT_EXTRACTION_STATUS.DONE) {
        return next(
            new ErrorResponse(
                `Cannot generate summary. Text extraction status: ${report.pdf.extractionStatus}`,
                400
            )
        );
    }

    // Set status to processing
    report.ai.status = LAB_REPORT_AI_STATUS.PROCESSING;
    await report.save();

    try {
        // Call LLM placeholder service
        const { summarizeLabReport } = require('../services/llmClient');
        const summaryJson = await summarizeLabReport(report.pdf.extractedText);

        // Update report with summary
        report.ai.status = LAB_REPORT_AI_STATUS.READY;
        report.ai.summaryJson = summaryJson;
        report.ai.createdAt = new Date();
        report.ai.error = null;
        await report.save();

        res.status(200).json({
            success: true,
            message: 'AI summary generated successfully',
            data: {
                status: report.ai.status,
                summaryJson: report.ai.summaryJson,
                createdAt: report.ai.createdAt,
            },
        });
    } catch (error) {
        // Mark as failed
        report.ai.status = LAB_REPORT_AI_STATUS.FAILED;
        report.ai.error = error.message;
        await report.save();

        return next(new ErrorResponse(`AI summary generation failed: ${error.message}`, 500));
    }
});

/**
 * @desc    Get all lab reports (for doctor listing page)
 * @route   GET /api/v1/lab-reports
 * @access  Doctor, Admin only
 */
exports.getAllReports = asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 50 } = req.query;

    const reports = await LabReport.find()
        .populate('patientId', 'firstName lastName uhid')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    const total = await LabReport.countDocuments();

    res.status(200).json({
        success: true,
        count: reports.length,
        total,
        data: reports,
    });
});

/**
 * @desc    Get all lab reports for a patient
 * @route   GET /api/v1/lab-reports/patient/:patientId
 * @access  Doctor, Admin only
 */
exports.getReportsByPatient = asyncHandler(async (req, res, next) => {
    const { patientId } = req.params;

    const reports = await LabReport.find({ patientId })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: reports.length,
        data: reports,
    });
});
