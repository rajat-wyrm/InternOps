import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import DashboardLayout from './layouts/DashboardLayout';
import useAuthStore from './store/auth';
import useFeatureFlagsStore from './store/featureFlags';
import { refreshSession } from './lib/axios';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import RouteRefreshSkeleton from './components/loading/RouteRefreshSkeleton';

const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Ratings = lazy(() => import('./pages/Ratings'));
const Team = lazy(() => import('./pages/Team'));
const Profile = lazy(() => import('./pages/Profile'));
const Requests = lazy(() => import('./pages/Requests'));
const Sessions = lazy(() => import('./pages/Sessions'));
const Meetings = lazy(() => import('./pages/Meetings'));
const Notifications = lazy(() => import('./pages/Notifications'));

const InternOpsAssistant = lazy(
  () => import('./components/InternOpsAssistant')
);

const PerformanceIntelligence = lazy(
  () => import('./pages/PerformanceIntelligence')
);

const PrivilegedRoutes = lazy(() => import('./PrivilegedRoutes'));

function PageLoader() {
  return <RouteRefreshSkeleton />;
}

function PublicLazyPage({ children }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

let bootRefreshPromise = null;

function Private({ children }) {
  const location = useLocation();
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const impersonation = useAuthStore((s) => s.impersonation);

  if (!hydrated) {
    return user ? children : null;
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (
    user?.mustChangePassword &&
    !impersonation &&
    window.location.pathname !== '/profile'
  ) {
    return <Navigate to="/profile" replace />;
  }

  return children;
}

function PrivilegedRouteGate() {
  const user = useAuthStore((s) => s.user);

  const privilegedRoles = ['ADMIN', 'SENIOR_TL', 'TL', 'HR'];

  if (!privilegedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <PrivilegedRoutes />
    </Suspense>
  );
}

export default function App() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const logout = useAuthStore((s) => s.logout);
  const setSystemError = useAuthStore((s) => s.setSystemError);
  const systemError = useAuthStore((s) => s.systemError);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
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
      bootRefreshPromise = refreshSession().then(
        async ({ user: refreshedUser }) => {
          if (refreshedUser?.mustChangePassword) {
            resetFlags();
          } else {
            Promise.resolve(fetchFlags()).catch(() => {});
          }

          return refreshedUser;
        }
      );
    }

    bootRefreshPromise
      .catch((err) => {
        const status = err.response?.status;

        if (status === 400 || status === 401 || status === 403) {
          const currentToken = useAuthStore.getState().accessToken;

          if (!currentToken) {
            logout();
            resetFlags();
          }
        } else if (status === 429) {
          const retryAfterHeader = Number(
            err.response?.headers?.['retry-after']
          );

          const retryAfter =
            Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
              ? Math.ceil(retryAfterHeader)
              : 10;

          setRetryAfterSeconds(retryAfter);

          setSystemError(
            `Too many requests. Please retry in ${retryAfter} seconds.`
          );
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

  useEffect(() => {
    if (!systemError || retryAfterSeconds <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setRetryAfterSeconds((seconds) => {
        const next = Math.max(0, seconds - 1);

        if (next > 0) {
          setSystemError(`Too many requests. Please retry in ${next} seconds.`);
        } else {
          setSystemError('You can retry now.');
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [retryAfterSeconds > 0, setSystemError, systemError]);

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
        <p
          style={{
            fontSize: '1.1rem',
            color: '#b91c1c',
            fontWeight: 600,
          }}
        >
          {systemError}
        </p>

        <button
          onClick={() => {
            if (retryAfterSeconds > 0) return;

            useAuthStore.getState().setSystemError(null);
            bootRefreshPromise = null;
            window.location.reload();
          }}
          disabled={retryAfterSeconds > 0}
          style={{
            padding: '8px 20px',
            cursor: retryAfterSeconds > 0 ? 'not-allowed' : 'pointer',
            opacity: retryAfterSeconds > 0 ? 0.6 : 1,
          }}
        >
          {retryAfterSeconds > 0 ? `Retry in ${retryAfterSeconds}s` : 'Retry'}
        </button>
      </div>
    );
  }

  if (!hydrated && !useAuthStore.getState().user) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-50 dark:from-slate-950 dark:via-indigo-950 dark:to-blue-950 text-slate-800 dark:text-white overflow-hidden animate-fade-in">
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
          <div className="inline-flex items-center justify-center rounded-3xl bg-white/40 dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/10 px-6 py-4 shadow-xl dark:shadow-2xl backdrop-blur-xl mb-6 animate-pulse">
            <img
              src="/UptoSkills.webp"
              alt="UptoSkills"
              className="w-[200px] h-auto object-contain"
            />
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white mb-1">
            InternOps
          </h1>

          <p className="text-slate-500 dark:text-white/60 text-xs tracking-wider uppercase mb-8">
            Workforce &amp; Intern Management Platform
          </p>

          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400"
            role="status"
            aria-label="Loading InternOps"
          />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/forgot-password"
          element={
            <PublicLazyPage>
              <ForgotPassword />
            </PublicLazyPage>
          }
        />

        <Route
          path="/reset-password"
          element={
            <PublicLazyPage>
              <ResetPassword />
            </PublicLazyPage>
          }
        />

        <Route
          path="/"
          element={
            <Private>
              <DashboardLayout />
            </Private>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />

          {/* Common authenticated routes */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="ratings" element={<Ratings />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="team" element={<Team />} />
          <Route path="profile" element={<Profile />} />
          <Route path="requests" element={<Requests />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="assistant" element={<InternOpsAssistant />} />

          <Route
            path="performance-intelligence"
            element={<PerformanceIntelligence />}
          />

          {/* Privileged routes are loaded only after clearance is known */}
          <Route path="tasks/:taskId" element={<PrivilegedRouteGate />} />

          <Route path="admin/tasks/:taskId" element={<PrivilegedRouteGate />} />

          <Route path="hr" element={<PrivilegedRouteGate />} />

          <Route path="internops" element={<PrivilegedRouteGate />} />

          <Route path="reports" element={<PrivilegedRouteGate />} />

          <Route path="report-templates" element={<PrivilegedRouteGate />} />

          <Route path="notices" element={<PrivilegedRouteGate />} />

          <Route path="analytics" element={<PrivilegedRouteGate />} />

          <Route path="exports" element={<PrivilegedRouteGate />} />

          <Route path="admin" element={<PrivilegedRouteGate />} />

          <Route path="departments" element={<PrivilegedRouteGate />} />

          <Route path="admin/departments" element={<PrivilegedRouteGate />} />

          <Route
            path="departments/:deptId/projects"
            element={<PrivilegedRouteGate />}
          />

          <Route
            path="departments/:deptId/projects/:leadId"
            element={<PrivilegedRouteGate />}
          />

          <Route
            path="admin/departments/:deptId/attendance"
            element={<PrivilegedRouteGate />}
          />

          <Route
            path="admin/departments/:deptId/ratings"
            element={<PrivilegedRouteGate />}
          />

          <Route
            path="admin/departments/:deptId/tasks"
            element={<PrivilegedRouteGate />}
          />

          <Route path="audit" element={<PrivilegedRouteGate />} />

          <Route path="quick-generate" element={<PrivilegedRouteGate />} />

          <Route path="certificates" element={<PrivilegedRouteGate />} />

          <Route path="bulk-generate" element={<PrivilegedRouteGate />} />

          <Route path="canva-templates" element={<PrivilegedRouteGate />} />

          <Route
            path="canva-templates/callback"
            element={<PrivilegedRouteGate />}
          />

          <Route path="ai-certificates" element={<PrivilegedRouteGate />} />

          <Route path="feature-flags" element={<PrivilegedRouteGate />} />

          <Route path="github-sync" element={<PrivilegedRouteGate />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
