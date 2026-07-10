import { useEffect, useState } from 'react';
import { ManagerLayout } from '@/app/ManagerLayout';
import { DenseTable, DenseTableCell, DenseTableRow } from '@/features/products/components/DenseTable';
import { fetchVendorDamageReport } from './api';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function VendorDamageReportPage() {
  const initial = defaultRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchVendorDamageReport>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runReport() {
    setLoading(true);
    setError(null);
    try {
      const fromIso = new Date(`${from}T00:00:00`).toISOString();
      const toIso = new Date(`${to}T23:59:59`).toISOString();
      setRows(await fetchVendorDamageReport(fromIso, toIso));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runReport();
    // Load the default 30-day window immediately so the report is useful on first open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ManagerLayout title="Vendor damage report">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
          From
          <input type="date" className="cortex-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
          To
          <input type="date" className="cortex-input" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className="cortex-btn-primary" disabled={loading} onClick={() => void runReport()}>
          {loading ? 'Loading…' : 'Run report'}
        </button>
      </div>

      {error && <p className="mb-4 text-body-sm text-error">{error}</p>}

      <DenseTable headers={['Vendor', 'Part', 'Units wasted', '₹ wasted']}>
        {rows.map((row) => (
          <DenseTableRow key={`${row.vendorId}:${row.partId}`}>
            <DenseTableCell>{row.vendorName}</DenseTableCell>
            <DenseTableCell>{row.partName}</DenseTableCell>
            <DenseTableCell className="font-mono text-data-mono">{row.unitsWasted}</DenseTableCell>
            <DenseTableCell className="font-mono text-data-mono">
              ₹{row.rupeesWasted.toFixed(2)}
            </DenseTableCell>
          </DenseTableRow>
        ))}
        {rows.length === 0 && !loading && (
          <DenseTableRow>
            <DenseTableCell className="py-6 text-tertiary">
              Select a date range and run the report.
            </DenseTableCell>
          </DenseTableRow>
        )}
      </DenseTable>
    </ManagerLayout>
  );
}
