import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Stethoscope, User, Bed, Calendar, Search,
    ChevronLeft, AlertTriangle, Activity
} from 'lucide-react';
import NursingMAR from '../../components/pharmacy/NursingMAR';

/**
 * Nursing Dashboard Page
 * 
 * Entry point for nursing staff to manage:
 * - Medication Administration Records (MAR)
 * - Patient care workflows
 */

const Nursing = () => {
    const [searchParams] = useSearchParams();
    const initialAdmissionId = searchParams.get('admission');

    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAdmission, setSelectedAdmission] = useState(null);
    const [patientInfo, setPatientInfo] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Mock fetch admissions - in real app, this would call API
    useEffect(() => {
        const fetchAdmissions = async () => {
            setLoading(true);
            try {
                // TODO: Replace with actual API call
                // const res = await ipdService.getActiveAdmissions();
                // setAdmissions(res.data);

                // Mock data for now
                setAdmissions([
                    {
                        _id: 'adm001',
                        admissionNumber: 'ADM20260121001',
                        patient: {
                            _id: 'pat001',
                            patientId: 'P2026001',
                            firstName: 'John',
                            lastName: 'Doe',
                            dateOfBirth: '1985-05-15',
                            allergies: ['Penicillin']
                        },
                        ward: 'General Ward',
                        bed: 'A-101',
                        admissionDate: new Date().toISOString(),
                        attendingDoctor: { profile: { firstName: 'Sarah', lastName: 'Smith' } }
                    },
                    {
                        _id: 'adm002',
                        admissionNumber: 'ADM20260121002',
                        patient: {
                            _id: 'pat002',
                            patientId: 'P2026002',
                            firstName: 'Jane',
                            lastName: 'Wilson',
                            dateOfBirth: '1990-08-22',
                            allergies: []
                        },
                        ward: 'ICU',
                        bed: 'ICU-05',
                        admissionDate: new Date().toISOString(),
                        attendingDoctor: { profile: { firstName: 'Mike', lastName: 'Johnson' } }
                    },
                ]);
            } catch (error) {
                console.error('Error fetching admissions:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAdmissions();
    }, []);

    // Auto-select admission from URL param
    useEffect(() => {
        if (initialAdmissionId && admissions.length > 0) {
            const admission = admissions.find(a => a._id === initialAdmissionId);
            if (admission) {
                handleSelectAdmission(admission);
            }
        }
    }, [initialAdmissionId, admissions]);

    const handleSelectAdmission = (admission) => {
        setSelectedAdmission(admission._id);
        setPatientInfo(admission.patient);
    };

    const filteredAdmissions = admissions.filter(adm => {
        const search = searchTerm.toLowerCase();
        const name = `${adm.patient?.firstName} ${adm.patient?.lastName}`.toLowerCase();
        const id = adm.patient?.patientId?.toLowerCase() || '';
        const bed = adm.bed?.toLowerCase() || '';
        return name.includes(search) || id.includes(search) || bed.includes(search);
    });

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <Stethoscope className="text-violet-500" size={32} />
                        Nursing Station
                    </h1>
                    <p className="text-gray-500 mt-1">Medication Administration & Patient Care</p>
                </div>

                {/* Quick Stats */}
                <div className="flex gap-4">
                    <div className="bg-violet-50 px-4 py-2 rounded-lg">
                        <span className="text-sm text-violet-600 font-medium">
                            Active Patients: {admissions.length}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Patient List Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search patients..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                />
                                <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                            </div>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto">
                            {loading ? (
                                <div className="text-center py-12 text-gray-400">Loading...</div>
                            ) : filteredAdmissions.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">No patients found</div>
                            ) : (
                                filteredAdmissions.map((admission) => (
                                    <div
                                        key={admission._id}
                                        onClick={() => handleSelectAdmission(admission)}
                                        className={`p-4 border-b border-gray-50 cursor-pointer transition-colors ${selectedAdmission === admission._id
                                                ? 'bg-violet-50 border-l-4 border-l-violet-500'
                                                : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                                                <User size={20} className="text-violet-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-800 truncate">
                                                    {admission.patient?.firstName} {admission.patient?.lastName}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {admission.patient?.patientId}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Bed size={12} />
                                                {admission.bed}
                                            </span>
                                            <span>{admission.ward}</span>
                                        </div>
                                        {admission.patient?.allergies?.length > 0 && (
                                            <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                                                <AlertTriangle size={12} />
                                                Allergies: {admission.patient.allergies.join(', ')}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* MAR Panel */}
                <div className="lg:col-span-3">
                    {selectedAdmission ? (
                        <NursingMAR
                            admissionId={selectedAdmission}
                            patientInfo={patientInfo}
                        />
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-full flex items-center justify-center">
                            <div className="text-center p-12">
                                <Activity size={64} className="mx-auto text-gray-200 mb-4" />
                                <h3 className="text-xl font-bold text-gray-400">Select a Patient</h3>
                                <p className="text-gray-400 mt-1">
                                    Choose a patient from the list to view their MAR
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Nursing;
