import { useEffect, useState } from 'react';
import { ManagerLayout } from '@/app/ManagerLayout';
import { DenseTable, DenseTableCell, DenseTableRow } from '@/features/products/components/DenseTable';
import { fetchEmployeeAnalytics } from './api';

function formatMinutes(value: number | null) {
  if (value === null) return '—';
  if (value < 60) return `${value.toFixed(0)} min`;
  return `${(value / 60).toFixed(1)} hr`;
}

export function ManagerAnalyticsPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchEmployeeAnalytics>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchEmployeeAnalytics()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  const totals = rows.reduce(
    (acc, row) => {
      acc.completedTasks += row.completedTasks;
      acc.qcChecks += row.qcChecks;
      acc.qcPasses += row.qcPasses;
      return acc;
    },
    { completedTasks: 0, qcChecks: 0, qcPasses: 0 },
  );

  return (
    <ManagerLayout title="Team analytics">
      {error && <p className="mb-4 text-body-sm text-error">{error}</p>}
      {loading ? (
        <p className="text-body-sm text-tertiary">Loading analytics…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="cortex-module p-4">
              <p className="cortex-label">Tasks completed</p>
              <p className="mt-2 font-mono text-headline-md text-primary">{totals.completedTasks}</p>
            </div>
            <div className="cortex-module p-4">
              <p className="cortex-label">QC checks</p>
              <p className="mt-2 font-mono text-headline-md text-primary">{totals.qcChecks}</p>
            </div>
            <div className="cortex-module p-4">
              <p className="cortex-label">Overall QC pass rate</p>
              <p className="mt-2 font-mono text-headline-md text-primary">
                {totals.qcChecks === 0 ? '—' : `${((totals.qcPasses / totals.qcChecks) * 100).toFixed(0)}%`}
              </p>
            </div>
          </div>

          <DenseTable headers={['Employee', 'Tasks done', 'Avg step time', 'QC checks', 'QC pass rate']}>
            {rows.map((row) => (
              <DenseTableRow key={row.employeeId}>
                <DenseTableCell>{row.email}</DenseTableCell>
                <DenseTableCell className="font-mono text-data-mono">{row.completedTasks}</DenseTableCell>
                <DenseTableCell className="font-mono text-data-mono">
                  {formatMinutes(row.avgCompletionMinutes)}
                </DenseTableCell>
                <DenseTableCell className="font-mono text-data-mono">{row.qcChecks}</DenseTableCell>
                <DenseTableCell className="font-mono text-data-mono">
                  {row.qcPassRate === null ? '—' : `${row.qcPassRate.toFixed(0)}%`}
                </DenseTableCell>
              </DenseTableRow>
            ))}
            {rows.length === 0 && (
              <DenseTableRow>
                <DenseTableCell className="py-6 text-tertiary">No employee data yet.</DenseTableCell>
              </DenseTableRow>
            )}
          </DenseTable>
        </div>
      )}
    </ManagerLayout>
  );
}
