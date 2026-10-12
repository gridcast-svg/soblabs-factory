export type FieldSpec = {
  key: string;
  label: string;
  type?: "text" | "number" | "checkbox" | "select" | "date" | "textarea";
  options?: { value: string; label: string }[];
};

type Props = {
  fields: FieldSpec[];
  value: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
};

const input =
  "w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function RecordEditor({ fields, value, onChange }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {fields.map((f) => {
        const v = value[f.key];
        return (
          <label key={f.key} className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {f.label}
            </span>
            {f.type === "checkbox" ? (
              <input
                type="checkbox"
                checked={Boolean(v)}
                onChange={(e) => onChange({ [f.key]: e.target.checked })}
              />
            ) : f.type === "select" ? (
              <select
                value={(v as string) ?? ""}
                onChange={(e) => onChange({ [f.key]: e.target.value })}
                className={input}
              >
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value} className="bg-popover">
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                value={(v as string) ?? ""}
                onChange={(e) => onChange({ [f.key]: e.target.value })}
                className={`${input} h-20`}
              />
            ) : (
              <input
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                step="any"
                value={(v as string | number) ?? ""}
                onChange={(e) =>
                  onChange({
                    [f.key]:
                      f.type === "number"
                        ? e.target.value === ""
                          ? null
                          : Number(e.target.value)
                        : e.target.value === ""
                          ? null
                          : e.target.value,
                  })
                }
                className={input}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
