import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";

const navItems = [
  { to: "/workspace", label: "Business Workspace" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/quotes", label: "Quote Library" },
  { to: "/catalogue/led", label: "LED Catalogue" },
  { to: "/catalogue/processors", label: "Processors" },
  { to: "/catalogue/receivers", label: "Receiver Cards" },
] as const;

const adminItems = [
  { to: "/admin/accounts", label: "Admin · Accounts" },
  { to: "/admin/settings", label: "Business Settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const linkClass =
    "rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground";

  return (
    <div className="mx-auto flex max-w-[1500px] gap-6 px-5 py-6 md:px-8">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 lg:flex">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-1">
          <div className="space-y-2">
            <img
              src="/branding/soblabs-logo.png"
              alt="Soblabs"
              width={3494}
              height={900}
              className="h-auto w-44 max-w-full"
            />
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              LED Configurator
            </div>
          </div>
        </Link>

        <nav className="glass flex flex-col gap-1 p-2 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={linkClass}
              activeProps={{
                className: "rounded-lg px-3 py-2.5 bg-white/10 font-medium text-foreground",
              }}
            >
              {item.label}
            </Link>
          ))}
          {me?.isAdmin && (
            <>
              <div className="mx-2 my-1 h-px bg-border" />
              {adminItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={linkClass}
                  activeProps={{
                    className: "rounded-lg px-3 py-2.5 bg-white/10 font-medium text-foreground",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="glass mt-auto p-4">
          <div className="text-sm font-medium">{me?.profile?.full_name || me?.profile?.email}</div>
          <div className="text-[11px] capitalize text-brand/80">
            {me?.role === "admin" ? "Administrator" : "Salesperson"}
          </div>
          <button
            onClick={signOut}
            className="mt-4 w-full rounded-lg border border-border py-2 text-xs text-muted-foreground hover:bg-white/5"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-3 lg:hidden">
          {[...navItems, ...(me?.isAdmin ? adminItems : [])].map((item) => (
            <Link key={item.to} to={item.to} className="text-xs text-muted-foreground">
              {item.label}
            </Link>
          ))}
        </div>
        {children}
      </main>
    </div>
  );
}
