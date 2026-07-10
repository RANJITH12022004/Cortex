type TabBarProps<T extends string> = {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
};

export function TabBar<T extends string>({ tabs, active, onChange }: TabBarProps<T>) {
  return (
    <div className="flex border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-body-md transition-colors ${
            active === tab.id
              ? 'border-b-2 border-primary font-semibold text-primary'
              : 'border-b-2 border-transparent text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
