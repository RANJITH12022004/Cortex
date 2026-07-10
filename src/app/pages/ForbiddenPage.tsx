import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { getDefaultRouteForRole } from '@/features/auth/roleRoutes';

export function ForbiddenPage() {
  const { role } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-4">
      <div className="cortex-card w-full max-w-md p-8 text-center">
        <h1 className="font-headline text-headline-md text-on-surface">Access denied</h1>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          You do not have permission to view this page.
        </p>
        {role && (
          <Link to={getDefaultRouteForRole(role)} className="cortex-btn-primary mt-6 inline-flex">
            Return home
          </Link>
        )}
      </div>
    </div>
  );
}
