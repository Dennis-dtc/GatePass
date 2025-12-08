import React from 'react';
import { Routes, Route } from 'react-router-dom';

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from './components/ProtectedRoute';

// Landing
import LandingPage from './pages/LandingPage';

// Student
import StudentAuth from './components/StudentAuth';
import StudentHome from './pages/StudentHome';

// Security
import SecurityAuth from './components/SecurityAuth';
import SecurityHome from './pages/SecurityHome';

// Admin
import AdminAuth from './components/AdminAuth';
import AdminDashboard from './pages/AdminDashboard';

// Notifications
import { NotificationProvider } from "./context/NotificationContext";
import OverrideDialogs from "./utils/OverrideDialogs";

export default function App() {
  return (
    <NotificationProvider>
      <OverrideDialogs />  {/* <-- enables global alert/confirm/prompt override */}
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* STUDENT */}
          <Route path="/student/auth" element={<StudentAuth />} />
          <Route
            path="/student/home"
            element={
              <ProtectedRoute
                role="student"
                element={<StudentHome />}
              />
            }
          />

          {/* SECURITY */}
          <Route path="/security/login" element={<SecurityAuth />} />
          <Route
            path="/security/home"
            element={
              <ProtectedRoute
                role="security"
                element={<SecurityHome />}
              />
            }
          />

          {/* ADMIN */}
          <Route path="/admin/login" element={<AdminAuth />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute
                role="admin"
                element={<AdminDashboard />}
              />
            }
          />
        </Routes>
      </AuthProvider>
    </NotificationProvider>
  );
}
