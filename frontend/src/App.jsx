import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import InternOpsAssistant from './components/InternOpsAssistant';
import useAuthStore from './store/auth';
import api from './lib/axios';

function isTokenExpired(token) {
  try {
    const decoded = jwtDecode(token);

    if (!decoded.exp) {
      return true;
    }

    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
}

function Private({ children }) {
  const token = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);
  const logout = useAuthStore((s) => s.logout);

  if (!hydrated) return null;

  if (!token || isTokenExpired(token)) {
    if (token && typeof logout === 'function') logout();
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
            <Dashboard />
          </Private>
        }
      />
    </Routes>
  );
}
