import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { getProductForm, saveProductForm } from './api';
import type { FormDefinition, ProductFormKind } from './formSchemas';
import { PRODUCT_FORM_KIND_LABELS } from './formSchemas';
import {
  FORM_BUILDER_ASSEMBLY_TYPES,
  FORM_BUILDER_QC_TYPES,
  FormBuilder,
} from './components/FormBuilder';

const FORM_CONFIG: Record<
  ProductFormKind,
  { label: string; hint: string; allowedTypes: typeof FORM_BUILDER_ASSEMBLY_TYPES }
> = {
  assembly: {
    label: PRODUCT_FORM_KIND_LABELS.assembly,
    hint: 'Use section headers for assembly stages. Add any question types employees should answer at each stage.',
    allowedTypes: FORM_BUILDER_ASSEMBLY_TYPES,
  },
  qc: {
    label: PRODUCT_FORM_KIND_LABELS.qc,
    hint: 'Add pass/fail checkpoints, photos, measurements, and custom questions for quality control.',
    allowedTypes: FORM_BUILDER_QC_TYPES,
  },
  installation: {
    label: PRODUCT_FORM_KIND_LABELS.installation,
    hint: 'Build the installation checklist field teams complete on site.',
    allowedTypes: FORM_BUILDER_ASSEMBLY_TYPES,
  },
};

type ProductFormEditorPageProps = {
  formKind: ProductFormKind;
};

export function ProductFormEditorPage({ formKind }: ProductFormEditorPageProps) {
  const { productId } = useParams<{ productId: string }>();
  const config = FORM_CONFIG[formKind];
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!productId) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        setDefinition(await getProductForm(productId, formKind));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form');
      } finally {
        setLoading(false);
      }
    })();
  }, [productId, formKind]);

  async function handleSave() {
    if (!productId || !definition) return;
    setSaveMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      await saveProductForm(productId, formKind, definition);
      setSaveMessage('Form saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!productId) {
    return (
      <ManagerLayout title={config.label}>
        <p className="text-error">Invalid product ID.</p>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout title={config.label} hideTitle>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/products/${productId}`} className="text-body-sm text-primary-container hover:underline">
          ← Back to product
        </Link>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={submitting || !definition}
          className="cortex-btn-primary w-auto px-6 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save form'}
        </button>
      </div>

      {loading && <p className="text-body-sm text-on-surface-variant">Loading form…</p>}
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

      {!loading && definition && (
        <div className="space-y-4">
          <p className="text-center text-body-sm text-on-surface-variant">{config.hint}</p>
          <FormBuilder
            definition={definition}
            onChange={setDefinition}
            allowedFieldTypes={config.allowedTypes}
          />
          <div className="flex justify-center pb-8">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={submitting}
              className="cortex-btn-primary w-auto min-w-[200px] px-6 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save form'}
            </button>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}
