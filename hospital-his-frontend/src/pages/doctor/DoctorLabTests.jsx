import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, Eye, X, FileText, Bot, Loader, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import labService from '../../services/lab.service';

/**
 * DoctorLabTests - Doctor page to view completed lab tests with PDF + AI Summary
 * Route: /dashboard/doctor-lab-tests
 */
const DoctorLabTests = () => {
    const [completedTests, setCompletedTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTest, setSelectedTest] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [aiSummary, setAiSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState(null);

    useEffect(() => {
        fetchCompletedTests();
    }, []);

    const fetchCompletedTests = async () => {
        try {
            setLoading(true);
            // Get completed lab tests using getAllOrders with status filter
            const response = await labService.getAllOrders('completed');
            setCompletedTests(response.data || []);
        } catch (err) {
            console.error('Error fetching completed tests:', err);
        } finally {
            setLoading(false);
        }
    };

    const openTestDetails = async (test) => {
        setSelectedTest(test);
        setAiSummary(null);
        setSummaryError(null);
        setShowModal(true);

        // Check if test already has AI summary stored
        if (test.aiSummary) {
            try {
                // aiSummary might be stored as stringified JSON
                const summary = typeof test.aiSummary === 'string'
                    ? JSON.parse(test.aiSummary)
                    : test.aiSummary;
                setAiSummary(summary);
            } catch (e) {
                console.error('Error parsing existing aiSummary:', e);
            }
        }
    };

    const generateAiSummary = async () => {
        if (!selectedTest?._id) {
            setSummaryError('No test selected.');
            return;
        }

        if (!selectedTest.reportPdf) {
            setSummaryError('No PDF uploaded for this test. Please upload a PDF first.');
            return;
        }

        try {
            setSummaryLoading(true);
            setSummaryError(null);
            const response = await labService.generateAiSummary(selectedTest._id);
            const summary = response.data.aiSummary;
            // Handle both object and string formats
            setAiSummary(typeof summary === 'string' ? JSON.parse(summary) : summary);
        } catch (err) {
            console.error('Error generating summary:', err);
            setSummaryError(err.response?.data?.error || 'Failed to generate AI summary');
        } finally {
            setSummaryLoading(false);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedTest(null);
        setAiSummary(null);
        setSummaryError(null);
    };

    const getPdfUrl = () => {
        if (selectedTest?.reportPdf) {
            // Ensure path starts with /
            const pdfPath = selectedTest.reportPdf.startsWith('/')
                ? selectedTest.reportPdf
                : '/' + selectedTest.reportPdf;
            return `http://localhost:5001${pdfPath}`;
        }
        return null;
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                        <FlaskConical size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Lab Test Results</h1>
                        <p className="text-gray-500 text-sm">View completed lab tests with AI summaries</p>
                    </div>
                </div>
                <button
                    onClick={fetchCompletedTests}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {/* Tests List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent mb-4"></div>
                        <p className="text-gray-500">Loading completed tests...</p>
                    </div>
                ) : completedTests.length === 0 ? (
                    <div className="p-12 text-center">
                        <FlaskConical size={40} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">No completed lab tests found</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Test #</th>
                                <th className="px-6 py-4">Patient</th>
                                <th className="px-6 py-4">Test Name</th>
                                <th className="px-6 py-4">Completed</th>
                                <th className="px-6 py-4">Report</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {completedTests.map((test) => (
                                <tr key={test._id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-sm text-slate-600">{test.testNumber}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                                                {test.patient?.firstName?.[0]}{test.patient?.lastName?.[0]}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-700">
                                                    {test.patient?.firstName} {test.patient?.lastName}
                                                </div>
                                                <div className="text-xs text-gray-400">{test.patient?.patientId}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-700">{test.test?.testName || 'Unknown'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {test.completedAt ? new Date(test.completedAt).toLocaleDateString('en-IN') : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {test.reportPdf ? (
                                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                                                <FileText size={12} /> PDF Available
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                                                No PDF
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => openTestDetails(test)}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                                        >
                                            <Eye size={16} /> View Results
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Results Modal */}
            <AnimatePresence>
                {showModal && selectedTest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={closeModal}
                        />
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-5xl relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto"
                        >
                            {/* Header */}
                            <div className="bg-purple-600 p-6 text-white flex justify-between items-center sticky top-0 z-10">
                                <div>
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        <FlaskConical size={24} /> Lab Test Results
                                    </h2>
                                    <p className="text-purple-200 text-sm mt-1">
                                        {selectedTest.test?.testName} • {selectedTest.testNumber}
                                    </p>
                                </div>
                                <button onClick={closeModal} className="hover:bg-white/20 p-2 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6">
                                {/* Patient Info */}
                                <div className="flex items-center gap-3 mb-6 p-4 bg-slate-50 rounded-xl">
                                    <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                                        {selectedTest.patient?.firstName?.[0]}{selectedTest.patient?.lastName?.[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800">
                                            {selectedTest.patient?.firstName} {selectedTest.patient?.lastName}
                                        </div>
                                        <div className="text-sm text-gray-500">{selectedTest.patient?.patientId}</div>
                                    </div>
                                </div>

                                {/* Test Results */}
                                {selectedTest.results && selectedTest.results.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                            📊 Test Parameters
                                        </h3>
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-gray-500 text-xs uppercase">
                                                        <th className="text-left py-2">Parameter</th>
                                                        <th className="text-left py-2">Value</th>
                                                        <th className="text-left py-2">Unit</th>
                                                        <th className="text-left py-2">Normal Range</th>
                                                        <th className="text-left py-2">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedTest.results.map((result, idx) => (
                                                        <tr key={idx} className="border-t border-gray-200">
                                                            <td className="py-2 font-medium text-slate-700">{result.parameter}</td>
                                                            <td className={`py-2 ${result.isAbnormal ? 'text-amber-600 font-bold' : ''} ${result.isCritical ? 'text-red-600 font-bold' : ''}`}>
                                                                {result.value}
                                                            </td>
                                                            <td className="py-2 text-gray-500">{result.unit}</td>
                                                            <td className="py-2 text-gray-500">{result.normalRange}</td>
                                                            <td className="py-2">
                                                                {result.isCritical ? (
                                                                    <span className="text-red-600 font-bold">⚠️ Critical</span>
                                                                ) : result.isAbnormal ? (
                                                                    <span className="text-amber-600">Abnormal</span>
                                                                ) : (
                                                                    <span className="text-green-600">Normal</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {selectedTest.remarks && (
                                            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                                <strong className="text-blue-800">Remarks:</strong>
                                                <p className="text-blue-700 text-sm mt-1">{selectedTest.remarks}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* PDF Preview */}
                                {getPdfUrl() && (
                                    <div className="mb-6">
                                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                            <FileText size={18} className="text-red-500" /> Lab Report PDF
                                        </h3>
                                        <a
                                            href={getPdfUrl()}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                                        >
                                            <FileText size={18} /> View PDF Report
                                        </a>
                                    </div>
                                )}

                                {/* AI Summary Section */}
                                <div className="mb-6">
                                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                        <Bot size={18} className="text-blue-500" /> AI Summary
                                    </h3>

                                    {/* Disclaimer */}
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                                        <p className="text-amber-800 text-sm flex items-center gap-2">
                                            <AlertTriangle size={16} />
                                            <strong>AI-generated summary. Not a diagnosis. Doctor must verify.</strong>
                                        </p>
                                    </div>

                                    {summaryLoading ? (
                                        <div className="p-8 text-center bg-gray-50 rounded-xl">
                                            <Loader size={32} className="mx-auto animate-spin text-blue-500 mb-3" />
                                            <p className="text-gray-600">Generating AI summary...</p>
                                        </div>
                                    ) : summaryError ? (
                                        <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
                                            <p className="text-red-700 mb-3">{summaryError}</p>
                                            <button
                                                onClick={generateAiSummary}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    ) : aiSummary ? (
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                                            {/* Overall Status Badge */}
                                            {aiSummary.overallStatus && (
                                                <div className="mb-4">
                                                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${aiSummary.overallStatus === 'critical'
                                                        ? 'bg-red-100 text-red-700'
                                                        : aiSummary.overallStatus === 'attention_needed'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        {aiSummary.overallStatus === 'critical' ? '🔴 Critical'
                                                            : aiSummary.overallStatus === 'attention_needed' ? '🟡 Attention Needed'
                                                                : '🟢 Normal'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Summary Paragraphs */}
                                            {aiSummary.summary && (
                                                <div className="mb-4 p-4 bg-white rounded-lg">
                                                    <h4 className="font-semibold text-blue-800 mb-2">Clinical Summary</h4>
                                                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">{aiSummary.summary}</p>
                                                </div>
                                            )}

                                            {/* Legacy format: Key Findings */}
                                            {aiSummary.keyFindings && aiSummary.keyFindings.length > 0 && (
                                                <div className="mb-4">
                                                    <h4 className="font-semibold text-blue-800 mb-2">Key Findings</h4>
                                                    <div className="space-y-2">
                                                        {aiSummary.keyFindings.map((finding, idx) => (
                                                            <div key={idx} className="flex items-center gap-3 text-sm bg-white p-3 rounded-lg">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${finding.status === 'high' || finding.status === 'low'
                                                                    ? 'bg-amber-100 text-amber-700'
                                                                    : 'bg-green-100 text-green-700'
                                                                    }`}>
                                                                    {finding.status?.toUpperCase()}
                                                                </span>
                                                                <span className="font-medium text-slate-700">{finding.parameter}:</span>
                                                                <span className="text-slate-600">{finding.value}</span>
                                                                {finding.referenceRange && <span className="text-gray-400 text-xs">(Ref: {finding.referenceRange})</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Abnormal Values */}
                                            {aiSummary.abnormalValues && aiSummary.abnormalValues.length > 0 && (
                                                <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                                                    <h4 className="font-semibold text-amber-700 mb-2">⚠️ Abnormal Values</h4>
                                                    <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
                                                        {aiSummary.abnormalValues.map((item, idx) => (
                                                            <li key={idx}>
                                                                <strong>{item.parameter}</strong>: {item.value || item.observation}
                                                                {item.significance && <span className="text-amber-600"> — {item.significance}</span>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Clinical Recommendation */}
                                            {aiSummary.clinicalRecommendation && (
                                                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                                    <h4 className="font-semibold text-indigo-700 mb-1">💡 Clinical Recommendation</h4>
                                                    <p className="text-sm text-indigo-800">{aiSummary.clinicalRecommendation}</p>
                                                </div>
                                            )}

                                            {/* Legacy: Normal Results */}
                                            {aiSummary.normalResults && aiSummary.normalResults.length > 0 && (
                                                <div className="mb-4">
                                                    <h4 className="font-semibold text-green-700 mb-2">✓ Normal Results</h4>
                                                    <ul className="list-disc list-inside text-sm text-green-800 space-y-1">
                                                        {aiSummary.normalResults.map((item, idx) => (
                                                            <li key={idx}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Legacy: Clinical Notes */}
                                            {aiSummary.clinicalNotes && (
                                                <div className="p-3 bg-white rounded-lg mt-4">
                                                    <h4 className="font-semibold text-slate-700 mb-1">Clinical Notes</h4>
                                                    <p className="text-sm text-slate-600">{aiSummary.clinicalNotes}</p>
                                                </div>
                                            )}

                                            {aiSummary.generatedAt && (
                                                <p className="text-xs text-gray-400 mt-3">
                                                    Generated: {new Date(aiSummary.generatedAt).toLocaleString()}
                                                    {aiSummary.model && ` • Model: ${aiSummary.model}`}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-gray-50 rounded-xl text-center">
                                            <Bot size={40} className="mx-auto text-gray-400 mb-3" />
                                            <p className="text-gray-600 mb-4">No AI summary generated yet</p>
                                            {selectedTest.reportPdf ? (
                                                <button
                                                    onClick={generateAiSummary}
                                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 mx-auto"
                                                >
                                                    <Bot size={18} /> Generate AI Summary
                                                </button>
                                            ) : (
                                                <p className="text-sm text-gray-500">
                                                    Upload a PDF report first to enable AI summary
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <button
                                        onClick={closeModal}
                                        className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DoctorLabTests;
