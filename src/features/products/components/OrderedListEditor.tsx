type OrderedListEditorProps = {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
};

export function OrderedListEditor({
  label,
  items,
  onChange,
  placeholder = 'Step name',
}: OrderedListEditorProps) {
  function updateItem(index: number, value: string) {
    const next = [...items];
    next[index] = value;
    onChange(next);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function addItem() {
    onChange([...items, '']);
  }

  return (
    <div className="cortex-module overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-surface-container-lowest px-3 py-2">
        <span className="cortex-label">{label}</span>
        <button
          type="button"
          onClick={addItem}
          className="h-row-height-dense rounded bg-primary-container px-3 font-headline text-label-caps uppercase text-on-primary hover:bg-primary"
        >
          Add row
        </button>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 && (
          <p className="p-4 text-body-sm text-on-surface-variant">No items yet. Add a row to begin.</p>
        )}
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2 bg-surface p-2">
            <span className="w-8 text-center font-mono text-data-mono text-on-surface-variant">
              {index + 1}
            </span>
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={placeholder}
              className="cortex-input flex-1"
            />
            <button
              type="button"
              onClick={() => moveItem(index, -1)}
              disabled={index === 0}
              className="h-8 w-8 rounded border border-border text-on-surface-variant hover:border-primary-container disabled:opacity-40"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveItem(index, 1)}
              disabled={index === items.length - 1}
              className="h-8 w-8 rounded border border-border text-on-surface-variant hover:border-primary-container disabled:opacity-40"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="h-8 w-8 rounded border border-border text-error hover:bg-error-container"
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
