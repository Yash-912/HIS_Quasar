import axios from 'axios';

const API_URL = 'http://localhost:5001/api/v1/lab-reports';

const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    return { headers: { Authorization: `Bearer ${user?.token}` } };
};

const labReportService = {
    /**
     * Upload PDF lab report for a patient (Lab Tech only)
     * @param {string} patientId - Patient ID
     * @param {File} file - PDF file
     */
    uploadReport: async (patientId, file) => {
        const formData = new FormData();
        formData.append('report', file);
        const config = getConfig();
        config.headers['Content-Type'] = 'multipart/form-data';
        const response = await axios.post(`${API_URL}/${patientId}/upload`, formData, config);
        return response.data;
    },

    /**
     * Get lab report by ID (Doctor/Admin only)
     * @param {string} reportId - Report ID
     */
    getReport: async (reportId) => {
        const response = await axios.get(`${API_URL}/${reportId}`, getConfig());
        return response.data;
    },

    /**
     * Trigger AI summary generation (Doctor/Admin only)
     * @param {string} reportId - Report ID
     */
    generateSummary: async (reportId) => {
        const response = await axios.post(`${API_URL}/${reportId}/summarize`, {}, getConfig());
        return response.data;
    },

    /**
     * Get all lab reports for a patient (Doctor/Admin only)
     * @param {string} patientId - Patient ID
     */
    getReportsByPatient: async (patientId) => {
        const response = await axios.get(`${API_URL}/patient/${patientId}`, getConfig());
        return response.data;
    },

    /**
     * Get all lab reports (Doctor/Admin only)
     */
    getAllReports: async () => {
        const response = await axios.get(`${API_URL}/all`, getConfig());
        return response.data;
    },
};

export default labReportService;
