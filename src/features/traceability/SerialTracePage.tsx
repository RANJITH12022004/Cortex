import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { DenseTable, DenseTableCell, DenseTableRow } from '@/features/products/components/DenseTable';
import { findSerialByNumber } from './api';
import type { SerialTraceBundle } from './api';

function formatWhen(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function TraceSections({ bundle }: { bundle: SerialTraceBundle }) {
  const {
    serial,
    assignments,
    steps,
    qcResults,
    attachments,
    handovers,
    damageReports,
    remarks,
    deliveryInstall,
    remarkAuthors,
  } =
    bundle;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-headline text-headline-md text-on-surface">Unit</h2>
        <dl className="mt-2 grid gap-2 text-body-sm md:grid-cols-2">
          <div>
            <dt className="text-tertiary">Serial</dt>
            <dd className="font-mono text-data-mono">{serial.serial_number}</dd>
          </div>
          <div>
            <dt className="text-tertiary">Product</dt>
            <dd>{serial.purchase_requests?.products?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-tertiary">Stage</dt>
            <dd>{serial.current_stage ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-tertiary">Packed by</dt>
            <dd>{serial.packed_by_user?.email ?? '—'} ({formatWhen(serial.packed_at)})</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="font-headline text-headline-md text-on-surface">Assignments</h2>
        <DenseTable headers={['Task', 'Assigned to', 'By', 'Assigned', 'Completed']}>
          {assignments.map((row) => (
            <DenseTableRow key={row.id}>
              <DenseTableCell>{row.task_type}</DenseTableCell>
              <DenseTableCell>{row.assigned_user?.email ?? row.assigned_to}</DenseTableCell>
              <DenseTableCell>{row.assigned_by_user?.email ?? row.assigned_by}</DenseTableCell>
              <DenseTableCell>{formatWhen(row.assigned_at)}</DenseTableCell>
              <DenseTableCell>{formatWhen(row.completed_at)}</DenseTableCell>
            </DenseTableRow>
          ))}
        </DenseTable>
      </section>

      <section>
        <h2 className="font-headline text-headline-md text-on-surface">Assembly steps</h2>
        <DenseTable headers={['Step', 'Status', 'Started', 'Completed', 'Done by']}>
          {steps.map((row) => (
            <DenseTableRow key={row.id}>
              <DenseTableCell>{row.step_name}</DenseTableCell>
              <DenseTableCell>{row.status}</DenseTableCell>
              <DenseTableCell>{formatWhen(row.started_at)}</DenseTableCell>
              <DenseTableCell>{formatWhen(row.completed_at)}</DenseTableCell>
              <DenseTableCell>{row.done_by ?? '—'}</DenseTableCell>
            </DenseTableRow>
          ))}
        </DenseTable>
      </section>

      <section>
        <h2 className="font-headline text-headline-md text-on-surface">QC results</h2>
        <DenseTable headers={['Checkpoint', 'Result', 'Note', 'Checked']}>
          {qcResults.map((row) => (
            <DenseTableRow key={row.id}>
              <DenseTableCell>{row.checkpoint_name}</DenseTableCell>
              <DenseTableCell>{row.result}</DenseTableCell>
              <DenseTableCell>{row.note ?? '—'}</DenseTableCell>
              <DenseTableCell>{formatWhen(row.checked_at)}</DenseTableCell>
            </DenseTableRow>
          ))}
        </DenseTable>
      </section>

      <section>
        <h2 className="font-headline text-headline-md text-on-surface">Attachments</h2>
        <ul className="mt-2 space-y-2 text-body-sm">
          {attachments.map((row) => (
            <li key={row.id}>
              <a href={row.drive_link} target="_blank" rel="noreferrer" className="text-primary underline">
                {row.step_name} — {row.file_type}
              </a>
              <span className="text-tertiary">
                {' '}
                — {row.task_type ?? row.step_name} {formatWhen(row.uploaded_at)}
              </span>
            </li>
          ))}
          {attachments.length === 0 && <li className="text-tertiary">No attachments.</li>}
        </ul>
      </section>

      <section>
        <h2 className="font-headline text-headline-md text-on-surface">Material handover</h2>
        <DenseTable headers={['Part', 'Qty', 'Issued by', 'Issued', 'Received by', 'Received']}>
          {handovers.map((row) => (
            <DenseTableRow key={row.id}>
              <DenseTableCell>{row.parts?.name ?? row.part_id}</DenseTableCell>
              <DenseTableCell>{row.qty}</DenseTableCell>
              <DenseTableCell>{row.issued_by_user?.email ?? row.issued_by}</DenseTableCell>
              <DenseTableCell>{formatWhen(row.issued_at)}</DenseTableCell>
              <DenseTableCell>{row.received_by_user?.email ?? row.received_by ?? '—'}</DenseTableCell>
              <DenseTableCell>{formatWhen(row.received_at)}</DenseTableCell>
            </DenseTableRow>
          ))}
          {handovers.length === 0 && (
            <DenseTableRow>
              <DenseTableCell className="py-6 text-tertiary">No handover history.</DenseTableCell>
            </DenseTableRow>
          )}
        </DenseTable>
      </section>

      <section>
        <h2 className="font-headline text-headline-md text-on-surface">Damage & replacements</h2>
        <DenseTable headers={['Part', 'Qty', 'Reason', 'Reported by', 'Replacement issued by']}>
          {damageReports.map((row) => (
            <DenseTableRow key={row.id}>
              <DenseTableCell>{row.parts?.name ?? row.part_id}</DenseTableCell>
              <DenseTableCell>{row.qty}</DenseTableCell>
              <DenseTableCell>{row.reason}</DenseTableCell>
              <DenseTableCell>
                {row.reported_by_user?.email ?? row.reported_by} ({formatWhen(row.reported_at)})
              </DenseTableCell>
              <DenseTableCell>
                {row.replacement_issued_by_user?.email ?? row.replacement_issued_by ?? '—'}
                {row.replacement_issued_at ? ` (${formatWhen(row.replacement_issued_at)})` : ''}
              </DenseTableCell>
            </DenseTableRow>
          ))}
          {damageReports.length === 0 && (
            <DenseTableRow>
              <DenseTableCell className="py-6 text-tertiary">No damage history.</DenseTableCell>
            </DenseTableRow>
          )}
        </DenseTable>
      </section>

      <section>
        <h2 className="font-headline text-headline-md text-on-surface">Delivery & installation</h2>
        <dl className="mt-2 grid gap-2 text-body-sm md:grid-cols-2">
          <div>
            <dt className="text-tertiary">Partner</dt>
            <dd>{deliveryInstall?.delivery_partner ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-tertiary">Delivered</dt>
            <dd>
              {(deliveryInstall as { delivered_by_user?: { email?: string } | null } | null)?.delivered_by_user?.email ??
                '—'}{' '}
              ({formatWhen(deliveryInstall?.delivered_at ?? null)})
            </dd>
          </div>
          <div>
            <dt className="text-tertiary">Delivery docs</dt>
            <dd>
              {deliveryInstall?.delivery_docs_link ? (
                <a href={deliveryInstall.delivery_docs_link} target="_blank" rel="noreferrer" className="text-primary underline">
                  View
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-tertiary">Installed</dt>
            <dd>
              {(deliveryInstall as { installed_by_user?: { email?: string } | null } | null)?.installed_by_user?.email ??
                '—'}{' '}
              ({formatWhen(deliveryInstall?.installed_at ?? null)})
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="font-headline text-headline-md text-on-surface">Remarks</h2>
        <ul className="mt-2 space-y-2 text-body-sm">
          {remarks.map((row) => (
            <li key={row.id}>
              <span className="font-medium">{row.step_name}</span> — {remarkAuthors[row.author] ?? row.author}
              <span className="text-tertiary"> ({formatWhen(row.created_at)})</span>
              <p className="text-on-surface-variant">{row.text}</p>
            </li>
          ))}
          {remarks.length === 0 && <li className="text-tertiary">No remarks.</li>}
        </ul>
      </section>
    </div>
  );
}

export function SerialTracePage() {
  const [query, setQuery] = useState('');
  const [bundle, setBundle] = useState<SerialTraceBundle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setBundle(null);
    try {
      const result = await findSerialByNumber(query);
      if (!result) setNotFound(true);
      else setBundle(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ManagerLayout title="Serial traceability">
      <form className="mb-6 flex flex-wrap gap-2" onSubmit={(e) => void handleSearch(e)}>
        <input
          className="cortex-input min-w-[16rem] flex-1"
          placeholder="Enter serial number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="cortex-btn-primary" disabled={loading}>
          {loading ? 'Searching…' : 'Lookup'}
        </button>
      </form>

      {error && <p className="mb-4 text-body-sm text-error">{error}</p>}
      {notFound && <p className="text-body-sm text-tertiary">No serial found for that number.</p>}
      {bundle && <TraceSections bundle={bundle} />}

      <p className="mt-8 text-body-sm text-tertiary">
        <Link to="/dashboard" className="text-primary underline">
          Back to dashboard
        </Link>
      </p>
    </ManagerLayout>
  );
}
