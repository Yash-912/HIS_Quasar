import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    LayoutDashboard, Users, Calendar, Stethoscope,
    FlaskConical, Pill, FileText, Settings,
    Menu, X, Activity, ShieldCheck, Database,
    Banknote, ScanLine, Siren, Scissors, ClipboardList, BedDouble, Ambulance,
    FileCode, CheckSquare, AlertCircle, UserPlus, Package, Moon, Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import systemSettingsService from '../../services/systemSettings.service';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const { user } = useSelector((state) => state.auth);
    const { theme, toggleTheme } = useTheme();
    const role = user?.role || 'guest';
    const [clinicalCodingEnabled, setClinicalCodingEnabled] = useState(true);

    // Check if clinical coding is enabled
    useEffect(() => {
        const checkCodingStatus = async () => {
            try {
                const status = await systemSettingsService.getClinicalCodingStatus();
                setClinicalCodingEnabled(status.enabled);
            } catch (error) {
                console.log('Could not fetch coding status');
                setClinicalCodingEnabled(true); // Default to show if error
            }
        };
        if (user) {
            checkCodingStatus();
        }
    }, [user]);

    // Navigation Config based on Roles
    // Navigation Config based on Roles
    const allNavItems = [
        // -------------------------------------------------------------------------
        // CLINICAL MODULES (Non-Admin)
        // -------------------------------------------------------------------------
        {
            title: 'Dashboard',
            path: '/dashboard',
            icon: <LayoutDashboard size={20} />,
            roles: ['doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_tech', 'radiologist', 'billing', 'head_nurse'] // REMOVED 'admin'
        },
        {
            title: 'Patients',
            path: '/dashboard/patients',
            icon: <Users size={20} />,
            roles: ['doctor', 'nurse', 'receptionist', 'head_nurse']
        },
        {
            title: 'Appointments',
            path: '/dashboard/appointments',
            icon: <Calendar size={20} />,
            roles: ['doctor', 'nurse', 'receptionist']
        },
        {
            title: 'OPD Queue',
            path: '/dashboard/opd-queue',
            icon: <Stethoscope size={20} />,
            roles: ['doctor', 'nurse', 'receptionist']
        },
        {
            title: 'IPD / Wards',
            path: '/dashboard/ipd',
            icon: <Activity size={20} />,
            roles: ['doctor', 'nurse', 'receptionist', 'head_nurse']
        },
        {
            title: 'Bed Management',
            path: '/dashboard/bed-management',
            icon: <BedDouble size={20} />,
            roles: ['doctor', 'nurse', 'receptionist', 'head_nurse', 'admin']
        },
        {
            title: 'Emergency',
            path: '/dashboard/emergency',
            icon: <Ambulance size={20} />,
            roles: ['doctor', 'nurse', 'receptionist', 'head_nurse', 'admin']
        },
        {
            title: 'Laboratory',
            path: '/dashboard/lab',
            icon: <FlaskConical size={20} />,
            roles: ['doctor', 'lab_tech']
        },
        {
            title: 'Radiology',
            path: '/dashboard/radiology',
            icon: <ScanLine size={20} />,
            roles: ['doctor', 'radiologist']
        },
        {
            title: 'Pharmacy',
            path: '/dashboard/pharmacy',
            icon: <Pill size={20} />,
            roles: ['pharmacist']
        },
        {
            title: 'Operation Theatre',
            path: '/dashboard/ot',
            icon: <Scissors size={20} />,
            roles: ['doctor', 'nurse']
        },
        {
            title: 'Nursing',
            path: '/dashboard/nursing',
            icon: <Activity size={20} />,
            roles: ['nurse', 'head_nurse']
        },
        {
            title: 'Doctor Rounds',
            path: '/dashboard/doctor-rounds',
            icon: <ClipboardList size={20} />,
            roles: ['doctor']
        },
        {
            title: 'Lab Test Results',
            path: '/dashboard/doctor-lab-tests',
            icon: <FlaskConical size={20} />,
            roles: ['doctor']
        },
        {
            title: 'Duty Roster',
            path: '/dashboard/duty-roster',
            icon: <Calendar size={20} />,
            roles: ['head_nurse']
        },

        {
            title: 'Billing',
            path: '/dashboard/billing',
            icon: <Banknote size={20} />,
            roles: ['billing']
        },
        {
            title: 'Insurance',
            path: '/dashboard/insurance',
            icon: <ShieldCheck size={20} />,
            roles: ['insurance', 'billing']
        },
        {
            title: 'Report Incident',
            path: '/dashboard/report-incident',
            icon: <AlertCircle size={20} />,
            roles: ['doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_tech', 'radiologist', 'billing', 'head_nurse', 'insurance', 'coder', 'senior_coder', 'compliance']
        },
        {
            title: 'My Reports',
            path: '/dashboard/my-incidents',
            icon: <FileText size={20} />,
            roles: ['doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_tech', 'radiologist', 'billing', 'head_nurse', 'insurance', 'coder', 'senior_coder', 'compliance']
        },
        {
            title: 'Incident Review Queue',
            path: '/dashboard/department-incidents',
            icon: <Database size={20} />,
            roles: ['head_nurse', 'compliance', 'admin']
        },

        // -------------------------------------------------------------------------
        // INVENTORY MANAGER (Inventory Manager Only)
        // -------------------------------------------------------------------------
        {
            title: 'Inventory Dashboard',
            path: '/inventory',
            icon: <LayoutDashboard size={20} />,
            roles: ['inventory_manager']
        },
        {
            title: 'Inventory Items',
            path: '/inventory/items',
            icon: <Package size={20} />,
            roles: ['inventory_manager']
        },
        {
            title: 'Purchase Orders',
            path: '/inventory/purchase-orders',
            icon: <ClipboardList size={20} />,
            roles: ['inventory_manager']
        },
        {
            title: 'Stock Operations',
            path: '/inventory/stock-issues',
            icon: <Activity size={20} />,
            roles: ['inventory_manager']
        },

        // -------------------------------------------------------------------------
        // CLINICAL CODING (Coder Roles) - Only shown when clinical coding is enabled
        // -------------------------------------------------------------------------
        {
            title: 'Coding Dashboard',
            path: '/dashboard/coding',
            icon: <LayoutDashboard size={20} />,
            roles: ['coder', 'senior_coder'],
            isCodingItem: true
        },
        {
            title: 'Coding Queue',
            path: '/dashboard/coding/queue',
            icon: <FileCode size={20} />,
            roles: ['coder', 'senior_coder'],
            isCodingItem: true
        },
        {
            title: 'Pending Review',
            path: '/dashboard/coding/review',
            icon: <CheckSquare size={20} />,
            roles: ['senior_coder'],
            isCodingItem: true
        },
        {
            title: 'Procedure Codes',
            path: '/dashboard/coding/procedure-codes',
            icon: <Database size={20} />,
            roles: ['coder', 'senior_coder', 'admin'],
            isCodingItem: true
        },

        // -------------------------------------------------------------------------
        // ADMIN MODULES (Admin Only)
        // -------------------------------------------------------------------------
        {
            title: 'Governance Dashboard',
            path: '/admin',
            icon: <LayoutDashboard size={20} />,
            roles: ['admin']
        },
        {
            title: 'User Management',
            path: '/admin/users',
            icon: <Users size={20} />,
            roles: ['admin']
        },
        {
            title: 'Staff Onboarding',
            path: '/admin/staff-onboarding',
            icon: <UserPlus size={20} />,
            roles: ['admin']
        },
        {
            title: 'Break-Glass',
            path: '/admin/break-glass',
            icon: <Siren size={20} />,
            roles: ['admin']
        },
        {
            title: 'Audit Logs',
            path: '/admin/audit-logs',
            icon: <FileText size={20} />,
            roles: ['admin']
        },
        {
            title: 'Revenue Anomalies',
            path: '/admin/revenue-anomalies',
            icon: <Banknote size={20} />,
            roles: ['admin']
        },
        {
            title: 'Incidents',
            path: '/admin/incidents',
            icon: <ShieldCheck size={20} />,
            roles: ['admin']
        },
        {
            title: 'Compliance',
            path: '/admin/compliance',
            icon: <ClipboardList size={20} />,
            roles: ['admin']
        },
        {
            title: 'Master Data',
            path: '/admin/master-data',
            icon: <Database size={20} />,
            roles: ['admin']
        },
        {
            title: 'Departments',
            path: '/admin/departments',
            icon: <Menu size={20} />,
            roles: ['admin']
        },
        {
            title: 'System Health',
            path: '/admin/system',
            icon: <Activity size={20} />,
            roles: ['admin']
        },
        {
            title: 'System Settings',
            path: '/admin/settings',
            icon: <Settings size={20} />,
            roles: ['admin']
        },
    ];

    // Filter links based on role and clinical coding status
    const filteredNav = allNavItems.filter(item => {
        // Check role access
        if (!item.roles.includes(role)) return false;

        // Hide coding items if clinical coding is disabled
        if (item.isCodingItem && !clinicalCodingEnabled) return false;

        return true;
    });

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
                className={`fixed left-0 top-0 bottom-0 z-50 bg-surface dark:bg-stone-900 border-r border-slate-200 dark:border-stone-800 w-64 shadow-xl md:shadow-none md:translate-x-0 transition-all duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-stone-800">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white mr-3">
                            <Activity size={18} />
                        </div>
                        <span className="font-bold text-lg text-textPrimary tracking-tight">HIS Quasar</span>
                        <button onClick={toggleSidebar} className="ml-auto md:hidden text-textSecondary">
                            <X size={20} />
                        </button>
                    </div>

                    {/* User Role Badge */}
                    <div className="px-6 py-4 bg-slate-50 dark:bg-stone-800 border-b border-slate-200 dark:border-stone-800">
                        <p className="text-xs uppercase tracking-wider text-textSecondary font-bold mb-1">Signed in as</p>
                        <p className="font-semibold text-textPrimary capitalize">{role.replace('_', ' ')}</p>
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
                                        : 'text-textSecondary hover:bg-slate-50 dark:hover:bg-stone-800 hover:text-textPrimary'
                                    }
                `}
                            >
                                {item.icon}
                                <span>{item.title}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* Theme Toggle & Footer */}
                    <div className="p-4 border-t border-slate-200 dark:border-stone-800 flex flex-col gap-4">
                        <button
                            onClick={toggleTheme}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-stone-800 hover:bg-slate-100 dark:hover:bg-stone-700 transition-colors text-sm font-medium text-textSecondary"
                        >
                            <span className="flex items-center gap-2">
                                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                                {theme === 'dark' ? 'Night Mode' : 'Day Mode'}
                            </span>
                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${theme === 'dark' ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                        </button>

                        <div className="text-xs text-center text-textSecondary">
                            v1.0.0 • HIS Quasar
                        </div>
                    </div>
                </div>
            </motion.aside>
        </>
    );
};

export default Sidebar;
