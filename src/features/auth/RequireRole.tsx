import { Navigate } from 'react-router-dom';
import type { UserRole } from '@/types/database';
import { canAccessRoles } from '@/app/navigation';
import { useAuth } from './AuthProvider';
import { getDefaultRouteForRole } from './roleRoutes';

type RequireRoleProps = {
  allowedRoles: UserRole[];
  children: React.ReactNode;
};

export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessRoles(role, allowedRoles)) {
    return <Navigate to={getDefaultRouteForRole(role)} replace />;
  }

  return <>{children}</>;
}
