/**
 * Medicine Service (Frontend)
 * API client for medicine autocomplete
 */

import axios from 'axios';

const API_URL = 'http://98.93.152.237:5000/api/v1/medicines';

const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return {
        headers: {
            Authorization: `Bearer ${user?.token}`
        }
    };
};

/**
 * Search medicines by prefix (for autocomplete)
 * @param {string} query - Search query
 * @param {number} limit - Max results to return
 */
export const searchMedicines = async (query, limit = 15) => {
    const response = await axios.get(
        `${API_URL}/search`,
        {
            params: { q: query, limit },
            ...getConfig()
        }
    );
    return response.data;
};

/**
 * Get all medicines (paginated)
 */
export const getMedicines = async (page = 1, limit = 50, category = null) => {
    const params = { page, limit };
    if (category) params.category = category;

    const response = await axios.get(API_URL, {
        params,
        ...getConfig()
    });
    return response.data;
};

/**
 * Get medicine by ID
 */
export const getMedicineById = async (id) => {
    const response = await axios.get(`${API_URL}/${id}`, getConfig());
    return response.data;
};

/**
 * Get all medicine categories
 */
export const getMedicineCategories = async () => {
    const response = await axios.get(`${API_URL}/meta/categories`, getConfig());
    return response.data;
};

export default {
    searchMedicines,
    getMedicines,
    getMedicineById,
    getMedicineCategories
};
