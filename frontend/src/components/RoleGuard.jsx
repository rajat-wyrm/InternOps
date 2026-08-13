import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/auth';

export default function RoleGuard({ children, allowedRoles }) {
  const { user, hydrated } = useAuthStore((s) => ({
    user: s.user,
    hydrated: s.hydrated,
  }));
  if (!hydrated) {
    return null;
  }

  // If no user or role mismatch, redirect to safe dashboard
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
