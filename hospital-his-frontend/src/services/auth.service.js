import axios from 'axios';

// Align with your backend server URL
const API_URL = 'http://98.93.152.237:5000/api/v1/auth/';

// Login user
const login = async (userData) => {
    const response = await axios.post(API_URL + 'login', userData);

    if (response.data) {
        // Check if account is pending approval
        if (response.data.pendingApproval) {
            return {
                ...response.data,
                pendingApproval: true,
            };
        }

        // Backend returns: { success, accessToken, refreshToken, user: { ... } }
        // We flatten this for the frontend to: { ...user, token: accessToken }
        const { accessToken, user } = response.data;
        const userPayload = { ...user, token: accessToken };

        localStorage.setItem('user', JSON.stringify(userPayload));
        return userPayload;
    }

    return response.data;
};

// Logout user
const logout = () => {
    localStorage.removeItem('user');
};

// Validate onboarding ID (first step of staff signup)
const validateOnboardingId = async (onboardingCode) => {
    const response = await axios.post(API_URL + 'validate-onboarding-id', { onboardingCode });
    return response.data;
};

// Signup with onboarding ID (complete staff signup)
const signupWithOnboarding = async (signupData) => {
    const response = await axios.post(API_URL + 'signup-with-onboarding', signupData);
    return response.data;
};

const authService = {
    login,
    logout,
    validateOnboardingId,
    signupWithOnboarding,
};

export default authService;
