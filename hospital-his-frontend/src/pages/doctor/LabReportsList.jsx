import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Eye, Bot, Clock, CheckCircle, AlertCircle, Search, RefreshCw } from 'lucide-react';
import labReportService from '../../services/labReport.service';

/**
 * LabReportsList - Doctor page to view all uploaded lab reports
 * Route: /dashboard/lab-reports
 */
const LabReportsList = () => {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await labReportService.getAllReports();
            setReports(response.data || []);
        } catch (err) {
            console.error('Error fetching reports:', err);
            setError(err.response?.data?.error || 'Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (extractionStatus, aiStatus) => {
        if (extractionStatus === 'pending') {
            return (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 flex items-center gap-1">
                    <Clock size={12} /> Extracting...
                </span>
            );
        }
        if (extractionStatus === 'failed') {
            return (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex items-center gap-1">
                    <AlertCircle size={12} /> Extraction Failed
                </span>
            );
        }
        if (aiStatus === 'ready') {
            return (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1">
                    <CheckCircle size={12} /> Summary Ready
                </span>
            );
        }
        return (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 flex items-center gap-1">
                <Bot size={12} /> Awaiting Summary
            </span>
        );
    };

    const filteredReports = reports.filter(report => {
        const patientName = `${report.patientId?.firstName || ''} ${report.patientId?.lastName || ''}`.toLowerCase();
        const fileName = (report.pdf?.fileName || '').toLowerCase();
        return patientName.includes(searchTerm.toLowerCase()) || fileName.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Lab Reports</h1>
                        <p className="text-gray-500 text-sm">View uploaded PDF reports with AI summaries</p>
                    </div>
                </div>
                <button
                    onClick={fetchReports}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by patient name or file name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                </div>
            </div>

            {/* Reports List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mb-4"></div>
                        <p className="text-gray-500">Loading reports...</p>
                    </div>
                ) : error ? (
                    <div className="p-12 text-center">
                        <AlertCircle size={40} className="mx-auto text-red-500 mb-4" />
                        <p className="text-red-600">{error}</p>
                        <button onClick={fetchReports} className="mt-4 text-indigo-600 hover:underline">
                            Try again
                        </button>
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText size={40} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">
                            {searchTerm ? 'No reports match your search' : 'No lab reports uploaded yet'}
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Patient</th>
                                <th className="px-6 py-4">File Name</th>
                                <th className="px-6 py-4">Uploaded</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredReports.map((report) => (
                                <tr key={report._id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                                                {report.patientId?.firstName?.[0]}{report.patientId?.lastName?.[0]}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-700">
                                                    {report.patientId?.firstName} {report.patientId?.lastName}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {report.patientId?.uhid || 'No UHID'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-red-500" />
                                            <span className="text-sm text-slate-600 truncate max-w-[200px]">
                                                {report.pdf?.fileName || 'Unnamed'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {report.pdf?.uploadedAt
                                            ? new Date(report.pdf.uploadedAt).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })
                                            : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(report.pdf?.extractionStatus, report.ai?.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => navigate(`/dashboard/lab-reports/${report._id}`)}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                                        >
                                            <Eye size={16} /> View Report
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Info note */}
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-amber-800 text-sm">
                    <strong>Note:</strong> Lab technicians upload PDF reports. Click "View Report" to see the PDF and generate/view AI summary.
                </p>
            </div>
        </div>
    );
};

export default LabReportsList;
