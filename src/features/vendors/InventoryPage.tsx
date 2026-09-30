import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { canImportInventory, canWriteStock } from '@/features/auth/roleRoutes';
import { recordStockIn } from '@/features/procurement/api';
import { stockInSchema } from '@/features/procurement/schemas';
import {
  DenseTable,
  DenseTableCell,
  DenseTableRow,
} from '@/features/products/components/DenseTable';
import { TabBar } from '@/features/products/components/TabBar';
import {
  createPartCatalog,
  createVendor,
  deletePart,
  deleteVendor,
  friendlyDeleteError,
  listVendors,
  recordStockOut,
  updatePartCatalog,
  updateVendor,
} from './api';
import {
  INVENTORY_CSV_HEADER,
  INVENTORY_PAGE_SIZE,
  createBox,
  createRack,
  deleteBox,
  deleteRack,
  importInventoryCsv,
  listBoxes,
  listRacks,
  searchInventory,
  searchParts,
  updateBox,
  updateRack,
  type BoxWithRack,
  type InventoryHit,
  type Rack,
} from './locationApi';
import { boxSchema, partCatalogSchema, rackSchema, vendorSchema } from './schemas';
import { stockOutSchema } from './stockSchemas';
import type { PartWithVendor, Vendor } from './types';

type InventoryTab = 'search' | 'racks' | 'boxes' | 'parts' | 'vendors' | 'stock-in' | 'stock-out' | 'import';

const WRITER_TABS: InventoryTab[] = ['racks', 'boxes', 'parts', 'vendors', 'stock-in', 'stock-out'];

function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), 300);
    return () => window.clearTimeout(handle);
  }, [value]);
  return debounced;
}

function formatQty(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function InventoryPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canWrite = role ? canWriteStock(role) : false;
  const canImport = role ? canImportInventory(role) : false;

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') ?? 'search';
  const tab = (
    requestedTab === 'search' ||
    (canWrite && WRITER_TABS.includes(requestedTab as InventoryTab)) ||
    (canImport && requestedTab === 'import')
      ? requestedTab
      : 'search'
  ) as InventoryTab;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [hits, setHits] = useState<InventoryHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [racks, setRacks] = useState<Rack[]>([]);
  const [boxes, setBoxes] = useState<BoxWithRack[]>([]);
  const [parts, setParts] = useState<PartWithVendor[]>([]);
  const [partQuery, setPartQuery] = useState('');
  const [rackQuery, setRackQuery] = useState('');
  const [boxQuery, setBoxQuery] = useState('');
  const debouncedRackQuery = useDebounced(rackQuery);
  const debouncedBoxQuery = useDebounced(boxQuery);
  const debouncedPartQuery = useDebounced(partQuery);

  const [rackCode, setRackCode] = useState('');
  const [rackName, setRackName] = useState('');
  const [editingRackId, setEditingRackId] = useState<string | null>(null);

  const [boxRackId, setBoxRackId] = useState('');
  const [boxCode, setBoxCode] = useState('');
  const [boxName, setBoxName] = useState('');
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);

  const [partName, setPartName] = useState('');
  const [partDescription, setPartDescription] = useState('');
  const [partMpn, setPartMpn] = useState('');
  const [partFootprint, setPartFootprint] = useState('');
  const [editingPartId, setEditingPartId] = useState<string | null>(null);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorName, setVendorName] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [stockInVendorId, setStockInVendorId] = useState('');

  const [stockInPartId, setStockInPartId] = useState('');
  const [stockInBoxId, setStockInBoxId] = useState('');
  const [stockInQty, setStockInQty] = useState('1');
  const [stockInCost, setStockInCost] = useState('0');
  const [stockInNotes, setStockInNotes] = useState('');

  const [stockOutPartId, setStockOutPartId] = useState('');
  const [stockOutBoxId, setStockOutBoxId] = useState('');
  const [stockOutQty, setStockOutQty] = useState('1');
  const [stockOutReason, setStockOutReason] = useState('');
  const [stockOutNotes, setStockOutNotes] = useState('');

  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  const tabs = useMemo(() => {
    const items: { id: InventoryTab; label: string }[] = [{ id: 'search', label: 'Search' }];
    if (canWrite) {
      items.push(
        { id: 'racks', label: 'Racks' },
        { id: 'boxes', label: 'Boxes' },
        { id: 'parts', label: 'Parts' },
        { id: 'vendors', label: 'Vendors' },
        { id: 'stock-in', label: 'Stock in' },
        { id: 'stock-out', label: 'Stock out' },
      );
    }
    if (canImport) items.push({ id: 'import', label: 'Import' });
    return items;
  }, [canWrite, canImport]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    async function loadSearch() {
      setLoading(true);
      setError(null);
      try {
        const rows = await searchInventory(debouncedQuery, offset);
        if (cancelled) return;
        setHits(rows);
        setTotal(rows[0] ? Number(rows[0].total_count) : 0);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (tab === 'search') void loadSearch();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, offset, tab]);

  useEffect(() => {
    if (!canWrite || (tab !== 'racks' && tab !== 'boxes' && tab !== 'stock-in' && tab !== 'stock-out')) {
      return;
    }
    let cancelled = false;
    void listRacks(debouncedRackQuery)
      .then((rows) => {
        if (!cancelled) {
          setRacks(rows);
          setBoxRackId((current) => current || rows[0]?.id || '');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setFormError(err instanceof Error ? err.message : 'Failed to load racks');
      });
    return () => {
      cancelled = true;
    };
  }, [canWrite, tab, debouncedRackQuery]);

  useEffect(() => {
    if (!canWrite || (tab !== 'boxes' && tab !== 'stock-in' && tab !== 'stock-out')) return;
    let cancelled = false;
    void listBoxes(debouncedBoxQuery)
      .then((rows) => {
        if (!cancelled) {
          setBoxes(rows);
          setStockInBoxId((current) => current || rows[0]?.id || '');
          setStockOutBoxId((current) => current || rows[0]?.id || '');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setFormError(err instanceof Error ? err.message : 'Failed to load boxes');
      });
    return () => {
      cancelled = true;
    };
  }, [canWrite, tab, debouncedBoxQuery]);

  useEffect(() => {
    if (!canWrite || (tab !== 'parts' && tab !== 'stock-in' && tab !== 'stock-out')) return;
    let cancelled = false;
    void searchParts(debouncedPartQuery)
      .then((rows) => {
        if (!cancelled) {
          setParts(rows);
          setStockInPartId((current) => current || rows[0]?.id || '');
          setStockOutPartId((current) => current || rows[0]?.id || '');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setFormError(err instanceof Error ? err.message : 'Failed to load parts');
      });
    return () => {
      cancelled = true;
    };
  }, [canWrite, tab, debouncedPartQuery]);

  useEffect(() => {
    if (!canWrite || (tab !== 'vendors' && tab !== 'stock-in')) return;
    let cancelled = false;
    void listVendors()
      .then((rows) => {
        if (!cancelled) setVendors(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFormError(err instanceof Error ? err.message : 'Failed to load vendors');
      });
    return () => {
      cancelled = true;
    };
  }, [canWrite, tab]);

  function setTab(next: InventoryTab) {
    setSearchParams({ tab: next });
    setFormError(null);
    setSuccess(null);
  }

  async function refreshSearch() {
    const rows = await searchInventory(debouncedQuery, offset);
    setHits(rows);
    setTotal(rows[0] ? Number(rows[0].total_count) : 0);
  }

  async function handleRackSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = rackSchema.safeParse({ code: rackCode, name: rackName || null });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? 'Invalid rack');
      return;
    }
    try {
      if (editingRackId) await updateRack(editingRackId, parsed.data);
      else await createRack(parsed.data);
      setSuccess(editingRackId ? 'Rack updated.' : 'Rack created.');
      setEditingRackId(null);
      setRackCode('');
      setRackName('');
      setRacks(await listRacks(rackQuery));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save rack');
    }
  }

  async function handleBoxSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!boxRackId) {
      setFormError('Select a rack before creating a box.');
      return;
    }
    const parsed = boxSchema.safeParse({ rack_id: boxRackId, code: boxCode, name: boxName || null });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? 'Invalid box');
      return;
    }
    try {
      if (editingBoxId) await updateBox(editingBoxId, parsed.data);
      else await createBox(parsed.data);
      setSuccess(editingBoxId ? 'Box updated.' : 'Box created.');
      setEditingBoxId(null);
      setBoxCode('');
      setBoxName('');
      setBoxes(await listBoxes(boxQuery));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save box');
    }
  }

  async function handlePartSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = partCatalogSchema.safeParse({
      name: partName,
      description: partDescription || null,
      mpn: partMpn || null,
      footprint: partFootprint || null,
      storage_location: null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? 'Invalid part');
      return;
    }
    try {
      if (editingPartId) await updatePartCatalog(editingPartId, parsed.data);
      else await createPartCatalog(parsed.data);
      setSuccess(editingPartId ? 'Part updated.' : 'Part created. Put stock into a box to count it.');
      setEditingPartId(null);
      setPartName('');
      setPartDescription('');
      setPartMpn('');
      setPartFootprint('');
      setParts(await searchParts(partQuery));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save part');
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
      setFormError(parsed.error.errors[0]?.message ?? 'Invalid vendor');
      return;
    }
    try {
      if (editingVendorId) await updateVendor(editingVendorId, parsed.data);
      else await createVendor(parsed.data);
      setSuccess(editingVendorId ? 'Vendor updated.' : 'Vendor created.');
      setEditingVendorId(null);
      setVendorName('');
      setVendorContact('');
      setVendors(await listVendors());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save vendor');
    }
  }

  async function handleStockInSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!stockInBoxId) {
      setFormError('Select a box before adding stock.');
      return;
    }
    const parsed = stockInSchema.safeParse({
      part_id: stockInPartId,
      box_id: stockInBoxId,
      vendor_id: stockInVendorId || null,
      qty: stockInQty,
      unit_cost: stockInCost,
      notes: stockInNotes || null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? 'Invalid stock in');
      return;
    }
    try {
      await recordStockIn(parsed.data);
      setSuccess('Stock added to the box.');
      setStockInQty('1');
      setStockInNotes('');
      await refreshSearch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Stock in failed');
    }
  }

  async function handleStockOutSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!stockOutBoxId) {
      setFormError('Select a box before issuing stock.');
      return;
    }
    const parsed = stockOutSchema.safeParse({
      part_id: stockOutPartId,
      box_id: stockOutBoxId,
      qty: stockOutQty,
      reason: stockOutReason,
      notes: stockOutNotes || null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? 'Invalid stock out');
      return;
    }
    try {
      await recordStockOut(parsed.data);
      setSuccess('Stock issued from the box.');
      setStockOutQty('1');
      setStockOutReason('');
      setStockOutNotes('');
      await refreshSearch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Stock out failed');
    }
  }

  async function handleImport(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setImporting(true);
    try {
      const imported = await importInventoryCsv(csvText);
      setSuccess(`Imported ${imported} rows. A second import of the same part and box replaces the quantity.`);
      setCsvText('');
      await refreshSearch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = offset + hits.length;

  return (
    <ManagerLayout title="Inventory">
      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      <div className="mt-6 space-y-4">
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

        {tab === 'search' && (
          <div className="space-y-4">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by part, MPN, rack, or box…"
              className="cortex-input max-w-xl"
            />
            {loading && <p className="text-body-sm text-on-surface-variant">Searching inventory…</p>}
            {!loading && (
              <DenseTable headers={['Part', 'MPN', 'Rack', 'Box', 'In box', 'On hand']}>
                {hits.length === 0 && (
                  <DenseTableRow>
                    <DenseTableCell className="py-8 text-on-surface-variant" colSpan={6}>
                      No parts match your search.
                    </DenseTableCell>
                  </DenseTableRow>
                )}
                {hits.map((hit) => (
                  <DenseTableRow key={`${hit.part_id}-${hit.location_id ?? 'none'}`}>
                    <DenseTableCell>
                      <span className="font-semibold">{hit.part_name}</span>
                    </DenseTableCell>
                    <DenseTableCell>
                      <span className="font-mono text-data-mono">{hit.mpn ?? '—'}</span>
                    </DenseTableCell>
                    <DenseTableCell>{hit.rack_code ?? '—'}</DenseTableCell>
                    <DenseTableCell>{hit.box_code ?? '—'}</DenseTableCell>
                    <DenseTableCell>
                      <span className="font-mono text-data-mono">{formatQty(hit.qty_in_box)}</span>
                    </DenseTableCell>
                    <DenseTableCell>
                      <span className="font-mono text-data-mono">{formatQty(hit.qty_available)}</span>
                    </DenseTableCell>
                  </DenseTableRow>
                ))}
              </DenseTable>
            )}
            <div className="flex items-center justify-between text-body-sm text-on-surface-variant">
              <span>
                {total === 0 ? '0 results' : `${pageStart}–${pageEnd} of ${total}`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="cortex-btn-primary w-auto px-4 disabled:opacity-40"
                  disabled={offset === 0}
                  onClick={() => setOffset((current) => Math.max(0, current - INVENTORY_PAGE_SIZE))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="cortex-btn-primary w-auto px-4 disabled:opacity-40"
                  disabled={pageEnd >= total}
                  onClick={() => setOffset((current) => current + INVENTORY_PAGE_SIZE)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'racks' && canWrite && (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <form onSubmit={(e) => void handleRackSubmit(e)} className="cortex-module p-5">
              <h3 className="font-headline text-headline-sm">{editingRackId ? 'Edit rack' : 'New rack'}</h3>
              <label className="cortex-label mb-1 mt-4 block">Code</label>
              <input value={rackCode} onChange={(e) => setRackCode(e.target.value)} className="cortex-input" required />
              <label className="cortex-label mb-1 mt-3 block">Name</label>
              <input value={rackName} onChange={(e) => setRackName(e.target.value)} className="cortex-input" />
              <button type="submit" className="cortex-btn-primary mt-4">
                {editingRackId ? 'Save rack' : 'Create rack'}
              </button>
            </form>
            <div className="space-y-3">
              <input
                type="search"
                value={rackQuery}
                onChange={(e) => setRackQuery(e.target.value)}
                placeholder="Find a rack…"
                className="cortex-input max-w-sm"
              />
              <DenseTable headers={['Code', 'Name', '']}>
                {racks.map((rack) => (
                  <DenseTableRow key={rack.id}>
                    <DenseTableCell>{rack.code}</DenseTableCell>
                    <DenseTableCell>{rack.name ?? '—'}</DenseTableCell>
                    <DenseTableCell>
                      <button
                        type="button"
                        className="mr-3 text-primary-container hover:underline"
                        onClick={() => {
                          setEditingRackId(rack.id);
                          setRackCode(rack.code);
                          setRackName(rack.name ?? '');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-error hover:underline"
                        onClick={() => {
                          void deleteRack(rack.id)
                            .then(() => listRacks(rackQuery).then(setRacks))
                            .catch((err: unknown) => setFormError(friendlyDeleteError(err)));
                        }}
                      >
                        Delete
                      </button>
                    </DenseTableCell>
                  </DenseTableRow>
                ))}
              </DenseTable>
            </div>
          </div>
        )}

        {tab === 'boxes' && canWrite && (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <form onSubmit={(e) => void handleBoxSubmit(e)} className="cortex-module p-5">
              <h3 className="font-headline text-headline-sm">{editingBoxId ? 'Edit box' : 'New box'}</h3>
              <label className="cortex-label mb-1 mt-4 block">Rack</label>
              <select value={boxRackId} onChange={(e) => setBoxRackId(e.target.value)} className="cortex-input" required>
                <option value="">Select a rack</option>
                {racks.map((rack) => (
                  <option key={rack.id} value={rack.id}>
                    {rack.code}
                  </option>
                ))}
              </select>
              {racks.length === 0 && (
                <p className="mt-2 text-body-sm text-on-surface-variant">Create a rack before adding a box.</p>
              )}
              <label className="cortex-label mb-1 mt-3 block">Code</label>
              <input value={boxCode} onChange={(e) => setBoxCode(e.target.value)} className="cortex-input" required />
              <label className="cortex-label mb-1 mt-3 block">Name</label>
              <input value={boxName} onChange={(e) => setBoxName(e.target.value)} className="cortex-input" />
              <button type="submit" className="cortex-btn-primary mt-4">
                {editingBoxId ? 'Save box' : 'Create box'}
              </button>
            </form>
            <div className="space-y-3">
              <input
                type="search"
                value={boxQuery}
                onChange={(e) => setBoxQuery(e.target.value)}
                placeholder="Find a box…"
                className="cortex-input max-w-sm"
              />
              <DenseTable headers={['Rack', 'Box', 'Name', '']}>
                {boxes.map((box) => (
                  <DenseTableRow key={box.id}>
                    <DenseTableCell>{box.racks?.code ?? '—'}</DenseTableCell>
                    <DenseTableCell>{box.code}</DenseTableCell>
                    <DenseTableCell>{box.name ?? '—'}</DenseTableCell>
                    <DenseTableCell>
                      <button
                        type="button"
                        className="mr-3 text-primary-container hover:underline"
                        onClick={() => {
                          setEditingBoxId(box.id);
                          setBoxRackId(box.rack_id);
                          setBoxCode(box.code);
                          setBoxName(box.name ?? '');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-error hover:underline"
                        onClick={() => {
                          void deleteBox(box.id)
                            .then(() => listBoxes(boxQuery).then(setBoxes))
                            .catch((err: unknown) => setFormError(friendlyDeleteError(err)));
                        }}
                      >
                        Delete
                      </button>
                    </DenseTableCell>
                  </DenseTableRow>
                ))}
              </DenseTable>
            </div>
          </div>
        )}

        {tab === 'parts' && canWrite && (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <form onSubmit={(e) => void handlePartSubmit(e)} className="cortex-module p-5">
              <h3 className="font-headline text-headline-sm">{editingPartId ? 'Edit part' : 'New part'}</h3>
              <label className="cortex-label mb-1 mt-4 block">Name</label>
              <input value={partName} onChange={(e) => setPartName(e.target.value)} className="cortex-input" required />
              <label className="cortex-label mb-1 mt-3 block">Description</label>
              <input value={partDescription} onChange={(e) => setPartDescription(e.target.value)} className="cortex-input" />
              <label className="cortex-label mb-1 mt-3 block">MPN</label>
              <input value={partMpn} onChange={(e) => setPartMpn(e.target.value)} className="cortex-input" />
              <label className="cortex-label mb-1 mt-3 block">Footprint</label>
              <input value={partFootprint} onChange={(e) => setPartFootprint(e.target.value)} className="cortex-input" />
              <button type="submit" className="cortex-btn-primary mt-4">
                {editingPartId ? 'Save part' : 'Create part'}
              </button>
            </form>
            <div className="space-y-3">
            <input
              type="search"
              value={partQuery}
              onChange={(e) => setPartQuery(e.target.value)}
              placeholder="Find a part…"
              className="cortex-input max-w-sm"
            />
            <DenseTable headers={['Part', 'MPN', 'On hand', '']}>
              {parts.map((part) => (
                <DenseTableRow key={part.id}>
                  <DenseTableCell>{part.name}</DenseTableCell>
                  <DenseTableCell>{part.mpn ?? '—'}</DenseTableCell>
                  <DenseTableCell>{formatQty(part.qty_available)}</DenseTableCell>
                  <DenseTableCell>
                    <button
                      type="button"
                      className="mr-3 text-primary-container hover:underline"
                      onClick={() => {
                        setEditingPartId(part.id);
                        setPartName(part.name);
                        setPartDescription(part.description ?? '');
                        setPartMpn(part.mpn ?? '');
                        setPartFootprint(part.footprint ?? '');
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-error hover:underline"
                      onClick={() => {
                        void deletePart(part.id)
                          .then(() => searchParts(partQuery).then(setParts))
                          .catch((err: unknown) => setFormError(friendlyDeleteError(err)));
                      }}
                    >
                      Delete
                    </button>
                  </DenseTableCell>
                </DenseTableRow>
              ))}
            </DenseTable>
            </div>
          </div>
        )}

        {tab === 'vendors' && canWrite && (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <form onSubmit={(e) => void handleVendorSubmit(e)} className="cortex-module p-5">
              <h3 className="font-headline text-headline-sm">{editingVendorId ? 'Edit vendor' : 'New vendor'}</h3>
              <label className="cortex-label mb-1 mt-4 block">Name</label>
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="cortex-input" required />
              <label className="cortex-label mb-1 mt-3 block">Contact</label>
              <input value={vendorContact} onChange={(e) => setVendorContact(e.target.value)} className="cortex-input" />
              <button type="submit" className="cortex-btn-primary mt-4">
                {editingVendorId ? 'Save vendor' : 'Create vendor'}
              </button>
            </form>
            <DenseTable headers={['Name', 'Contact', '']}>
              {vendors.map((vendor) => (
                <DenseTableRow key={vendor.id}>
                  <DenseTableCell>{vendor.name}</DenseTableCell>
                  <DenseTableCell>{vendor.contact_info ?? '—'}</DenseTableCell>
                  <DenseTableCell>
                    <button
                      type="button"
                      className="mr-3 text-primary-container hover:underline"
                      onClick={() => {
                        setEditingVendorId(vendor.id);
                        setVendorName(vendor.name);
                        setVendorContact(vendor.contact_info ?? '');
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-error hover:underline"
                      onClick={() => {
                        void deleteVendor(vendor.id)
                          .then(() => listVendors().then(setVendors))
                          .catch((err: unknown) => setFormError(friendlyDeleteError(err)));
                      }}
                    >
                      Delete
                    </button>
                  </DenseTableCell>
                </DenseTableRow>
              ))}
            </DenseTable>
          </div>
        )}

        {tab === 'stock-in' && canWrite && (
          <form onSubmit={(e) => void handleStockInSubmit(e)} className="cortex-module max-w-lg p-5">
            <h3 className="font-headline text-headline-sm">Receive into a box</h3>
            {boxes.length === 0 && (
              <p className="mt-2 text-body-sm text-on-surface-variant">
                Select a box after you create one. Stock cannot be received without a box.
              </p>
            )}
            <label className="cortex-label mb-1 mt-4 block">Find part</label>
            <input
              type="search"
              value={partQuery}
              onChange={(e) => setPartQuery(e.target.value)}
              placeholder="Name or MPN…"
              className="cortex-input"
            />
            <label className="cortex-label mb-1 mt-3 block">Part</label>
            <select
              value={stockInPartId}
              onChange={(e) => {
                setStockInPartId(e.target.value);
                const part = parts.find((row) => row.id === e.target.value);
                if (part) setStockInCost(String(part.unit_cost ?? 0));
              }}
              className="cortex-input"
              required
            >
              <option value="">Select a part</option>
              {parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.name}
                </option>
              ))}
            </select>
            <label className="cortex-label mb-1 mt-3 block">Box</label>
            <select value={stockInBoxId} onChange={(e) => setStockInBoxId(e.target.value)} className="cortex-input" required>
              <option value="">Select a box</option>
              {boxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.racks?.code ?? 'Rack'} / {box.code}
                </option>
              ))}
            </select>
            <label className="cortex-label mb-1 mt-3 block">Vendor</label>
            <select
              value={stockInVendorId}
              onChange={(e) => setStockInVendorId(e.target.value)}
              className="cortex-input"
            >
              <option value="">Keep the part vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            <label className="cortex-label mb-1 mt-3 block">Quantity</label>
            <input value={stockInQty} onChange={(e) => setStockInQty(e.target.value)} className="cortex-input" required />
            <label className="cortex-label mb-1 mt-3 block">Unit cost</label>
            <input value={stockInCost} onChange={(e) => setStockInCost(e.target.value)} className="cortex-input" required />
            <label className="cortex-label mb-1 mt-3 block">Notes</label>
            <input value={stockInNotes} onChange={(e) => setStockInNotes(e.target.value)} className="cortex-input" />
            <button type="submit" className="cortex-btn-primary mt-4">
              Add stock
            </button>
          </form>
        )}

        {tab === 'stock-out' && canWrite && (
          <form onSubmit={(e) => void handleStockOutSubmit(e)} className="cortex-module max-w-lg p-5">
            <h3 className="font-headline text-headline-sm">Issue from a box</h3>
            {!stockOutBoxId && (
              <p className="mt-2 text-body-sm text-on-surface-variant">Select a box before issuing stock.</p>
            )}
            <label className="cortex-label mb-1 mt-4 block">Find part</label>
            <input
              type="search"
              value={partQuery}
              onChange={(e) => setPartQuery(e.target.value)}
              placeholder="Name or MPN…"
              className="cortex-input"
            />
            <label className="cortex-label mb-1 mt-3 block">Part</label>
            <select value={stockOutPartId} onChange={(e) => setStockOutPartId(e.target.value)} className="cortex-input" required>
              <option value="">Select a part</option>
              {parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.name}
                </option>
              ))}
            </select>
            <label className="cortex-label mb-1 mt-3 block">Box</label>
            <select value={stockOutBoxId} onChange={(e) => setStockOutBoxId(e.target.value)} className="cortex-input" required>
              <option value="">Select a box</option>
              {boxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.racks?.code ?? 'Rack'} / {box.code}
                </option>
              ))}
            </select>
            <label className="cortex-label mb-1 mt-3 block">Quantity</label>
            <input value={stockOutQty} onChange={(e) => setStockOutQty(e.target.value)} className="cortex-input" required />
            <label className="cortex-label mb-1 mt-3 block">Reason</label>
            <input value={stockOutReason} onChange={(e) => setStockOutReason(e.target.value)} className="cortex-input" required />
            <label className="cortex-label mb-1 mt-3 block">Notes</label>
            <input value={stockOutNotes} onChange={(e) => setStockOutNotes(e.target.value)} className="cortex-input" />
            <button type="submit" className="cortex-btn-primary mt-4">
              Issue stock
            </button>
          </form>
        )}

        {tab === 'import' && canImport && (
          <form onSubmit={(e) => void handleImport(e)} className="cortex-module max-w-3xl p-5">
            <h3 className="font-headline text-headline-sm">Pathbox CSV</h3>
            <p className="mt-2 text-body-sm text-on-surface-variant">
              Columns: {INVENTORY_CSV_HEADER}. Importing the same part into the same box again replaces the quantity.
            </p>
            <a
              href="/inventory-import-template.csv"
              download
              className="mt-3 inline-block text-body-sm text-primary-container hover:underline"
            >
              Download blank template
            </a>
            <label className="cortex-label mb-1 mt-4 block">CSV file</label>
            <input
              type="file"
              accept=".csv,text/csv"
              className="block text-body-sm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then(setCsvText);
              }}
            />
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="cortex-input mt-4 min-h-48 font-mono text-data-mono"
              placeholder={INVENTORY_CSV_HEADER}
              required
            />
            <button type="submit" disabled={importing} className="cortex-btn-primary mt-4 disabled:opacity-60">
              {importing ? 'Importing…' : 'Import rows'}
            </button>
          </form>
        )}
      </div>
    </ManagerLayout>
  );
}
