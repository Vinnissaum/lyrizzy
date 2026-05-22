interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: [ToggleOption<T>, ToggleOption<T>];
  label?: string;
}

export function Toggle<T extends string>({ value, onChange, options, label }: Props<T>) {
  return (
    <div className="flex items-center justify-between">
      {label && (
        <span className="text-sm text-muted">{label}</span>
      )}
      <div className="flex rounded-lg overflow-hidden border border-border text-sm">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 transition-colors ${
              value === opt.value
                ? "bg-primary text-fg-on-primary"
                : "bg-surface text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
