import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import DashboardLayout from './layouts/DashboardLayout';
import Tasks from './pages/Tasks';
import Attendance from './pages/Attendance';
import Ratings from './pages/Ratings';
import Team from './pages/Team';
import Profile from './pages/Profile';
import Sessions from './pages/Sessions';
import Meetings from './pages/Meetings';
import Notifications from './pages/Notifications';
import InternOpsAssistant from './components/InternOpsAssistant';
import Reports from './pages/admin/Reports';
import Analytics from './pages/admin/Analytics';
import Exports from './pages/admin/Exports';
import AdminDashboard from './pages/admin/AdminDashboard';
import Departments from './pages/admin/Departments';
import AuditLog from './pages/admin/AuditLog';
import Notices from './pages/admin/Notices';
import Certificates from './pages/admin/Certificates';
import BulkGenerate from './pages/admin/BulkGenerate';
import CanvaTemplates from './pages/admin/CanvaTemplates';
import AICertificates from './pages/admin/AICertificates';
import QuickGenerate from './pages/admin/QuickGenerate';
import useAuthStore from './store/auth';
import api from './lib/axios';
import RoleGuard from './components/RoleGuard';
import ErrorBoundary from './components/ErrorBoundary';

let bootRefreshPromise = null;

function Private({ children }) {
  const token = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const logout = useAuthStore((s) => s.logout);
  const setSystemError = useAuthStore((s) => s.setSystemError);
  const systemError = useAuthStore((s) => s.systemError);

  useEffect(() => {
    if (!bootRefreshPromise) {
      bootRefreshPromise = api.post('/auth/refresh', {});
    }

    bootRefreshPromise
      .then((res) => {
        setAuth({
          accessToken: res.data.accessToken,
          user: res.data.user,
        });
      })
      .catch((err) => {
        const status = err.response?.status;
        if (status === 400 || status === 401 || status === 403) {
          const currentToken = useAuthStore.getState().accessToken;
          if (!currentToken) logout();
        } else {
          setSystemError(
            'Service temporarily unavailable. Please try again later.'
          );
        }
      })
      .finally(() => {
        setHydrated();
      });
  }, [logout, setAuth, setHydrated, setSystemError]);

  if (systemError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '12px',
        }}
      >
        <p style={{ fontSize: '1.1rem', color: '#b91c1c', fontWeight: 600 }}>
          {systemError}
        </p>
        <button
          onClick={() => {
            useAuthStore.getState().setSystemError(null);
            bootRefreshPromise = null;
            window.location.reload();
          }}
          style={{ padding: '8px 20px', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* SINGLE LAYOUT WRAPPER FOR ALL AUTHENTICATED PAGES */}
        <Route
          path="/"
          element={
            <Private>
              <DashboardLayout />
            </Private>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="ratings" element={<Ratings />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="team" element={<Team />} />
          <Route path="profile" element={<Profile />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="assistant" element={<InternOpsAssistant />} />

          {/* Admin/Manager Routes */}
          <Route
            path="reports"
            element={
              <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
                <Reports />
              </RoleGuard>
            }
          />
          <Route
            path="notices"
            element={
              <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
                <Notices />
              </RoleGuard>
            }
          />
          <Route
            path="analytics"
            element={
              <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
                <Analytics />
              </RoleGuard>
            }
          />
          <Route
            path="exports"
            element={
              <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
                <Exports />
              </RoleGuard>
            }
          />

          <Route
            path="admin"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="departments"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <Departments />
              </RoleGuard>
            }
          />
          <Route
            path="audit"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <AuditLog />
              </RoleGuard>
            }
          />

          {/* Certificate & Canva Routes (Admin only) */}
          <Route
            path="quick-generate"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <QuickGenerate />
              </RoleGuard>
            }
          />
          <Route
            path="certificates"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <Certificates />
              </RoleGuard>
            }
          />
          <Route
            path="bulk-generate"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <BulkGenerate />
              </RoleGuard>
            }
          />
          <Route
            path="canva-templates"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <CanvaTemplates />
              </RoleGuard>
            }
          />
          <Route
            path="ai-certificates"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <AICertificates />
              </RoleGuard>
            }
          />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
