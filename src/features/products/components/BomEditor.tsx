import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PartWithVendor } from '@/features/vendors/types';
import type { BomRowFormValues } from '../schemas';
import { DenseTable, DenseTableCell, DenseTableRow } from './DenseTable';
import { matchesPartSearchQuery, SearchablePartSelect } from './SearchablePartSelect';

type BomEditorProps = {
  rows: BomRowFormValues[];
  parts: PartWithVendor[];
  /** Full catalog for resolving selected part labels when filtered list is in use. */
  allParts?: PartWithVendor[];
  onChange: (rows: BomRowFormValues[]) => void;
};

export function BomEditor({ rows, parts, allParts, onChange }: BomEditorProps) {
  const [adding, setAdding] = useState(false);
  const [partQuery, setPartQuery] = useState('');

  function updateRow(index: number, patch: Partial<BomRowFormValues>) {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function addExistingPart(partId: string) {
    if (!partId || rows.some((row) => row.part_id === partId)) return;
    onChange([...rows, { part_id: partId, qty_required: 1 }]);
    setPartQuery('');
    setAdding(false);
  }

  const usedPartIds = new Set(rows.map((r) => r.part_id).filter(Boolean));
  const catalog = allParts ?? parts;
  const availableParts = catalog
    .filter((part) => !usedPartIds.has(part.id) && matchesPartSearchQuery(part, partQuery))
    .slice(0, 30);

  return (
    <div className="space-y-3">
      {adding && (
        <div className="cortex-module p-4">
          <label htmlFor="add-existing-part" className="cortex-label mb-2 block">
            Add an existing part
          </label>
          <input
            id="add-existing-part"
            type="search"
            value={partQuery}
            onChange={(e) => setPartQuery(e.target.value)}
            placeholder="Search parts by name, MPN, or bin…"
            className="cortex-input max-w-md"
            autoFocus
          />
          <ul className="mt-2 max-h-60 overflow-y-auto rounded border border-border bg-surface">
            {availableParts.length === 0 && (
              <li className="px-3 py-2 text-body-sm text-on-surface-variant">No parts match.</li>
            )}
            {availableParts.map((part) => (
              <li key={part.id}>
                <button
                  type="button"
                  onClick={() => addExistingPart(part.id)}
                  className="block w-full px-3 py-2 text-left text-body-sm hover:bg-surface-container-high"
                >
                  <span className="block">{part.name}</span>
                  <span className="mt-0.5 block font-mono text-body-sm text-on-surface-variant">
                    {[
                      part.mpn,
                      part.storage_location ? `Bin ${part.storage_location}` : null,
                      `${part.qty_available} on hand`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    <DenseTable
      headers={['Part', 'MPN', 'Qty required', '']}
      footer={
        <>
          <span className="cortex-label">Bill of materials — {rows.length} items</span>
          <div className="flex gap-2">
            <Link
              to="/inventory?tab=parts"
              className="inline-flex h-row-height-dense items-center rounded border border-primary-container px-3 font-headline text-label-caps uppercase text-primary-container hover:bg-surface-container-low"
            >
              Create part
            </Link>
            <button
              type="button"
              onClick={() => setAdding((open) => !open)}
              className="inline-flex h-row-height-dense items-center rounded bg-primary-container px-3 font-headline text-label-caps uppercase text-on-primary hover:bg-primary"
            >
              Add part
            </button>
          </div>
        </>
      }
    >
      {rows.length === 0 && (
        <DenseTableRow>
          <DenseTableCell className="py-4 text-on-surface-variant" >
            <span className="col-span-4">No parts on this product yet. Add an existing part.</span>
          </DenseTableCell>
          <DenseTableCell>{null}</DenseTableCell>
          <DenseTableCell>{null}</DenseTableCell>
          <DenseTableCell>{null}</DenseTableCell>
        </DenseTableRow>
      )}
      {rows.map((row, index) => {
        const selectedPart = catalog.find((p) => p.id === row.part_id);
        return (
          <DenseTableRow key={index}>
            <DenseTableCell>
              <SearchablePartSelect
                parts={parts}
                value={row.part_id}
                onChange={(partId) => updateRow(index, { part_id: partId })}
                excludeIds={usedPartIds}
                placeholder="Search parts…"
              />
            </DenseTableCell>
            <DenseTableCell>
              <span className="font-mono text-data-mono text-on-surface-variant">
                {selectedPart?.mpn ?? '—'}
              </span>
            </DenseTableCell>
            <DenseTableCell>
              <input
                type="number"
                min="0.001"
                step="any"
                value={row.qty_required}
                onChange={(e) =>
                  updateRow(index, { qty_required: parseFloat(e.target.value) || 0 })
                }
                className="cortex-input w-24 text-right"
              />
            </DenseTableCell>
            <DenseTableCell>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="text-error hover:underline"
              >
                Remove
              </button>
            </DenseTableCell>
          </DenseTableRow>
        );
      })}
    </DenseTable>
    </div>
  );
}
