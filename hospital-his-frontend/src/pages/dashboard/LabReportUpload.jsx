import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Search, User } from 'lucide-react';
import labReportService from '../../services/labReport.service';
import axios from 'axios';

/**
 * LabReportUpload - Lab tech page to upload PDF reports for patients
 * Route: /dashboard/upload-lab-report
 */
const LabReportUpload = () => {
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [pdfFile, setPdfFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState(null);
    const [recentUploads, setRecentUploads] = useState([]);

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const response = await axios.get('http://localhost:5001/api/v1/patients', {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            setPatients(response.data.data || []);
        } catch (err) {
            console.error('Error fetching patients:', err);
        }
    };

    const handleUpload = async () => {
        if (!selectedPatient || !pdfFile) {
            setMessage({ type: 'error', text: 'Please select a patient and choose a PDF file' });
            return;
        }

        setUploading(true);
        setMessage(null);

        try {
            const response = await labReportService.uploadReport(selectedPatient._id, pdfFile);

            setMessage({
                type: 'success',
                text: `✅ PDF uploaded successfully! Report ID: ${response.data.reportId}. Text extraction started.`
            });

            // Add to recent uploads
            setRecentUploads(prev => [{
                reportId: response.data.reportId,
                patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                fileName: pdfFile.name,
                uploadedAt: new Date().toISOString()
            }, ...prev.slice(0, 4)]);

            // Reset form
            setPdfFile(null);
            setSelectedPatient(null);
            setSearchTerm('');

        } catch (err) {
            console.error('Upload error:', err);
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'Failed to upload PDF. Please try again.'
            });
        } finally {
            setUploading(false);
        }
    };

    const filteredPatients = patients.filter(p => {
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        const uhid = (p.uhid || p.patientId || '').toLowerCase();
        return fullName.includes(searchTerm.toLowerCase()) || uhid.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                    <Upload size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Upload Lab Report PDF</h1>
                    <p className="text-gray-500 text-sm">Upload external lab report PDFs for patients</p>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${message.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Upload Form */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                {/* Step 1: Select Patient */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        1. Select Patient
                    </label>
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by patient name or UHID..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setSelectedPatient(null);
                            }}
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                    </div>

                    {/* Patient list */}
                    {searchTerm && !selectedPatient && (
                        <div className="mt-2 max-h-48 overflow-y-auto border border-gray-100 rounded-xl">
                            {filteredPatients.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">No patients found</div>
                            ) : (
                                filteredPatients.slice(0, 10).map(patient => (
                                    <button
                                        key={patient._id}
                                        onClick={() => {
                                            setSelectedPatient(patient);
                                            setSearchTerm(`${patient.firstName} ${patient.lastName}`);
                                        }}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 transition-colors text-left"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                            {patient.firstName?.[0]}{patient.lastName?.[0]}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-700">
                                                {patient.firstName} {patient.lastName}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {patient.uhid || patient.patientId || 'No ID'}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {/* Selected patient */}
                    {selectedPatient && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                                    {selectedPatient.firstName?.[0]}{selectedPatient.lastName?.[0]}
                                </div>
                                <div>
                                    <div className="font-medium text-blue-800">
                                        {selectedPatient.firstName} {selectedPatient.lastName}
                                    </div>
                                    <div className="text-xs text-blue-600">
                                        {selectedPatient.uhid || selectedPatient.patientId}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => { setSelectedPatient(null); setSearchTerm(''); }}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                                Change
                            </button>
                        </div>
                    )}
                </div>

                {/* Step 2: Upload PDF */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        2. Choose PDF File
                    </label>
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setPdfFile(e.target.files[0])}
                            className="hidden"
                            id="pdf-upload"
                        />
                        <label htmlFor="pdf-upload" className="cursor-pointer">
                            <FileText size={40} className="mx-auto text-gray-400 mb-3" />
                            {pdfFile ? (
                                <div>
                                    <p className="text-blue-600 font-medium">{pdfFile.name}</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-gray-600">Click to select PDF file</p>
                                    <p className="text-sm text-gray-400 mt-1">Max 10MB</p>
                                </div>
                            )}
                        </label>
                    </div>
                </div>

                {/* Upload Button */}
                <button
                    onClick={handleUpload}
                    disabled={!selectedPatient || !pdfFile || uploading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {uploading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Upload size={20} />
                            Upload Lab Report
                        </>
                    )}
                </button>
            </div>

            {/* Recent Uploads */}
            {recentUploads.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-semibold text-slate-700 mb-4">📋 Recent Uploads (This Session)</h3>
                    <div className="space-y-3">
                        {recentUploads.map((upload, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FileText size={20} className="text-red-500" />
                                    <div>
                                        <div className="font-medium text-slate-700">{upload.patientName}</div>
                                        <div className="text-xs text-gray-500">{upload.fileName}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-green-600 font-medium">
                                    ✓ Uploaded
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info */}
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-amber-800 text-sm">
                    <strong>Workflow:</strong> After upload, text will be extracted automatically.
                    Doctors can view the PDF and generate AI summary at <code>/dashboard/lab-reports</code>
                </p>
            </div>
        </div>
    );
};

export default LabReportUpload;
