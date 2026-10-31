import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/analytics/`;

// Get user from local storage to send token
const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('user'));

    if (user && user.token) {
        return {
            headers: { Authorization: `Bearer ${user.token}` }
        };
    }
    return {};
};

const getExecutiveStats = async () => {
    const response = await axios.get(API_URL + 'executive-dashboard', getConfig());
    return response.data.data;
};

const getClinicalStats = async (filters = {}) => {
    // Construct query string from filters if needed
    const response = await axios.get(API_URL + 'clinical', getConfig());
    return response.data.data;
};

const getFinancialStats = async () => {
    const response = await axios.get(API_URL + 'financial', getConfig());
    return response.data.data;
};

const getReceptionistStats = async () => {
    const response = await axios.get(API_URL + 'reception', getConfig());
    return response.data.data;
};

const analyticsService = {
    getExecutiveStats,
    getClinicalStats,
    getFinancialStats,
    getReceptionistStats
};

export default analyticsService;

