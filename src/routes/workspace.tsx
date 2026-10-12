import { createFileRoute, redirect } from "@tanstack/react-router";
import { Workspace } from "@/features/workspace/Workspace";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/workspace")({
  ssr: false,
  beforeLoad: async () => {
    if (!import.meta.env["VITE_SUPABASE_URL"] || !import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"])
      throw redirect({ to: "/auth" });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: assurance, error: mfaError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (mfaError || assurance?.currentLevel !== "aal2") throw redirect({ to: "/mfa" });
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError || !profile?.is_active) throw redirect({ to: "/auth" });
  },
  component: () => <Workspace mode="account" />,
});
