import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { getProductHubSummary, updateProduct } from './api';
import type { ProductHubSummary } from './types';
import { DataPlateHeader } from './components/DataPlateHeader';

type SetupCard = {
  to: string;
  title: string;
  description: string;
  status: string;
  accent: string;
};

export function ProductHubPage() {
  const { productId } = useParams<{ productId: string }>();
  const [summary, setSummary] = useState<ProductHubSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        setSummary(await getProductHubSummary(productId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product');
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  async function handleArchiveToggle() {
    if (!summary) return;
    setError(null);
    try {
      const updated = await updateProduct(summary.product.id, {
        archived: !summary.product.archived,
      });
      setSummary({ ...summary, product: updated });
      setMessage(updated.archived ? 'Product archived.' : 'Product restored.');
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

  const cards: SetupCard[] = summary
    ? [
        {
          to: `/products/${productId}/bom`,
          title: 'BOM',
          description: 'Parts and quantities required to build this product.',
          status: summary.bom_count > 0 ? `${summary.bom_count} lines configured` : 'Not configured',
          accent: 'border-primary-container',
        },
        {
          to: `/products/${productId}/assembly`,
          title: 'Assembly form',
          description: 'Build the step-by-step assembly checklist employees follow on the floor.',
          status:
            summary.assembly_step_count > 0
              ? `${summary.assembly_step_count} steps configured`
              : 'Not configured',
          accent: 'border-tertiary-container',
        },
        {
          to: `/products/${productId}/qc`,
          title: 'QC form',
          description: 'Quality checkpoints with pass/fail, photos, notes, and custom questions.',
          status:
            summary.qc_checkpoint_count > 0
              ? `${summary.qc_checkpoint_count} checkpoints configured`
              : 'Not configured',
          accent: 'border-secondary-container',
        },
        {
          to: `/products/${productId}/installation`,
          title: 'Installation form',
          description: 'Field installation checklist and documentation capture.',
          status: summary.has_installation_form ? 'Form saved' : 'Not configured',
          accent: 'border-primary',
        },
      ]
    : [];

  return (
    <ManagerLayout title="Product" hideTitle>
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
      {message && (
        <p className="mb-4 rounded border border-tertiary-container bg-tertiary-container/20 px-3 py-2 text-body-sm text-tertiary">
          {message}
        </p>
      )}

      {!loading && summary && (
        <div className="space-y-6">
          <DataPlateHeader
            title={summary.product.name}
            subtitle={summary.product.id.slice(0, 8).toUpperCase()}
            status={summary.product.archived ? 'Archived' : 'Active'}
            meta={[
              {
                label: 'Created',
                value: new Date(summary.product.created_at).toLocaleDateString(),
              },
            ]}
          />

          {summary.product.description && (
            <p className="text-body-md text-on-surface-variant">{summary.product.description}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((card) => (
              <Link
                key={card.to}
                to={card.to}
                className={`cortex-module block border-l-4 p-5 transition-shadow hover:shadow-md ${card.accent}`}
              >
                <h2 className="font-headline text-headline-sm text-on-surface">{card.title}</h2>
                <p className="mt-2 text-body-sm text-on-surface-variant">{card.description}</p>
                <p className="mt-4 font-mono text-data-mono text-xs text-primary-container">{card.status}</p>
                <span className="mt-4 inline-block text-body-sm font-semibold text-primary-container">
                  Open editor →
                </span>
              </Link>
            ))}
          </div>

          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => void handleArchiveToggle()}
              className="inline-flex h-row-height-standard items-center rounded border border-border px-4 font-headline text-label-caps uppercase text-on-surface-variant hover:border-primary-container"
            >
              {summary.product.archived ? 'Restore product' : 'Archive product'}
            </button>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}
