import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import labReportService from '../../services/labReport.service';

/**
 * LabReportView - Doctor-facing page for viewing PDF lab reports with AI summary
 * Route: /doctor/lab-reports/:reportId
 */
const LabReportView = () => {
    const { reportId } = useParams();
    const navigate = useNavigate();

    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState(null);

    // Fetch report on mount
    useEffect(() => {
        fetchReport();
    }, [reportId]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await labReportService.getReport(reportId);
            setReport(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load lab report');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateSummary = async () => {
        try {
            setSummaryLoading(true);
            setSummaryError(null);
            const response = await labReportService.generateSummary(reportId);
            // Update report with new AI summary
            setReport(prev => ({
                ...prev,
                ai: {
                    ...prev.ai,
                    status: response.data.status,
                    summaryJson: response.data.summaryJson,
                    createdAt: response.data.createdAt,
                },
            }));
        } catch (err) {
            setSummaryError(err.response?.data?.error || 'Failed to generate AI summary');
        } finally {
            setSummaryLoading(false);
        }
    };

    const renderSummaryContent = () => {
        if (!report) return null;

        const { ai } = report;

        // Not started state
        if (ai.status === 'not_started') {
            return (
                <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">AI summary has not been generated yet.</p>
                    <button
                        onClick={handleGenerateSummary}
                        disabled={summaryLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {summaryLoading ? 'Generating...' : 'Generate Summary'}
                    </button>
                </div>
            );
        }

        // Processing state
        if (ai.status === 'processing' || summaryLoading) {
            return (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-4"></div>
                    <p className="text-gray-600">Generating AI summary...</p>
                </div>
            );
        }

        // Failed state
        if (ai.status === 'failed') {
            return (
                <div className="text-center py-8">
                    <p className="text-red-600 mb-4">
                        {ai.error || summaryError || 'Failed to generate summary'}
                    </p>
                    <button
                        onClick={handleGenerateSummary}
                        disabled={summaryLoading}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Retry Summary
                    </button>
                </div>
            );
        }

        // Ready state - render summary
        if (ai.status === 'ready' && ai.summaryJson) {
            const summary = ai.summaryJson;
            return (
                <div className="space-y-6">
                    {/* Key Findings */}
                    {summary.keyFindings && summary.keyFindings.length > 0 && (
                        <div>
                            <h4 className="text-lg font-semibold text-gray-800 mb-3">Key Findings</h4>
                            <div className="grid gap-2">
                                {summary.keyFindings.map((finding, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-lg border ${finding.status === 'high' || finding.status === 'low'
                                                ? 'bg-red-50 border-red-200'
                                                : 'bg-green-50 border-green-200'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">{finding.parameter}</span>
                                            <span className={`font-semibold ${finding.status === 'high' || finding.status === 'low'
                                                    ? 'text-red-600'
                                                    : 'text-green-600'
                                                }`}>
                                                {finding.value}
                                            </span>
                                        </div>
                                        {finding.referenceRange && (
                                            <p className="text-sm text-gray-500 mt-1">
                                                Reference: {finding.referenceRange}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Abnormal Values */}
                    {summary.abnormalValues && summary.abnormalValues.length > 0 && (
                        <div>
                            <h4 className="text-lg font-semibold text-red-700 mb-3">⚠️ Abnormal Values</h4>
                            <ul className="space-y-2">
                                {summary.abnormalValues.map((item, idx) => (
                                    <li key={idx} className="bg-red-50 p-3 rounded-lg border border-red-200">
                                        <span className="font-medium">{item.parameter}:</span>{' '}
                                        <span className="text-gray-700">{item.observation}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Normal Results */}
                    {summary.normalResults && summary.normalResults.length > 0 && (
                        <div>
                            <h4 className="text-lg font-semibold text-green-700 mb-3">✓ Normal Results</h4>
                            <ul className="space-y-1">
                                {summary.normalResults.map((item, idx) => (
                                    <li key={idx} className="text-gray-700 flex items-center">
                                        <span className="text-green-500 mr-2">•</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Clinical Notes */}
                    {summary.clinicalNotes && (
                        <div>
                            <h4 className="text-lg font-semibold text-gray-800 mb-2">Clinical Notes</h4>
                            <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                                {summary.clinicalNotes}
                            </p>
                        </div>
                    )}

                    {/* Generated timestamp */}
                    {ai.createdAt && (
                        <p className="text-sm text-gray-500">
                            Generated: {new Date(ai.createdAt).toLocaleString()}
                        </p>
                    )}
                </div>
            );
        }

        return null;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                    <p className="text-gray-600">Loading lab report...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 text-lg mb-4">{error}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-600 hover:text-blue-800 flex items-center mb-4"
                    >
                        ← Back to Patient
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">Lab Report</h1>
                    {report?.patient && (
                        <p className="text-gray-600 mt-1">
                            Patient: {report.patient.firstName} {report.patient.lastName}
                            {report.patient.uhid && ` (UHID: ${report.patient.uhid})`}
                        </p>
                    )}
                    <p className="text-gray-500 text-sm mt-1">
                        File: {report?.pdf?.fileName} •
                        Uploaded: {report?.pdf?.uploadedAt ? new Date(report.pdf.uploadedAt).toLocaleString() : 'N/A'}
                    </p>
                </div>

                {/* PDF Viewer */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
                    <div className="bg-gray-800 text-white py-3 px-4">
                        <h2 className="font-semibold">PDF Report</h2>
                    </div>
                    <div className="p-4">
                        {report?.pdf?.url ? (
                            <iframe
                                src={`http://localhost:5001${report.pdf.url}`}
                                className="w-full h-[600px] border rounded-lg"
                                title="Lab Report PDF"
                            />
                        ) : (
                            <div className="bg-gray-100 h-[400px] flex items-center justify-center rounded-lg">
                                <p className="text-gray-500">PDF not available</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* AI Summary Section */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-4">
                        <h2 className="font-semibold flex items-center">
                            <span className="mr-2">🤖</span>
                            AI Summary
                        </h2>
                    </div>
                    <div className="p-6">
                        {/* Extraction Status Warning */}
                        {report?.pdf?.extractionStatus === 'pending' && (
                            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-4">
                                <p className="font-medium">⏳ Text extraction in progress...</p>
                                <p className="text-sm mt-1">Please wait a moment and refresh the page.</p>
                            </div>
                        )}
                        {report?.pdf?.extractionStatus === 'failed' && (
                            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-4">
                                <p className="font-medium">❌ Text extraction failed</p>
                                <p className="text-sm mt-1">Unable to extract text from PDF. AI summary unavailable.</p>
                            </div>
                        )}

                        {/* Summary Content */}
                        {summaryError && (
                            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-4">
                                <p>{summaryError}</p>
                            </div>
                        )}
                        {renderSummaryContent()}
                    </div>
                </div>

                {/* Disclaimer */}
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                    <p className="text-amber-800 font-medium flex items-start">
                        <span className="text-xl mr-2">⚠️</span>
                        <span>
                            <strong>Disclaimer:</strong> AI-generated summary. Not a diagnosis.
                            Doctor must verify all findings against the original lab report before making clinical decisions.
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LabReportView;
