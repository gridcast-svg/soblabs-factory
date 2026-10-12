import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/mfa")({
  ssr: false,
  beforeLoad: async () => {
    if (!import.meta.env["VITE_SUPABASE_URL"] || !import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"])
      throw redirect({ to: "/auth" });
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Mfa,
});
function Mfa() {
  const navigate = useNavigate();
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!alive) return;
      if (error) setError(error.message);
      else {
        const f = data.totp.find((f) => f.status === "verified");
        if (f) setFactor(f.id);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;
      for (const f of factors.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) throw error;
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Soblabs authenticator",
      });
      if (error) throw error;
      setFactor(data.id);
      setQr(data.totp.qr_code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor, code });
      if (error) throw error;
      navigate({ to: "/workspace", replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-md space-y-5 p-8">
        <h1 className="text-xl">Secure your workspace</h1>
        <p className="text-sm text-muted-foreground">
          An authenticator-app code is required to access account data.
        </p>
        {!factor ? (
          <button
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-3 text-primary-foreground"
            onClick={() => void enroll()}
          >
            Set up authenticator
          </button>
        ) : (
          <>
            {qr && (
              <>
                <p className="text-sm">Scan this QR code with your authenticator app.</p>
                <img
                  alt="Authenticator enrollment QR code"
                  className="mx-auto w-56 rounded bg-white p-3"
                  src={
                    qr.startsWith("data:")
                      ? qr
                      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`
                  }
                />
              </>
            )}
            <form className="space-y-4" onSubmit={verify}>
              <label className="block text-sm">
                Six-digit code
                <input
                  className="mt-2 w-full rounded border border-input bg-secondary p-3"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </label>
              <button
                className="w-full rounded-lg bg-primary px-4 py-3 text-primary-foreground"
                disabled={busy}
              >
                {busy ? "Verifying…" : "Verify and open workspace"}
              </button>
            </form>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Authenticator recovery requires an administrator. Keep an independently secured admin
          recovery procedure before production use.
        </p>
        <button
          className="text-sm text-brand"
          onClick={() => void supabase.auth.signOut().then(() => location.assign("/auth"))}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
