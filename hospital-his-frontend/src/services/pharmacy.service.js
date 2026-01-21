import axios from 'axios';

const API_URL = 'http://localhost:5000/api/v1/pharmacy';
const APPOINTMENT_URL = 'http://localhost:5000/api/v1/opd/appointments';

const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    return { headers: { Authorization: `Bearer ${user?.token}` } };
};

const pharmacyService = {
    // Get Pending Prescriptions (Unified Queue for OPD & Emergency)
    getPendingPrescriptions: async () => {
        const response = await axios.get(`${API_URL}/queue`, getConfig());
        return response.data;
    },

    // Dispense Medicines (Deduct Stock & Clear Request)
    // data: { appointmentId } OR { prescriptionId }
    dispensePrescription: async (data) => {
        const response = await axios.post(`${API_URL}/dispense`, data, getConfig());
        return response.data;
    },

    // Get Pharmacy Inventory With Search
    getInventory: async (searchString = '') => {
        const response = await axios.get(`${API_URL}/inventory`, {
            ...getConfig(),
            params: { search: searchString }
        });
        return response.data;
    },

    // Add New Stock (and Medicine if new)
    addInventory: async (data) => {
        const response = await axios.post(`${API_URL}/inventory`, data, getConfig());
        return response.data;
    }
};

export default pharmacyService;
