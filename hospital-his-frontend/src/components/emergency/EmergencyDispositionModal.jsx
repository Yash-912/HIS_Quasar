import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BedDouble, AlertTriangle, Activity, Home, ArrowRight,
    CheckCircle, X, AlertOctagon, FileText, ChevronLeft
} from 'lucide-react';
import emergencyOrderSetService from '../../services/emergency.orderSet.service';
// import './EmergencyDispositionModal.css'; // REMOVED: Using Tailwind directly

/**
 * Emergency Disposition Modal (Refactored)
 * Optimized for critical decision making with clear hierarchy and robust layout.
 */
const EmergencyDispositionModal = ({ emergencyCase, onClose, onDispositionComplete }) => {
    const [dispositionType, setDispositionType] = useState(''); // 'ipd', 'icu', 'ot', 'discharge'
    const [targetWard, setTargetWard] = useState('');
    const [surgeryNotes, setSurgeryNotes] = useState('');
    const [dischargeSummary, setDischargeSummary] = useState('');
    const [transferNotes, setTransferNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const data = {
                dispositionType,
                targetWard: dispositionType === 'ipd' ? targetWard : undefined,
                surgeryNotes: dispositionType === 'ot' ? surgeryNotes : undefined,
                dischargeSummary: dispositionType === 'discharge' ? dischargeSummary : undefined,
                transferNotes
            };

            const result = await emergencyOrderSetService.processDisposition(emergencyCase._id, data);

            if (onDispositionComplete) onDispositionComplete(result);
            onClose();
        } catch (error) {
            console.error("Error processing disposition:", error);
            alert("Failed to process disposition: " + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Configuration for disposition types to keep code clean and manageable
    const dispositionOptions = [
        {
            id: 'ipd',
            title: 'Shift to IPD',
            subtext: 'Admit to General, Semi-Private, or Private Ward.',
            icon: BedDouble,
            color: 'blue',
            style: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400'
        },
        {
            id: 'icu',
            title: 'Shift to ICU',
            subtext: 'Critical care transfer. Alerts ICU team immediately.',
            icon: AlertTriangle,
            color: 'red',
            style: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400 ring-1 ring-red-100' // Added extra visual weight
        },
        {
            id: 'ot',
            title: 'Shift to OT',
            subtext: 'Immediate surgical intervention required.',
            icon: Activity,
            color: 'amber', // Orange/Amber for procedural/caution
            style: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400'
        },
        {
            id: 'discharge',
            title: 'Discharge',
            subtext: 'Patient stable. Generate discharge summary.',
            icon: Home,
            color: 'emerald',
            style: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400'
        }
    ];

    const renderFormContent = () => {
        switch (dispositionType) {
            case 'ipd':
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                            <h4 className="font-bold text-blue-800 flex items-center gap-2">
                                <BedDouble size={20} /> Shift to In-Patient Department
                            </h4>
                            <p className="text-sm text-blue-600 mt-1">
                                Select ward type and provide reason for admission.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Recommended Ward Type</label>
                                <select
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    value={targetWard}
                                    onChange={(e) => setTargetWard(e.target.value)}
                                    required
                                >
                                    <option value="">Select Ward Type...</option>
                                    <option value="general">General Ward</option>
                                    <option value="semi-private">Semi-Private Room</option>
                                    <option value="private">Private Room</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Admission/Transfer Notes</label>
                                <textarea
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    rows="4"
                                    value={transferNotes}
                                    onChange={(e) => setTransferNotes(e.target.value)}
                                    placeholder="Diagnosis, reason for admission, special instructions..."
                                    required
                                ></textarea>
                            </div>
                        </div>
                    </div>
                );
            case 'icu':
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                            <h4 className="font-bold text-red-800 flex items-center gap-2">
                                <AlertOctagon size={20} /> CRITICAL: ICU Transfer
                            </h4>
                            <p className="text-sm text-red-600 mt-1">
                                This will activate ICU protocols and notify the critical care team.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Critical Care Notes</label>
                            <textarea
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-all bg-red-50/10"
                                rows="5"
                                value={transferNotes}
                                onChange={(e) => setTransferNotes(e.target.value)}
                                placeholder="Patient vitals, ventilation status, urgent medication requirements..."
                                required
                            ></textarea>
                        </div>
                    </div>
                );
            case 'ot':
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
                            <h4 className="font-bold text-amber-800 flex items-center gap-2">
                                <Activity size={20} /> Shift to Operation Theatre
                            </h4>
                            <p className="text-sm text-amber-600 mt-1">
                                Schedule immediate surgical intervention.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Planned Procedure / Surgery</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all font-medium"
                                    value={surgeryNotes}
                                    onChange={(e) => setSurgeryNotes(e.target.value)}
                                    placeholder="e.g. Exploratory Laparotomy"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Pre-Op Instructions</label>
                                <textarea
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                    rows="4"
                                    value={transferNotes}
                                    onChange={(e) => setTransferNotes(e.target.value)}
                                    placeholder="NPO status, consent status, blood component requirements..."
                                    required
                                ></textarea>
                            </div>
                        </div>
                    </div>
                );
            case 'discharge':
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg">
                            <h4 className="font-bold text-emerald-800 flex items-center gap-2">
                                <Home size={20} /> Discharge from Emergency
                            </h4>
                            <p className="text-sm text-emerald-600 mt-1">
                                Patient is stable for discharge. Finalize summary.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Discharge Summary & Advice <span className="text-slate-400 text-xs ml-2">(Will be printed)</span></label>
                            <textarea
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono text-sm"
                                rows="8"
                                value={dischargeSummary}
                                onChange={(e) => setDischargeSummary(e.target.value)}
                                placeholder="Treatment given, medications prescribed, follow-up instructions..."
                                required
                            ></textarea>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                {/* Modal Window */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Sticky Header */}
                    <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between z-10 sticky top-0">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                {dispositionType && (
                                    <button
                                        onClick={() => setDispositionType('')}
                                        className="mr-1 p-1 hover:bg-slate-100 rounded-full transition-colors"
                                        title="Back to options"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                )}
                                Emergency Disposition
                            </h2>
                            <div className="flex items-center gap-2 mt-1 text-sm">
                                <span className="text-slate-500">Patient:</span>
                                <span className="font-semibold text-slate-900">{emergencyCase.patient?.firstName} {emergencyCase.patient?.lastName}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300 mx-1" />
                                <span className={`px-2 py-0.5 rounded textxs font-bold uppercase tracking-wider ${emergencyCase.triageCategory === 'red' ? 'bg-red-100 text-red-700' :
                                        emergencyCase.triageCategory === 'yellow' ? 'bg-amber-100 text-amber-700' :
                                            'bg-green-100 text-green-700'
                                    }`}>
                                    {emergencyCase.triageCategory || 'Unknown'} Priority
                                </span>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                        {!dispositionType ? (
                            <div className="h-full flex flex-col justify-center">
                                <div className="text-center mb-8">
                                    <h3 className="text-lg font-medium text-slate-700">Select Final Clinical Outcome</h3>
                                    <p className="text-slate-500 text-sm">Choose the appropriate disposition pathway for this patient.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto w-full">
                                    {dispositionOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => setDispositionType(option.id)}
                                            className={`
                                                relative p-6 rounded-xl border-2 text-left transition-all duration-200 group
                                                ${option.style}
                                            `}
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className={`p-3 rounded-lg bg-white/60 backdrop-blur-sm shadow-sm`}>
                                                    <option.icon size={32} strokeWidth={1.5} />
                                                </div>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                                    <ArrowRight size={20} />
                                                </div>
                                            </div>
                                            <h4 className="text-xl font-bold mb-1">{option.title}</h4>
                                            <p className="text-sm opacity-90 font-medium">{option.subtext}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <form id="disposition-form" onSubmit={handleSubmit} className="max-w-2xl mx-auto bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                                {renderFormContent()}
                            </form>
                        )}
                    </div>

                    {/* Footer (Only visible when form is active) */}
                    {dispositionType && (
                        <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 z-10">
                            <button
                                type="button"
                                onClick={() => { setDispositionType(''); setTransferNotes(''); }}
                                className="px-5 py-2.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-medium transition-colors"
                            >
                                Cancel / Back
                            </button>
                            <button
                                type="submit"
                                form="disposition-form"
                                disabled={loading}
                                className="px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading && (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                )}
                                <span>Confirm & {dispositionType === 'discharge' ? 'Discharge' : 'Transfer'}</span>
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default EmergencyDispositionModal;
