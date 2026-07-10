import { useEffect, useState } from 'react';
import { WorkspaceLayout } from '@/app/WorkspaceLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { DenseTable, DenseTableCell, DenseTableRow } from '@/features/products/components/DenseTable';
import { listMyNotifications } from './api';

function channelLabel(channel: 'email' | 'push') {
  return channel === 'email' ? 'Email' : 'Push';
}

export function NotificationsPage() {
  const { profile } = useAuth();
  const profileId = profile?.id ?? null;
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listMyNotifications>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    const userId = profileId;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        setRows(await listMyNotifications(userId, 50));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [profileId]);

  const content = (
    <>
      {error && <p className="mb-4 text-body-sm text-error">{error}</p>}
      {loading ? (
        <p className="text-body-sm text-tertiary">Loading notifications…</p>
      ) : (
        <DenseTable headers={['Event', 'Channel', 'Sent at']}>
          {rows.map((row) => (
            <DenseTableRow key={row.id}>
              <DenseTableCell>{row.event_type}</DenseTableCell>
              <DenseTableCell>{channelLabel(row.channel)}</DenseTableCell>
              <DenseTableCell>{new Date(row.sent_at).toLocaleString()}</DenseTableCell>
            </DenseTableRow>
          ))}
          {rows.length === 0 && (
            <DenseTableRow>
              <DenseTableCell className="py-6 text-tertiary">No notifications yet.</DenseTableCell>
              <DenseTableCell>{null}</DenseTableCell>
              <DenseTableCell>{null}</DenseTableCell>
            </DenseTableRow>
          )}
        </DenseTable>
      )}
    </>
  );

  return <WorkspaceLayout title="Notifications">{content}</WorkspaceLayout>;
}
