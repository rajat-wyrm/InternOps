import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/auth';

export default function RoleGuard({ children, allowedRoles }) {
  const user = useAuthStore((s) => s.user);

  // If no user or role mismatch, redirect to safe dashboard
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
