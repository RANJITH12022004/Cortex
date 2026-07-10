type DataPlateHeaderProps = {
  title: string;
  subtitle?: string;
  status: 'Active' | 'Archived';
  meta?: { label: string; value: string }[];
};

export function DataPlateHeader({ title, subtitle, status, meta }: DataPlateHeaderProps) {
  const isArchived = status === 'Archived';

  return (
    <div className="cortex-module border-t-4 border-t-primary-container p-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-headline text-headline-lg text-on-surface">{title}</h2>
          {subtitle && (
            <p className="mt-1 font-mono text-data-mono text-on-surface-variant">{subtitle}</p>
          )}
        </div>
        <div className="flex gap-6">
          <div className="flex flex-col items-end">
            <span className="cortex-label text-outline">Status</span>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${isArchived ? 'bg-outline' : 'bg-secondary-container'}`}
              />
              <span className="text-body-md text-on-surface">{status}</span>
            </div>
          </div>
          {meta?.map((item) => (
            <div key={item.label} className="flex flex-col items-end">
              <span className="cortex-label text-outline">{item.label}</span>
              <span className="mt-1 text-body-md text-on-surface">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
