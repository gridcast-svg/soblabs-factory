import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { createQuote, duplicateQuote, STATUS_STYLES } from "@/lib/quotes";
import { formatMoney } from "@/lib/led-calc";
import type { Quote, QuoteItemRow } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/quotes/")({
  head: () => ({
    meta: [
      { title: "Quote Library — Soblabs LED Configurator" },
      { name: "description", content: "Search, filter and duplicate saved LED display quotes." },
      { property: "og:title", content: "Quote Library — Soblabs LED Configurator" },
      { property: "og:description", content: "All saved LED display quotes with status tracking." },
    ],
  }),
  component: QuoteLibrary,
});

const STATUSES = ["all", "draft", "issued", "accepted", "declined"] as const;

function QuoteLibrary() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  const { data: quotes } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Quote[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (quotes ?? []).filter((q) => {
      if (status !== "all" && q.status !== status) return false;
      if (!term) return true;
      return [q.quote_number, q.customer_company, q.project_name, q.contact_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [quotes, search, status]);

  async function newQuote() {
    if (!me) return;
    const quote = await createQuote(me.userId);
    navigate({ to: "/quotes/$quoteId", params: { quoteId: quote.id } });
  }

  async function duplicate(quote: Quote, refresh: boolean) {
    if (!me) return;
    try {
      const { data: items, error } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quote.id);
      if (error) throw error;
      const copy = await duplicateQuote(
        quote,
        (items ?? []) as unknown as QuoteItemRow[],
        me.userId,
        refresh,
      );
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(`Duplicated as ${copy.quote_number} (draft). The original is unchanged.`);
      navigate({ to: "/quotes/$quoteId", params: { quoteId: copy.id } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">Quote Library</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search quote number, customer, project…"
          className="ml-auto w-72 rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
          className="rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm capitalize outline-none"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-popover">
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <button
          onClick={newQuote}
          className="rounded-lg bg-gradient-to-br from-brand to-accent px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          + New quote
        </button>
      </div>

      <div className="glass mt-5 overflow-hidden">
        <div className="grid grid-cols-[150px_1.4fr_1fr_130px_120px_150px] gap-3 border-b border-border px-5 py-2.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>Quote #</span>
          <span>Customer / Project</span>
          <span>Configuration</span>
          <span>Total</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-border">
          {filtered.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">No quotes match this filter.</p>
          )}
          {filtered.map((q) => {
            const snap = q.snapshot as {
              total?: number;
              productLabel?: string;
              layoutLabel?: string;
            };
            return (
              <div
                key={q.id}
                className="grid grid-cols-[150px_1.4fr_1fr_130px_120px_150px] items-center gap-3 px-5 py-3 text-[13px] hover:bg-white/[0.03]"
              >
                <Link
                  to="/quotes/$quoteId"
                  params={{ quoteId: q.id }}
                  className="num text-muted-foreground hover:text-brand"
                >
                  {q.quote_number} · R{q.revision}
                  {q.is_demo && <span className="ml-1 text-[10px] text-amber">DEMO</span>}
                </Link>
                <Link to="/quotes/$quoteId" params={{ quoteId: q.id }} className="font-medium">
                  {q.customer_company || "—"} · {q.project_name || "Untitled"}
                </Link>
                <span className="num text-xs text-muted-foreground">
                  {snap.productLabel || "Not configured"}
                  {snap.layoutLabel ? ` · ${snap.layoutLabel}` : ""}
                </span>
                <span className="num text-xs">
                  {snap.total != null ? formatMoney(snap.total, q.currency) : "—"}
                </span>
                <span
                  className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLES[q.status]}`}
                >
                  {q.status}
                </span>
                <span className="flex justify-end gap-2 text-xs">
                  <button onClick={() => duplicate(q, false)} className="text-brand hover:underline">
                    Duplicate
                  </button>
                  <button
                    onClick={() => duplicate(q, true)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Duplicate and refresh costs from the current catalogue"
                  >
                    + refresh
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
