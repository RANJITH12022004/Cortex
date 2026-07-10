import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { ROLE_LABELS } from '@/features/auth/roleRoutes';
import type { UserProfile } from '@/types/database';
import {
  DenseTable,
  DenseTableCell,
  DenseTableRow,
} from '@/features/products/components/DenseTable';
import { listTeamMembers, setUserActive } from './api';

function matchesEmployeeSearch(member: UserProfile, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    member.email.toLowerCase().includes(q) ||
    ROLE_LABELS[member.role].toLowerCase().includes(q) ||
    member.role.toLowerCase().includes(q)
  );
}

export function TeamEmployeesPage() {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(
    () => members.filter((member) => matchesEmployeeSearch(member, search)),
    [members, search],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setMembers(await listTeamMembers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleActive(member: UserProfile) {
    setActionError(null);
    setBusyId(member.id);
    try {
      await setUserActive(member.id, !member.active);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ManagerLayout title="Employees">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or role…"
          className="cortex-input max-w-md"
        />
        <Link to="/team/invite" className="cortex-btn-primary w-auto shrink-0 px-5 text-center">
          Invite employee
        </Link>
      </div>

      {loading && <p className="text-body-sm text-on-surface-variant">Loading team…</p>}
      {error && (
        <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {error}
        </p>
      )}
      {actionError && (
        <p className="mb-4 rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {actionError}
        </p>
      )}

      {!loading && !error && (
        <DenseTable headers={['Email', 'Role', 'Status', 'Actions']}>
          {filtered.map((member) => (
            <DenseTableRow key={member.id}>
              <DenseTableCell>
                <span className="font-mono text-data-mono">{member.email}</span>
              </DenseTableCell>
              <DenseTableCell>{ROLE_LABELS[member.role]}</DenseTableCell>
              <DenseTableCell>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    member.active
                      ? 'bg-tertiary-container/30 text-tertiary'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {member.active ? 'Active' : 'Inactive'}
                </span>
              </DenseTableCell>
              <DenseTableCell>
                {(member.role === 'employee' || member.role === 'procurement') && (
                  <button
                    type="button"
                    disabled={busyId === member.id}
                    onClick={() => void toggleActive(member)}
                    className="text-body-sm text-primary-container hover:underline disabled:opacity-50"
                  >
                    {member.active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </DenseTableCell>
            </DenseTableRow>
          ))}
          {filtered.length === 0 && (
            <DenseTableRow>
              <DenseTableCell className="py-6 text-on-surface-variant" colSpan={4}>
                No employees match your search.
              </DenseTableCell>
            </DenseTableRow>
          )}
        </DenseTable>
      )}
    </ManagerLayout>
  );
}
