import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { DenseTable, DenseTableCell, DenseTableRow } from '@/features/products/components/DenseTable';
import {
  friendlyProcurementError,
  listPurchaseRequests,
  recheckPurchaseRequestAvailability,
} from './api';
import type { PurchaseRequestListItem } from './types';

function statusTone(status: PurchaseRequestListItem['status']) {
  if (status === 'ready') return 'bg-tertiary-container/30 text-tertiary';
  if (status === 'procurement_hold') return 'bg-error-container text-on-error-container';
  return 'bg-surface-container-high text-on-surface-variant';
}

export function OrderListPage() {
  const [requests, setRequests] = useState<PurchaseRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRequests(await listPurchaseRequests());
    } catch (err) {
      setError(friendlyProcurementError(err, 'Failed to load purchase requests'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleRecheck(requestId: string) {
    setActionError(null);
    try {
      await recheckPurchaseRequestAvailability(requestId);
      await load();
    } catch (err) {
      setActionError(friendlyProcurementError(err, 'Failed to recheck availability'));
    }
  }

  return (
    <ManagerLayout title="Orders">
      <div className="mb-4 flex items-center justify-end">
        <Link
          to="/orders/new"
          className="inline-flex h-row-height-standard items-center rounded bg-primary-container px-4 font-headline text-label-caps uppercase text-on-primary hover:bg-primary"
        >
          New order
        </Link>
      </div>

      {actionError && (
        <p className="mb-4 rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {actionError}
        </p>
      )}

      {loading && <p className="text-body-sm text-on-surface-variant">Loading order queue…</p>}
      {error && (
        <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {error}
        </p>
      )}

      {!loading && !error && (
        <DenseTable headers={['Product', 'Qty', 'Priority', 'Status', 'Shortfall', 'Actions']}>
          {requests.length === 0 && (
            <DenseTableRow>
              <DenseTableCell className="py-6 text-on-surface-variant">No purchase requests yet.</DenseTableCell>
              <DenseTableCell>{null}</DenseTableCell>
              <DenseTableCell>{null}</DenseTableCell>
              <DenseTableCell>{null}</DenseTableCell>
              <DenseTableCell>{null}</DenseTableCell>
              <DenseTableCell>{null}</DenseTableCell>
            </DenseTableRow>
          )}

          {requests.map((request) => (
            <DenseTableRow key={request.id}>
              <DenseTableCell>
                <div>
                  <Link
                    to={`/orders/${request.id}`}
                    className="font-semibold text-primary-container hover:underline"
                  >
                    {request.products?.name ?? 'Unknown product'}
                  </Link>
                  {request.products?.description && (
                    <p className="mt-0.5 line-clamp-1 text-body-sm text-on-surface-variant">
                      {request.products.description}
                    </p>
                  )}
                </div>
              </DenseTableCell>
              <DenseTableCell>
                <span className="font-mono text-data-mono">{request.qty}</span>
              </DenseTableCell>
              <DenseTableCell>
                <span className="font-mono text-data-mono">{request.priority}</span>
              </DenseTableCell>
              <DenseTableCell>
                <span className={`rounded px-2 py-0.5 text-label-caps uppercase ${statusTone(request.status)}`}>
                  {request.status.replace('_', ' ')}
                </span>
              </DenseTableCell>
              <DenseTableCell>
                {request.shortfalls.length === 0 ? (
                  <span className="text-tertiary">In stock</span>
                ) : (
                  <span className="text-error">{request.shortfalls.length} parts short</span>
                )}
              </DenseTableCell>
              <DenseTableCell>
                <div className="flex flex-wrap gap-3">
                  <Link to={`/orders/${request.id}`} className="text-primary-container hover:underline">
                    Open
                  </Link>
                  {request.status === 'procurement_hold' && (
                    <button
                      type="button"
                      onClick={() => void handleRecheck(request.id)}
                      className="text-on-surface-variant hover:text-primary-container"
                    >
                      Recheck
                    </button>
                  )}
                </div>
              </DenseTableCell>
            </DenseTableRow>
          ))}
        </DenseTable>
      )}
    </ManagerLayout>
  );
}
