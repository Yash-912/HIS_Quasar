import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/system-settings`;

// Get token from local storage
const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.token) {
        return { headers: { Authorization: `Bearer ${user.token}` } };
    }
    return {};
};

/**
 * Get clinical coding status (public endpoint)
 */
const getClinicalCodingStatus = async () => {
    const response = await axios.get(`${API_URL}/clinical-coding-status`, getConfig());
    return response.data.data;
};

/**
 * Get all system settings (admin only)
 */
const getSettings = async () => {
    const response = await axios.get(API_URL, getConfig());
    return response.data.data;
};

/**
 * Toggle clinical coding
 */
const toggleClinicalCoding = async (enabled, reason = '') => {
    const response = await axios.put(
        `${API_URL}/clinical-coding`,
        { enabled, reason },
        getConfig()
    );
    return response.data;
};

/**
 * Force toggle clinical coding (after confirmation)
 */
const forceToggleClinicalCoding = async (enabled, reason = '') => {
    const response = await axios.put(
        `${API_URL}/clinical-coding/force`,
        { enabled, reason },
        getConfig()
    );
    return response.data;
};

/**
 * Get audit log
 */
const getAuditLog = async () => {
    const response = await axios.get(`${API_URL}/audit-log`, getConfig());
    return response.data.data;
};

const systemSettingsService = {
    getClinicalCodingStatus,
    getSettings,
    toggleClinicalCoding,
    forceToggleClinicalCoding,
    getAuditLog,
};

export default systemSettingsService;
