import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Scan, Shield, Camera, Upload, RefreshCw, AlertCircle, CheckCircle, UserPlus, Search, ChevronDown, ChevronUp, Mail, Phone, Building2 } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { createPatient } from '../../features/patients/patientsSlice';
import ScanIDModal from '../idScan/ScanIDModal';
import axios from 'axios';

const API_URL = 'http://98.93.152.237:5000/api/v1';

const AddPatientModal = ({ isOpen, onClose }) => {
    const dispatch = useDispatch();
    const [step, setStep] = useState('form'); // 'form' or 'success'
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);

    // Initial State
    const initialFormData = {
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
        phone: '',
        email: '',
        bloodGroup: '',
        identificationMark: '',
        maskedAadhaar: '',
        address: {
            street: '',
            city: '',
            state: '',
            pincode: ''
        },
        idDocument: {
            hasOptedIn: false,
            imageData: null, // Base64 for preview
        },
        // Referral Information (Optional)
        referral: {
            type: null, // 'INTERNAL' or 'EXTERNAL' or null
            doctorId: '',
            doctorName: '',
            clinicName: '',
            email: '',
            phone: '',
        }
    };
    const [formData, setFormData] = useState(initialFormData);
    const [idCaptureStatus, setIdCaptureStatus] = useState('idle'); // 'idle', 'captured', 'uploading'
    const [isCameraActive, setIsCameraActive] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);

    // Referral state
    const [showReferral, setShowReferral] = useState(false);
    const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
    const [doctorSearchResults, setDoctorSearchResults] = useState([]);
    const [isSearchingDoctors, setIsSearchingDoctors] = useState(false);
    const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: { ...prev[parent], [child]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    /**
     * Handle extracted data from ID scan
     * Auto-fills the form with extracted information
     */
    const handleIdExtracted = (extractedData) => {
        setFormData(prev => ({
            ...prev,
            firstName: extractedData.firstName || prev.firstName,
            lastName: extractedData.lastName || prev.lastName,
            dateOfBirth: extractedData.dateOfBirth || prev.dateOfBirth,
            gender: extractedData.gender || prev.gender,
            phone: extractedData.phone || prev.phone,
            maskedAadhaar: extractedData.maskedAadhaar || prev.maskedAadhaar,
        }));
    };

    /**
     * Search for internal doctors
     */
    const searchDoctors = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setDoctorSearchResults([]);
            return;
        }

        setIsSearchingDoctors(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/users/doctors/search?query=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDoctorSearchResults(response.data.data || []);
            setShowDoctorDropdown(true);
        } catch (error) {
            console.error('Doctor search failed:', error);
            setDoctorSearchResults([]);
        } finally {
            setIsSearchingDoctors(false);
        }
    }, []);

    // Debounced doctor search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (doctorSearchQuery && formData.referral.type === 'INTERNAL') {
                searchDoctors(doctorSearchQuery);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [doctorSearchQuery, formData.referral.type, searchDoctors]);

    /**
     * Select an internal doctor from search results
     */
    const selectInternalDoctor = (doctor) => {
        setFormData(prev => ({
            ...prev,
            referral: {
                ...prev.referral,
                type: 'INTERNAL',
                doctorId: doctor._id,
                doctorName: `${doctor.profile?.firstName || ''} ${doctor.profile?.lastName || ''}`.trim(),
                email: doctor.email,
                phone: doctor.profile?.phone || '',
                clinicName: '',
            }
        }));
        setDoctorSearchQuery('');
        setShowDoctorDropdown(false);
    };

    /**
     * Handle external referral input
     */
    const handleExternalReferral = (field, value) => {
        setFormData(prev => ({
            ...prev,
            referral: {
                ...prev.referral,
                type: 'EXTERNAL',
                doctorId: '',
                [field]: value,
            }
        }));
    };

    /**
     * Clear referral information
     */
    const clearReferral = () => {
        setFormData(prev => ({
            ...prev,
            referral: {
                type: null,
                doctorId: '',
                doctorName: '',
                clinicName: '',
                email: '',
                phone: '',
            }
        }));
        setDoctorSearchQuery('');
        setShowReferral(false);
    };

    const startCamera = async () => {
        setIsCameraActive(true);
        // Small delay to ensure video element is rendered
        setTimeout(async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                setIsCameraActive(false);
                alert("Could not access camera. Please check permissions.");
            }
        }, 100);
    };

    const stopCamera = () => {
        setIsCameraActive(false);
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    const captureImage = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageDataUrl = canvas.toDataURL('image/jpeg');

            setFormData(prev => ({
                ...prev,
                idDocument: {
                    ...prev.idDocument,
                    imageData: imageDataUrl
                }
            }));
            setIdCaptureStatus('captured');
            stopCamera();
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({
                    ...prev,
                    idDocument: {
                        ...prev.idDocument,
                        imageData: reader.result
                    }
                }));
                setIdCaptureStatus('captured');
            };
            reader.readAsDataURL(file);
        }
    };

    const resetIdCapture = () => {
        setFormData(prev => ({
            ...prev,
            idDocument: {
                ...prev.idDocument,
                imageData: null
            }
        }));
        setIdCaptureStatus('idle');
        stopCamera();
    };

    const handleOptOut = () => {
        setFormData(prev => ({
            ...prev,
            idDocument: {
                ...prev.idDocument,
                imageData: null,
                hasOptedIn: false
            }
        }));
        setIdCaptureStatus('idle');
        stopCamera();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Prepare data for submission
            const submitData = { ...formData };

            // If ID image was captured, we'll send it as base64
            // Backend will handle saving and return the path
            if (formData.idDocument.imageData) {
                submitData.idDocumentImage = formData.idDocument.imageData;
            }
            delete submitData.idDocument.imageData; // Don't store raw base64 in schema

            await dispatch(createPatient(submitData)).unwrap();
            setStep('success');
            setTimeout(() => {
                setStep('form');
                setFormData(initialFormData);
                setIdCaptureStatus('idle');
                stopCamera();
                onClose();
            }, 2500);
        } catch (error) {
            console.error(error);
            alert('Failed to create patient: ' + error);
        }
    };

    // Cleanup on close
    const handleClose = () => {
        stopCamera();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={handleClose}
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden"
                >
                    {step === 'form' ? (
                        <>
                            {/* Header with Scan ID button */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-100">
                                <h2 className="text-xl font-bold text-slate-800">New Patient Registration</h2>
                                <div className="flex items-center gap-2">
                                    {/* Scan ID Button - NEW ADDITION */}
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setIsScanModalOpen(true)}
                                        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md text-sm font-medium"
                                    >
                                        <Scan size={16} />
                                        Scan ID
                                    </motion.button>
                                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-gray-500">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                                {/* ID Scan hint banner */}
                                {!formData.maskedAadhaar && (
                                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-sm">
                                        <Scan size={18} />
                                        <p>
                                            <strong>Tip:</strong> Click "Scan ID" to auto-fill patient details from Aadhaar card
                                        </p>
                                    </div>
                                )}

                                {/* Show masked Aadhaar if scanned */}
                                {formData.maskedAadhaar && (
                                    <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                        <Shield size={18} className="text-emerald-600" />
                                        <div>
                                            <p className="text-sm font-medium text-emerald-800">ID Verified</p>
                                            <p className="text-xs text-emerald-600 font-mono">
                                                Aadhaar: {formData.maskedAadhaar}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                                        <input required name="firstName" value={formData.firstName} onChange={handleChange} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" placeholder="John" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                                        <input required name="lastName" value={formData.lastName} onChange={handleChange} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Doe" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth *</label>
                                        <input required type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Gender *</label>
                                        <select required name="gender" value={formData.gender} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                                            <option value="">Select</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number *</label>
                                        <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" placeholder="+91 98765 43210" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
                                        <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                                            <option value="">Select</option>
                                            <option value="A+">A+</option>
                                            <option value="A-">A-</option>
                                            <option value="B+">B+</option>
                                            <option value="B-">B-</option>
                                            <option value="O+">O+</option>
                                            <option value="O-">O-</option>
                                            <option value="AB+">AB+</option>
                                            <option value="AB-">AB-</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                                    <input name="address.city" value={formData.address.city} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" placeholder="City" />
                                </div>

                                {/* Identification Section */}
                                <div className="border-t border-gray-100 pt-6">
                                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Identification</h3>

                                    {/* Birth Mark / Identification Mark */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Birth Mark / Identification Mark
                                            <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                                        </label>
                                        <input
                                            name="identificationMark"
                                            value={formData.identificationMark}
                                            onChange={handleChange}
                                            maxLength={100}
                                            className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                            placeholder="e.g. Mole on left cheek"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Max 100 characters. Helps in patient identification.</p>
                                    </div>

                                    {/* ID Verification Section */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h4 className="font-semibold text-slate-700">ID Verification</h4>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    📋 For identification assistance only. Not government authentication.
                                                </p>
                                            </div>
                                            {idCaptureStatus === 'captured' && (
                                                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                                    <CheckCircle size={12} /> Captured
                                                </span>
                                            )}
                                        </div>

                                        {/* Camera / Upload Area */}
                                        {idCaptureStatus === 'idle' && !isCameraActive && (
                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={startCamera}
                                                    className="flex-1 flex items-center justify-center gap-2 p-4 bg-white border-2 border-dashed border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-gray-600 hover:text-primary"
                                                >
                                                    <Camera size={20} />
                                                    <span className="font-medium">Use Camera</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="flex-1 flex items-center justify-center gap-2 p-4 bg-white border-2 border-dashed border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-gray-600 hover:text-primary"
                                                >
                                                    <Upload size={20} />
                                                    <span className="font-medium">Upload Image</span>
                                                </button>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                />
                                            </div>
                                        )}

                                        {/* Camera View */}
                                        {isCameraActive && (
                                            <div className="relative">
                                                <video
                                                    ref={videoRef}
                                                    autoPlay
                                                    playsInline
                                                    className="w-full rounded-lg bg-black"
                                                />
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        type="button"
                                                        onClick={captureImage}
                                                        className="flex-1 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark flex items-center justify-center gap-2"
                                                    >
                                                        <Camera size={18} /> Capture ID
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={stopCamera}
                                                        className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Preview Captured Image */}
                                        {idCaptureStatus === 'captured' && formData.idDocument.imageData && (
                                            <div className="relative">
                                                <img
                                                    src={formData.idDocument.imageData}
                                                    alt="Captured ID"
                                                    className="w-full max-h-48 object-contain rounded-lg border border-gray-200 bg-white"
                                                />
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        type="button"
                                                        onClick={resetIdCapture}
                                                        className="flex-1 py-2 bg-amber-50 text-amber-600 rounded-lg font-medium hover:bg-amber-100 flex items-center justify-center gap-2"
                                                    >
                                                        <RefreshCw size={16} /> Retake / Re-upload
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleOptOut}
                                                        className="px-4 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 text-sm"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Opt-out option */}
                                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                                            <AlertCircle size={12} />
                                            <span>Patient can opt out of ID capture at any time.</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ═══════════════════════════════════════════════════════════════════════════════ */}
                                {/* REFERRAL SECTION (Optional) */}
                                {/* ═══════════════════════════════════════════════════════════════════════════════ */}
                                <div className="border-t border-gray-100 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowReferral(!showReferral)}
                                        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                                <UserPlus size={20} className="text-indigo-600" />
                                            </div>
                                            <div className="text-left">
                                                <h3 className="text-sm font-bold text-slate-700">Referred By Doctor</h3>
                                                <p className="text-xs text-gray-500">Optional - Record referral for coordination</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {formData.referral.doctorName && (
                                                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                                                    {formData.referral.type === 'INTERNAL' ? '🏥' : '🩺'} {formData.referral.doctorName}
                                                </span>
                                            )}
                                            {showReferral ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {showReferral && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pt-4 space-y-4">
                                                    {/* Referral Type Tabs */}
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, referral: { ...prev.referral, type: 'INTERNAL', doctorId: '', doctorName: '', email: '', phone: '', clinicName: '' } }))}
                                                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${formData.referral.type === 'INTERNAL'
                                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            🏥 Internal Doctor
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, referral: { ...prev.referral, type: 'EXTERNAL', doctorId: '', doctorName: '', email: '', phone: '', clinicName: '' } }))}
                                                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${formData.referral.type === 'EXTERNAL'
                                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            🩺 External Doctor
                                                        </button>
                                                    </div>

                                                    {/* Internal Doctor Search */}
                                                    {formData.referral.type === 'INTERNAL' && (
                                                        <div className="relative">
                                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                Search Internal Doctor
                                                            </label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={doctorSearchQuery}
                                                                    onChange={(e) => setDoctorSearchQuery(e.target.value)}
                                                                    onFocus={() => doctorSearchResults.length > 0 && setShowDoctorDropdown(true)}
                                                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                                    placeholder="Type doctor name..."
                                                                />
                                                                <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                                                                {isSearchingDoctors && (
                                                                    <div className="absolute right-3 top-3">
                                                                        <div className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Search Results Dropdown */}
                                                            {showDoctorDropdown && doctorSearchResults.length > 0 && (
                                                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                                    {doctorSearchResults.map((doctor) => (
                                                                        <button
                                                                            key={doctor._id}
                                                                            type="button"
                                                                            onClick={() => selectInternalDoctor(doctor)}
                                                                            className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
                                                                        >
                                                                            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold">
                                                                                {doctor.profile?.firstName?.[0]}{doctor.profile?.lastName?.[0]}
                                                                            </div>
                                                                            <div>
                                                                                <div className="font-medium text-slate-800">
                                                                                    Dr. {doctor.profile?.firstName} {doctor.profile?.lastName}
                                                                                </div>
                                                                                <div className="text-xs text-gray-500">
                                                                                    {doctor.profile?.specialization || doctor.department?.name || 'General'}
                                                                                </div>
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Selected Doctor Display */}
                                                            {formData.referral.doctorName && formData.referral.type === 'INTERNAL' && (
                                                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <CheckCircle size={16} className="text-green-600" />
                                                                        <span className="font-medium text-green-800">Dr. {formData.referral.doctorName}</span>
                                                                        <span className="text-xs text-green-600">({formData.referral.email})</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={clearReferral}
                                                                        className="text-red-500 hover:text-red-700 text-sm"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* External Doctor Form */}
                                                    {formData.referral.type === 'EXTERNAL' && (
                                                        <div className="space-y-3">
                                                            <div>
                                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                    Doctor Name *
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={formData.referral.doctorName}
                                                                    onChange={(e) => handleExternalReferral('doctorName', e.target.value)}
                                                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                                    placeholder="Dr. John Smith"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                    <Building2 size={14} className="inline mr-1" />
                                                                    Clinic / Hospital Name
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={formData.referral.clinicName}
                                                                    onChange={(e) => handleExternalReferral('clinicName', e.target.value)}
                                                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                                    placeholder="City Medical Center"
                                                                />
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                        <Mail size={14} className="inline mr-1" />
                                                                        Email <span className="text-amber-500 text-xs">(for notification)</span>
                                                                    </label>
                                                                    <input
                                                                        type="email"
                                                                        value={formData.referral.email}
                                                                        onChange={(e) => handleExternalReferral('email', e.target.value)}
                                                                        className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                                        placeholder="doctor@clinic.com"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                        <Phone size={14} className="inline mr-1" />
                                                                        Phone
                                                                    </label>
                                                                    <input
                                                                        type="tel"
                                                                        value={formData.referral.phone}
                                                                        onChange={(e) => handleExternalReferral('phone', e.target.value)}
                                                                        className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                                        placeholder="+91 98765 43210"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {formData.referral.email && (
                                                                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
                                                                    <Mail size={16} className="mt-0.5 flex-shrink-0" />
                                                                    <span>A professional notification email will be sent to the referring doctor when registration is complete.</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Clear Referral Button */}
                                                    {formData.referral.type && (
                                                        <button
                                                            type="button"
                                                            onClick={clearReferral}
                                                            className="w-full py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
                                                        >
                                                            Clear Referral Information
                                                        </button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <canvas ref={canvasRef} className="hidden" />

                                <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                                    <button type="button" onClick={handleClose} className="px-5 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancel</button>
                                    <button type="submit" className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark shadow-md font-medium">
                                        Register Patient
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center h-80">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                                className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-500 mb-4"
                            >
                                <Check size={40} strokeWidth={3} />
                            </motion.div>
                            <motion.h3
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-xl font-bold text-slate-800"
                            >
                                Registration Successful!
                            </motion.h3>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-gray-500 mt-2"
                            >
                                Patient record has been created.
                            </motion.p>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Scan ID Modal */}
            <ScanIDModal
                isOpen={isScanModalOpen}
                onClose={() => setIsScanModalOpen(false)}
                onExtracted={handleIdExtracted}
            />
        </AnimatePresence>
    );
};

export default AddPatientModal;

