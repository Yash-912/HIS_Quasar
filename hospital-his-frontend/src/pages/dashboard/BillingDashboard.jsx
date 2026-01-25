
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    DollarSign, Clock, CheckCircle, AlertTriangle,
    ChevronRight, TrendingUp, Receipt, CreditCard,
    RefreshCw, ArrowRight, FileText, PieChart
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import billingService from '../../services/billing.service';

// --- Reusable Components (Local) ---

// Animated CountUp for numbers
const CountUp = ({ value, duration = 800, prefix = '' }) => {
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
    return <span>{prefix}{count.toLocaleString()}</span>;
};

// StatCard Component
const StatCard = ({ title, value, subtext, icon: Icon, color, onClick, isLoading, delay = 0, highlight, prefix = '' }) => {
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
                    {isLoading ? <div className="h-9 w-20 bg-gray-200/50 animate-pulse rounded"></div> : <CountUp value={value} prefix={prefix} />}
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

// Status Badge
const StatusBadge = ({ status, paymentStatus }) => {
    let style = 'bg-gray-50 text-gray-600 border-gray-100';
    let label = status;

    if (status === 'cancelled') {
        style = 'bg-red-50 text-red-600 border-red-100';
        label = 'Cancelled';
    } else if (status === 'finalized' && paymentStatus === 'paid') {
        style = 'bg-emerald-50 text-emerald-600 border-emerald-100';
        label = 'Paid';
    } else if (status === 'finalized') {
        style = 'bg-blue-50 text-blue-600 border-blue-100';
        label = 'Finalized';
    } else if (status === 'draft') {
        style = 'bg-amber-50 text-amber-600 border-amber-100';
        label = 'Draft';
    }

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${style}`}>
            {label}
        </span>
    );
};

const BillingDashboard = () => {
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);

    // State
    const [stats, setStats] = useState({
        todayCollection: 0,
        pendingAmount: 0,
        todayBills: 0,
        totalRevenue: 0
    });
    const [recentBills, setRecentBills] = useState([]);
    const [pendingBills, setPendingBills] = useState([]);
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
            const [statsRes, billsRes, pendingRes] = await Promise.all([
                billingService.getDashboardStats(),
                billingService.getAllBills({ limit: 10 }),
                billingService.getPendingBills()
            ]);

            setStats(statsRes.data || { todayCollection: 0, pendingAmount: 0, todayBills: 0, totalRevenue: 0 });
            setRecentBills((billsRes.data || []).slice(0, 5));
            setPendingBills((pendingRes.data || []).slice(0, 5));
        } catch (error) {
            console.error("Error fetching billing dashboard data", error);
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
                        {greeting}, <span className="text-indigo-600">{user?.name?.split(' ')[0] || 'Billing Staff'}</span> 💰
                    </h1>
                    <p className="text-gray-500 mt-1">Manage bills, collect payments, and track revenue.</p>
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
                        onClick={() => navigate('/billing')}
                        className="ml-3 px-5 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 inline-flex items-center gap-2"
                    >
                        Go to Billing <ArrowRight size={18} />
                    </button>
                </div>
            </header>

            {/* Stats Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Today's Collection"
                    value={stats.todayCollection || 0}
                    subtext="Amount received today"
                    icon={DollarSign}
                    color="bg-emerald-500"
                    isLoading={loading}
                    delay={0}
                    prefix="₹"
                    onClick={() => navigate('/billing')}
                />
                <StatCard
                    title="Pending Amount"
                    value={stats.pendingAmount || 0}
                    subtext="Outstanding balance"
                    icon={Clock}
                    color="bg-amber-500"
                    isLoading={loading}
                    delay={0.1}
                    prefix="₹"
                    highlight={stats.pendingAmount > 0}
                    onClick={() => navigate('/billing')}
                />
                <StatCard
                    title="Today's Bills"
                    value={stats.todayBills || 0}
                    subtext="Bills generated"
                    icon={Receipt}
                    color="bg-blue-500"
                    isLoading={loading}
                    delay={0.2}
                    onClick={() => navigate('/billing')}
                />
                <StatCard
                    title="Total Revenue"
                    value={stats.totalRevenue || 0}
                    subtext="All time collection"
                    icon={TrendingUp}
                    color="bg-purple-500"
                    isLoading={loading}
                    delay={0.3}
                    prefix="₹"
                />
            </div>

            {/* Main Content Split: Recent Bills & Pending */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Recent Bills List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                                <FileText className="text-blue-500" size={20} /> Recent Bills
                            </h3>
                            <p className="text-sm text-gray-400">Latest billing activity</p>
                        </div>
                        <button onClick={() => navigate('/billing')} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                            View All <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        {recentBills.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                                    <Receipt size={32} />
                                </div>
                                <h4 className="text-slate-600 font-bold">No bills yet</h4>
                                <p className="text-slate-400 text-sm">Start creating bills to see them here.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentBills.map((bill, idx) => (
                                    <div
                                        key={bill._id || idx}
                                        onClick={() => navigate('/billing')}
                                        className="group p-4 rounded-xl border border-gray-100 hover:border-blue-100 bg-white hover:bg-blue-50/30 transition-all cursor-pointer flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-white group-hover:text-blue-600 transition-colors">
                                                {bill.patient?.firstName?.[0] || '?'}{bill.patient?.lastName?.[0] || '?'}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                                                    {bill.patient?.firstName} {bill.patient?.lastName}
                                                </h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span className="font-mono">{bill.billNumber || 'N/A'}</span>
                                                    <span>•</span>
                                                    <span>₹{(bill.grandTotal || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Date</p>
                                                <p className="text-xs font-medium text-slate-600">
                                                    {bill.createdAt ? format(new Date(bill.createdAt), 'dd MMM') : 'N/A'}
                                                </p>
                                            </div>
                                            <StatusBadge status={bill.status} paymentStatus={bill.paymentStatus} />
                                            <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Right Column: Quick Stats & Pending */}
                <div className="space-y-6">
                    {/* Revenue Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200"
                    >
                        <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                            <PieChart size={20} className="text-indigo-200" /> Revenue Overview
                        </h3>
                        <p className="text-indigo-100 text-sm opacity-80 mb-6">Today's financial snapshot</p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                                <p className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">Collected</p>
                                <p className="text-2xl font-bold">₹{(stats.todayCollection || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                                <p className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">Pending</p>
                                <p className="text-2xl font-bold">₹{(stats.pendingAmount || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Pending Bills Alert */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm"
                    >
                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-amber-500" />
                            Pending Payments
                        </h4>
                        {pendingBills.length === 0 ? (
                            <div className="text-center py-4 text-slate-400 text-sm flex flex-col items-center">
                                <CheckCircle size={24} className="text-emerald-400 mb-2" />
                                No pending payments
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {pendingBills.map((bill, idx) => (
                                    <div
                                        key={bill._id || idx}
                                        onClick={() => navigate('/billing')}
                                        className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm cursor-pointer hover:bg-amber-100 transition-colors"
                                    >
                                        <div className="flex justify-between items-center">
                                            <p className="font-medium text-amber-800">
                                                {bill.patient?.firstName} {bill.patient?.lastName}
                                            </p>
                                            <p className="font-bold text-amber-700">
                                                ₹{((bill.grandTotal || 0) - (bill.paidAmount || 0)).toLocaleString()}
                                            </p>
                                        </div>
                                        <p className="text-xs text-amber-600 mt-0.5">
                                            Bill: {bill.billNumber}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    {/* Quick Links */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm"
                    >
                        <h4 className="font-bold text-slate-800 mb-4">Quick Actions</h4>
                        <div className="space-y-2">
                            <button onClick={() => navigate('/billing')} className="w-full p-3 text-left rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Receipt size={18} />
                                </div>
                                Create New Bill
                            </button>
                            <button onClick={() => navigate('/billing')} className="w-full p-3 text-left rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <CreditCard size={18} />
                                </div>
                                Collect Payment
                            </button>
                            <button onClick={() => navigate('/insurance')} className="w-full p-3 text-left rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200">
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                    <FileText size={18} />
                                </div>
                                Manage Insurance Claims
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default BillingDashboard;
