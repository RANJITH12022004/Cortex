import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { DenseTable, DenseTableCell, DenseTableRow } from '@/features/products/components/DenseTable';
import {
  friendlyProcurementError,
  getPurchaseRequest,
  recheckPurchaseRequestAvailability,
} from './api';
import type { PurchaseRequestListItem } from './types';

export function OrderDetailPage() {
  const { prId } = useParams();
  const [request, setRequest] = useState<PurchaseRequestListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!prId) return;
    const id = prId;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        setRequest(await getPurchaseRequest(id));
      } catch (err) {
        setError(friendlyProcurementError(err, 'Failed to load purchase request'));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [prId]);

  async function handleRecheck() {
    if (!prId) return;
    setActionError(null);
    try {
      setRequest(await recheckPurchaseRequestAvailability(prId));
    } catch (err) {
      setActionError(friendlyProcurementError(err, 'Failed to recheck availability'));
    }
  }

  return (
    <ManagerLayout title="Order detail">
      {loading && <p className="text-body-sm text-on-surface-variant">Loading order…</p>}
      {error && (
        <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {error}
        </p>
      )}

      {!loading && !error && request && (
        <div className="space-y-6">
          <section className="cortex-module p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="cortex-label">Product</p>
                <h2 className="font-headline text-headline-md text-on-surface">
                  {request.products?.name ?? 'Unknown product'}
                </h2>
                {request.products?.description && (
                  <p className="mt-2 max-w-2xl text-body-md text-on-surface-variant">
                    {request.products.description}
                  </p>
                )}
              </div>
              <div className="grid gap-2 text-body-sm text-on-surface-variant">
                <p>
                  Qty: <span className="font-mono text-data-mono text-on-surface">{request.qty}</span>
                </p>
                <p>
                  Priority:{' '}
                  <span className="font-mono text-data-mono text-on-surface">{request.priority}</span>
                </p>
                <p>
                  Status:{' '}
                  <span className="font-semibold uppercase text-primary-container">
                    {request.status.replace('_', ' ')}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/orders" className="text-primary-container hover:underline">
                Back to orders
              </Link>
              {request.status === 'procurement_hold' && (
                <button
                  type="button"
                  onClick={() => void handleRecheck()}
                  className="text-on-surface-variant hover:text-primary-container"
                >
                  Recheck availability
                </button>
              )}
            </div>

            {actionError && (
              <p className="mt-4 rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
                {actionError}
              </p>
            )}
          </section>

          <section>
            <DenseTable headers={['Part', 'Required', 'Available', 'Shortfall']}>
              {request.shortfalls.length === 0 ? (
                <DenseTableRow>
                  <DenseTableCell className="py-6 text-tertiary">All BOM materials are currently available.</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                </DenseTableRow>
              ) : (
                request.shortfalls.map((row) => (
                  <DenseTableRow key={row.part_id}>
                    <DenseTableCell>
                      <div>
                        <p className="font-semibold">{row.part_name}</p>
                        {row.mpn && <p className="text-body-sm text-on-surface-variant">{row.mpn}</p>}
                      </div>
                    </DenseTableCell>
                    <DenseTableCell>
                      <span className="font-mono text-data-mono">{row.required_qty}</span>
                    </DenseTableCell>
                    <DenseTableCell>
                      <span className="font-mono text-data-mono">{row.available_qty}</span>
                    </DenseTableCell>
                    <DenseTableCell>
                      <span className="font-mono text-data-mono text-error">{row.shortfall_qty}</span>
                    </DenseTableCell>
                  </DenseTableRow>
                ))
              )}
            </DenseTable>
          </section>
        </div>
      )}
    </ManagerLayout>
  );
}
