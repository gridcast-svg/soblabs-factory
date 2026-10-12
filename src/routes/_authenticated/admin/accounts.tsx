import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { createAccount, setAccountActive, setAccountRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts — Soblabs LED Configurator" },
      { name: "description", content: "Administrator management of Soblabs sales portal accounts." },
      { property: "og:title", content: "Accounts — Soblabs LED Configurator" },
      { property: "og:description", content: "Create, deactivate and assign roles to team accounts." },
    ],
  }),
  component: Accounts,
});

function Accounts() {
  const { data: me } = useCurrentUser();
  const queryClient = useQueryClient();
  const invite = useServerFn(createAccount);
  const changeRole = useServerFn(setAccountRole);
  const changeActive = useServerFn(setAccountActive);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "salesperson">("salesperson");
  const [busy, setBusy] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        role: roles?.find((r) => r.user_id === p.id)?.role ?? "salesperson",
      }));
    },
  });

  if (!me?.isAdmin) {
    return <p className="glass p-4 text-sm text-muted-foreground">Administrators only.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await invite({ data: { email, fullName, role, password } });
      toast.success("Account created. Share the temporary password securely.");
      setEmail("");
      setFullName("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">Accounts</h1>

      <form onSubmit={submit} className="glass grid gap-3 p-4 md:grid-cols-5">
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
        <input
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={input}
        />
        <input
          placeholder="Temporary password (10+ chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={input}>
          <option value="salesperson" className="bg-popover">
            Salesperson
          </option>
          <option value="admin" className="bg-popover">
            Administrator
          </option>
        </select>
        <button
          disabled={busy}
          className="rounded-lg bg-gradient-to-br from-brand to-accent px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Create account
        </button>
      </form>

      <div className="glass overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1fr_150px_120px_150px] gap-3 border-b border-border px-5 py-2.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>Email</span>
          <span>Name</span>
          <span>Role</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-border">
          {(accounts ?? []).map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-[1.5fr_1fr_150px_120px_150px] items-center gap-3 px-5 py-3 text-sm"
            >
              <span>{a.email}</span>
              <span className="text-muted-foreground">{a.full_name ?? "—"}</span>
              <select
                value={a.role}
                disabled={a.id === me.userId}
                onChange={async (e) => {
                  try {
                    await changeRole({
                      data: { userId: a.id, role: e.target.value as "admin" | "salesperson" },
                    });
                    queryClient.invalidateQueries({ queryKey: ["accounts"] });
                    toast.success("Role updated");
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
                className="rounded-lg border border-input bg-secondary/40 px-2 py-1 text-xs"
              >
                <option value="salesperson" className="bg-popover">
                  Salesperson
                </option>
                <option value="admin" className="bg-popover">
                  Administrator
                </option>
              </select>
              <span className={a.is_active ? "text-mint" : "text-destructive"}>
                {a.is_active ? "Active" : "Deactivated"}
              </span>
              <button
                disabled={a.id === me.userId}
                onClick={async () => {
                  try {
                    await changeActive({ data: { userId: a.id, isActive: !a.is_active } });
                    queryClient.invalidateQueries({ queryKey: ["accounts"] });
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
                className="text-right text-xs text-brand hover:underline disabled:opacity-40"
              >
                {a.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Roles are stored separately from profiles and can only be changed by an administrator — no
        one can promote their own account.
      </p>
    </div>
  );
}

const input =
  "rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
