import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield, Plus, Search, Clock, CheckCircle, XCircle, AlertCircle,
    DollarSign, ChevronRight, ArrowRight, FileText, Clipboard, Copy,
    AlertTriangle, ListChecks, Sparkles, RefreshCw, Loader2
} from 'lucide-react';
import insuranceService from '../../services/insurance.service';
import patientService from '../../services/patients.service';
import { toast } from 'react-hot-toast';

const PreAuthQueueTab = () => {
    // State
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedCase, setSelectedCase] = useState(null);
    const [generatingPacket, setGeneratingPacket] = useState(false);

    // Fetch queue cases
    const fetchCases = useCallback(async () => {
        try {
            setLoading(true);
            const response = await insuranceService.getPreAuthQueue();
            setCases(response.data || []);
        } catch (error) {
            console.error('Error fetching pre-auth queue:', error);
            toast.error('Failed to load pre-auth queue');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCases();
    }, [fetchCases]);

    // Status badge component
    const QueueStatusBadge = ({ status }) => {
        const styles = {
            'draft': 'bg-gray-100 text-gray-800',
            'ready': 'bg-green-100 text-green-800',
            'submitted': 'bg-blue-100 text-blue-800',
            'query': 'bg-orange-100 text-orange-800',
            'approved': 'bg-emerald-100 text-emerald-800',
            'denied': 'bg-red-100 text-red-800',
        };
        const icons = {
            'draft': FileText,
            'ready': CheckCircle,
            'submitted': ArrowRight,
            'query': AlertCircle,
            'approved': CheckCircle,
            'denied': XCircle,
        };
        const Icon = icons[status] || Clock;

        return (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
                <Icon size={12} />
                <span className="capitalize">{status}</span>
            </span>
        );
    };

    // Create Case Modal
    const CreateCaseModal = () => {
        const [step, setStep] = useState(1);
        const [searchQuery, setSearchQuery] = useState('');
        const [searchResults, setSearchResults] = useState([]);
        const [selectedPatient, setSelectedPatient] = useState(null);
        const [insurerName, setInsurerName] = useState('');
        const [tpaName, setTpaName] = useState('');
        const [policyNumber, setPolicyNumber] = useState('');
        const [submitting, setSubmitting] = useState(false);

        const handleSearch = async (query) => {
            setSearchQuery(query);
            if (query.length < 2) {
                setSearchResults([]);
                return;
            }
            try {
                const res = await patientService.searchPatients(query);
                setSearchResults(Array.isArray(res.data) ? res.data : []);
            } catch (e) {
                console.error('Search error:', e);
            }
        };

        const handleSubmit = async () => {
            if (!selectedPatient || !insurerName) {
                toast.error('Patient and Insurer Name are required');
                return;
            }

            try {
                setSubmitting(true);
                await insuranceService.createPreAuthCase(
                    selectedPatient._id,
                    insurerName,
                    tpaName || undefined,
                    policyNumber || undefined
                );
                toast.success('Pre-auth case created! Data auto-populated.');
                setShowCreateModal(false);
                fetchCases();
            } catch (error) {
                console.error('Error creating case:', error);
                toast.error(error.response?.data?.message || 'Failed to create case');
            } finally {
                setSubmitting(false);
            }
        };

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">New Pre-Auth Case</h2>
                                <p className="text-sm text-gray-500">Minimal input — system auto-populates the rest</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white rounded-full">
                                <XCircle size={24} className="text-gray-400" />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Patient Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Patient <span className="text-red-500">*</span>
                            </label>
                            {!selectedPatient ? (
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input
                                        className="w-full pl-10 p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="Search by name, ID, or phone..."
                                        value={searchQuery}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        autoFocus
                                    />
                                    {searchResults.length > 0 && (
                                        <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-10">
                                            {searchResults.map(p => (
                                                <div
                                                    key={p._id}
                                                    onClick={() => {
                                                        setSelectedPatient(p);
                                                        setSearchResults([]);
                                                        setSearchQuery('');
                                                    }}
                                                    className="p-3 hover:bg-purple-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                >
                                                    <div className="font-medium text-slate-800">{p.firstName} {p.lastName}</div>
                                                    <div className="text-xs text-gray-500">ID: {p.patientId} • {p.gender}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg flex justify-between items-center">
                                    <div className="flex gap-3 items-center">
                                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-purple-600 font-bold border border-purple-100">
                                            {selectedPatient.firstName[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800">{selectedPatient.firstName} {selectedPatient.lastName}</div>
                                            <div className="text-xs text-slate-500">ID: {selectedPatient.patientId}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedPatient(null)} className="p-1 text-gray-400 hover:text-red-500">
                                        <XCircle size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Insurer Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Insurer Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="e.g. Star Health, ICICI Lombard..."
                                value={insurerName}
                                onChange={(e) => setInsurerName(e.target.value)}
                            />
                        </div>

                        {/* TPA Name (Optional) */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">TPA Name (Optional)</label>
                            <input
                                className="w-full p-2.5 border border-gray-200 rounded-lg outline-none"
                                placeholder="e.g. Medi Assist, Health India..."
                                value={tpaName}
                                onChange={(e) => setTpaName(e.target.value)}
                            />
                        </div>

                        {/* Policy Number (Optional) */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Policy Number (Optional)</label>
                            <input
                                className="w-full p-2.5 border border-gray-200 rounded-lg outline-none font-mono"
                                placeholder="Will auto-fill from patient records if available"
                                value={policyNumber}
                                onChange={(e) => setPolicyNumber(e.target.value)}
                            />
                        </div>

                        <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 flex items-start gap-2">
                            <Sparkles size={16} className="mt-0.5 flex-shrink-0" />
                            <span>
                                <strong>Auto-Population:</strong> System will auto-fetch latest encounter, treating doctor, diagnosis,
                                attached documents, and estimate costs from linked records.
                            </span>
                        </div>
                    </div>

                    <div className="p-6 border-t border-gray-100 bg-slate-50 flex justify-end gap-3">
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-white rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!selectedPatient || !insurerName || submitting}
                            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            Create Case
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Case Detail Panel
    const CaseDetailPanel = () => {
        if (!selectedCase) return null;

        const handleGeneratePacket = async () => {
            try {
                setGeneratingPacket(true);
                const result = await insuranceService.generatePreAuthPacket(selectedCase._id);
                toast.success('Pre-auth packet generated!');
                // Refresh case data
                const updated = await insuranceService.getPreAuthCase(selectedCase._id);
                setSelectedCase(updated.data);
            } catch (error) {
                console.error('Error generating packet:', error);
                toast.error(error.response?.data?.message || 'Failed to generate packet');
            } finally {
                setGeneratingPacket(false);
            }
        };

        const copyToClipboard = (text) => {
            navigator.clipboard.writeText(text);
            toast.success('Copied to clipboard!');
        };

        const agentOutput = selectedCase.agentOutput;

        return (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm">
                <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 p-6 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{selectedCase.caseNumber}</h2>
                            <p className="text-sm text-gray-500">Pre-Auth Case</p>
                        </div>
                        <button onClick={() => setSelectedCase(null)} className="p-2 hover:bg-slate-100 rounded-full">
                            <XCircle size={24} className="text-gray-400" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Status & Actions */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <QueueStatusBadge status={selectedCase.status} />
                                <span className="text-sm text-gray-500">Created {new Date(selectedCase.createdAt).toLocaleDateString()}</span>
                            </div>
                            {(selectedCase.status === 'draft' || selectedCase.status === 'ready') && (
                                <button
                                    onClick={handleGeneratePacket}
                                    disabled={generatingPacket}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 font-medium text-sm"
                                >
                                    {generatingPacket ? (
                                        <><Loader2 size={16} className="animate-spin" /> Generating...</>
                                    ) : selectedCase.status === 'ready' ? (
                                        <><RefreshCw size={16} /> Regenerate Packet</>
                                    ) : (
                                        <><Sparkles size={16} /> Generate Packet</>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Patient & Encounter Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-blue-50 rounded-xl">
                                <div className="text-xs text-blue-600 font-bold uppercase mb-1">Patient</div>
                                <div className="font-bold text-slate-800">
                                    {selectedCase.patient?.firstName} {selectedCase.patient?.lastName}
                                </div>
                                <div className="text-sm text-gray-500">{selectedCase.patient?.patientId}</div>
                            </div>
                            <div className="p-4 bg-green-50 rounded-xl">
                                <div className="text-xs text-green-600 font-bold uppercase mb-1">Insurer</div>
                                <div className="font-bold text-slate-800">{selectedCase.insurerName}</div>
                                {selectedCase.tpaName && <div className="text-sm text-gray-500">TPA: {selectedCase.tpaName}</div>}
                            </div>
                        </div>

                        {/* Auto-Populated Data */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Sparkles size={16} className="text-purple-500" /> Auto-Populated Data
                            </h3>

                            <div className="grid gap-3 text-sm">
                                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-gray-500">Encounter</span>
                                    <span className="font-medium">{selectedCase.encounterModel || 'Not found'}</span>
                                </div>
                                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-gray-500">Treating Doctor</span>
                                    <span className="font-medium">
                                        {selectedCase.treatingDoctor
                                            ? `Dr. ${selectedCase.treatingDoctor.profile?.firstName} ${selectedCase.treatingDoctor.profile?.lastName}`
                                            : 'Not assigned'}
                                    </span>
                                </div>
                                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-gray-500">Department</span>
                                    <span className="font-medium">{selectedCase.department?.name || 'N/A'}</span>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <span className="text-gray-500 block mb-1">Diagnosis</span>
                                    <span className="font-medium">{selectedCase.diagnosisSummary || 'Pending'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Cost Estimation */}
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-amber-900 flex items-center gap-2">
                                    <DollarSign size={16} /> Estimated Cost
                                </h4>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedCase.estimationBasis === 'exact' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {selectedCase.estimationBasis === 'exact' ? 'Exact' : 'Estimated'}
                                </span>
                            </div>
                            <div className="text-2xl font-bold text-slate-800 mb-3">
                                ₹{(selectedCase.estimatedAmount || 0).toLocaleString()}
                            </div>
                            {selectedCase.estimationBreakdown?.length > 0 && (
                                <div className="space-y-1 text-sm">
                                    {selectedCase.estimationBreakdown.slice(0, 5).map((item, i) => (
                                        <div key={i} className="flex justify-between text-amber-800">
                                            <span>{item.description}</span>
                                            <span className="font-medium">₹{item.amount.toLocaleString()}</span>
                                        </div>
                                    ))}
                                    {selectedCase.estimationBreakdown.length > 5 && (
                                        <div className="text-amber-600 text-xs">+ {selectedCase.estimationBreakdown.length - 5} more items</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Agent Output (if generated) */}
                        {agentOutput && (
                            <div className="space-y-5">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                    <Sparkles size={18} className="text-green-500" /> Generated Pre-Auth Packet
                                </h3>

                                {/* Packet Draft - Pretty Printed */}
                                {agentOutput.packetDraft && (
                                    <div className="border border-green-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                        <div className="p-3 bg-green-50 border-b border-green-200 flex justify-between items-center">
                                            <span className="font-semibold text-green-800 flex items-center gap-2">
                                                <FileText size={16} /> Pre-Authorization Request
                                            </span>
                                            <button
                                                onClick={() => {
                                                    const pd = agentOutput.packetDraft;
                                                    const text = `PRE-AUTHORIZATION REQUEST\n\n` +
                                                        `PATIENT INFORMATION\n` +
                                                        `Name: ${pd.patientIdentity?.name || 'N/A'}\n` +
                                                        `Patient ID: ${pd.patientIdentity?.patientId || 'N/A'}\n` +
                                                        `Date of Birth: ${pd.patientIdentity?.dateOfBirth || 'N/A'}\n` +
                                                        `Gender: ${pd.patientIdentity?.gender || 'N/A'}\n\n` +
                                                        `INSURANCE DETAILS\n` +
                                                        `Insurer: ${pd.insurerName || 'N/A'}\n` +
                                                        `TPA: ${pd.tpaName || 'N/A'}\n` +
                                                        `Policy Number: ${pd.policyNumber || 'N/A'}\n\n` +
                                                        `CLINICAL INFORMATION\n` +
                                                        `Diagnosis: ${pd.diagnosisSummary || 'N/A'}\n` +
                                                        `Planned Procedure: ${pd.plannedProcedure || 'N/A'}\n` +
                                                        `Treating Doctor: ${pd.treatingDoctor || 'N/A'}\n` +
                                                        `Department: ${pd.department || 'N/A'}\n` +
                                                        `Encounter Reference: ${pd.encounterReference || 'N/A'}\n\n` +
                                                        `CLINICAL JUSTIFICATION\n${pd.clinicalJustification || 'N/A'}\n\n` +
                                                        `COST ESTIMATE\n` +
                                                        `Amount: ₹${(pd.estimatedAmount || 0).toLocaleString()}\n` +
                                                        `Basis: ${pd.estimationBasis || 'Estimated'}`;
                                                    copyToClipboard(text);
                                                }}
                                                className="text-green-600 hover:text-green-800 p-1.5 hover:bg-green-100 rounded flex items-center gap-1 text-sm"
                                            >
                                                <Copy size={14} /> Copy
                                            </button>
                                        </div>
                                        <div className="p-5 space-y-5">
                                            {/* Patient Identity Section */}
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                    👤 Patient Information
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg">
                                                    <div>
                                                        <span className="text-xs text-gray-400">Name</span>
                                                        <p className="font-semibold text-slate-800">{agentOutput.packetDraft.patientIdentity?.name || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400">Patient ID</span>
                                                        <p className="font-mono text-slate-700">{agentOutput.packetDraft.patientIdentity?.patientId || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400">Date of Birth</span>
                                                        <p className="text-slate-700">{agentOutput.packetDraft.patientIdentity?.dateOfBirth || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400">Gender</span>
                                                        <p className="text-slate-700 capitalize">{agentOutput.packetDraft.patientIdentity?.gender || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Insurance Details Section */}
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                    🏥 Insurance Details
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3 bg-blue-50 p-3 rounded-lg">
                                                    <div>
                                                        <span className="text-xs text-blue-500">Insurer</span>
                                                        <p className="font-semibold text-slate-800">{agentOutput.packetDraft.insurerName || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-blue-500">TPA</span>
                                                        <p className="text-slate-700">{agentOutput.packetDraft.tpaName || 'None'}</p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className="text-xs text-blue-500">Policy Number</span>
                                                        <p className="font-mono text-slate-800 text-lg">{agentOutput.packetDraft.policyNumber || 'NOT PROVIDED'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Clinical Information Section */}
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                    🩺 Clinical Information
                                                </h4>
                                                <div className="bg-purple-50 p-3 rounded-lg space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <span className="text-xs text-purple-500">Treating Doctor</span>
                                                            <p className="font-semibold text-slate-800">{agentOutput.packetDraft.treatingDoctor || 'Not assigned'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-purple-500">Department</span>
                                                            <p className="text-slate-700">{agentOutput.packetDraft.department || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-purple-500">Encounter Reference</span>
                                                        <p className="font-mono text-slate-700">{agentOutput.packetDraft.encounterReference || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-purple-500">Primary Diagnosis</span>
                                                        <p className="font-medium text-slate-800">{agentOutput.packetDraft.diagnosisSummary || 'Pending'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-purple-500">Planned Procedure / Treatment</span>
                                                        <p className="font-medium text-slate-800">{agentOutput.packetDraft.plannedProcedure || 'To be determined'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Clinical Justification */}
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                    📋 Clinical Justification
                                                </h4>
                                                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                                                    <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                                                        {agentOutput.packetDraft.clinicalJustification || 'No clinical justification provided.'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Cost Estimate */}
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                    💰 Cost Estimate
                                                </h4>
                                                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex justify-between items-center">
                                                    <div>
                                                        <p className="text-3xl font-bold text-slate-800">
                                                            ₹{(agentOutput.packetDraft.estimatedAmount || 0).toLocaleString()}
                                                        </p>
                                                        <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${agentOutput.packetDraft.estimationBasis === 'exact'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                            {agentOutput.packetDraft.estimationBasis === 'exact' ? '✓ Exact Amount' : '≈ Estimated'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Clinical Summary Section (AI Generated) */}
                                {selectedCase.aiSummaries && Object.keys(selectedCase.aiSummaries).length > 0 && (
                                    <div className="border border-indigo-200 rounded-xl overflow-hidden">
                                        <div className="p-3 bg-indigo-50 border-b border-indigo-200">
                                            <span className="font-semibold text-indigo-800 flex items-center gap-2">
                                                <Sparkles size={16} /> Clinical Summary (AI-Generated)
                                            </span>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            {/* Doctor Consultation Summary */}
                                            {selectedCase.clinicalJustificationSnippet && (
                                                <div>
                                                    <h5 className="text-sm font-bold text-slate-700 mb-2">📝 Doctor Consultation Notes</h5>
                                                    <div className="bg-gray-50 p-3 rounded-lg text-sm text-slate-600 whitespace-pre-line">
                                                        {selectedCase.clinicalJustificationSnippet}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Lab Report AI Summary */}
                                            {selectedCase.aiSummaries?.labReports && (
                                                <div>
                                                    <h5 className="text-sm font-bold text-slate-700 mb-2">🧪 Lab Report AI Summary</h5>
                                                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-slate-700 space-y-2">
                                                        {(() => {
                                                            try {
                                                                const labSummary = typeof selectedCase.aiSummaries.labReports === 'string'
                                                                    ? JSON.parse(selectedCase.aiSummaries.labReports)
                                                                    : selectedCase.aiSummaries.labReports;
                                                                return (
                                                                    <>
                                                                        {labSummary.summary && (
                                                                            <p className="whitespace-pre-line">{labSummary.summary}</p>
                                                                        )}
                                                                        {labSummary.abnormalValues?.length > 0 && (
                                                                            <div className="mt-2 pt-2 border-t border-blue-100">
                                                                                <span className="text-xs font-bold text-blue-600">Abnormal Values:</span>
                                                                                <ul className="mt-1 space-y-1">
                                                                                    {labSummary.abnormalValues.map((v, i) => (
                                                                                        <li key={i} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">
                                                                                            <strong>{v.parameter}:</strong> {v.value} — {v.significance}
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                        {labSummary.clinicalRecommendation && (
                                                                            <div className="mt-2 pt-2 border-t border-blue-100">
                                                                                <span className="text-xs font-bold text-blue-600">Recommendation:</span>
                                                                                <p className="text-xs mt-1">{labSummary.clinicalRecommendation}</p>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                );
                                                            } catch (e) {
                                                                return <p className="whitespace-pre-line">{String(selectedCase.aiSummaries.labReports)}</p>;
                                                            }
                                                        })()}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Radiology Report AI Summary */}
                                            {selectedCase.aiSummaries?.radiologyReports && (
                                                <div>
                                                    <h5 className="text-sm font-bold text-slate-700 mb-2">📷 Radiology Report AI Summary</h5>
                                                    <div className="bg-purple-50 p-3 rounded-lg text-sm text-slate-700 whitespace-pre-line">
                                                        {(() => {
                                                            try {
                                                                const radSummary = typeof selectedCase.aiSummaries.radiologyReports === 'string'
                                                                    ? JSON.parse(selectedCase.aiSummaries.radiologyReports)
                                                                    : selectedCase.aiSummaries.radiologyReports;
                                                                return radSummary.summary || radSummary.findings || String(radSummary);
                                                            } catch (e) {
                                                                return String(selectedCase.aiSummaries.radiologyReports);
                                                            }
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Checklist */}
                                {agentOutput.attachmentsChecklist?.length > 0 && (
                                    <div className="border border-blue-200 rounded-xl p-4">
                                        <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                                            <ListChecks size={16} /> Attachments Checklist
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {agentOutput.attachmentsChecklist.map((item, i) => (
                                                <div key={i} className={`flex items-center gap-2 text-sm p-2 rounded ${item.exists ? 'bg-green-50' : 'bg-red-50'}`}>
                                                    {item.exists ? (
                                                        <CheckCircle size={16} className="text-green-500" />
                                                    ) : (
                                                        <XCircle size={16} className="text-red-400" />
                                                    )}
                                                    <span className={item.exists ? 'text-slate-700' : 'text-gray-500'}>{item.doc}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Warnings */}
                                {agentOutput.riskWarnings?.length > 0 && (
                                    <div className="border border-orange-200 rounded-xl p-4 bg-orange-50">
                                        <h4 className="font-medium text-orange-800 mb-2 flex items-center gap-2">
                                            <AlertTriangle size={16} /> Risk Warnings
                                        </h4>
                                        <ul className="space-y-2">
                                            {agentOutput.riskWarnings.map((warning, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-orange-700 bg-white p-2 rounded border border-orange-100">
                                                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                                    {warning}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Next Actions */}
                                {agentOutput.nextActions?.length > 0 && (
                                    <div className="border border-purple-200 rounded-xl p-4 bg-purple-50">
                                        <h4 className="font-medium text-purple-800 mb-2 flex items-center gap-2">
                                            <ArrowRight size={16} /> Next Actions
                                        </h4>
                                        <ul className="space-y-2">
                                            {agentOutput.nextActions.map((action, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-purple-700 bg-white p-2 rounded border border-purple-100">
                                                    <span className="bg-purple-200 text-purple-800 text-xs font-bold px-1.5 py-0.5 rounded">{i + 1}</span>
                                                    {action}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Manual Submission Reminder */}
                        <div className="p-4 bg-slate-100 rounded-xl text-sm text-slate-600 flex items-start gap-3">
                            <Shield size={20} className="text-slate-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <strong>Manual Submission Required:</strong> Copy the packet draft above and paste it into the insurer's portal.
                                This system does NOT submit claims automatically.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-100">
                <div className="flex gap-4 items-center">
                    <div className="p-3 bg-white rounded-full shadow-sm text-purple-600"><Shield size={24} /></div>
                    <div>
                        <h3 className="font-bold text-purple-900">Pre-Auth Queue (Agentic Workflow)</h3>
                        <p className="text-sm text-purple-700">Create cases with minimal input — system auto-populates & LLM generates packets</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchCases} className="p-2 text-purple-600 hover:bg-white rounded-lg">
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium"
                    >
                        <Plus size={18} /> New Case
                    </button>
                </div>
            </div>

            {/* Queue Table */}
            {loading ? (
                <div className="p-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2" />
                    Loading queue...
                </div>
            ) : cases.length === 0 ? (
                <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl">
                    <Shield size={48} className="mx-auto mb-3 text-gray-300" />
                    <p>No pre-auth cases yet. Click "New Case" to create one.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-sm">Case #</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-sm">Patient</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-sm">Insurer</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-sm">Est. Amount</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-sm">Status</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-sm text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {cases.map((c) => (
                                <tr key={c._id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-sm text-purple-600">{c.caseNumber}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-800">{c.patient?.firstName} {c.patient?.lastName}</div>
                                        <div className="text-xs text-gray-400">{c.patient?.patientId}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{c.insurerName}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800">₹{(c.estimatedAmount || 0).toLocaleString()}</td>
                                    <td className="px-6 py-4"><QueueStatusBadge status={c.status} /></td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setSelectedCase(c)}
                                            className="text-purple-600 hover:bg-purple-50 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all font-medium text-sm inline-flex items-center gap-1"
                                        >
                                            View <ChevronRight size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
            {showCreateModal && <CreateCaseModal />}
            {selectedCase && <CaseDetailPanel />}
        </div>
    );
};

export default PreAuthQueueTab;
