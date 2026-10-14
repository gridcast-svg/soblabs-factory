import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const refreshZohoDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { readZohoConfig, assertZohoOwner, refreshZoho } = await import("./zoho.server");
    const config = readZohoConfig();
    if (!config)
      throw new Error(
        "Zoho is not connected. Configure the secure server settings before refreshing.",
      );
    assertZohoOwner(config, context.userId);
    return refreshZoho(config);
  });
