import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { loginSchema } from '@/features/auth/schemas';
import { getDefaultRouteForRole } from '@/features/auth/roleRoutes';

export function LoginPage() {
  const { signIn, session, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  if (!loading && session && role) {
    return <Navigate to={from ?? getDefaultRouteForRole(role)} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    try {
      const nextRole = await signIn(parsed.data.email, parsed.data.password);
      navigate(from ?? getDefaultRouteForRole(nextRole), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOutStaleSession() {
    setError(null);
    try {
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-4">
      <div className="cortex-card w-full max-w-md">
        <div className="flex flex-col items-center p-8">
          <div className="mb-8 text-center">
            <p className="font-headline text-headline-lg uppercase tracking-wide text-primary-container">
              Cortex
            </p>
            <p className="mt-1 font-mono text-data-mono text-on-surface-variant">
              Production & Warehouse Management
            </p>
          </div>

          {!loading && session && !role && (
            <div className="mb-6 w-full rounded border border-amber-300 bg-amber-50 px-3 py-3 text-body-sm text-amber-900">
              <p className="font-semibold">Signed in, but profile not loaded</p>
              <p className="mt-1">
                Your login worked, but Cortex could not load your role. Try signing out and back in,
                or contact an administrator.
              </p>
              <button
                type="button"
                onClick={() => void handleSignOutStaleSession()}
                className="mt-3 text-primary-container hover:underline"
              >
                Sign out
              </button>
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-6">
            <div>
              <label htmlFor="email" className="cortex-label mb-2 block">
                Operator ID / Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="cortex-input"
                placeholder="name@company.com"
                required
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="cortex-label">
                  Passcode
                </label>
                <span className="text-body-sm text-primary">Invite-only access</span>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cortex-input"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p
                className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || loading}
              className="cortex-btn-primary mt-4 disabled:opacity-60"
            >
              {submitting ? 'Authenticating…' : 'Authenticate'}
            </button>
          </form>

          <div className="mt-8 w-full border-t border-border pt-4 text-center">
            <p className="text-body-sm text-on-surface-variant">
              Invited users set their password via email.{' '}
              <Link to="/auth/callback" className="text-primary-container hover:underline">
                Complete invite
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
