import axios from 'axios';

const API_URL = 'http://localhost:5000/api/v1/order-sets';

const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    return { headers: { Authorization: `Bearer ${user?.token}` } };
};

const orderSetService = {
    /**
     * Get all active order sets
     * @param {Object} filters - Optional filters (type, triageLevel)
     */
    getAll: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.type) params.append('type', filters.type);
        if (filters.triageLevel) params.append('triageLevel', filters.triageLevel);

        const url = params.toString() ? `${API_URL}?${params}` : API_URL;
        const response = await axios.get(url, getConfig());
        return response.data;
    },

    /**
     * Get order set by ID
     */
    getById: async (id) => {
        const response = await axios.get(`${API_URL}/${id}`, getConfig());
        return response.data;
    },

    /**
     * Get order sets by type (trauma, cardiac, stroke, etc.)
     */
    getByType: async (type) => {
        const response = await axios.get(`${API_URL}/type/${type}`, getConfig());
        return response.data;
    },

    /**
     * Preview order set with safety checks
     * @param {string} orderSetId - Order set ID
     * @param {string} patientId - Patient ID
     * @param {string} emergencyId - Emergency ID
     */
    preview: async (orderSetId, patientId, emergencyId) => {
        const response = await axios.post(
            `${API_URL}/${orderSetId}/preview`,
            { patientId, emergencyId },
            getConfig()
        );
        return response.data;
    },

    /**
     * Apply order set to patient
     * @param {string} orderSetId - Order set ID
     * @param {Object} data - { patientId, emergencyId, overrides, modifications }
     */
    apply: async (orderSetId, data) => {
        const response = await axios.post(
            `${API_URL}/${orderSetId}/apply`,
            data,
            getConfig()
        );
        return response.data;
    },

    /**
     * Get applied order sets for an emergency
     */
    getAppliedByEmergency: async (emergencyId) => {
        const response = await axios.get(
            `${API_URL}/applied/emergency/${emergencyId}`,
            getConfig()
        );
        return response.data;
    },

    /**
     * Get applied order set by ID
     */
    getAppliedById: async (id) => {
        const response = await axios.get(`${API_URL}/applied/${id}`, getConfig());
        return response.data;
    },

    /**
     * Create new order set (admin only)
     */
    create: async (orderSetData) => {
        const response = await axios.post(API_URL, orderSetData, getConfig());
        return response.data;
    },

    /**
     * Update order set (admin only)
     */
    update: async (id, updateData) => {
        const response = await axios.put(`${API_URL}/${id}`, updateData, getConfig());
        return response.data;
    },

    /**
     * Delete/deactivate order set (admin only)
     */
    delete: async (id) => {
        const response = await axios.delete(`${API_URL}/${id}`, getConfig());
        return response.data;
    },
};

export default orderSetService;
