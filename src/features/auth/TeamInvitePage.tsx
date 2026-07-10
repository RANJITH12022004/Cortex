import { FormEvent, useState } from 'react';
import { ManagerLayout } from '@/app/ManagerLayout';
import { inviteUser } from './inviteApi';
import { inviteSchema, type InviteFormValues } from './schemas';

export function TeamInvitePage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteFormValues['role']>('employee');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const parsed = inviteSchema.safeParse({ email, role });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    try {
      const result = await inviteUser(parsed.data);
      setMessage(result.message ?? 'Invitation sent.');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send invitation.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ManagerLayout title="Invite team member">
      <div className="cortex-module max-w-lg p-6">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div>
            <label htmlFor="email" className="cortex-label mb-2 block">
              Email address
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
            <label htmlFor="role" className="cortex-label mb-2 block">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as InviteFormValues['role'])}
              className="cortex-input"
            >
              <option value="employee">Employee</option>
              <option value="procurement">Procurement</option>
            </select>
          </div>

          {message && (
            <p className="rounded border border-tertiary-container bg-tertiary-container/20 px-3 py-2 text-body-sm text-tertiary">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="cortex-btn-primary disabled:opacity-60">
            {submitting ? 'Sending…' : 'Send invitation'}
          </button>
        </form>
      </div>
    </ManagerLayout>
  );
}
