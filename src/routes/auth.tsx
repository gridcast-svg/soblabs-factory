import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Soblabs LED Configurator" },
      { name: "description", content: "Sign in to the Soblabs LED Configurator sales portal." },
      { property: "og:title", content: "Sign in — Soblabs LED Configurator" },
      { property: "og:description", content: "Invitation-only access for the Soblabs sales team." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function AuthPage() {
  const configured = !!(
    import.meta.env["VITE_SUPABASE_URL"] && import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]
  );
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/workspace", replace: true });
    });
  }, [navigate, configured]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.error("Account backend is not configured. Use the design sandbox for now.");
      return;
    }
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/workspace", replace: true });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.error("Account backend is not configured. Use the design sandbox for now.");
      return;
    }
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("If that account exists, a reset link is on its way.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-md p-8">
        <div className="flex items-center gap-2.5">
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
        </div>

        <h1 className="mt-8 font-display text-xl font-semibold">
          {mode === "signin" ? "Sign in" : "Reset your password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Accounts are created by an administrator."
            : "We'll email you a link to choose a new password."}
        </p>

        {!configured && (
          <p className="mt-5 rounded border border-border p-3 text-sm text-muted-foreground">
            Account backend is not configured. Login and MFA require a Supabase project and the
            included database migrations.{" "}
            <Link to="/" className="text-brand">
              Open the design sandbox
            </Link>
            .
          </p>
        )}
        <form onSubmit={mode === "signin" ? handleSignIn : handleForgot} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Email
            </span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          {mode === "signin" && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Password
              </span>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={busy || !configured}
            className="w-full rounded-lg bg-gradient-to-br from-brand to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Send reset link"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-xs">
          <button
            onClick={() => setMode(mode === "signin" ? "forgot" : "signin")}
            className="text-brand hover:underline"
          >
            {mode === "signin" ? "Forgot password?" : "Back to sign in"}
          </button>
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
