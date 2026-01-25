import axios from 'axios';

const API_URL = 'http://98.93.152.237:5000/api/v1/staff';

const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    return { headers: { Authorization: `Bearer ${user?.token}` } };
};

const staffService = {
    getAllStaff: async (params) => {
        const config = getConfig();
        config.params = params;
        const response = await axios.get(API_URL, config);
        return response.data;
    },

    getDoctors: async () => {
        const response = await axios.get(`${API_URL}/doctors`, getConfig());
        return response.data;
    },

    getStaffById: async (id) => {
        const response = await axios.get(`${API_URL}/${id}`, getConfig());
        return response.data;
    }
};

export default staffService;
