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
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      )}
      <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 text-sm">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 transition-colors ${
              value === opt.value
                ? "bg-emerald-600 text-white"
                : "bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
