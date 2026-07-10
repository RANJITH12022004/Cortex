import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { getDefaultRouteForRole } from './roleRoutes';

export function RoleRedirect() {
  const { session, role, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-amber-900">Account profile missing</h1>
          <p className="mt-2 text-sm text-amber-800">
            You are signed in, but Cortex has no role on file for this account. An administrator
            needs to invite you or link your profile in the system.
          </p>
          <button
            type="button"
            onClick={() => void signOut().then(() => window.location.assign('/login'))}
            className="mt-4 text-sm font-semibold text-primary-container hover:underline"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  return <Navigate to={getDefaultRouteForRole(role)} replace />;
}
