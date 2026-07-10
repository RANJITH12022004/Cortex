import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { createProduct } from './api';
import { productSchema } from './schemas';
import { friendlyDbError } from '@/lib/errors';

export function ProductCreatePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = productSchema.safeParse({ name, description: description || null });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    if (!profile) {
      setError('Your account profile is not loaded. Sign out and sign in again.');
      return;
    }

    setSubmitting(true);
    try {
      const product = await createProduct({
        name: parsed.data.name,
        description: parsed.data.description,
        created_by: profile.id,
      });
      navigate(`/products/${product.id}`);
    } catch (err) {
      setError(friendlyDbError(err, 'Failed to create product'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ManagerLayout title="New product">
      <form onSubmit={(e) => void handleSubmit(e)} className="cortex-module max-w-lg p-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="cortex-label mb-2 block">
              Product name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="cortex-input"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="cortex-label mb-2 block">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="cortex-input min-h-[80px] py-2"
            />
          </div>
          {error && (
            <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="cortex-btn-primary max-w-xs disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create & configure'}
          </button>
        </div>
      </form>
    </ManagerLayout>
  );
}
