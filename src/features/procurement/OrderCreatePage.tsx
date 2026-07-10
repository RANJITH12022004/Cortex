import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { createPurchaseRequest, friendlyProcurementError, listActiveProducts } from './api';
import { purchaseRequestSchema } from './schemas';

type ProductOption = {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
};

export function OrderCreatePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [priority, setPriority] = useState('0');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const nextProducts = (await listActiveProducts()) as ProductOption[];
        setProducts(nextProducts);
        setProductId(nextProducts[0]?.id ?? '');
      } catch (err) {
        setError(friendlyProcurementError(err, 'Failed to load products'));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = purchaseRequestSchema.safeParse({
      product_id: productId,
      qty,
      priority,
    });

    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    if (!profile) {
      setError('You must be signed in.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createPurchaseRequest({
        ...parsed.data,
        created_by: profile.id,
      });
      navigate(`/orders/${result.request.id}`);
    } catch (err) {
      setError(friendlyProcurementError(err, 'Failed to create purchase request'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ManagerLayout title="New order">
      <form onSubmit={(e) => void handleSubmit(e)} className="cortex-module max-w-xl p-6">
        {loading ? (
          <p className="text-body-sm text-on-surface-variant">Loading products…</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="product" className="cortex-label mb-2 block">
                Product
              </label>
              <select
                id="product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="cortex-input"
                required
              >
                {products.length === 0 && <option value="">No active products</option>}
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="qty" className="cortex-label mb-2 block">
                  Quantity
                </label>
                <input
                  id="qty"
                  type="number"
                  min="1"
                  step="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="cortex-input"
                  required
                />
              </div>

              <div>
                <label htmlFor="priority" className="cortex-label mb-2 block">
                  Priority
                </label>
                <input
                  id="priority"
                  type="number"
                  min="0"
                  step="1"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="cortex-input"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting || products.length === 0} className="cortex-btn-primary">
              {submitting ? 'Saving…' : 'Create purchase request'}
            </button>
          </div>
        )}
      </form>
    </ManagerLayout>
  );
}
