import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mic, MicOff, Phone, PhoneOff, Send, Volume2, VolumeX,
    Bot, User, MessageCircle, Clock, Activity, Loader2,
    Sparkles, Zap, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import voiceAgentService from '../../services/voiceAgent.service';

// Message component
const ChatMessage = ({ message, index }) => {
    const isAgent = message.type === 'agent';
    const isSystem = message.type === 'system';

    if (isSystem) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center my-2"
            >
                <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {message.text}
                </span>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: isAgent ? -20 : 20, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex gap-3 ${isAgent ? 'justify-start' : 'justify-end'}`}
        >
            {isAgent && (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-200 flex-shrink-0">
                    <Bot size={20} className="text-white" />
                </div>
            )}
            <div className={`max-w-[70%] ${isAgent ? 'order-2' : 'order-1'}`}>
                <div className={`px-4 py-3 rounded-2xl ${isAgent
                    ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-200'
                    }`}>
                    <p className="text-sm leading-relaxed">{message.text}</p>
                </div>
                <div className={`flex items-center gap-2 mt-1 text-xs text-slate-400 ${isAgent ? '' : 'justify-end'}`}>
                    <Clock size={10} />
                    <span>{format(message.time, 'h:mm a')}</span>
                    {message.intent && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-medium">
                            {message.intent}
                        </span>
                    )}
                </div>
            </div>
            {!isAgent && (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-lg flex-shrink-0 order-2">
                    <User size={20} className="text-white" />
                </div>
            )}
        </motion.div>
    );
};

const VoiceAssistant = () => {
    const { user } = useSelector((state) => state.auth);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // State
    const [isConnected, setIsConnected] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [turnCount, setTurnCount] = useState(0);
    const [lastIntent, setLastIntent] = useState(null);
    const [context, setContext] = useState({});

    // Speech synthesis
    const synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Check connection on mount
    useEffect(() => {
        checkConnection();
        const interval = setInterval(checkConnection, 10000);
        return () => clearInterval(interval);
    }, []);

    const checkConnection = async () => {
        try {
            const health = await voiceAgentService.checkHealth();
            setIsConnected(health.status === 'healthy');
        } catch {
            setIsConnected(false);
        }
    };

    // Speak text using browser TTS
    const speak = useCallback((text) => {
        if (!synthesis || isMuted) return;

        synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-IN';
        utterance.rate = 1.0;

        const voices = synthesis.getVoices();
        const voice = voices.find(v => v.lang === 'en-IN') || voices.find(v => v.lang.startsWith('en'));
        if (voice) utterance.voice = voice;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);

        synthesis.speak(utterance);
    }, [synthesis, isMuted]);

    // Voice recording functions
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { sampleRate: 16000, channelCount: 1 }
            });

            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());

                if (audioChunksRef.current.length === 0) return;

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await handleTranscription(audioBlob);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);

        } catch (error) {
            console.error('Mic error:', error);
            setMessages(prev => [...prev, {
                type: 'system',
                text: '❌ Microphone access denied',
                time: new Date()
            }]);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleTranscription = async (audioBlob) => {
        setIsLoading(true);
        try {
            // Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);

            reader.onloadend = async () => {
                const base64Audio = reader.result.split(',')[1];

                try {
                    const result = await voiceAgentService.transcribeAudio(sessionId, base64Audio, 48000);

                    if (result.transcript && result.transcript.trim()) {
                        const transcribedText = result.transcript.trim();

                        // Check if it's a mock response
                        if (transcribedText.startsWith('[Mock') || transcribedText.includes('GCP')) {
                            setMessages(prev => [...prev, {
                                type: 'system',
                                text: '⚠️ Using text input (GCP STT not configured)',
                                time: new Date()
                            }]);
                        } else {
                            await handleSendMessage(transcribedText);
                        }
                    } else {
                        setMessages(prev => [...prev, {
                            type: 'system',
                            text: '🎤 No speech detected. Try again.',
                            time: new Date()
                        }]);
                    }
                } catch (error) {
                    console.error('Transcription API error:', error);
                    setMessages(prev => [...prev, {
                        type: 'system',
                        text: '❌ Transcription failed',
                        time: new Date()
                    }]);
                }
                setIsLoading(false);
            };
        } catch (error) {
            setIsLoading(false);
            console.error('Audio processing error:', error);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // Start call
    const handleStartCall = async () => {
        try {
            setIsLoading(true);
            const response = await voiceAgentService.startCall(user?.id || 'guest');

            setSessionId(response.session_id);
            setMessages([{
                type: 'agent',
                text: response.response_text,
                time: new Date(),
                intent: 'greeting'
            }]);
            setTurnCount(0);
            setContext({});

            speak(response.response_text);
        } catch (error) {
            setMessages([{
                type: 'system',
                text: '❌ Failed to connect to Voice Agent',
                time: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // End call
    const handleEndCall = async () => {
        if (synthesis) synthesis.cancel();

        if (sessionId) {
            try {
                await voiceAgentService.endCall(sessionId);
            } catch (error) {
                console.error('Error ending call:', error);
            }
        }

        setSessionId(null);
        setMessages(prev => [...prev, {
            type: 'system',
            text: '📴 Call ended',
            time: new Date()
        }]);
    };

    // Send message
    const handleSendMessage = async (text = inputText) => {
        if (!sessionId || !text.trim()) return;
        if (synthesis) synthesis.cancel();

        const userMessage = { type: 'user', text: text.trim(), time: new Date() };
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            const response = await voiceAgentService.processMessage(sessionId, text.trim(), context);

            setContext(response.context || context);
            setTurnCount(prev => prev + 1);
            setLastIntent(response.intent);

            const agentMessage = {
                type: 'agent',
                text: response.response_text,
                time: new Date(),
                intent: response.intent
            };
            setMessages(prev => [...prev, agentMessage]);

            speak(response.response_text);

            if (response.is_complete) {
                setMessages(prev => [...prev, {
                    type: 'system',
                    text: '✅ Task completed successfully',
                    time: new Date()
                }]);
            }

            if (response.requires_human) {
                setMessages(prev => [...prev, {
                    type: 'system',
                    text: '👤 Transferring to human agent...',
                    time: new Date()
                }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                type: 'system',
                text: '❌ Failed to process message',
                time: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Quick actions
    const quickActions = [
        { label: 'Book Appointment', message: 'I want to book an appointment' },
        { label: 'Check Status', message: 'What is my appointment status?' },
        { label: 'Find Doctor', message: 'I need to find a doctor' },
        { label: 'Lab Results', message: 'I want to check my lab results' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-200">
                            <Bot size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                AI Voice Receptionist
                                <Sparkles size={16} className="text-amber-500" />
                            </h1>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <span className="text-sm text-slate-500">
                                    {isConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {sessionId && (
                            <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-slate-100 rounded-xl">
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Turn</p>
                                    <p className="text-sm font-bold text-slate-700">{turnCount}</p>
                                </div>
                                {lastIntent && (
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Intent</p>
                                        <p className="text-sm font-bold text-purple-600">{lastIntent}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-3 rounded-xl border transition-all ${isMuted
                                ? 'bg-red-50 border-red-200 text-red-600'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>

                        {!sessionId ? (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleStartCall}
                                disabled={isLoading || !isConnected}
                                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-200 hover:shadow-xl transition-all disabled:opacity-50"
                            >
                                <Phone size={18} />
                                <span>Start Call</span>
                            </motion.button>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleEndCall}
                                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg shadow-red-200 hover:shadow-xl transition-all"
                            >
                                <PhoneOff size={18} />
                                <span>End Call</span>
                            </motion.button>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto p-6">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Chat Area */}
                    <div className="lg:col-span-2">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 h-[calc(100vh-220px)] flex flex-col"
                        >
                            {/* Messages */}
                            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gradient-to-b from-slate-50/50 to-white">
                                {messages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                            <MessageCircle size={32} className="text-slate-300" />
                                        </div>
                                        <p className="text-lg font-medium">No active conversation</p>
                                        <p className="text-sm">Click "Start Call" to begin</p>
                                    </div>
                                ) : (
                                    <>
                                        <AnimatePresence>
                                            {messages.map((msg, idx) => (
                                                <ChatMessage key={idx} message={msg} index={idx} />
                                            ))}
                                        </AnimatePresence>

                                        {isLoading && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex items-center gap-3"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                                    <Bot size={20} className="text-white" />
                                                </div>
                                                <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
                                                    <div className="flex gap-1">
                                                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {isSpeaking && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="flex justify-center"
                                            >
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                                                    <Volume2 size={14} className="animate-pulse" />
                                                    Speaking...
                                                </div>
                                            </motion.div>
                                        )}

                                        <div ref={messagesEndRef} />
                                    </>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-slate-100 bg-white rounded-b-2xl">
                                <div className="flex gap-3">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder={isRecording ? "🎤 Recording..." : (sessionId ? "Type or click mic to speak..." : "Start a call to begin...")}
                                        disabled={!sessionId || isLoading || isRecording}
                                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    />
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={toggleRecording}
                                        disabled={!sessionId || isLoading}
                                        className={`px-4 py-3 rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isRecording
                                            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200 animate-pulse'
                                            : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-200 hover:shadow-xl'
                                            }`}
                                        title={isRecording ? "Stop recording" : "Start recording"}
                                    >
                                        {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleSendMessage()}
                                        disabled={!sessionId || !inputText.trim() || isLoading}
                                        className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-200 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <Loader2 size={20} className="animate-spin" />
                                        ) : (
                                            <Send size={20} />
                                        )}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Quick Actions */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full -mr-10 -mt-10 blur-2xl" />

                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 relative z-10">
                                <Zap size={20} className="text-amber-400" />
                                Quick Actions
                            </h3>

                            <div className="space-y-3 relative z-10">
                                {quickActions.map((action, idx) => (
                                    <motion.button
                                        key={idx}
                                        whileHover={{ x: 4 }}
                                        onClick={() => sessionId && handleSendMessage(action.message)}
                                        disabled={!sessionId}
                                        className="w-full text-left p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="text-sm font-medium">{action.label}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>

                        {/* Session Info */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg shadow-slate-200/50"
                        >
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
                                <Activity size={20} className="text-blue-500" />
                                Session Info
                            </h3>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-500">Status</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${sessionId
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {sessionId ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-500">Session ID</span>
                                    <span className="text-sm font-medium text-slate-700 font-mono">
                                        {sessionId ? sessionId.slice(0, 8) + '...' : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-500">Messages</span>
                                    <span className="text-sm font-bold text-slate-700">{messages.length}</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm text-slate-500">User</span>
                                    <span className="text-sm font-medium text-slate-700">
                                        {user?.name || 'Guest'}
                                    </span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Tips */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100"
                        >
                            <h3 className="font-bold text-sm mb-3 text-blue-800 flex items-center gap-2">
                                <AlertCircle size={16} />
                                Tips
                            </h3>
                            <ul className="space-y-2 text-xs text-blue-700">
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    <span>Say patient names clearly for accurate search</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    <span>Speak dates in format "tomorrow" or "next Monday"</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    <span>Use natural language for best results</span>
                                </li>
                            </ul>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceAssistant;
