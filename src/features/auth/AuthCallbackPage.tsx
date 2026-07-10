import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { setPasswordSchema } from './schemas';
import { getDefaultRouteForRole } from './roleRoutes';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshProfile, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function establishSession() {
      setError(null);

      const tokenHash = searchParams.get('token_hash');
      const otpType = searchParams.get('type');

      try {
        if (tokenHash && otpType) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as EmailOtpType,
          });
          if (verifyError) throw verifyError;
        }

        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!mounted) return;

        if (!data.session?.user) {
          setError('Invitation link is invalid or expired. Ask for a new invite.');
          setReady(false);
          return;
        }

        setSessionEmail(data.session.user.email ?? null);
        setReady(true);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unable to verify invitation.');
        setReady(false);
      }
    }

    void establishSession();

    return () => {
      mounted = false;
    };
  }, [searchParams]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = setPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (updateError) throw updateError;

      const profile = await refreshProfile();
      if (!profile?.active) {
        await signOut();
        throw new Error('Your account profile is missing or inactive. Contact an administrator.');
      }

      navigate(getDefaultRouteForRole(profile.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-4">
      <div className="cortex-card w-full max-w-md">
        <div className="p-8">
          <div className="mb-8 text-center">
            <p className="font-headline text-headline-lg uppercase tracking-wide text-primary-container">
              Cortex OS
            </p>
            <h1 className="mt-3 font-headline text-headline-md text-on-surface">Activate your account</h1>
            <p className="mt-2 text-body-sm text-on-surface-variant">
              Create a password to finish setting up your account.
            </p>
            {sessionEmail && (
              <p className="mt-2 font-mono text-data-mono text-xs text-on-surface-variant">{sessionEmail}</p>
            )}
          </div>

          {!ready && !error && (
            <p className="text-center text-body-sm text-on-surface-variant">Verifying invitation…</p>
          )}

          {error && !ready && (
            <div className="space-y-4 text-center">
              <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
                {error}
              </p>
              <Link to="/login" className="text-primary-container hover:underline">
                Back to sign in
              </Link>
            </div>
          )}

          {ready && (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
              <div>
                <label htmlFor="password" className="cortex-label mb-2 block">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="cortex-input"
                  required
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="cortex-label mb-2 block">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="cortex-input"
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

              <button type="submit" disabled={submitting} className="cortex-btn-primary w-full disabled:opacity-60">
                {submitting ? 'Saving…' : 'Continue'}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-body-sm text-on-surface-variant">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-container hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
