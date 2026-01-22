import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/public/Landing';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import PatientsList from './pages/dashboard/PatientsList';
import AppointmentsList from './pages/dashboard/AppointmentsList';
import PatientDetails from './pages/dashboard/PatientDetails';
import OPDQueue from './pages/dashboard/OPDQueue';
import Consultation from './pages/doctor/Consultation';
import IPD from './pages/dashboard/IPD';
import Laboratory from './pages/dashboard/Laboratory';
import Radiology from './pages/dashboard/Radiology';
import Pharmacy from './pages/dashboard/Pharmacy';
import Billing from './pages/dashboard/Billing';
import OperationTheatre from './pages/dashboard/OperationTheatre';
import Nursing from './pages/dashboard/Nursing';
import DashboardLayout from './layouts/DashboardLayout';
import { Provider } from 'react-redux';
import { store } from './store/store';

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="patients" element={<PatientsList />} />
            <Route path="patients/:id" element={<PatientDetails />} />
            <Route path="appointments" element={<AppointmentsList />} />
            <Route path="opd-queue" element={<OPDQueue />} />
            <Route path="consultation/:appointmentId" element={<Consultation />} />
            <Route path="pharmacy" element={<Pharmacy />} />
            <Route path="ipd" element={<IPD />} />
            <Route path="lab" element={<Laboratory />} />
            <Route path="radiology" element={<Radiology />} />
            <Route path="billing" element={<Billing />} />
            <Route path="ot" element={<OperationTheatre />} />
            <Route path="nursing" element={<Nursing />} />

            {/* Future routes will be nested here */}
            {/* <Route path="patients" element={<Patients />} /> */}
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

export default App;
