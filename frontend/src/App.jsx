import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import InternOpsAssistant from './components/InternOpsAssistant';
import useAuthStore from './store/auth';

function Private({ children }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? children : <Navigate to="/login" />;
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
