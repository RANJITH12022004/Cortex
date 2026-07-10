import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { isAdminRole } from '@/app/navigation';
import { listStockInEvents, recordStockIn } from '@/features/procurement/api';
import type { StockInEventWithRelations } from '@/features/procurement/types';
import { stockInSchema } from '@/features/procurement/schemas';
import {
  createPartCatalog,
  createVendor,
  deletePart,
  deleteVendor,
  friendlyDeleteError,
  listParts,
  listStockOutEvents,
  listVendors,
  recordStockOut,
  updatePartCatalog,
  updateVendor,
  type StockOutEventRow,
} from './api';
import { partCatalogSchema, vendorSchema } from './schemas';
import { stockOutSchema } from './stockSchemas';
import type { PartWithVendor, Vendor } from './types';
import { SlideOver } from './components/SlideOver';
import { SearchablePartSelect } from '@/features/products/components/SearchablePartSelect';
import {
  DenseTable,
  DenseTableCell,
  DenseTableRow,
} from '@/features/products/components/DenseTable';
import { TabBar } from '@/features/products/components/TabBar';
import { friendlyDbError } from '@/lib/errors';

type InventoryTab = 'parts' | 'stock-in' | 'stock-out' | 'vendors';

function matchesPartSearch(part: PartWithVendor, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    part.name.toLowerCase().includes(q) ||
    (part.mpn?.toLowerCase().includes(q) ?? false) ||
    (part.footprint?.toLowerCase().includes(q) ?? false) ||
    (part.storage_location?.toLowerCase().includes(q) ?? false) ||
    (part.vendors?.name?.toLowerCase().includes(q) ?? false)
  );
}

export function InventoryPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canManageVendors = role === 'procurement' || isAdminRole(role ?? 'employee');
  const canStockMove =
    role === 'procurement' || role === 'manager' || role === 'senior_manager' || isAdminRole(role ?? 'employee');

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (['parts', 'stock-in', 'stock-out', 'vendors'].includes(searchParams.get('tab') ?? '')
    ? searchParams.get('tab')
    : 'parts') as InventoryTab;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [parts, setParts] = useState<PartWithVendor[]>([]);
  const [stockOutEvents, setStockOutEvents] = useState<StockOutEventRow[]>([]);
  const [stockInEvents, setStockInEvents] = useState<StockInEventWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [partsSearch, setPartsSearch] = useState('');
  const [partPanelOpen, setPartPanelOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<PartWithVendor | null>(null);
  const [partName, setPartName] = useState('');
  const [partDescription, setPartDescription] = useState('');
  const [partMpn, setPartMpn] = useState('');
  const [partFootprint, setPartFootprint] = useState('');
  const [partLocation, setPartLocation] = useState('');

  const [vendorPanelOpen, setVendorPanelOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [vendorContact, setVendorContact] = useState('');

  const [stockInPartId, setStockInPartId] = useState('');
  const [stockInVendorId, setStockInVendorId] = useState('');
  const [stockInQty, setStockInQty] = useState('1');
  const [stockInCost, setStockInCost] = useState('0');
  const [stockInNotes, setStockInNotes] = useState('');

  const [stockOutPartId, setStockOutPartId] = useState('');
  const [stockOutQty, setStockOutQty] = useState('1');
  const [stockOutReason, setStockOutReason] = useState('');
  const [stockOutNotes, setStockOutNotes] = useState('');

  const filteredParts = useMemo(
    () => parts.filter((part) => matchesPartSearch(part, partsSearch)),
    [parts, partsSearch],
  );

  const selectedStockInPart = parts.find((p) => p.id === stockInPartId);
  const selectedStockOutPart = parts.find((p) => p.id === stockOutPartId);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [v, p, outEvents, inEvents] = await Promise.all([
        listVendors(),
        listParts(),
        listStockOutEvents().catch(() => [] as StockOutEventRow[]),
        listStockInEvents().catch(() => [] as StockInEventWithRelations[]),
      ]);
      setVendors(v);
      setParts(p);
      setStockOutEvents(outEvents);
      setStockInEvents(inEvents);
      if (!stockInPartId && p[0]) setStockInPartId(p[0].id);
      if (!stockOutPartId && p[0]) setStockOutPartId(p[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function setTab(next: InventoryTab) {
    setSearchParams({ tab: next });
    setFormError(null);
    setSuccess(null);
  }

  function openNewPart() {
    setEditingPart(null);
    setPartName('');
    setPartDescription('');
    setPartMpn('');
    setPartFootprint('');
    setPartLocation('');
    setFormError(null);
    setPartPanelOpen(true);
  }

  function openEditPart(part: PartWithVendor) {
    setEditingPart(part);
    setPartName(part.name);
    setPartDescription(part.description ?? '');
    setPartMpn(part.mpn ?? '');
    setPartFootprint(part.footprint ?? '');
    setPartLocation(part.storage_location ?? '');
    setFormError(null);
    setPartPanelOpen(true);
  }

  function openNewVendor() {
    setEditingVendor(null);
    setVendorName('');
    setVendorContact('');
    setFormError(null);
    setVendorPanelOpen(true);
  }

  function openEditVendor(vendor: Vendor) {
    setEditingVendor(vendor);
    setVendorName(vendor.name);
    setVendorContact(vendor.contact_info ?? '');
    setFormError(null);
    setVendorPanelOpen(true);
  }

  async function handlePartSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = partCatalogSchema.safeParse({
      name: partName,
      description: partDescription || null,
      mpn: partMpn || null,
      footprint: partFootprint || null,
      storage_location: partLocation || null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }
    try {
      if (editingPart) {
        await updatePartCatalog(editingPart.id, parsed.data);
        setSuccess('Part updated.');
      } else {
        await createPartCatalog(parsed.data);
        setSuccess('Part added to catalog.');
      }
      setPartPanelOpen(false);
      await load();
    } catch (err) {
      setFormError(friendlyDbError(err, 'Save failed'));
    }
  }

  async function handleVendorSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = vendorSchema.safeParse({
      name: vendorName,
      contact_info: vendorContact || null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }
    try {
      if (editingVendor) {
        await updateVendor(editingVendor.id, parsed.data);
        setSuccess('Vendor updated.');
      } else {
        await createVendor(parsed.data);
        setSuccess('Vendor added.');
      }
      setVendorPanelOpen(false);
      await load();
    } catch (err) {
      setFormError(friendlyDbError(err, 'Save failed'));
    }
  }

  async function handleStockInSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = stockInSchema.safeParse({
      part_id: stockInPartId,
      vendor_id: stockInVendorId || null,
      qty: stockInQty,
      unit_cost: stockInCost,
      notes: stockInNotes || null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }
    try {
      await recordStockIn(parsed.data);
      setSuccess('Stock received and quantity updated.');
      setStockInQty('1');
      setStockInNotes('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Stock in failed');
    }
  }

  async function handleStockOutSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = stockOutSchema.safeParse({
      part_id: stockOutPartId,
      qty: stockOutQty,
      reason: stockOutReason,
      notes: stockOutNotes || null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }
    try {
      await recordStockOut(parsed.data);
      setSuccess('Stock issued from inventory.');
      setStockOutQty('1');
      setStockOutReason('');
      setStockOutNotes('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Stock out failed');
    }
  }

  async function handleDeleteVendor(id: string) {
    setFormError(null);
    try {
      await deleteVendor(id);
      setSuccess('Vendor removed.');
      await load();
    } catch (err) {
      setFormError(friendlyDeleteError(err));
    }
  }

  async function handleDeletePart(id: string) {
    setFormError(null);
    try {
      await deletePart(id);
      setSuccess('Part removed.');
      await load();
    } catch (err) {
      setFormError(friendlyDeleteError(err));
    }
  }

  return (
    <ManagerLayout title="Inventory">
      <TabBar
        tabs={[
          { id: 'parts' as const, label: 'Parts catalog' },
          { id: 'stock-in' as const, label: 'Stock in' },
          { id: 'stock-out' as const, label: 'Stock out' },
          { id: 'vendors' as const, label: 'Vendors' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-6 space-y-4">
        {loading && <p className="text-body-sm text-on-surface-variant">Loading inventory…</p>}
        {error && (
          <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
            {error}
          </p>
        )}
        {formError && (
          <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
            {formError}
          </p>
        )}
        {success && (
          <p className="rounded border border-tertiary-container bg-tertiary-container/20 px-3 py-2 text-body-sm text-tertiary">
            {success}
          </p>
        )}

        {!loading && tab === 'parts' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="search"
                value={partsSearch}
                onChange={(e) => setPartsSearch(e.target.value)}
                placeholder="Search parts by name, MPN, vendor, or bin…"
                className="cortex-input max-w-md"
              />
              <button type="button" onClick={openNewPart} className="cortex-btn-primary w-auto shrink-0 px-5">
                Add part
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredParts.map((part) => (
                <article
                  key={part.id}
                  className="cortex-module border-l-4 border-primary-container p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-headline text-headline-sm text-on-surface">{part.name}</h3>
                      {part.mpn && (
                        <p className="mt-1 font-mono text-data-mono text-primary-container">{part.mpn}</p>
                      )}
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-data-mono text-xs ${
                        Number(part.qty_available) <= 5
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-surface-container-high text-on-surface'
                      }`}
                    >
                      {part.qty_available} in stock
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-body-sm">
                    <div>
                      <dt className="cortex-label text-[10px]">Vendor</dt>
                      <dd className="text-on-surface-variant">{part.vendors?.name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="cortex-label text-[10px]">Bin</dt>
                      <dd className="font-mono text-data-mono text-on-surface-variant">
                        {part.storage_location ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="cortex-label text-[10px]">Unit cost</dt>
                      <dd className="font-mono text-data-mono">₹{part.unit_cost}</dd>
                    </div>
                    <div>
                      <dt className="cortex-label text-[10px]">Footprint</dt>
                      <dd className="text-on-surface-variant">{part.footprint ?? '—'}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => openEditPart(part)}
                      className="text-body-sm text-primary-container hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeletePart(part.id)}
                      className="text-body-sm text-error hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
              {filteredParts.length === 0 && (
                <p className="col-span-full py-8 text-center text-body-sm text-on-surface-variant">
                  No parts match your search.
                </p>
              )}
            </div>
          </div>
        )}

        {!loading && tab === 'stock-in' && (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <form onSubmit={(e) => void handleStockInSubmit(e)} className="cortex-module border-t-4 border-tertiary-container p-5">
              <h3 className="font-headline text-headline-sm text-on-surface">Receive stock</h3>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Procurement records incoming quantity and assigns the vendor.
              </p>
              {!canStockMove && (
                <p className="mt-3 text-body-sm text-on-surface-variant">
                  You can view stock movements; procurement records stock in.
                </p>
              )}
              <div className="mt-4 space-y-3">
                <div>
                  <label className="cortex-label mb-1 block">Part</label>
                  <SearchablePartSelect
                    parts={parts}
                    value={stockInPartId}
                    onChange={(partId) => {
                      setStockInPartId(partId);
                      const part = parts.find((p) => p.id === partId);
                      if (part) setStockInCost(String(part.unit_cost || 0));
                    }}
                    disabled={!canStockMove}
                    required
                    placeholder="Search parts by name, MPN, or bin…"
                  />
                </div>
                <div>
                  <label className="cortex-label mb-1 block">Vendor</label>
                  <select
                    value={stockInVendorId}
                    onChange={(e) => setStockInVendorId(e.target.value)}
                    className="cortex-input"
                    disabled={!canStockMove}
                  >
                    <option value="">Select vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="cortex-label mb-1 block">Quantity</label>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={stockInQty}
                      onChange={(e) => setStockInQty(e.target.value)}
                      className="cortex-input"
                      disabled={!canStockMove}
                      required
                    />
                  </div>
                  <div>
                    <label className="cortex-label mb-1 block">Unit cost (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={stockInCost}
                      onChange={(e) => setStockInCost(e.target.value)}
                      className="cortex-input"
                      disabled={!canStockMove}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="cortex-label mb-1 block">Notes</label>
                  <input
                    type="text"
                    value={stockInNotes}
                    onChange={(e) => setStockInNotes(e.target.value)}
                    className="cortex-input"
                    disabled={!canStockMove}
                  />
                </div>
                {selectedStockInPart && (
                  <div className="rounded border border-border bg-surface-container-low p-3 text-body-sm">
                    <p className="font-mono text-data-mono text-primary">{selectedStockInPart.mpn ?? 'No MPN'}</p>
                    <p className="text-on-surface-variant">
                      Bin {selectedStockInPart.storage_location ?? '—'} · After receive:{' '}
                      {Number(selectedStockInPart.qty_available) + Number(stockInQty || 0)}
                    </p>
                  </div>
                )}
                <button type="submit" className="cortex-btn-primary w-full" disabled={!canStockMove}>
                  Confirm stock in
                </button>
              </div>
            </form>

            <div className="cortex-module p-4">
              <h3 className="font-headline text-headline-sm">Parts on hand</h3>
              <div className="mt-4">
              <DenseTable headers={['Part', 'MPN', 'Qty', 'Vendor', 'Bin']}>
                {parts.map((part) => (
                  <DenseTableRow key={part.id}>
                    <DenseTableCell>{part.name}</DenseTableCell>
                    <DenseTableCell>
                      <span className="font-mono text-data-mono">{part.mpn ?? '—'}</span>
                    </DenseTableCell>
                    <DenseTableCell>
                      <span className="font-mono text-data-mono font-semibold">{part.qty_available}</span>
                    </DenseTableCell>
                    <DenseTableCell>{part.vendors?.name ?? '—'}</DenseTableCell>
                    <DenseTableCell>{part.storage_location ?? '—'}</DenseTableCell>
                  </DenseTableRow>
                ))}
              </DenseTable>
              </div>
            </div>

            <div className="cortex-module p-4 lg:col-span-2">
              <h3 className="font-headline text-headline-sm">Recent stock in</h3>
              <div className="mt-4">
                <DenseTable headers={['Part', 'Qty', 'Vendor', 'When']}>
                  {stockInEvents.slice(0, 20).map((event) => (
                    <DenseTableRow key={event.id}>
                      <DenseTableCell>{event.parts?.name ?? '—'}</DenseTableCell>
                      <DenseTableCell>
                        <span className="font-mono text-data-mono">{event.qty}</span>
                      </DenseTableCell>
                      <DenseTableCell>{event.vendors?.name ?? '—'}</DenseTableCell>
                      <DenseTableCell>{new Date(event.received_at).toLocaleString()}</DenseTableCell>
                    </DenseTableRow>
                  ))}
                  {stockInEvents.length === 0 && (
                    <DenseTableRow>
                      <DenseTableCell className="py-6 text-on-surface-variant" colSpan={4}>
                        No stock in events yet.
                      </DenseTableCell>
                    </DenseTableRow>
                  )}
                </DenseTable>
              </div>
            </div>
          </div>
        )}

        {!loading && tab === 'stock-out' && (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <form onSubmit={(e) => void handleStockOutSubmit(e)} className="cortex-module border-t-4 border-secondary-container p-5">
              <h3 className="font-headline text-headline-sm text-on-surface">Issue stock</h3>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Remove quantity for adjustments, scrap, or manual issues.
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="cortex-label mb-1 block">Part</label>
                  <SearchablePartSelect
                    parts={parts}
                    value={stockOutPartId}
                    onChange={setStockOutPartId}
                    disabled={!canStockMove}
                    required
                    placeholder="Search parts by name, MPN, or bin…"
                  />
                </div>
                <div>
                  <label className="cortex-label mb-1 block">Quantity</label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={stockOutQty}
                    onChange={(e) => setStockOutQty(e.target.value)}
                    className="cortex-input"
                    disabled={!canStockMove}
                    required
                  />
                </div>
                <div>
                  <label className="cortex-label mb-1 block">Reason</label>
                  <input
                    type="text"
                    value={stockOutReason}
                    onChange={(e) => setStockOutReason(e.target.value)}
                    placeholder="e.g. Damaged, adjustment, sample"
                    className="cortex-input"
                    disabled={!canStockMove}
                    required
                  />
                </div>
                <div>
                  <label className="cortex-label mb-1 block">Notes</label>
                  <input
                    type="text"
                    value={stockOutNotes}
                    onChange={(e) => setStockOutNotes(e.target.value)}
                    className="cortex-input"
                    disabled={!canStockMove}
                  />
                </div>
                {selectedStockOutPart && (
                  <div className="rounded border border-border bg-surface-container-low p-3 text-body-sm">
                    <p className="font-mono text-data-mono text-primary">{selectedStockOutPart.mpn ?? 'No MPN'}</p>
                    <p className="text-on-surface-variant">
                      Remaining after issue:{' '}
                      {Math.max(Number(selectedStockOutPart.qty_available) - Number(stockOutQty || 0), 0)}
                    </p>
                  </div>
                )}
                <button type="submit" className="cortex-btn-primary w-full" disabled={!canStockMove}>
                  Confirm stock out
                </button>
              </div>
            </form>

            <div className="cortex-module p-4 lg:col-span-2">
              <h3 className="font-headline text-headline-sm">Recent stock out</h3>
              <div className="mt-4">
              <DenseTable headers={['Part', 'Qty', 'Reason', 'When']}>
                {stockOutEvents.map((event) => (
                  <DenseTableRow key={event.id}>
                    <DenseTableCell>{event.parts?.name ?? '—'}</DenseTableCell>
                    <DenseTableCell>
                      <span className="font-mono text-data-mono">{event.qty}</span>
                    </DenseTableCell>
                    <DenseTableCell>{event.reason}</DenseTableCell>
                    <DenseTableCell>{new Date(event.issued_at).toLocaleString()}</DenseTableCell>
                  </DenseTableRow>
                ))}
                {stockOutEvents.length === 0 && (
                  <DenseTableRow>
                    <DenseTableCell className="py-6 text-on-surface-variant" colSpan={4}>
                      No stock out events yet.
                    </DenseTableCell>
                  </DenseTableRow>
                )}
              </DenseTable>
              </div>
            </div>
          </div>
        )}

        {!loading && tab === 'vendors' && (
          <div className="space-y-4">
            {canManageVendors && (
              <div className="flex justify-end">
                <button type="button" onClick={openNewVendor} className="cortex-btn-primary w-auto px-5">
                  Add vendor
                </button>
              </div>
            )}
            {!canManageVendors && (
              <p className="text-body-sm text-on-surface-variant">
                Vendors are maintained by the procurement team during stock in.
              </p>
            )}
            <DenseTable headers={['Name', 'Contact', ...(canManageVendors ? (['Actions'] as const) : [])]}>
              {vendors.map((vendor) => (
                <DenseTableRow key={vendor.id}>
                  <DenseTableCell>{vendor.name}</DenseTableCell>
                  <DenseTableCell className="text-on-surface-variant">
                    {vendor.contact_info ?? '—'}
                  </DenseTableCell>
                  {canManageVendors && (
                    <DenseTableCell>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditVendor(vendor)}
                          className="text-primary-container hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteVendor(vendor.id)}
                          className="text-error hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </DenseTableCell>
                  )}
                </DenseTableRow>
              ))}
            </DenseTable>
          </div>
        )}
      </div>

      <SlideOver
        open={partPanelOpen}
        title={editingPart ? 'Edit part' : 'Add part'}
        onClose={() => setPartPanelOpen(false)}
      >
        <form onSubmit={(e) => void handlePartSubmit(e)} className="space-y-4">
          <p className="text-body-sm text-on-surface-variant">
            Catalog details only. Quantity and vendor are set when procurement receives stock.
          </p>
          <input
            type="text"
            placeholder="Part name *"
            value={partName}
            onChange={(e) => setPartName(e.target.value)}
            className="cortex-input"
            required
          />
          <input
            type="text"
            placeholder="Description"
            value={partDescription}
            onChange={(e) => setPartDescription(e.target.value)}
            className="cortex-input"
          />
          <input
            type="text"
            placeholder="MPN / SKU"
            value={partMpn}
            onChange={(e) => setPartMpn(e.target.value)}
            className="cortex-input"
          />
          <input
            type="text"
            placeholder="Footprint"
            value={partFootprint}
            onChange={(e) => setPartFootprint(e.target.value)}
            className="cortex-input"
          />
          <input
            type="text"
            placeholder="Storage bin / location"
            value={partLocation}
            onChange={(e) => setPartLocation(e.target.value)}
            className="cortex-input"
          />
          {formError && (
            <p className="text-body-sm text-error" role="alert">
              {formError}
            </p>
          )}
          <button type="submit" className="cortex-btn-primary w-full">
            {editingPart ? 'Save changes' : 'Add part'}
          </button>
        </form>
      </SlideOver>

      <SlideOver
        open={vendorPanelOpen}
        title={editingVendor ? 'Edit vendor' : 'Add vendor'}
        onClose={() => setVendorPanelOpen(false)}
      >
        <form onSubmit={(e) => void handleVendorSubmit(e)} className="space-y-4">
          <input
            type="text"
            placeholder="Vendor name *"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            className="cortex-input"
            required
          />
          <input
            type="text"
            placeholder="Contact info"
            value={vendorContact}
            onChange={(e) => setVendorContact(e.target.value)}
            className="cortex-input"
          />
          <button type="submit" className="cortex-btn-primary w-full">
            {editingVendor ? 'Save changes' : 'Add vendor'}
          </button>
        </form>
      </SlideOver>
    </ManagerLayout>
  );
}
