import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getReceptionistStats } from '../../features/analytics/analyticsSlice';
import { Users, Calendar, Clock, Activity, TrendingUp, RefreshCw, PlusCircle, CalendarPlus, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const SOCKET_URL = 'http://98.93.152.237:5000';
const POLLING_INTERVAL = 30000; // 30 seconds

// Custom CountUp Component for animated numbers
const CountUp = ({ value, duration = 1000 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime = null;
        let startValue = count;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);

            // Ease out cubic
            const easeOut = 1 - Math.pow(1 - percentage, 3);

            setCount(Math.floor(startValue + (value - startValue) * easeOut));

            if (progress < duration) {
                requestAnimationFrame(animate);
            } else {
                setCount(value);
            }
        };

        requestAnimationFrame(animate);
    }, [value]);

    return <span>{count}</span>;
}

// Reuse StatCard Component with enhancements
const StatCard = ({ title, value, subtext, icon: Icon, color, isLoading, index }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
        className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all relative overflow-hidden group cursor-default"
    >
        {/* Soft background gradient glow */}
        <div className={`absolute top-0 right-0 w-32 h-32 ${color} bg-opacity-5 rounded-bl-[100px] -mr-10 -mt-10 transition-transform group-hover:scale-110 duration-500`} />

        <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-gray-500 text-sm font-semibold tracking-wide uppercase opacity-70 mb-2">{title}</p>
                    <h3 className="text-4xl font-extrabold text-slate-800 tracking-tight">
                        {isLoading ? (
                            <div className="h-10 w-20 bg-gray-100 animate-pulse rounded"></div>
                        ) : (
                            <CountUp value={value} />
                        )}
                    </h3>
                </div>
                <motion.div
                    whileHover={{ rotate: 15, scale: 1.1 }}
                    className={`p-4 rounded-2xl ${color} bg-opacity-10 text-opacity-100 shadow-sm`}
                >
                    <Icon size={24} className={color.replace('bg-', 'text-')} />
                </motion.div>
            </div>
            <div className="flex items-center text-sm font-medium">
                <span className={`flex items-center ${color.replace('bg-', 'text-')} bg-opacity-10 px-2 py-0.5 rounded-full mr-2`}>
                    <TrendingUp size={12} className="mr-1" />
                    Live
                </span>
                <span className="text-gray-400">{subtext}</span>
            </div>
        </div>
    </motion.div>
);

const ReceptionistDashboard = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { data: stats, isLoading, isError, message } = useSelector((state) => state.analytics);
    const { user } = useSelector((state) => state.auth);

    // Local state for real-time updates
    const [notifications, setNotifications] = useState([]);
    const [todayCount, setTodayCount] = useState(0);
    const [trafficData, setTrafficData] = useState([]);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update clock every minute
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

    // Keyboard shortcut for Register Patient
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                navigate('/patients/new');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    // Fetch stats function
    const fetchStats = useCallback(() => {
        setIsRefreshing(true);
        dispatch(getReceptionistStats())
            .finally(() => {
                setIsRefreshing(false);
                setLastRefresh(new Date());
            });
    }, [dispatch]);

    // Initial fetch
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Sync state
    useEffect(() => {
        if (stats) {
            setTodayCount(stats.newRegistrations || 0);
            setTrafficData(stats.trafficData || []);
        }
    }, [stats]);

    // Polling
    useEffect(() => {
        const interval = setInterval(fetchStats, POLLING_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchStats]);

    // Socket.io
    useEffect(() => {
        const socket = io(SOCKET_URL);
        if (user?.id) socket.emit('join-user-room', user.id);

        socket.on('patient-registered', (data) => {
            setTodayCount((prev) => prev + 1);

            // Update traffic chart
            const currentHour = new Date().getHours();
            setTrafficData((prev) => prev.map(item => {
                const hourNum = parseInt(item.name.split(':')[0], 10);
                if (hourNum === currentHour) {
                    return {
                        ...item,
                        patients: item.patients + 1,
                        registrations: (item.registrations || 0) + 1
                    };
                }
                return item;
            }));

            addNotification({
                id: Date.now(),
                title: 'New Patient Registered',
                message: `${data.name} has been registered.`,
                time: new Date(),
                type: 'registration'
            });
        });

        socket.on('appointment-updated', (data) => {
            fetchStats();
            const action = data.type === 'new' ? 'Created' : 'Updated';
            addNotification({
                id: Date.now(),
                title: `Appointment ${action}`,
                message: `Status: ${data.status}`,
                time: new Date(),
                type: 'appointment'
            });
        });

        return () => socket.disconnect();
    }, [user, fetchStats]);

    const addNotification = (notif) => {
        setNotifications((prev) => [notif, ...prev].slice(0, 5));
    };

    const handleManualRefresh = () => {
        fetchStats();
    };

    // Custom Chart Tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-800 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs">
                    <p className="font-bold mb-2 text-slate-300">{label}</p>
                    <div className="space-y-1">
                        <p className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                            Registrations: <span className="font-bold">{payload[0]?.payload?.registrations || 0}</span>
                        </p>
                        <p className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                            Appointments: <span className="font-bold">{payload[0]?.payload?.appointments || 0}</span>
                        </p>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (isError) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-red-50 rounded-2xl border border-red-100 m-8">
                <div className="bg-red-100 p-4 rounded-full text-red-500 mb-4">
                    <Activity size={32} />
                </div>
                <h3 className="text-xl font-bold text-red-800 mb-2">Something went wrong</h3>
                <p className="text-red-600 mb-6">{message}</p>
                <button onClick={handleManualRefresh} className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
                    Try Again
                </button>
            </div>
        );
    }

    if (isLoading && !stats) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="flex justify-between items-end mb-8 animate-pulse">
                    <div className="h-10 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-8 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="grid grid-cols-4 gap-6 mb-8">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse"></div>
                    ))}
                </div>
                <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 h-96 bg-gray-100 rounded-2xl animate-pulse"></div>
                    <div className="h-96 bg-gray-100 rounded-2xl animate-pulse"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-10 max-w-7xl mx-auto">
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
                        {greeting}, <span className="text-blue-600">{user?.name?.split(' ')[0] || 'Receptionist'}</span> 👋
                    </h1>
                    <p className="text-gray-500 mt-1">Here's what's happening at the front desk right now.</p>
                </div>

                <div className="flex items-center gap-3">
                    {lastRefresh && (
                        <div className="hidden md:block text-right mr-2">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Last Updated</p>
                            <p className="text-xs font-medium text-gray-600">{format(lastRefresh, 'h:mm:ss a')}</p>
                        </div>
                    )}
                    <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => navigate('/notifications')}
                        className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 relative"
                        title="Notifications"
                    >
                        <Bell size={20} />
                        {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
                    </button>
                </div>
            </header>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    index={0}
                    title="Registrations"
                    value={todayCount}
                    subtext="New patients today"
                    icon={Users}
                    color="bg-blue-500"
                    isLoading={isRefreshing}
                />
                <StatCard
                    index={1}
                    title="Appointments"
                    value={stats?.appointments?.scheduled || 0}
                    subtext="Scheduled for today"
                    icon={Calendar}
                    color="bg-purple-500"
                    isLoading={isRefreshing}
                />
                <StatCard
                    index={2}
                    title="Checked In"
                    value={stats?.appointments?.checkedIn || 0}
                    subtext="Waiting in lobby"
                    icon={Clock}
                    color="bg-amber-500"
                    isLoading={isRefreshing}
                />
                <StatCard
                    index={3}
                    title="Completed"
                    value={stats?.appointments?.completed || 0}
                    subtext="Successfully cleared"
                    icon={Activity}
                    color="bg-emerald-500"
                    isLoading={isRefreshing}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Traffic Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-slate-200/50"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="font-bold text-xl text-slate-800">Patient Traffic</h3>
                            <p className="text-sm text-gray-500">Hourly breakdown of footfall</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-semibold">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-blue-500"></span> Registrations
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-purple-500"></span> Appointments
                            </div>
                        </div>
                    </div>

                    <div className="h-[350px] w-full">
                        {trafficData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trafficData} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 500 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 500 }}
                                        dx={-10}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
                                    <Bar
                                        dataKey="registrations"
                                        fill="url(#colorReg)"
                                        radius={[4, 4, 4, 4]}
                                        barSize={12}
                                        animationDuration={1500}
                                    />
                                    <Bar
                                        dataKey="appointments"
                                        fill="url(#colorAppt)"
                                        radius={[4, 4, 4, 4]}
                                        barSize={12}
                                        animationDuration={1500}
                                        animationBegin={200}
                                    />
                                    <defs>
                                        <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#60A5FA" stopOpacity={1} />
                                        </linearGradient>
                                        <linearGradient id="colorAppt" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#A78BFA" stopOpacity={1} />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300">
                                <Activity size={48} className="mb-4 opacity-20" />
                                <p>No traffic recorded yet today</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Right Column: Key Actions & Live Feed */}
                <div className="space-y-8">

                    {/* Quick Actions Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden"
                    >
                        {/* Decorative circle */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>

                        <h3 className="font-bold text-lg mb-6 relative z-10">Quick Actions</h3>

                        <div className="space-y-4 relative z-10">
                            <button
                                onClick={() => navigate('/patients/new')}
                                className="w-full group flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 rounded-2xl transition-all duration-300"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-blue-500 rounded-xl group-hover:scale-110 transition-transform">
                                        <PlusCircle size={20} className="text-white" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm">Register Patient</div>
                                        <div className="text-[10px] opacity-60">Press 'R'</div>
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all">
                                    →
                                </div>
                            </button>

                            <button
                                onClick={() => navigate('/appointments/new')}
                                className="w-full group flex items-center justify-between p-4 bg-white/5 hover:bg-white/15 border border-white/5 hover:border-white/20 rounded-2xl transition-all duration-300"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-purple-500 rounded-xl group-hover:scale-110 transition-transform">
                                        <CalendarPlus size={20} className="text-white" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm">Book Appointment</div>
                                        <div className="text-[10px] opacity-60">Schedule visit</div>
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all">
                                    →
                                </div>
                            </button>
                        </div>
                    </motion.div>

                    {/* Live Updates Feed */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                        className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-slate-200/50"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-800 text-lg">Live Updates</h3>
                            <span className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold border border-green-100">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                System Active
                            </span>
                        </div>

                        <div className="space-y-0 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar -mr-2">
                            <AnimatePresence>
                                {notifications.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl"
                                    >
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                                            <Activity size={20} />
                                        </div>
                                        <p className="text-slate-400 font-medium text-sm">Waiting for events...</p>
                                        <p className="text-slate-300 text-xs">New activities will appear here.</p>
                                    </motion.div>
                                ) : (
                                    notifications.map((notif, idx) => (
                                        <motion.div
                                            key={notif.id}
                                            initial={{ opacity: 0, x: 50, height: 0 }}
                                            animate={{ opacity: 1, x: 0, height: 'auto' }}
                                            exit={{ opacity: 0, x: -50, height: 0 }}
                                            className="relative pl-6 pb-6 last:pb-0 border-l-2 border-slate-100"
                                        >
                                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-sm"></div>
                                            <div className="bg-slate-50 p-3 rounded-xl hover:bg-blue-50 transition-colors cursor-default">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-slate-700 text-sm">{notif.title}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium">{format(notif.time, 'h:mm a')}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 leading-relaxed">{notif.message}</p>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default ReceptionistDashboard;
