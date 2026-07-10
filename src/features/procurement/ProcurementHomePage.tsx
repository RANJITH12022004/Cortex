import { FormEvent, useEffect, useMemo, useState } from 'react';
import { WorkspaceLayout } from '@/app/WorkspaceLayout';
import { DenseTable, DenseTableCell, DenseTableRow } from '@/features/products/components/DenseTable';
import { listParts, listVendors } from '@/features/vendors/api';
import type { PartWithVendor, Vendor } from '@/features/vendors/types';
import {
  friendlyProcurementError,
  getSerialIssueBundle,
  issueDamageReplacement,
  issueSerialMaterials,
  listOpenDamageReports,
  listProcurementSerials,
  listPurchaseRequests,
  listStockInEvents,
  recordStockIn,
} from './api';
import { stockInSchema } from './schemas';
import type {
  DamageReportQueueItem,
  PurchaseRequestListItem,
  SerialIssueBundle,
  SerialWithContext,
  StockInEventWithRelations,
} from './types';

export function ProcurementFeaturePage() {
  const [parts, setParts] = useState<PartWithVendor[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [events, setEvents] = useState<StockInEventWithRelations[]>([]);
  const [holdRequests, setHoldRequests] = useState<PurchaseRequestListItem[]>([]);
  const [serials, setSerials] = useState<SerialWithContext[]>([]);
  const [damageReports, setDamageReports] = useState<DamageReportQueueItem[]>([]);
  const [selectedSerialId, setSelectedSerialId] = useState('');
  const [selectedBundle, setSelectedBundle] = useState<SerialIssueBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingStockIn, setSubmittingStockIn] = useState(false);
  const [issuingSerial, setIssuingSerial] = useState(false);
  const [issuingDamageId, setIssuingDamageId] = useState<string | null>(null);
  const [stockForm, setStockForm] = useState({
    part_id: '',
    vendor_id: '',
    qty: '',
    unit_cost: '',
    notes: '',
  });

  const issueReadySerials = useMemo(
    () => serials.filter((serial) => serial.purchase_requests?.status === 'assigned'),
    [serials],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextParts, nextVendors, nextEvents, requests, nextSerials, nextDamage] =
        await Promise.all([
          listParts(),
          listVendors(),
          listStockInEvents(),
          listPurchaseRequests(),
          listProcurementSerials(),
          listOpenDamageReports(),
        ]);

      setParts(nextParts);
      setVendors(nextVendors);
      setEvents(nextEvents);
      setHoldRequests(requests.filter((request) => request.status === 'procurement_hold'));
      setSerials(nextSerials);
      setDamageReports(nextDamage);
      setStockForm((current) => ({
        ...current,
        part_id: current.part_id || nextParts[0]?.id || '',
      }));
    } catch (err) {
      setError(friendlyProcurementError(err, 'Failed to load procurement data'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedSerialId) {
      setSelectedBundle(null);
      return;
    }

    async function loadBundle() {
      setDetailLoading(true);
      setActionError(null);
      try {
        setSelectedBundle(await getSerialIssueBundle(selectedSerialId));
      } catch (err) {
        setActionError(friendlyProcurementError(err, 'Failed to load serial BOM'));
      } finally {
        setDetailLoading(false);
      }
    }

    void loadBundle();
  }, [selectedSerialId]);

  async function handleStockIn(event: FormEvent) {
    event.preventDefault();
    setActionError(null);

    const parsed = stockInSchema.safeParse({
      part_id: stockForm.part_id,
      vendor_id: stockForm.vendor_id,
      qty: stockForm.qty,
      unit_cost: stockForm.unit_cost,
      notes: stockForm.notes || null,
    });

    if (!parsed.success) {
      setActionError(parsed.error.errors[0]?.message ?? 'Invalid stock-in input');
      return;
    }

    setSubmittingStockIn(true);
    try {
      await recordStockIn(parsed.data);
      await load();
      setStockForm((current) => ({ ...current, qty: '', unit_cost: '', notes: '' }));
    } catch (err) {
      setActionError(friendlyProcurementError(err, 'Failed to record stock in'));
    } finally {
      setSubmittingStockIn(false);
    }
  }

  async function handleIssueSerial() {
    if (!selectedSerialId) return;
    setIssuingSerial(true);
    setActionError(null);
    try {
      await issueSerialMaterials(selectedSerialId);
      setSelectedBundle(await getSerialIssueBundle(selectedSerialId));
      await load();
    } catch (err) {
      setActionError(friendlyProcurementError(err, 'Failed to issue materials'));
    } finally {
      setIssuingSerial(false);
    }
  }

  async function handleIssueReplacement(damageReportId: string) {
    setIssuingDamageId(damageReportId);
    setActionError(null);
    try {
      await issueDamageReplacement(damageReportId);
      await load();
      if (selectedSerialId) {
        setSelectedBundle(await getSerialIssueBundle(selectedSerialId));
      }
    } catch (err) {
      setActionError(friendlyProcurementError(err, 'Failed to issue replacement'));
    } finally {
      setIssuingDamageId(null);
    }
  }

  return (
    <WorkspaceLayout title="Procurement">
      {actionError && (
        <p className="mb-4 rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {actionError}
        </p>
      )}

      {loading && <p className="text-body-sm text-on-surface-variant">Loading procurement workspace…</p>}
      {error && (
        <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <form onSubmit={(e) => void handleStockIn(e)} className="cortex-module p-6">
              <h2 className="font-headline text-headline-md text-on-surface">Stock in</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="cortex-label mb-2 block">Part</label>
                  <select
                    value={stockForm.part_id}
                    onChange={(e) => setStockForm((current) => ({ ...current, part_id: e.target.value }))}
                    className="cortex-input"
                  >
                    {parts.map((part) => (
                      <option key={part.id} value={part.id}>
                        {part.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="cortex-label mb-2 block">Vendor</label>
                  <select
                    value={stockForm.vendor_id}
                    onChange={(e) => setStockForm((current) => ({ ...current, vendor_id: e.target.value }))}
                    className="cortex-input"
                  >
                    <option value="">Use part default</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="cortex-label mb-2 block">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={stockForm.qty}
                    onChange={(e) => setStockForm((current) => ({ ...current, qty: e.target.value }))}
                    className="cortex-input"
                  />
                </div>
                <div>
                  <label className="cortex-label mb-2 block">Unit cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stockForm.unit_cost}
                    onChange={(e) => setStockForm((current) => ({ ...current, unit_cost: e.target.value }))}
                    className="cortex-input"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="cortex-label mb-2 block">Notes</label>
                <textarea
                  value={stockForm.notes}
                  onChange={(e) => setStockForm((current) => ({ ...current, notes: e.target.value }))}
                  className="cortex-input min-h-[80px] py-2"
                />
              </div>
              <button type="submit" disabled={submittingStockIn} className="cortex-btn-primary mt-4">
                {submittingStockIn ? 'Recording…' : 'Record stock in'}
              </button>
            </form>

            <DenseTable headers={['Part', 'Qty', 'Vendor', 'Cost', 'Received']}>
              {events.slice(0, 6).map((row) => (
                <DenseTableRow key={row.id}>
                  <DenseTableCell>{row.parts?.name ?? 'Unknown part'}</DenseTableCell>
                  <DenseTableCell>
                    <span className="font-mono text-data-mono">{row.qty}</span>
                  </DenseTableCell>
                  <DenseTableCell>{row.vendors?.name ?? 'Default vendor'}</DenseTableCell>
                  <DenseTableCell>
                    <span className="font-mono text-data-mono">₹{row.unit_cost}</span>
                  </DenseTableCell>
                  <DenseTableCell>{new Date(row.received_at).toLocaleString()}</DenseTableCell>
                </DenseTableRow>
              ))}
              {events.length === 0 && (
                <DenseTableRow>
                  <DenseTableCell className="py-6 text-on-surface-variant">No stock-in history yet.</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                </DenseTableRow>
              )}
            </DenseTable>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <DenseTable headers={['Product', 'Qty', 'Priority', 'Shortfall']}>
              {holdRequests.map((request) => (
                <DenseTableRow key={request.id}>
                  <DenseTableCell>{request.products?.name ?? 'Unknown product'}</DenseTableCell>
                  <DenseTableCell>
                    <span className="font-mono text-data-mono">{request.qty}</span>
                  </DenseTableCell>
                  <DenseTableCell>
                    <span className="font-mono text-data-mono">{request.priority}</span>
                  </DenseTableCell>
                  <DenseTableCell>
                    {request.shortfalls.map((shortfall) => shortfall.part_name).join(', ')}
                  </DenseTableCell>
                </DenseTableRow>
              ))}
              {holdRequests.length === 0 && (
                <DenseTableRow>
                  <DenseTableCell className="py-6 text-tertiary">No orders are waiting on procurement.</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                </DenseTableRow>
              )}
            </DenseTable>

            <DenseTable headers={['Serial', 'Product', 'PR status', 'Action']}>
              {issueReadySerials.map((serial) => (
                <DenseTableRow key={serial.id}>
                  <DenseTableCell>{serial.serial_number}</DenseTableCell>
                  <DenseTableCell>{serial.purchase_requests?.products?.name ?? 'Unknown product'}</DenseTableCell>
                  <DenseTableCell>{serial.purchase_requests?.status ?? 'unknown'}</DenseTableCell>
                  <DenseTableCell>
                    <button
                      type="button"
                      onClick={() => setSelectedSerialId(serial.id)}
                      className="text-primary-container hover:underline"
                    >
                      Open BOM
                    </button>
                  </DenseTableCell>
                </DenseTableRow>
              ))}
              {issueReadySerials.length === 0 && (
                <DenseTableRow>
                  <DenseTableCell className="py-6 text-on-surface-variant">No assigned serials are ready for issue yet.</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                </DenseTableRow>
              )}
            </DenseTable>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <div className="space-y-4">
              <div className="cortex-module p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-headline text-headline-md text-on-surface">Per-serial issue</h2>
                    <p className="mt-1 text-body-sm text-on-surface-variant">
                      Select an assigned serial to issue its full BOM in one action.
                    </p>
                  </div>
                  {selectedBundle && (
                    <button
                      type="button"
                      onClick={() => void handleIssueSerial()}
                      disabled={
                        issuingSerial ||
                        selectedBundle.bomLines.length === 0 ||
                        selectedBundle.bomLines.every((line) => line.already_issued)
                      }
                      className="cortex-btn-primary"
                    >
                      {issuingSerial ? 'Issuing…' : 'Issue full BOM'}
                    </button>
                  )}
                </div>
              </div>

              {detailLoading && <p className="text-body-sm text-on-surface-variant">Loading BOM…</p>}

              {selectedBundle && (
                <DenseTable headers={['Part', 'Required', 'Available', 'Issued']}>
                  {selectedBundle.bomLines.map((line) => (
                    <DenseTableRow key={line.part_id}>
                      <DenseTableCell>
                        <div>
                          <p className="font-semibold">{line.parts?.name ?? 'Unknown part'}</p>
                          {line.parts?.mpn && (
                            <p className="text-body-sm text-on-surface-variant">{line.parts.mpn}</p>
                          )}
                        </div>
                      </DenseTableCell>
                      <DenseTableCell>
                        <span className="font-mono text-data-mono">{line.qty_required}</span>
                      </DenseTableCell>
                      <DenseTableCell>
                        <span className="font-mono text-data-mono">{line.available_qty}</span>
                      </DenseTableCell>
                      <DenseTableCell>{line.already_issued ? 'Yes' : 'No'}</DenseTableCell>
                    </DenseTableRow>
                  ))}
                  {selectedBundle.bomLines.length === 0 && (
                    <DenseTableRow>
                      <DenseTableCell className="py-6 text-on-surface-variant">This serial has no BOM lines.</DenseTableCell>
                      <DenseTableCell>{null}</DenseTableCell>
                      <DenseTableCell>{null}</DenseTableCell>
                      <DenseTableCell>{null}</DenseTableCell>
                    </DenseTableRow>
                  )}
                </DenseTable>
              )}
            </div>

            <DenseTable headers={['Serial', 'Part', 'Qty', 'Action']}>
              {damageReports.map((report) => (
                <DenseTableRow key={report.id}>
                  <DenseTableCell>{report.serials?.serial_number ?? 'Unknown serial'}</DenseTableCell>
                  <DenseTableCell>{report.parts?.name ?? 'Unknown part'}</DenseTableCell>
                  <DenseTableCell>
                    <span className="font-mono text-data-mono">{report.qty}</span>
                  </DenseTableCell>
                  <DenseTableCell>
                    <button
                      type="button"
                      onClick={() => void handleIssueReplacement(report.id)}
                      disabled={issuingDamageId === report.id}
                      className="text-primary-container hover:underline"
                    >
                      {issuingDamageId === report.id ? 'Issuing…' : 'Issue replacement'}
                    </button>
                  </DenseTableCell>
                </DenseTableRow>
              ))}
              {damageReports.length === 0 && (
                <DenseTableRow>
                  <DenseTableCell className="py-6 text-tertiary">No open damage replacements.</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                </DenseTableRow>
              )}
            </DenseTable>
          </section>
        </div>
      )}
    </WorkspaceLayout>
  );
}
