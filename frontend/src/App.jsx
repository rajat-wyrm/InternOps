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
import InternOpsAssistant from './components/InternOpsAssistant';
import useAuthStore from './store/auth';
import api from './lib/axios';

function Private({ children }) {
  const token = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) return null;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

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
      <Route
        path="/assistant"
        element={
          <Private>
            <InternOpsAssistant />
          </Private>
        }
      />
      <Route
        path="/*"
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
      </Route>
    </Routes>
  );
}
