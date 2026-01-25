
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom'; // Keep this one
import {
    FlaskConical, Clock, CheckCircle, AlertTriangle,
    ChevronRight, Activity, Calendar, TestTube,
    RefreshCw, Filter, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import labService from '../../services/lab.service';

// --- Reusable Components (Local) ---

// Animated CountUp for numbers
const CountUp = ({ value, duration = 800 }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let startTime = null;
        let startValue = count;
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            const easeOut = 1 - Math.pow(1 - percentage, 3);
            setCount(Math.floor(startValue + (value - startValue) * easeOut));
            if (progress < duration) requestAnimationFrame(animate);
            else setCount(value);
        };
        requestAnimationFrame(animate);
    }, [value]);
    return <span>{count}</span>;
};

// StatCard Component
const StatCard = ({ title, value, subtext, icon: Icon, color, onClick, isLoading, delay = 0, highlight }) => {
    const baseColorName = color.split('-')[1]; // e.g., 'blue' from 'bg-blue-500'
    const borderColor = `border-${baseColorName}-100`;
    const hoverBorder = `hover:border-${baseColorName}-200`;
    const bgGradient = `bg-gradient-to-br from-${baseColorName}-50 to-white`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            whileHover={{ y: -4, boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.1)" }}
            onClick={onClick}
            className={`relative p-6 rounded-2xl border ${borderColor} ${bgGradient} ${hoverBorder} shadow-sm transition-all group ${onClick ? 'cursor-pointer' : ''} ${highlight ? `ring-2 ring-${baseColorName}-200` : ''}`}
        >
            <div className="relative z-10">
                <div className={`p-3 rounded-xl mb-4 inline-block ${color} bg-opacity-10 shadow-sm`}>
                    <Icon size={24} className={color.replace('bg-', 'text-')} />
                </div>
                <p className="text-slate-500 text-xs font-bold tracking-wider uppercase mb-1">{title}</p>
                <h3 className="text-4xl font-extrabold text-slate-800 tracking-tight mb-2">
                    {isLoading ? <div className="h-9 w-20 bg-gray-200/50 animate-pulse rounded"></div> : <CountUp value={value} />}
                </h3>
                <div className="flex items-center text-xs font-medium text-slate-500">
                    {subtext}
                    {onClick && <ChevronRight size={14} className="ml-1 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />}
                </div>
            </div>
            {/* Decorative Icon Background */}
            <Icon
                className={`absolute -bottom-4 -right-4 w-32 h-32 opacity-[0.03] text-${baseColorName}-600 transform group-hover:scale-110 group-hover:rotate-[-10deg] transition-all duration-700 pointer-events-none`}
            />
        </motion.div>
    );
};

// Priority/Status Badge
const StatusBadge = ({ status }) => {
    const styles = {
        'ordered': 'bg-blue-50 text-blue-600 border-blue-100',
        'sample-collected': 'bg-purple-50 text-purple-600 border-purple-100',
        'in-progress': 'bg-amber-50 text-amber-600 border-amber-100',
        'completed': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'critical': 'bg-red-50 text-red-600 border-red-100 animate-pulse'
    };
    const labels = {
        'ordered': 'New Order',
        'sample-collected': 'Processing',
        'in-progress': 'Processing',
        'completed': 'Done',
        'critical': 'CRITICAL'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[status] || styles['ordered']}`}>
            {labels[status] || status}
        </span>
    );
};

const LabTechDashboard = () => {
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);

    // State
    const [stats, setStats] = useState({ pending: 0, completedToday: 0 });
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Greeting logic
    const greeting = useMemo(() => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    }, [currentTime]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [queueRes, dashRes] = await Promise.all([
                labService.getQueue(),
                labService.getDashboard()
            ]);
            setQueue(queueRes.data || []);
            setStats(dashRes.data || { pending: 0, completedToday: 0 });
        } catch (error) {
            console.error("Error fetching lab dashboard data", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // Set up separate interval for data refresh if needed, for now manual refresh is fine or shared polling
    }, [fetchData]);

    const handleRefresh = () => {
        fetchData();
    };

    // Derived Data
    const awaitingSample = queue.filter(q => q.status === 'ordered').length;
    const pendingResults = queue.filter(q => ['sample-collected', 'in-progress'].includes(q.status)).length;

    // Get recent urgent/priority queue items (just showing top 5 pending for now)
    const priorityQueue = queue
        .filter(q => q.status !== 'completed')
        .slice(0, 5); // Take top 5

    return (
        <div className="min-h-screen pb-12 max-w-7xl mx-auto">
            {/* Header Section */}
            <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-1">
                        <span>{format(currentTime, 'EEEE, d MMMM yyyy')}</span>
                        <span>•</span>
                        <Clock size={14} />
                        <span>{format(currentTime, 'h:mm a')}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">
                        {greeting}, <span className="text-purple-600">{user?.name?.split(' ')[0] || 'Technician'}</span> 🧪
                    </h1>
                    <p className="text-gray-500 mt-1">Manage tests, enter results, and track lab performance.</p>
                </div>

                <div>
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => navigate('/dashboard/lab')}
                        className="ml-3 px-5 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 inline-flex items-center gap-2"
                    >
                        Go to Lab Workstation <ArrowRight size={18} />
                    </button>
                </div>
            </header>

            {/* Stats Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Work Queue"
                    value={queue.length}
                    subtext="Total pending tests"
                    icon={TestTube}
                    color="bg-blue-500"
                    isLoading={loading}
                    delay={0}
                    onClick={() => navigate('/dashboard/lab')}
                />
                <StatCard
                    title="Sample Collection"
                    value={awaitingSample}
                    subtext="Awaiting samples"
                    icon={FlaskConical}
                    color="bg-amber-500"
                    isLoading={loading}
                    delay={0.1}
                    highlight={awaitingSample > 0}
                    onClick={() => navigate('/dashboard/lab')}
                />
                <StatCard
                    title="Processing"
                    value={pendingResults}
                    subtext="Results pending entry"
                    icon={Activity}
                    color="bg-purple-500"
                    isLoading={loading}
                    delay={0.2}
                    onClick={() => navigate('/dashboard/lab')}
                />
                <StatCard
                    title="Completed Today"
                    value={stats.completedToday}
                    subtext="Tests finalized"
                    icon={CheckCircle}
                    color="bg-emerald-500"
                    isLoading={loading}
                    delay={0.3}
                />
            </div>

            {/* Main Content Split: Priority Queue & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Priority / Pending Queue List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                                <Activity className="text-blue-500" size={20} /> Priority Queue
                            </h3>
                            <p className="text-sm text-gray-400">Next tests to process</p>
                        </div>
                        <button onClick={() => navigate('/dashboard/lab')} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                            View All <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        {queue.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                                    <CheckCircle size={32} />
                                </div>
                                <h4 className="text-slate-600 font-bold">All clear!</h4>
                                <p className="text-slate-400 text-sm">No pending tests in the queue right now.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {priorityQueue.map((item, idx) => (
                                    <div
                                        key={item._id || idx}
                                        onClick={() => navigate('/dashboard/lab')}
                                        className="group p-4 rounded-xl border border-gray-100 hover:border-blue-100 bg-white hover:bg-blue-50/30 transition-all cursor-pointer flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-white group-hover:text-blue-600 transition-colors">
                                                {item.patient?.firstName?.[0] || '?'}{item.patient?.lastName?.[0] || '?'}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                                                    {item.test?.testName || 'Unknown Test'}
                                                </h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span>{item.patient?.firstName} {item.patient?.lastName}</span>
                                                    <span>•</span>
                                                    <span className="font-mono">{item.testNumber}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Requested</p>
                                                <p className="text-xs font-medium text-slate-600">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            <StatusBadge status={item.status} />
                                            <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Right Column: Quick Stats or Tips */}
                <div className="space-y-6">
                    {/* Efficiency Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-purple-200"
                    >
                        <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                            <Clock size={20} className="text-purple-200" /> Lab Performance
                        </h3>
                        <p className="text-purple-100 text-sm opacity-80 mb-6">Efficiency stats for today</p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                                <p className="text-xs font-bold uppercase tracking-wider text-purple-200 mb-1">Avg Turnaround</p>
                                <p className="text-2xl font-bold">45m</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                                <p className="text-xs font-bold uppercase tracking-wider text-purple-200 mb-1">Items Processed</p>
                                <p className="text-2xl font-bold">{stats.completedToday}</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Quick Links */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm"
                    >
                        <h4 className="font-bold text-slate-800 mb-4">Quick Actions</h4>
                        <div className="space-y-2">
                            <button onClick={() => navigate('/dashboard/lab')} className="w-full p-3 text-left rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <TestTube size={18} />
                                </div>
                                Record New Result
                            </button>
                            <button onClick={() => navigate('/settings')} className="w-full p-3 text-left rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200">
                                <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                                    <Filter size={18} />
                                </div>
                                Filter Worklist
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default LabTechDashboard;
