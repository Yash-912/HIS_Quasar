import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pill, CheckCircle, Clock, User, FileText, X, Check, Package, LayoutGrid } from 'lucide-react';
import pharmacyService from '../../services/pharmacy.service';
import InventoryManager from '../../components/pharmacy/InventoryManager';

const Pharmacy = () => {
    const [searchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') === 'inventory' ? 'inventory' : 'queue';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPrescription, setSelectedPrescription] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchQueue = async () => {
        setLoading(true);
        try {
            const res = await pharmacyService.getPendingPrescriptions();
            setQueue(res.data || []);
        } catch (error) {
            console.error("Error fetching pharmacy queue", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'queue') {
            fetchQueue();
            const interval = setInterval(fetchQueue, 30000); // Poll every 30s
            return () => clearInterval(interval);
        }
    }, [activeTab]);

    const handleDispense = async () => {
        if (!selectedPrescription) return;
        try {
            const payload = selectedPrescription.sourceType === 'prescription'
                ? { prescriptionId: selectedPrescription._id }
                : { appointmentId: selectedPrescription._id };

            await pharmacyService.dispensePrescription(payload);
            alert("Medicines Dispensed Successfully!");
            setSelectedPrescription(null);
            fetchQueue(); // Refresh queue
        } catch (error) {
            console.error("Error dispensing", error);
            alert("Failed to dispense");
        }
    };

    const filteredQueue = queue.filter(item => {
        const fullName = `${item.patient?.firstName} ${item.patient?.lastName}`.toLowerCase();
        const id = item.patient?.patientId?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || id.includes(search);
    });

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <Pill className="text-emerald-500" size={32} /> Pharmacy
                    </h1>
                    <p className="text-gray-500 mt-1">Dispensing & Inventory Management</p>
                </div>

                {/* Tab Switcher */}
                <div className="flex p-1 bg-gray-100 rounded-xl">
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'queue' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Clock size={16} /> Dispensing Queue
                    </button>
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'inventory' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Package size={16} /> Inventory
                    </button>
                </div>
            </div>

            {activeTab === 'queue' ? (
                // Queue View
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="relative flex-1 md:flex-none">
                                <input
                                    type="text"
                                    placeholder="Search Patient Name or ID..."
                                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <FileText size={18} className="absolute left-3 top-2.5 text-gray-400" />
                            </div>

                            <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-lg text-emerald-700 font-medium whitespace-nowrap">
                                <Clock size={18} />
                                <span>Pending: {filteredQueue.length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading && queue.length === 0 ? (
                            <div className="col-span-full text-center py-20 text-gray-400">Loading queue...</div>
                        ) : filteredQueue.length === 0 ? (
                            <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                                <CheckCircle size={48} className="mx-auto text-emerald-200 mb-4" />
                                <h3 className="text-xl font-bold text-slate-400">
                                    {searchTerm ? 'No matches found.' : 'All Clear!'}
                                </h3>
                                <p className="text-gray-400">
                                    {searchTerm ? 'Try a different search term.' : 'No pending prescriptions at the moment.'}
                                </p>
                            </div>
                        ) : (
                            filteredQueue.map((item) => (
                                <motion.div
                                    key={item._id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    layout
                                    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                    onClick={() => setSelectedPrescription(item)}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                            Token #{item.tokenNumber}
                                        </span>
                                        <span className="text-xs text-gray-400">{new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>

                                    <h3 className="font-bold text-slate-800 text-lg mb-1 flex items-center gap-2">
                                        <User size={18} className="text-gray-400" />
                                        {item.patient?.firstName} {item.patient?.lastName}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-4 pl-6">{item.patient?.patientId}</p>

                                    <div className="border-t border-gray-50 pt-4 flex justify-between items-center">
                                        <div className="text-xs text-gray-500">
                                            Dr. {item.doctor?.profile?.firstName} {item.doctor?.profile?.lastName}
                                        </div>
                                        <button className="text-emerald-500 font-medium text-sm group-hover:underline flex items-center gap-1">
                                            View Rx <FileText size={14} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                // Inventory View
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <InventoryManager />
                </div>
            )}

            {/* Dispensing Modal */}
            <AnimatePresence>
                {selectedPrescription && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedPrescription(null)}></div>

                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden"
                        >
                            {/* Header */}
                            <div className="bg-emerald-600 p-6 text-white flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-2">
                                        <Pill className="text-emerald-200" /> Dispense Medicines
                                    </h2>
                                    <p className="text-emerald-100 mt-1">
                                        {selectedPrescription.patient?.firstName} {selectedPrescription.patient?.lastName} • {selectedPrescription.patient?.age}Y / {selectedPrescription.patient?.gender}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedPrescription(null)} className="p-2 bg-emerald-700/50 rounded-full hover:bg-emerald-700 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Rx List */}
                            <div className="p-8 max-h-[60vh] overflow-y-auto">
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Prescription from Dr. {selectedPrescription.doctor?.profile?.firstName}</h3>

                                    {selectedPrescription.prescription && selectedPrescription.prescription.length > 0 ? (
                                        <div className="space-y-3">
                                            {selectedPrescription.prescription.map((med, idx) => (
                                                <div key={idx} className="flex items-center p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold mr-4">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-slate-800 text-lg">{med.name}</div>
                                                        <div className="text-sm text-gray-500">{med.dosage}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg text-sm mb-1">{med.frequency}</div>
                                                        <div className="text-xs text-gray-400">{med.duration}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                            No medicines listed in this prescription.
                                        </div>
                                    )}
                                </div>

                                {selectedPrescription.diagnosis && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Diagnosis Note</span>
                                        <p className="text-slate-700 font-medium">{selectedPrescription.diagnosis}</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setSelectedPrescription(null)}
                                    className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDispense}
                                    className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center gap-2 transition-transform active:scale-95"
                                >
                                    <Check size={20} /> Mark as Dispensed
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Pharmacy;
