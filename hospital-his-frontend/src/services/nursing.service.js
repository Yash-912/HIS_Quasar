import axios from 'axios';

const API_URL = 'http://localhost:5000/api/v1/nursing';

const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    return { headers: { Authorization: `Bearer ${user?.token}` } };
};

/**
 * Nursing Service
 * 
 * API methods for Medication Administration Record (MAR)
 */
const nursingService = {
    // ============================================================
    // MAR (Medication Administration Record)
    // ============================================================

    // Get MAR schedule for an admission
    getMARSchedule: async (admissionId, options = {}) => {
        const { date, status } = options;
        const response = await axios.get(`${API_URL}/mar/${admissionId}`, {
            ...getConfig(),
            params: { date, status }
        });
        return response.data;
    },

    // Get overdue medications
    getOverdueMedications: async (admissionId) => {
        const response = await axios.get(`${API_URL}/mar/${admissionId}/overdue`, getConfig());
        return response.data;
    },

    // Get single MAR record
    getMARRecord: async (marId) => {
        const response = await axios.get(`${API_URL}/mar/record/${marId}`, getConfig());
        return response.data;
    },

    // Run pre-administration safety check
    preAdminSafetyCheck: async (marId) => {
        const response = await axios.post(`${API_URL}/mar/${marId}/safety-check`, {}, getConfig());
        return response.data;
    },

    // Record medication administration
    recordAdministration: async (marId, data) => {
        const response = await axios.post(`${API_URL}/mar/${marId}/administer`, data, getConfig());
        return response.data;
    },

    // Hold medication
    holdMedication: async (marId, holdReason, holdDetails) => {
        const response = await axios.post(`${API_URL}/mar/${marId}/hold`, {
            holdReason,
            holdDetails
        }, getConfig());
        return response.data;
    },

    // Record patient refusal
    recordRefusal: async (marId, refusalReason) => {
        const response = await axios.post(`${API_URL}/mar/${marId}/refuse`, {
            refusalReason
        }, getConfig());
        return response.data;
    },

    // Create MAR schedule from dispense
    createMARSchedule: async (dispenseId, admissionId) => {
        const response = await axios.post(`${API_URL}/mar/create-schedule`, {
            dispenseId,
            admissionId
        }, getConfig());
        return response.data;
    },
};

export default nursingService;
