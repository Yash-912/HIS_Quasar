
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Clock, CheckCircle, AlertTriangle, Play,
    ChevronRight, Activity, Heart, Pill,
    RefreshCw, ArrowRight, Bell, Clipboard,
    User, Stethoscope, LogIn
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import nursingService from '../../services/nursing.service';

// --- Reusable Components ---

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
    const baseColorName = color.split('-')[1];
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
            <Icon
                className={`absolute -bottom-4 -right-4 w-32 h-32 opacity-[0.03] text-${baseColorName}-600 transform group-hover:scale-110 group-hover:rotate-[-10deg] transition-all duration-700 pointer-events-none`}
            />
        </motion.div>
    );
};

// Alert Severity Badge
const SeverityBadge = ({ severity }) => {
    const styles = {
        'critical': 'bg-red-50 text-red-600 border-red-100',
        'high': 'bg-orange-50 text-orange-600 border-orange-100',
        'medium': 'bg-amber-50 text-amber-600 border-amber-100',
        'low': 'bg-blue-50 text-blue-600 border-blue-100'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[severity] || styles['medium']}`}>
            {severity}
        </span>
    );
};

const NurseDashboard = () => {
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);

    // State
    const [currentShift, setCurrentShift] = useState(null);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [alerts, setAlerts] = useState([]);
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
            // Check for active shift
            const shiftRes = await nursingService.getCurrentShift().catch(() => ({ data: null }));
            setCurrentShift(shiftRes.data);

            if (shiftRes.data) {
                // Only fetch dashboard stats if there's an active shift
                const [dashboardRes, alertsRes] = await Promise.all([
                    nursingService.getDashboard().catch(() => ({ data: null })),
                    nursingService.getActiveAlerts().catch(() => ({ data: [] }))
                ]);
                setDashboardStats(dashboardRes.data);
                setAlerts((alertsRes.data || []).slice(0, 5));
            } else {
                setDashboardStats(null);
                setAlerts([]);
            }
        } catch (error) {
            console.error("Error fetching nurse dashboard data", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRefresh = () => {
        fetchData();
    };

    const assignedPatients = currentShift?.assignedPatients || [];
    const stats = dashboardStats?.stats || {};

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
                        {greeting}, <span className="text-teal-600">{user?.name?.split(' ')[0] || 'Nurse'}</span> 💉
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {currentShift
                            ? `Your ${currentShift.shiftType} shift is active • Started at ${format(new Date(currentShift.actualStartTime), 'h:mm a')}`
                            : 'Start your shift to begin caring for patients.'
                        }
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => navigate('/nursing')}
                        className="px-5 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 inline-flex items-center gap-2"
                    >
                        {currentShift ? 'Go to Nursing Station' : 'Start Shift'} <ArrowRight size={18} />
                    </button>
                </div>
            </header>

            {/* No Active Shift State */}
            {!loading && !currentShift && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-3xl border border-teal-100 p-12 text-center mb-8"
                >
                    <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <LogIn size={36} className="text-teal-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">No Active Shift</h2>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                        You don't have an active shift right now. Start your shift to see your assigned patients and tasks.
                    </p>
                    <button
                        onClick={() => navigate('/nursing')}
                        className="px-8 py-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-bold hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg shadow-teal-200 inline-flex items-center gap-2"
                    >
                        <Play size={20} /> Start Your Shift
                    </button>
                </motion.div>
            )}

            {/* Active Shift Content */}
            {currentShift && (
                <>
                    {/* Stats Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <StatCard
                            title="My Patients"
                            value={assignedPatients.length}
                            subtext="Assigned to me"
                            icon={User}
                            color="bg-teal-500"
                            isLoading={loading}
                            delay={0}
                            onClick={() => navigate('/nursing')}
                        />
                        <StatCard
                            title="Pending Tasks"
                            value={stats.pendingTasks || 0}
                            subtext="Tasks to complete"
                            icon={Clipboard}
                            color="bg-amber-500"
                            isLoading={loading}
                            delay={0.1}
                            highlight={(stats.pendingTasks || 0) > 5}
                            onClick={() => navigate('/nursing')}
                        />
                        <StatCard
                            title="Medications Due"
                            value={stats.medicationsDue || 0}
                            subtext="Next hour"
                            icon={Pill}
                            color="bg-purple-500"
                            isLoading={loading}
                            delay={0.2}
                            highlight={(stats.medicationsDue || 0) > 0}
                            onClick={() => navigate('/nursing')}
                        />
                        <StatCard
                            title="Active Alerts"
                            value={stats.activeAlerts || 0}
                            subtext="Require attention"
                            icon={AlertTriangle}
                            color="bg-red-500"
                            isLoading={loading}
                            delay={0.3}
                            highlight={(stats.activeAlerts || 0) > 0}
                        />
                    </div>

                    {/* Main Content Split */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* My Patients List */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                                        <Stethoscope className="text-teal-500" size={20} /> My Patients
                                    </h3>
                                    <p className="text-sm text-gray-400">Patients assigned to your shift</p>
                                </div>
                                <button onClick={() => navigate('/nursing')} className="text-sm font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1">
                                    View All <ChevronRight size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden">
                                {assignedPatients.length === 0 ? (
                                    <div className="h-64 flex flex-col items-center justify-center text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                                            <User size={32} />
                                        </div>
                                        <h4 className="text-slate-600 font-bold">No patients assigned</h4>
                                        <p className="text-slate-400 text-sm">Patients will appear here once assigned to your shift.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {assignedPatients.slice(0, 5).map((assignment, idx) => (
                                            <div
                                                key={assignment._id || idx}
                                                onClick={() => navigate('/nursing')}
                                                className="group p-4 rounded-xl border border-gray-100 hover:border-teal-100 bg-white hover:bg-teal-50/30 transition-all cursor-pointer flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                                                        {assignment.patient?.firstName?.[0] || '?'}{assignment.patient?.lastName?.[0] || '?'}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-700 group-hover:text-teal-700 transition-colors">
                                                            {assignment.patient?.firstName} {assignment.patient?.lastName}
                                                        </h4>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span className="font-mono">{assignment.patient?.patientId || 'N/A'}</span>
                                                            <span>•</span>
                                                            <span>Bed: {assignment.bed?.bedNumber || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); navigate('/nursing'); }}
                                                            className="p-2 bg-pink-50 text-pink-600 rounded-lg hover:bg-pink-100 transition-colors"
                                                            title="Record Vitals"
                                                        >
                                                            <Heart size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); navigate('/nursing'); }}
                                                            className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                                                            title="Medications"
                                                        >
                                                            <Pill size={16} />
                                                        </button>
                                                    </div>
                                                    <ChevronRight size={18} className="text-gray-300 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            {/* Shift Info Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="bg-gradient-to-br from-teal-600 to-cyan-700 rounded-3xl p-6 text-white shadow-xl shadow-teal-200"
                            >
                                <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                                    <Activity size={20} className="text-teal-200" /> Current Shift
                                </h3>
                                <p className="text-teal-100 text-sm opacity-80 mb-6">
                                    {currentShift?.shiftType?.charAt(0).toUpperCase() + currentShift?.shiftType?.slice(1)} Shift
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                                        <p className="text-xs font-bold uppercase tracking-wider text-teal-200 mb-1">Started</p>
                                        <p className="text-lg font-bold">
                                            {currentShift?.actualStartTime
                                                ? format(new Date(currentShift.actualStartTime), 'h:mm a')
                                                : '--:--'
                                            }
                                        </p>
                                    </div>
                                    <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                                        <p className="text-xs font-bold uppercase tracking-wider text-teal-200 mb-1">Patients</p>
                                        <p className="text-lg font-bold">{assignedPatients.length}</p>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/10 text-xs text-teal-100">
                                    Shift #{currentShift?.shiftNumber || 'N/A'}
                                </div>
                            </motion.div>

                            {/* Active Alerts */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm"
                            >
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Bell size={18} className="text-red-500" />
                                    Active Alerts
                                </h4>
                                {alerts.length === 0 ? (
                                    <div className="text-center py-4 text-slate-400 text-sm flex flex-col items-center">
                                        <CheckCircle size={24} className="text-emerald-400 mb-2" />
                                        No active alerts
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {alerts.map((alert, idx) => (
                                            <div
                                                key={alert._id || idx}
                                                className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm"
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="font-medium text-red-800 flex-1 line-clamp-1">{alert.title || 'Alert'}</p>
                                                    <SeverityBadge severity={alert.severity} />
                                                </div>
                                                <p className="text-xs text-red-600">
                                                    {alert.patient?.firstName} {alert.patient?.lastName}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>

                            {/* Quick Tasks */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 }}
                                className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm"
                            >
                                <h4 className="font-bold text-slate-800 mb-4">Quick Actions</h4>
                                <div className="space-y-2">
                                    <button onClick={() => navigate('/nursing')} className="w-full p-3 text-left rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200">
                                        <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
                                            <Heart size={18} />
                                        </div>
                                        Record Vitals
                                    </button>
                                    <button onClick={() => navigate('/nursing')} className="w-full p-3 text-left rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200">
                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                            <Pill size={18} />
                                        </div>
                                        Administer Medication
                                    </button>
                                    <button onClick={() => navigate('/report-incident')} className="w-full p-3 text-left rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                            <AlertTriangle size={18} />
                                        </div>
                                        Report Incident
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NurseDashboard;
