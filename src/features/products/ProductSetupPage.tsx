import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { listParts } from '@/features/vendors/api';
import type { PartWithVendor } from '@/features/vendors/types';
import { getProductBundle, syncProductSetup, updateProduct } from './api';
import { productSetupSchema } from './schemas';
import type { BomRowFormValues, ProductSetupFormValues } from './schemas';
import type { ProductBundle } from './types';
import { BomEditor } from './components/BomEditor';
import { DataPlateHeader } from './components/DataPlateHeader';
import { OrderedListEditor } from './components/OrderedListEditor';
import { TabBar } from './components/TabBar';

type SetupTab = 'bom' | 'assembly' | 'qc';

export function ProductSetupPage() {
  const { productId } = useParams<{ productId: string }>();
  const [bundle, setBundle] = useState<ProductBundle | null>(null);
  const [parts, setParts] = useState<PartWithVendor[]>([]);
  const [tab, setTab] = useState<SetupTab>('bom');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bom, setBom] = useState<BomRowFormValues[]>([]);
  const [assemblySteps, setAssemblySteps] = useState<string[]>([]);
  const [qcCheckpoints, setQcCheckpoints] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!productId) return;

    const id = productId;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [bundleData, partsData] = await Promise.all([
          getProductBundle(id),
          listParts(),
        ]);
        setBundle(bundleData);
        setParts(partsData);
        setName(bundleData.product.name);
        setDescription(bundleData.product.description ?? '');
        setBom(
          bundleData.bom.map((row) => ({
            part_id: row.part_id,
            qty_required: row.qty_required,
          })),
        );
        setAssemblySteps(bundleData.assemblySteps.map((s) => s.step_name));
        setQcCheckpoints(bundleData.qcCheckpoints.map((c) => c.checkpoint_name));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [productId]);

  async function handleSave() {
    if (!productId) return;
    setSaveMessage(null);
    setError(null);

    const payload: ProductSetupFormValues = {
      name,
      description: description || null,
      bom,
      assemblySteps: assemblySteps.map((step_name) => ({ step_name })),
      qcCheckpoints: qcCheckpoints.map((checkpoint_name) => ({ checkpoint_name })),
    };

    const parsed = productSetupSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Validation failed');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await syncProductSetup(productId, parsed.data);
      setBundle(updated);
      setSaveMessage('Product setup saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchiveToggle() {
    if (!bundle) return;
    setError(null);
    try {
      const updated = await updateProduct(bundle.product.id, {
        archived: !bundle.product.archived,
      });
      setBundle({ ...bundle, product: updated });
      setSaveMessage(updated.archived ? 'Product archived.' : 'Product restored.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  if (!productId) {
    return (
      <ManagerLayout title="Product">
        <p className="text-error">Invalid product ID.</p>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout title="Product setup" hideTitle>
      <div className="mb-4">
        <Link to="/products" className="text-body-sm text-primary-container hover:underline">
          ← Back to products
        </Link>
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

      {!loading && bundle && (
        <div className="flex flex-col gap-6">
          <DataPlateHeader
            title={name || bundle.product.name}
            subtitle={bundle.product.id.slice(0, 8).toUpperCase()}
            status={bundle.product.archived ? 'Archived' : 'Active'}
            meta={[
              {
                label: 'Created',
                value: new Date(bundle.product.created_at).toLocaleDateString(),
              },
            ]}
          />

          <div className="cortex-module p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="edit-name" className="cortex-label mb-2 block">
                  Product name
                </label>
                <input
                  id="edit-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="cortex-input"
                />
              </div>
              <div>
                <label htmlFor="edit-description" className="cortex-label mb-2 block">
                  Description
                </label>
                <input
                  id="edit-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="cortex-input"
                />
              </div>
            </div>
          </div>

          <TabBar
            tabs={[
              { id: 'bom' as const, label: 'BOM Builder' },
              { id: 'assembly' as const, label: 'Assembly Checklist' },
              { id: 'qc' as const, label: 'QC Checklist' },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === 'bom' && <BomEditor rows={bom} parts={parts} onChange={setBom} />}
          {tab === 'assembly' && (
            <OrderedListEditor
              label="Assembly steps"
              items={assemblySteps}
              onChange={setAssemblySteps}
              placeholder="e.g. Mechanical Assembly"
            />
          )}
          {tab === 'qc' && (
            <OrderedListEditor
              label="QC checkpoints"
              items={qcCheckpoints}
              onChange={setQcCheckpoints}
              placeholder="e.g. Visual inspection"
            />
          )}

          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={submitting}
              className="cortex-btn-primary w-auto min-w-[200px] px-6 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save product setup'}
            </button>
            <button
              type="button"
              onClick={() => void handleArchiveToggle()}
              className="inline-flex h-row-height-standard items-center rounded border border-border px-4 font-headline text-label-caps uppercase text-on-surface-variant hover:border-primary-container"
            >
              {bundle.product.archived ? 'Restore product' : 'Archive product'}
            </button>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}
