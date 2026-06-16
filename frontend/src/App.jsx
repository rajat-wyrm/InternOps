import { Routes, Route, Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import InternOpsAssistant from './components/InternOpsAssistant';
import useAuthStore from './store/auth';

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
  const logout = useAuthStore((s) => s.logout);

  if (!token || isTokenExpired(token)) {
    if (token && typeof logout === 'function') {
      logout();
    }

    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
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
