import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import DashboardLayout from './layouts/DashboardLayout';
import useAuthStore from './store/auth';
import useFeatureFlagsStore from './store/featureFlags';
import api from './lib/axios';
import RoleGuard from './components/RoleGuard';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load page components
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Ratings = lazy(() => import('./pages/Ratings'));
const Team = lazy(() => import('./pages/Team'));
const Profile = lazy(() => import('./pages/Profile'));
const Sessions = lazy(() => import('./pages/Sessions'));
const Meetings = lazy(() => import('./pages/Meetings'));
const Notifications = lazy(() => import('./pages/Notifications'));
const InternOpsAssistant = lazy(
  () => import('./components/InternOpsAssistant')
);
const Reports = lazy(() => import('./pages/admin/Reports'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const Exports = lazy(() => import('./pages/admin/Exports'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Departments = lazy(() => import('./pages/admin/Departments'));
const AuditLog = lazy(() => import('./pages/admin/AuditLog'));
const Notices = lazy(() => import('./pages/admin/Notices'));
const Certificates = lazy(() => import('./pages/admin/Certificates'));
const BulkGenerate = lazy(() => import('./pages/admin/BulkGenerate'));
const CanvaTemplates = lazy(() => import('./pages/admin/CanvaTemplates'));
const AICertificates = lazy(() => import('./pages/admin/AICertificates'));
const QuickGenerate = lazy(() => import('./pages/admin/QuickGenerate'));
const FeatureFlags = lazy(() => import('./pages/admin/FeatureFlags'));
const ProjectsPage = lazy(() => import('./pages/admin/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/admin/ProjectDetailPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] w-full">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-white/5"></div>
        <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-r-transparent border-indigo-600 dark:border-indigo-400 animate-spin"></div>
      </div>
    </div>
  );
}

let bootRefreshPromise = null;

function Private({ children }) {
  const token = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) return null;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const logout = useAuthStore((s) => s.logout);
  const setSystemError = useAuthStore((s) => s.setSystemError);
  const systemError = useAuthStore((s) => s.systemError);
  const hydrated = useAuthStore((s) => s.hydrated);
  const fetchFlags = useFeatureFlagsStore((s) => s.fetchFlags);
  const resetFlags = useFeatureFlagsStore((s) => s.reset);

  useEffect(() => {
    const handleForceLogout = () => {
      logout();
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, [logout, navigate]);

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
        // Fetch feature flags right after a successful auth refresh so they
        // are available before any page component renders.
        fetchFlags();
      })
      .catch((err) => {
        const status = err.response?.status;
        if (status === 400 || status === 401 || status === 403) {
          const currentToken = useAuthStore.getState().accessToken;
          if (!currentToken) {
            logout();
            resetFlags();
          }
        } else {
          setSystemError(
            'Service temporarily unavailable. Please try again later.'
          );
        }
      })
      .finally(() => {
        setHydrated();
      });
  }, [logout, setAuth, setHydrated, setSystemError, fetchFlags, resetFlags]);

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
      <Suspense fallback={<PageLoader />}>
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
              path="departments/:deptId/projects"
              element={
                <RoleGuard allowedRoles={['ADMIN']}>
                  <ProjectsPage />
                </RoleGuard>
              }
            />
            <Route
              path="departments/:deptId/projects/:leadId"
              element={
                <RoleGuard allowedRoles={['ADMIN']}>
                  <ProjectDetailPage />
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
            <Route
              path="feature-flags"
              element={
                <RoleGuard allowedRoles={['ADMIN']}>
                  <FeatureFlags />
                </RoleGuard>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
