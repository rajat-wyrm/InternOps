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

  if (!hydrated) return null;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const logout = useAuthStore((s) => s.logout);
  const setSystemError = useAuthStore((s) => s.setSystemError);
  const systemError = useAuthStore((s) => s.systemError);
  const hydrated = useAuthStore((s) => s.hydrated);

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

  if (!hydrated) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-50 dark:from-slate-950 dark:via-indigo-950 dark:to-blue-950 text-slate-800 dark:text-white overflow-hidden animate-fade-in">
        {/* Background Decor Grid */}
        <div className="absolute inset-0 opacity-[0.4] dark:opacity-[0.2] pointer-events-none">
          <svg
            className="w-full h-full stroke-slate-900/[0.06] dark:stroke-white/[0.05]"
            width="100%"
            height="100%"
          >
            <defs>
              <pattern
                id="grid-pattern"
                width="56"
                height="100"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M28 66L0 50V16L28 0l28 16v34L28 66zm0 0v34M0 50l28 16M56 50L28 66M0 16l28 16M56 16L28 32"
                  fill="none"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
        </div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-400/10 dark:bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative flex flex-col items-center max-w-sm px-6 text-center">
          {/* Logo container */}
          <div className="inline-flex items-center justify-center rounded-3xl bg-white/40 dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/10 px-6 py-4 shadow-xl dark:shadow-2xl backdrop-blur-xl mb-6 animate-pulse">
            <img
              src="/UptoSkills.webp"
              alt="UptoSkills"
              className="w-[200px] h-auto object-contain"
            />
          </div>

          {/* Title and details */}
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white mb-1">
            InternOps
          </h1>
          <p className="text-slate-500 dark:text-white/60 text-xs tracking-wider uppercase mb-8">
            Workforce &amp; Intern Management Platform
          </p>

          {/* Premium Loading Spinner */}
          <div className="relative w-12 h-12">
            {/* Outer glowing track */}
            <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-white/5"></div>
            {/* Inner spinning gradient indicator */}
            <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-r-transparent border-indigo-600 dark:border-indigo-400 animate-spin"></div>
          </div>
        </div>
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
