import { Link } from 'react-router-dom';
import type { PartWithVendor } from '@/features/vendors/types';
import type { BomRowFormValues } from '../schemas';
import { DenseTable, DenseTableCell, DenseTableRow } from './DenseTable';
import { SearchablePartSelect } from './SearchablePartSelect';

type BomEditorProps = {
  rows: BomRowFormValues[];
  parts: PartWithVendor[];
  /** Full catalog for resolving selected part labels when filtered list is in use. */
  allParts?: PartWithVendor[];
  onChange: (rows: BomRowFormValues[]) => void;
};

export function BomEditor({ rows, parts, allParts, onChange }: BomEditorProps) {
  function updateRow(index: number, patch: Partial<BomRowFormValues>) {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...rows, { part_id: '', qty_required: 1 }]);
  }

  const usedPartIds = new Set(rows.map((r) => r.part_id).filter(Boolean));
  const catalog = allParts ?? parts;

  return (
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
              onClick={addRow}
              className="inline-flex h-row-height-dense items-center rounded bg-primary-container px-3 font-headline text-label-caps uppercase text-on-primary hover:bg-primary"
            >
              Add row
            </button>
          </div>
        </>
      }
    >
      {rows.length === 0 && (
        <DenseTableRow>
          <DenseTableCell className="py-4 text-on-surface-variant" >
            <span className="col-span-4">No BOM lines. Add a row or create parts in Inventory.</span>
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
  );
}
