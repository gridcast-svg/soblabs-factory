import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { RecordEditor, type FieldSpec } from "@/components/RecordEditor";
import { orNotSpecified } from "@/lib/led-calc";
import type { Hardware } from "@/lib/types";
import { duplicateRecord, splitRecord } from "@/lib/record-utils";
import { groupHardware } from "@/lib/catalogue-groups";

const FIELDS: FieldSpec[] = [
  { key: "manufacturer_name", label: "Manufacturer" },
  { key: "model", label: "Model" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "max_pixels", label: "Documented max pixels", type: "number" },
  { key: "max_pixel_width", label: "Max pixel width", type: "number" },
  { key: "max_pixel_height", label: "Max pixel height", type: "number" },
  { key: "cost", label: "Cost", type: "number" },
  {
    key: "cost_currency",
    label: "Cost currency",
    type: "select",
    options: [
      { value: "USD", label: "USD" },
      { value: "CAD", label: "CAD" },
    ],
  },
  { key: "spec_notes", label: "Specification notes", type: "textarea" },
  { key: "datasheet_url", label: "Datasheet link" },
  { key: "last_verified_at", label: "Last verified", type: "date" },
  { key: "is_demo", label: "Fictional demonstration product", type: "checkbox" },
];

type Props = {
  table: "processors" | "receiver_cards";
  title: string;
  /** Receiver cards additionally manage which processors they are approved with. */
  withProcessorLinks?: boolean;
};

export function HardwareCatalogue({ table, title, withProcessorLinks }: Props) {
  const { data: me } = useCurrentUser();
  const isAdmin = !!me?.isAdmin;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  const { data } = useQuery({
    queryKey: ["hardware", table],
    queryFn: async () => {
      const [rows, processors, compat] = await Promise.all([
        supabase.from(table).select("*").order("model"),
        withProcessorLinks
          ? supabase.from("processors").select("id, manufacturer_name, model").order("model")
          : Promise.resolve({ data: [] }),
        withProcessorLinks
          ? supabase.from("receiver_processor_compat").select("*")
          : Promise.resolve({ data: [] }),
      ]);
      return {
        rows: (rows.data ?? []) as unknown as Hardware[],
        processors: (processors.data ?? []) as {
          id: string;
          manufacturer_name: string | null;
          model: string;
        }[],
        compat: (compat.data ?? []) as { receiver_card_id: string; processor_id: string }[],
      };
    },
  });
  const manufacturerGroups = useMemo(() => groupHardware(data?.rows ?? []), [data?.rows]);

  async function save() {
    if (!editing) return;
    const { id, payload } = splitRecord(editing);
    const { error } = id
      ? await supabase
          .from(table)
          .update(payload as never)
          .eq("id", id)
      : await supabase.from(table).insert(payload as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Catalogue saved.");
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["hardware", table] });
    queryClient.invalidateQueries({ queryKey: ["catalogue"] });
  }

  async function toggleLink(receiverId: string, processorId: string, on: boolean) {
    if (on) {
      await supabase
        .from("receiver_processor_compat")
        .insert({ receiver_card_id: receiverId, processor_id: processorId, verified: true });
    } else {
      await supabase
        .from("receiver_processor_compat")
        .delete()
        .eq("receiver_card_id", receiverId)
        .eq("processor_id", processorId);
    }
    queryClient.invalidateQueries({ queryKey: ["hardware", table] });
    queryClient.invalidateQueries({ queryKey: ["catalogue"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {isAdmin && (
          <button
            onClick={() => setEditing({ model: "", cost_currency: "USD", status: "active" })}
            className="ml-auto rounded-lg bg-gradient-to-br from-brand to-accent px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            + New item
          </button>
        )}
      </div>

      {editing && isAdmin && (
        <div className="glass space-y-3 p-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-semibold">
              {editing["id"] ? "Edit item" : "New item"}
            </h2>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Save
              </button>
            </div>
          </div>
          <RecordEditor
            fields={FIELDS}
            value={editing}
            onChange={(patch) => setEditing({ ...editing, ...patch })}
          />
        </div>
      )}

      <div className="space-y-6">
        {manufacturerGroups.map((group) => (
          <section key={group.name}>
            <div className="mb-2 flex items-baseline gap-2 border-b border-border/70 pb-2">
              <h2 className="font-display text-lg font-semibold">{group.name}</h2>
              <span className="text-xs text-muted-foreground">
                {group.items.length} {group.items.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="space-y-2">
              {group.items.map((r) => (
                <div key={r.id} className="glass p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {r.manufacturer_name} {r.model}
                    </span>
                    {r.is_demo && (
                      <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] text-amber">
                        FICTIONAL DEMO
                      </span>
                    )}
                    {r.status !== "active" && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                        Archived
                      </span>
                    )}
                    {isAdmin && (
                      <span className="ml-auto flex gap-3 text-xs">
                        <button
                          onClick={() => setEditing({ ...r })}
                          className="text-brand hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            setEditing(duplicateRecord({ ...r } as Record<string, unknown>))
                          }
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={async () => {
                            await supabase
                              .from(table)
                              .update({ status: r.status === "active" ? "archived" : "active" })
                              .eq("id", r.id);
                            queryClient.invalidateQueries({ queryKey: ["hardware", table] });
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {r.status === "active" ? "Archive" : "Restore"}
                        </button>
                      </span>
                    )}
                  </div>
                  <div className="num mt-2 grid gap-1 text-[11px] text-muted-foreground md:grid-cols-4">
                    <span>Max pixels: {orNotSpecified(r.max_pixels)}</span>
                    <span>
                      Max WxH: {orNotSpecified(r.max_pixel_width)} ×{" "}
                      {orNotSpecified(r.max_pixel_height)}
                    </span>
                    <span>
                      Cost: {orNotSpecified(r.cost)} {r.cost_currency}
                    </span>
                    <span>Verified: {orNotSpecified(r.last_verified_at)}</span>
                  </div>

                  {withProcessorLinks && (
                    <div className="mt-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Approved processors
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs">
                        {(data?.processors ?? []).map((p) => {
                          const on = (data?.compat ?? []).some(
                            (c) => c.receiver_card_id === r.id && c.processor_id === p.id,
                          );
                          return (
                            <label
                              key={p.id}
                              className="flex items-center gap-1.5 text-muted-foreground"
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={!isAdmin}
                                onChange={(e) => toggleLink(r.id, p.id, e.target.checked)}
                              />
                              {p.manufacturer_name} {p.model}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Compatibility comes only from these administrator-maintained links — it is never inferred
        from brand names.
      </p>
    </div>
  );
}
