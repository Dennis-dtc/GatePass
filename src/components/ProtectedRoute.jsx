import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * @param {ReactNode} element
 * @param {string} role - allowed role for this route 
 */
export default function ProtectedRoute({ element, role }) {
  const { auth } = useAuth();

  // Not logged in at all
  if (!auth.uid || !auth.role) {
    return <Navigate to="/" replace />;
  }

  // Trying to enter another user's route
  if (auth.role !== role) {
    return <Navigate to="/" replace />;
  }

  return element;
}
