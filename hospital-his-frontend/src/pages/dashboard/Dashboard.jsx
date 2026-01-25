import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { getExecutiveStats, resetAnalytics } from '../../features/analytics/analyticsSlice';
import { Activity, Users, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import ReceptionistDashboard from './ReceptionistDashboard';
import ClinicalDashboard from './ClinicalDashboard';
import AdminGovernanceDashboard from '../admin/AdminGovernanceDashboard';
import InventoryDashboard from '../inventory/InventoryDashboard';
import LabTechDashboard from './LabTechDashboard';
import RadiologyDashboard from './RadiologyDashboard';
import PharmacistDashboard from './PharmacistDashboard';
import BillingDashboard from './BillingDashboard';
import HeadNurseDashboard from './HeadNurseDashboard';
import NurseDashboard from './NurseDashboard';

const StatCard = ({ title, value, subtext, icon: Icon, color }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all"
    >
        <div className="flex items-start justify-between mb-4">
            <div>
                <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-opacity-100`}>
                <Icon size={22} className={color.replace('bg-', 'text-')} />
            </div>
        </div>
        <div className="flex items-center text-xs">
            <TrendingUp size={14} className="text-green-500 mr-1" />
            <span className="text-green-500 font-semibold mr-1">12%</span>
            <span className="text-gray-400">{subtext}</span>
        </div>
    </motion.div>
);

const Dashboard = () => {
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);
    const { data, isLoading, isError, message } = useSelector((state) => state.analytics);

    useEffect(() => {
        // Only admin uses executive stats - other roles have dedicated dashboards
        if (user?.role === 'admin') {
            dispatch(getExecutiveStats());
        }

        return () => {
            dispatch(resetAnalytics());
        }
    }, [user, dispatch]);

    // Render logic based on Role
    const renderContent = () => {
        // Receptionist gets dedicated dashboard
        if (user?.role === 'receptionist') {
            return <ReceptionistDashboard />;
        }

        // Doctors get Clinical Dashboard
        if (user?.role === 'doctor') {
            return <ClinicalDashboard />;
        }

        // Regular Nurses get Nurse Dashboard (shift/task focused)
        if (user?.role === 'nurse') {
            return <NurseDashboard />;
        }

        // Head Nurses get Head Nurse Dashboard (ward management focused)
        if (user?.role === 'head_nurse') {
            return <HeadNurseDashboard />;
        }

        // Admin View - Use comprehensive Governance Dashboard
        if (user?.role === 'admin') {
            return <AdminGovernanceDashboard />;
        }

        // Inventory Manager View
        if (user?.role === 'inventory_manager') {
            return <InventoryDashboard />;
        }

        // Lab Technician View
        if (user?.role === 'lab_tech') {
            return <LabTechDashboard />;
        }

        // Radiologist View
        if (user?.role === 'radiologist') {
            return <RadiologyDashboard />;
        }

        // Pharmacist View
        if (user?.role === 'pharmacist') {
            return <PharmacistDashboard />;
        }

        // Billing Staff View
        if (user?.role === 'billing') {
            return <BillingDashboard />;
        }

        return <div>Welcome to your dashboard</div>;
    };

    // For roles with dedicated dashboards, don't show the shared widgets
    const showSharedWidgets = !['receptionist', 'doctor', 'nurse', 'head_nurse', 'inventory_manager', 'lab_tech', 'radiologist', 'pharmacist', 'billing'].includes(user?.role);

    return (
        <div className="min-h-screen">
            {renderContent()}

            {/* Shared widgets only for Admin */}
            {showSharedWidgets && user?.role === 'admin' && (
                <div className="grid md:grid-cols-2 gap-6 mt-8">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4">Patient Traffic</h3>
                        <div className="h-64 flex items-center justify-center text-gray-400 bg-slate-50 rounded-xl">
                            Chart Placeholder (Recharts)
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4">Recent Notifications</h3>
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-3 items-start p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                                    <div className="w-2 h-2 mt-2 bg-blue-500 rounded-full flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">New Lab Result Available</p>
                                        <p className="text-xs text-slate-500">Patient John Doe • 10 mins ago</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
