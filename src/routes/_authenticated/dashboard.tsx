import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { createQuote, STATUS_STYLES } from "@/lib/quotes";
import { formatMoney } from "@/lib/led-calc";
import type { Quote } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Soblabs LED Configurator" },
      { name: "description", content: "Your recent LED display quotes and pipeline at a glance." },
      { property: "og:title", content: "Dashboard — Soblabs LED Configurator" },
      { property: "og:description", content: "Recent quotes and quick access to the configurator." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();

  const { data: quotes } = useQuery({
    queryKey: ["dashboard-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as unknown as Quote[];
    },
  });

  async function newQuote() {
    if (!me) return;
    try {
      const quote = await createQuote(me.userId);
      navigate({ to: "/quotes/$quoteId", params: { quoteId: quote.id } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const mine = quotes ?? [];
  const openCount = mine.filter((q) => q.status === "draft" || q.status === "issued").length;
  const totalValue = mine.reduce(
    (sum, q) => sum + Number((q.snapshot as { total?: number })?.total ?? 0),
    0,
  );
  const accepted = mine.filter((q) => q.status === "accepted").length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Welcome back{me?.profile?.full_name ? `, ${me.profile.full_name}` : ""} —{" "}
            {me?.isAdmin ? "you can see every quote." : "these are your quotes."}
          </p>
        </div>
        <button
          onClick={newQuote}
          className="ml-auto rounded-lg bg-gradient-to-br from-brand to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90"
        >
          + Create Quote
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Recent quotes" value={String(mine.length)} />
        <Stat label="Open (draft / issued)" value={String(openCount)} />
        <Stat label="Accepted" value={String(accepted)} />
        <Stat
          label="Recent value"
          value={formatMoney(totalValue, mine[0]?.currency ?? "CAD")}
          hint="Sum of saved quote totals shown"
        />
      </div>

      <div className="glass mt-4 p-4">
        <div className="flex items-center">
          <h2 className="font-display font-semibold">Recent quotes</h2>
          <Link to="/quotes" className="ml-auto text-xs text-brand hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {mine.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No quotes yet. Create your first quote to get started.
            </p>
          )}
          {mine.map((q) => (
            <Link
              key={q.id}
              to="/quotes/$quoteId"
              params={{ quoteId: q.id }}
              className="rounded-lg border border-border bg-white/[0.02] p-3 hover:border-brand/40 hover:bg-white/5"
            >
              <div className="flex items-center gap-2">
                <span className="num text-xs font-medium">
                  {q.quote_number} · R{q.revision}
                </span>
                {q.is_demo && (
                  <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] text-amber">
                    DEMO
                  </span>
                )}
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[10px] capitalize ${STATUS_STYLES[q.status]}`}
                >
                  {q.status}
                </span>
              </div>
              <div className="mt-1 text-sm text-foreground/80">
                {q.customer_company || "No customer yet"} — {q.project_name || "Untitled project"}
              </div>
              <div className="num mt-1 text-xs text-muted-foreground">
                {formatMoney(Number((q.snapshot as { total?: number })?.total ?? 0), q.currency)}{" "}
                {q.currency}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass p-4">
      <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className="num mt-2 font-display text-3xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
