type DenseTableProps = {
  headers: string[];
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function DenseTable({ headers, children, footer }: DenseTableProps) {
  return (
    <div className="cortex-module overflow-hidden">
      {footer && (
        <div className="flex items-center justify-between border-b border-border bg-surface-container-lowest px-3 py-2">
          {footer}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body-md">
          <thead>
            <tr className="bg-surface-container-high">
              {headers.map((header) => (
                <th
                  key={header}
                  className="h-row-height-dense border-b border-border px-3 text-left font-headline text-label-caps uppercase text-on-surface-variant"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function DenseTableRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-border bg-surface">{children}</tr>;
}

export function DenseTableCell({
  children,
  className = '',
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`h-row-height-dense px-3 text-body-sm text-on-surface ${className}`}
    >
      {children}
    </td>
  );
}
