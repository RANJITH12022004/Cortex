import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { listParts } from '@/features/vendors/api';
import type { PartWithVendor } from '@/features/vendors/types';
import { getProductBundle, syncProductBom } from './api';
import { bomOnlySchema, type BomRowFormValues } from './schemas';
import { BomEditor } from './components/BomEditor';
import { matchesPartSearchQuery } from './components/SearchablePartSelect';

export function ProductBomPage() {
  const { productId } = useParams<{ productId: string }>();
  const [parts, setParts] = useState<PartWithVendor[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bom, setBom] = useState<BomRowFormValues[]>([]);
  const [partsSearch, setPartsSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredParts = useMemo(
    () => parts.filter((part) => matchesPartSearchQuery(part, partsSearch)),
    [parts, partsSearch],
  );

  useEffect(() => {
    if (!productId) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [bundle, partsData] = await Promise.all([getProductBundle(productId), listParts()]);
        setParts(partsData);
        setName(bundle.product.name);
        setDescription(bundle.product.description ?? '');
        setBom(
          bundle.bom.map((row) => ({
            part_id: row.part_id,
            qty_required: row.qty_required,
          })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load BOM');
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  async function handleSave() {
    if (!productId) return;
    setSaveMessage(null);
    setError(null);

    const parsed = bomOnlySchema.safeParse({
      name,
      description: description || null,
      bom,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Validation failed');
      return;
    }

    setSubmitting(true);
    try {
      await syncProductBom(productId, parsed.data);
      setSaveMessage('BOM saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!productId) {
    return (
      <ManagerLayout title="BOM">
        <p className="text-error">Invalid product ID.</p>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout title="Bill of materials" hideTitle>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/products/${productId}`} className="text-body-sm text-primary-container hover:underline">
          ← Back to product
        </Link>
        <input
          type="search"
          value={partsSearch}
          onChange={(e) => setPartsSearch(e.target.value)}
          placeholder="Filter parts list by name, MPN, or bin…"
          className="cortex-input max-w-sm"
        />
      </div>

      {loading && <p className="text-body-sm text-on-surface-variant">Loading…</p>}
      {error && (
        <p className="mb-4 rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {error}
        </p>
      )}
      {saveMessage && (
        <p className="mb-4 rounded border border-tertiary-container bg-tertiary-container/20 px-3 py-2 text-body-sm text-tertiary">
          {saveMessage}
        </p>
      )}

      {!loading && (
        <div className="space-y-6">
          <div className="cortex-module p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="bom-name" className="cortex-label mb-2 block">
                  Product name
                </label>
                <input
                  id="bom-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="cortex-input"
                />
              </div>
              <div>
                <label htmlFor="bom-description" className="cortex-label mb-2 block">
                  Description
                </label>
                <input
                  id="bom-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="cortex-input"
                />
              </div>
            </div>
          </div>

          <BomEditor rows={bom} parts={filteredParts} allParts={parts} onChange={setBom} />

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={submitting}
            className="cortex-btn-primary w-auto min-w-[200px] px-6 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save BOM'}
          </button>
        </div>
      )}
    </ManagerLayout>
  );
}
