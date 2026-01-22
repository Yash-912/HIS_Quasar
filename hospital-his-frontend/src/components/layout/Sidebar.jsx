import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    LayoutDashboard, Users, Calendar, Stethoscope,
    FlaskConical, Pill, FileText, Settings,
    Menu, X, Activity, ShieldCheck, Database,
    Banknote, ScanLine, Siren, Scissors
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const { user } = useSelector((state) => state.auth);
    const role = user?.role || 'guest';

    // Navigation Config based on Roles
    const allNavItems = [
        {
            title: 'Dashboard',
            path: '/dashboard',
            icon: <LayoutDashboard size={20} />,
            roles: ['admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_tech', 'billing']
        },
        {
            title: 'Patients',
            path: '/dashboard/patients',
            icon: <Users size={20} />,
            roles: ['admin', 'doctor', 'nurse', 'receptionist']
        },
        {
            title: 'Appointments',
            path: '/dashboard/appointments',
            icon: <Calendar size={20} />,
            roles: ['admin', 'doctor', 'nurse', 'receptionist']
        },
        {
            title: 'OPD Queue',
            path: '/dashboard/opd-queue',
            icon: <Stethoscope size={20} />,
            roles: ['admin', 'doctor', 'nurse', 'receptionist']
        },
        {
            title: 'IPD / Wards',
            path: '/dashboard/ipd',
            icon: <Activity size={20} />,
            roles: ['admin', 'doctor', 'nurse', 'receptionist']
        },
        {
            title: 'Laboratory',
            path: '/dashboard/lab',
            icon: <FlaskConical size={20} />,
            roles: ['admin', 'doctor', 'lab_tech']
        },
        {
            title: 'Radiology',
            path: '/dashboard/radiology',
            icon: <ScanLine size={20} />,
            roles: ['admin', 'doctor', 'radiologist']
        },
        {
            title: 'Pharmacy',
            path: '/dashboard/pharmacy',
            icon: <Pill size={20} />,
            roles: ['admin', 'pharmacist']
        },
        {
            title: 'Operation Theatre',
            path: '/dashboard/ot',
            icon: <Scissors size={20} />,
            roles: ['admin', 'doctor', 'nurse']
        },
        {
            title: 'Nursing Station',
            path: '/dashboard/nursing',
            icon: <Stethoscope size={20} />,
            roles: ['admin', 'nurse']
        },
        {
            title: 'Billing',
            path: '/dashboard/billing',
            icon: <Banknote size={20} />,
            roles: ['admin', 'billing', 'receptionist']
        },
        {
            title: 'Insurance',
            path: '/dashboard/insurance',
            icon: <ShieldCheck size={20} />,
            roles: ['admin', 'insurance', 'billing']
        },
        {
            title: 'Inventory',
            path: '/dashboard/pharmacy?tab=inventory',
            icon: <Database size={20} />,
            roles: ['admin', 'pharmacist']
        },
        {
            title: 'Admin',
            path: '/dashboard/admin',
            icon: <Siren size={20} />, // Changed icon to distinguish
            roles: ['admin']
        },
        {
            title: 'Settings',
            path: '/dashboard/settings',
            icon: <Settings size={20} />,
            roles: ['admin'] // Everyone usually has settings, but simplified for now
        },
    ];

    // Filter links
    const filteredNav = allNavItems.filter(item => item.roles.includes(role));

    return (
        <>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleSidebar}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Container */}
            <motion.aside
                className={`fixed left-0 top-0 bottom-0 z-50 bg-white border-r border-gray-200 w-64 shadow-xl md:shadow-none md:translate-x-0 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="h-16 flex items-center px-6 border-b border-gray-100">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white mr-3">
                            <Activity size={18} />
                        </div>
                        <span className="font-bold text-lg text-secondary-dark tracking-tight">HIS Quasar</span>
                        <button onClick={toggleSidebar} className="ml-auto md:hidden text-gray-500">
                            <X size={20} />
                        </button>
                    </div>

                    {/* User Role Badge */}
                    <div className="px-6 py-4 bg-slate-50 border-b border-gray-100">
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">Signed in as</p>
                        <p className="font-semibold text-secondary-dark capitalize">{role.replace('_', ' ')}</p>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                        {filteredNav.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/dashboard'} // Only exact match for root dashboard
                                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                                        ? 'bg-primary/10 text-primary shadow-sm'
                                        : 'text-secondary hover:bg-slate-50 hover:text-secondary-dark'
                                    }
                `}
                            >
                                {item.icon}
                                <span>{item.title}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* Footer Info */}
                    <div className="p-4 border-t border-gray-100 text-xs text-center text-gray-400">
                        v1.0.0 • HIS Quasar
                    </div>
                </div>
            </motion.aside>
        </>
    );
};

export default Sidebar;
