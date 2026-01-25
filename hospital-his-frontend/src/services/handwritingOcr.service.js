/**
 * Handwriting OCR Service (Frontend)
 * API client for handwriting-to-text conversion
 */

import axios from 'axios';

const API_URL = 'http://98.93.152.237:5000/api/v1/ocr';

const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return {
        headers: {
            Authorization: `Bearer ${user?.token}`,
            'Content-Type': 'application/json'
        }
    };
};

/**
 * Convert a single canvas section to text
 * @param {string} imageData - Base64 image from canvas
 * @param {string} section - 'symptoms' | 'diagnosis' | 'combined'
 */
export const convertHandwriting = async (imageData, section = 'combined') => {
    const response = await axios.post(
        `${API_URL}/handwriting`,
        { imageData, section },
        getConfig()
    );
    return response.data;
};

/**
 * Convert sectioned canvas (symptoms + diagnosis) to text
 * @param {Object} canvasData - { symptoms: base64, diagnosis: base64 }
 */
export const convertSectionedHandwriting = async (canvasData) => {
    const response = await axios.post(
        `${API_URL}/handwriting/sectioned`,
        canvasData,
        getConfig()
    );
    return response.data;
};

/**
 * Check OCR service health
 */
export const checkOcrHealth = async () => {
    const response = await axios.get(`${API_URL}/health`, getConfig());
    return response.data;
};

export default {
    convertHandwriting,
    convertSectionedHandwriting,
    checkOcrHealth
};
