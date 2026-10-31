// Central runtime configuration.
// Set VITE_API_URL (full API base, e.g. https://his-api.onrender.com/api/v1) at build time.
const DEFAULT_API = 'http://localhost:5001/api/v1';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || DEFAULT_API).replace(/\/+$/, '');
// Server origin (for sockets, uploaded files): API base without the /api/v1 suffix
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '');
// ID-card OCR service (FastAPI)
export const OCR_SERVICE_URL = (import.meta.env.VITE_OCR_URL || 'http://localhost:8000').replace(/\/+$/, '');

// Access token as stored by auth.service (the `user` object holds `token`)
export const getToken = () => {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}').token || null;
    } catch {
        return null;
    }
};
