import { useEffect, useState } from "react";

export function PlannerNumberField({
  label,
  value,
  onChange,
  optional = false,
  min = 0.001,
  max = 1000000000,
  whole = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  optional?: boolean;
  min?: number;
  max?: number;
  whole?: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => setText(value === null ? "" : String(value)), [value]);
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={whole ? 1 : "any"}
        placeholder={optional ? "Not specified" : undefined}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          if (!raw) {
            if (optional) onChange(null);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n) && n >= min && n <= max && (!whole || Number.isInteger(n)))
            onChange(n);
        }}
        onBlur={() => setText(value === null ? "" : String(value))}
      />
    </label>
  );
}
