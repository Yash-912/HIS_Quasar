const axios = require('axios');

const API_URL = 'http://localhost:5000/api/v1';
const LOGIN_DATA = {
    email: 'ravi@hospital-his.com',
    password: 'Pharma@123'
};

async function testQueue() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, LOGIN_DATA);
        const token = loginRes.data.accessToken;
        console.log('Login successful. Token acquired.');

        // 2. Fetch Queue
        console.log('Fetching Pharmacy Queue...');
        const queueRes = await axios.get(`${API_URL}/pharmacy/queue`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Queue Status:', queueRes.status);
        console.log('Queue Data:', JSON.stringify(queueRes.data, null, 2));

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testQueue();
