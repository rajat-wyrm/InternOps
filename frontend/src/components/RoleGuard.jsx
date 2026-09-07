import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/auth';

export default function RoleGuard({ children, allowedRoles }) {
  const location = useLocation();
  const { user, hydrated } = useAuthStore((s) => ({
    user: s.user,
    hydrated: s.hydrated,
  }));
  if (!hydrated) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
