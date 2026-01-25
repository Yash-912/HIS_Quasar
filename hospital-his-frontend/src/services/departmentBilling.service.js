import axios from 'axios';

const API_URL = 'http://98.93.152.237:5000/api/v1/department-billing';

// Get token from local storage
const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.token) {
        return { headers: { Authorization: `Bearer ${user.token}` } };
    }
    return {};
};

/**
 * Generate lab bill for selected orders
 */
const generateLabBill = async (orderIds, encounterId, encounterModel, patientId) => {
    const response = await axios.post(
        `${API_URL}/lab/generate`,
        { orderIds, encounterId, encounterModel, patientId },
        getConfig()
    );
    return response.data;
};

/**
 * Generate radiology bill for selected orders
 */
const generateRadiologyBill = async (orderIds, encounterId, encounterModel, patientId) => {
    const response = await axios.post(
        `${API_URL}/radiology/generate`,
        { orderIds, encounterId, encounterModel, patientId },
        getConfig()
    );
    return response.data;
};

/**
 * Generate pharmacy bill for selected dispenses
 */
const generatePharmacyBill = async (dispenseIds, encounterId, encounterModel, patientId) => {
    const response = await axios.post(
        `${API_URL}/pharmacy/generate`,
        { dispenseIds, encounterId, encounterModel, patientId },
        getConfig()
    );
    return response.data;
};

/**
 * Record payment on department bill
 */
const recordPayment = async (billId, amount, mode, reference = '') => {
    const response = await axios.post(
        `${API_URL}/${billId}/pay`,
        { amount, mode, reference },
        getConfig()
    );
    return response.data;
};

/**
 * Get department bill by ID
 */
const getDepartmentBill = async (billId) => {
    const response = await axios.get(`${API_URL}/${billId}`, getConfig());
    return response.data.data;
};

/**
 * Get department bills for an encounter
 */
const getDepartmentBillsForEncounter = async (encounterId) => {
    const response = await axios.get(`${API_URL}/encounter/${encounterId}`, getConfig());
    return response.data.data;
};

/**
 * Get unbilled orders for a department
 */
const getUnbilledOrders = async (department, patientId = null, encounterId = null) => {
    const params = new URLSearchParams();
    if (patientId) params.append('patientId', patientId);
    if (encounterId) params.append('encounterId', encounterId);

    const response = await axios.get(
        `${API_URL}/${department}/unbilled?${params.toString()}`,
        getConfig()
    );
    return response.data.data;
};

/**
 * Get central billing view for an encounter
 */
const getCentralBillingView = async (encounterId) => {
    const response = await axios.get(`${API_URL}/central/${encounterId}`, getConfig());
    return response.data.data;
};

/**
 * Get patient's department bills
 */
const getPatientDepartmentBills = async (patientId) => {
    const response = await axios.get(`${API_URL}/patient/${patientId}`, getConfig());
    return response.data.data;
};

/**
 * Get department dashboard stats
 */
const getDepartmentDashboard = async (department) => {
    const response = await axios.get(`${API_URL}/dashboard/${department}`, getConfig());
    return response.data.data;
};

/**
 * Get all department bills with filters
 */
const getAllDepartmentBills = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.department) params.append('department', filters.department);
    if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);

    const response = await axios.get(`${API_URL}?${params.toString()}`, getConfig());
    return response.data;
};

const departmentBillingService = {
    generateLabBill,
    generateRadiologyBill,
    generatePharmacyBill,
    recordPayment,
    getDepartmentBill,
    getDepartmentBillsForEncounter,
    getUnbilledOrders,
    getCentralBillingView,
    getPatientDepartmentBills,
    getDepartmentDashboard,
    getAllDepartmentBills,
};

export default departmentBillingService;
