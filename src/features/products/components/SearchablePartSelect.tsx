import { useEffect, useMemo, useRef, useState } from 'react';
import type { PartWithVendor } from '@/features/vendors/types';

type SearchablePartSelectProps = {
  parts: PartWithVendor[];
  value: string;
  onChange: (partId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  excludeIds?: Set<string>;
  required?: boolean;
  id?: string;
};

function formatPartLabel(part: PartWithVendor) {
  const bits = [part.name];
  if (part.mpn) bits.push(part.mpn);
  if (part.storage_location) bits.push(`Bin ${part.storage_location}`);
  bits.push(`${part.qty_available} on hand`);
  return bits.join(' · ');
}

function matchesPartQuery(part: PartWithVendor, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    part.name.toLowerCase().includes(q) ||
    (part.mpn?.toLowerCase().includes(q) ?? false) ||
    (part.footprint?.toLowerCase().includes(q) ?? false) ||
    (part.storage_location?.toLowerCase().includes(q) ?? false) ||
    (part.vendors?.name?.toLowerCase().includes(q) ?? false)
  );
}

export function SearchablePartSelect({
  parts,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search parts by name, MPN, or bin…',
  excludeIds,
  required,
  id,
}: SearchablePartSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = parts.find((p) => p.id === value);

  const filtered = useMemo(() => {
    return parts.filter((part) => {
      if (excludeIds?.has(part.id) && part.id !== value) return false;
      return matchesPartQuery(part, query);
    });
  }, [parts, query, excludeIds, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open && selected) {
      setQuery('');
    }
  }, [open, selected]);

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        disabled={disabled}
        required={required && !value}
        placeholder={selected && !open ? formatPartLabel(selected) : placeholder}
        value={open ? query : selected ? formatPartLabel(selected) : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          if (selected) setQuery('');
        }}
        className="cortex-input w-full"
      />
      {open && !disabled && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded border border-border bg-surface shadow-lg"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-body-sm text-on-surface-variant">No parts match.</li>
          )}
          {filtered.map((part) => (
            <li key={part.id}>
              <button
                type="button"
                role="option"
                aria-selected={part.id === value}
                onClick={() => {
                  onChange(part.id);
                  setQuery('');
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-body-sm hover:bg-surface-container-high ${
                  part.id === value ? 'bg-surface-container-high font-semibold text-primary-container' : ''
                }`}
              >
                <span className="block">{part.name}</span>
                <span className="mt-0.5 block font-mono text-body-sm text-on-surface-variant">
                  {[part.mpn, part.storage_location ? `Bin ${part.storage_location}` : null, `${part.qty_available} on hand`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { matchesPartQuery as matchesPartSearchQuery };
