import axios from 'axios';

const VOICE_AGENT_URL = 'http://localhost:5003';

// Start a new voice call session
const startCall = async (callerId = null) => {
    const response = await axios.post(`${VOICE_AGENT_URL}/voice/call`, {
        caller_id: callerId || `web-${Date.now()}`,
        channel: 'web'
    });
    return response.data;
};

// Process conversation message
const processMessage = async (sessionId, userInput, context = {}) => {
    const response = await axios.post(`${VOICE_AGENT_URL}/conversation/process`, {
        session_id: sessionId,
        user_input: userInput,
        context: context,
        return_audio: false // Using browser TTS
    });
    return response.data;
};

// Transcribe audio (when GCP is configured)
const transcribeAudio = async (sessionId, audioBase64, sampleRate = 16000) => {
    const response = await axios.post(`${VOICE_AGENT_URL}/voice/transcribe`, {
        session_id: sessionId,
        audio_base64: audioBase64,
        sample_rate: sampleRate
    });
    return response.data;
};

// End voice session
const endCall = async (sessionId) => {
    const response = await axios.delete(`${VOICE_AGENT_URL}/session/${sessionId}`);
    return response.data;
};

// Check health status
const checkHealth = async () => {
    try {
        const response = await axios.get(`${VOICE_AGENT_URL}/health`);
        return response.data;
    } catch (error) {
        return { status: 'unhealthy', error: error.message };
    }
};

const voiceAgentService = {
    startCall,
    processMessage,
    transcribeAudio,
    endCall,
    checkHealth
};

export default voiceAgentService;
