import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import PublicPortal from './pages/PublicPortal';
import AuthorityLogin from './pages/authority/AuthorityLogin';
import AuthorityLayout from './components/authority/AuthorityLayout';
import AuthorityOverview from './pages/authority/AuthorityOverview';
import AuthorityMapPage from './pages/authority/AuthorityMapPage';
import AuthorityQueuePage from './pages/authority/AuthorityQueuePage';
import AuthorityCompletedPage from './pages/authority/AuthorityCompletedPage';
import AuthorityReportsPage from './pages/authority/AuthorityReportsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ========================================= */}
          {/* 1. PUBLIC CITIZEN PORTAL (/)              */}
          {/* ========================================= */}
          <Route path="/" element={<PublicPortal />} />

          {/* ========================================= */}
          {/* 2. AUTHORITY OFFICIAL LOGIN               */}
          {/* ========================================= */}
          <Route path="/authority/login" element={<AuthorityLogin />} />

          {/* ========================================= */}
          {/* 3. AUTHORITY SECURE MUNICIPAL PORTAL      */}
          {/* ========================================= */}
          <Route
            path="/authority"
            element={
              <ProtectedRoute>
                <AuthorityLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AuthorityOverview />} />
            <Route path="map" element={<AuthorityMapPage />} />
            <Route path="queue" element={<AuthorityQueuePage />} />
            <Route path="completed" element={<AuthorityCompletedPage />} />
            <Route path="reports" element={<AuthorityReportsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
