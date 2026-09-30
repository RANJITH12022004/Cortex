import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { canManageProducts } from '@/features/auth/roleRoutes';
import { listProducts, updateProduct } from './api';
import type { ProductListItem } from './types';
import { DenseTable, DenseTableCell, DenseTableRow } from './components/DenseTable';

export function ProductListPage() {
  const { profile } = useAuth();
  const canManage = profile ? canManageProducts(profile.role) : false;
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setProducts(await listProducts(includeArchived));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [includeArchived]);

  async function toggleArchive(product: ProductListItem) {
    setActionError(null);
    try {
      await updateProduct(product.id, { archived: !product.archived });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  return (
    <ManagerLayout title="Products">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Show archived
        </label>
        {canManage && (
          <Link
            to="/products/new"
            className="inline-flex h-row-height-standard items-center rounded bg-primary-container px-4 font-headline text-label-caps uppercase text-on-primary hover:bg-primary"
          >
            New product
          </Link>
        )}
      </div>

      {actionError && (
        <p className="mb-4 rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {actionError}
        </p>
      )}

      {loading && <p className="text-body-sm text-on-surface-variant">Loading products…</p>}
      {error && (
        <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {error}
        </p>
      )}

      {!loading && !error && (
        <DenseTable headers={['Name', 'BOM lines', 'Status', 'Actions']}>
          {products.length === 0 && (
            <DenseTableRow>
              <DenseTableCell className="py-6 text-on-surface-variant" >
                No products found.
              </DenseTableCell>
              <DenseTableCell>{null}</DenseTableCell>
              <DenseTableCell>{null}</DenseTableCell>
              <DenseTableCell>{null}</DenseTableCell>
            </DenseTableRow>
          )}
          {products.map((product) => (
            <DenseTableRow key={product.id}>
              <DenseTableCell>
                <div>
                  {canManage ? (
                    <Link
                      to={`/products/${product.id}`}
                      className="font-semibold text-primary-container hover:underline"
                    >
                      {product.name}
                    </Link>
                  ) : (
                    <span className="font-semibold text-on-surface">{product.name}</span>
                  )}
                  {product.description && (
                    <p className="mt-0.5 text-body-sm text-on-surface-variant line-clamp-1">
                      {product.description}
                    </p>
                  )}
                </div>
              </DenseTableCell>
              <DenseTableCell>
                <span className="font-mono text-data-mono">{product.bom_count}</span>
              </DenseTableCell>
              <DenseTableCell>
                <span
                  className={`rounded px-2 py-0.5 text-label-caps uppercase ${
                    product.archived
                      ? 'bg-surface-container-high text-on-surface-variant'
                      : 'bg-tertiary-container/30 text-tertiary'
                  }`}
                >
                  {product.archived ? 'Archived' : 'Active'}
                </span>
              </DenseTableCell>
              <DenseTableCell>
                {canManage ? (
                  <div className="flex gap-2">
                    <Link
                      to={`/products/${product.id}`}
                      className="text-primary-container hover:underline"
                    >
                      Setup
                    </Link>
                    <button
                      type="button"
                      onClick={() => void toggleArchive(product)}
                      className="text-on-surface-variant hover:text-primary-container"
                    >
                      {product.archived ? 'Restore' : 'Archive'}
                    </button>
                  </div>
                ) : (
                  <span className="text-on-surface-variant">View only</span>
                )}
              </DenseTableCell>
            </DenseTableRow>
          ))}
        </DenseTable>
      )}
    </ManagerLayout>
  );
}
