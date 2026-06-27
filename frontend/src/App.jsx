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
import useAuthStore from './store/auth';
import api from './lib/axios';
import RoleGuard from './components/RoleGuard';

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

  useEffect(() => {
    api
      .post('/auth/refresh')
      .then((res) =>
        setAuth({ accessToken: res.data.accessToken, user: res.data.user })
      )
      .catch(() => {})
      .finally(() => setHydrated());
  }, []);

  return (
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
      </Route>
    </Routes>
  );
}
