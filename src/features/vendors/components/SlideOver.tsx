type SlideOverProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function SlideOver({ open, title, onClose, children }: SlideOverProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-inverse-surface/40"
        aria-label="Close panel"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-surface-container-low px-4 py-3">
          <h2 className="font-headline text-headline-sm text-on-surface">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded border border-border text-on-surface-variant hover:bg-surface-container-high"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
