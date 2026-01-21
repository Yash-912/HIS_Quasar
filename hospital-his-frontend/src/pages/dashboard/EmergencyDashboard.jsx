import React, { useState, useEffect } from 'react';
import EmergencyOrderSets from '../../components/emergency/EmergencyOrderSets';
import patientsService from '../../services/patients.service';
import axios from 'axios';
import './EmergencyDashboard.css';

/**
 * Emergency Dashboard Page
 * Testing page for Emergency Order Sets module
 */
const EmergencyDashboard = () => {
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [emergencyId, setEmergencyId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [creatingEmergency, setCreatingEmergency] = useState(false);

    // Fetch patients for testing
    useEffect(() => {
        fetchPatients();
    }, []);

    const getAuthConfig = () => {
        const user = JSON.parse(localStorage.getItem('user'));
        return {
            headers: { Authorization: `Bearer ${user?.token}` }
        };
    };

    const fetchPatients = async () => {
        try {
            const data = await patientsService.getPatients();
            const patientList = Array.isArray(data) ? data : (data?.patients || []);
            setPatients(patientList);
        } catch (error) {
            console.error('Failed to fetch patients:', error);
            setPatients([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePatientSelect = async (patient) => {
        setSelectedPatient(patient);
        setCreatingEmergency(true);

        try {
            // Create a real emergency record for this patient
            const response = await axios.post(
                'http://localhost:5000/api/v1/emergency/cases',
                {
                    patient: patient._id,
                    chiefComplaint: 'Emergency Order Set Testing',
                    triageLevel: 'urgent',
                    arrivalMode: 'walk-in',
                    status: 'in-treatment'
                },
                getAuthConfig()
            );

            if (response.data.success) {
                setEmergencyId(response.data.data._id || response.data.data.emergency?._id);
            } else {
                console.error('Failed to create emergency:', response.data);
                alert('Failed to create emergency record');
            }
        } catch (error) {
            console.error('Error creating emergency:', error);
            // Try to use existing emergency if creation fails
            try {
                const existingEmergency = await axios.get(
                    `http://localhost:5000/api/v1/emergency/cases?patient=${patient._id}`,
                    getAuthConfig()
                );
                if (existingEmergency.data.success && existingEmergency.data.data.length > 0) {
                    setEmergencyId(existingEmergency.data.data[0]._id);
                } else {
                    alert('Could not create or find emergency record. Check backend logs.');
                }
            } catch (e) {
                console.error('Error fetching existing emergency:', e);
                alert('Error: Could not create emergency record');
            }
        } finally {
            setCreatingEmergency(false);
        }
    };

    const handleOrdersCreated = (result) => {
        console.log('Orders created:', result);
        alert(`✅ Orders created successfully!\n\n${JSON.stringify(result, null, 2)}`);
    };

    return (
        <div className="emergency-dashboard">
            <header className="dashboard-header">
                <h1>🚨 Emergency Department</h1>
                <p>Emergency Order Sets Testing Dashboard</p>
            </header>

            <div className="dashboard-content">
                {/* Patient Selection Panel */}
                <div className="patient-panel">
                    <h2>Select Patient</h2>
                    {loading ? (
                        <p>Loading patients...</p>
                    ) : patients.length === 0 ? (
                        <div className="no-patients">
                            <p>No patients found. Run the seed script first:</p>
                            <code>node scripts/seed.js</code>
                        </div>
                    ) : (
                        <ul className="patient-list">
                            {patients.map(patient => (
                                <li
                                    key={patient._id}
                                    className={selectedPatient?._id === patient._id ? 'selected' : ''}
                                    onClick={() => handlePatientSelect(patient)}
                                >
                                    <span className="patient-id">{patient.patientId}</span>
                                    <span className="patient-name">
                                        {patient.firstName} {patient.lastName}
                                    </span>
                                    <span className="patient-age">{patient.age}y</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Order Sets Panel */}
                <div className="order-sets-panel">
                    {creatingEmergency ? (
                        <div className="no-selection">
                            <h3>⏳ Creating emergency record...</h3>
                            <p>Please wait while we set up the emergency visit.</p>
                        </div>
                    ) : selectedPatient && emergencyId ? (
                        <EmergencyOrderSets
                            patientId={selectedPatient._id}
                            emergencyId={emergencyId}
                            patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                            onOrdersCreated={handleOrdersCreated}
                        />
                    ) : selectedPatient && !emergencyId ? (
                        <div className="no-selection">
                            <h3>⚠️ No Emergency Record</h3>
                            <p>Failed to create emergency record. Check console for errors.</p>
                        </div>
                    ) : (
                        <div className="no-selection">
                            <h3>👈 Select a patient to view Emergency Order Sets</h3>
                            <p>Choose a patient from the left panel to apply trauma, cardiac, or stroke protocols.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmergencyDashboard;
