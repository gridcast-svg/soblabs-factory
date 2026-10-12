import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { splitRecord } from "@/lib/record-utils";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Business Settings — Soblabs LED Configurator" },
      { name: "description", content: "Company details, logo, default exchange rate, tax and terms." },
      { property: "og:title", content: "Business Settings — Soblabs" },
      { property: "og:description", content: "Defaults applied to every new Soblabs quotation." },
    ],
  }),
  component: SettingsPage,
});

type SettingsRow = Record<string, string | number | null>;

const FIELDS: [string, string, string?][] = [
  ["company_name", "Company name"],
  ["address", "Address"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["website", "Website"],
  ["default_currency", "Default output currency (USD / CAD)"],
  ["default_exchange_rate", "Default exchange rate — 1 USD = X CAD", "number"],
  ["default_tax_rate", "Default tax rate (%)", "number"],
  ["quote_validity_days", "Quote validity (days)", "number"],
  ["default_payment_terms", "Default payment terms"],
  ["default_lead_time", "Default lead time"],
  ["default_warranty", "Default warranty"],
  ["default_exclusions", "Default exclusions"],
];

function SettingsPage() {
  const { data: me } = useCurrentUser();
  const [form, setForm] = useState<SettingsRow | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["business-settings"],
    queryFn: async () => {
      const { data: row, error } = await supabase.from("business_settings").select("*").maybeSingle();
      if (error) throw error;
      return row as unknown as SettingsRow;
    },
  });

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const logoPath = form?.["logo_url"];

  useEffect(() => {
    if (!logoPath) {
      setLogoPreview(null);
      return;
    }
    supabase.storage
      .from("branding")
      .createSignedUrl(String(logoPath), 600)
      .then(({ data: signed }) => setLogoPreview(signed?.signedUrl ?? null));
  }, [logoPath]);

  if (!me?.isAdmin) {
    return <p className="glass p-4 text-sm text-muted-foreground">Administrators only.</p>;
  }
  if (!form) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const set = (k: string, v: string | number | null) => setForm({ ...form, [k]: v });

  async function save() {
    const { payload } = splitRecord({ ...(form as Record<string, unknown>) });
    delete payload["id"];
    const { error } = await supabase
      .from("business_settings")
      .update(payload as never)
      .eq("id", true);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Business settings saved.");
  }

  async function uploadLogo(file: File) {
    const path = `logo-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    set("logo_url", path);
    toast.success("Logo uploaded — remember to save.");
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">Business Settings</h1>
      <div className="glass grid gap-3 p-4 md:grid-cols-2">
        {FIELDS.map(([key, label, type]) => (
          <label key={key} className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </span>
            <input
              type={type ?? "text"}
              value={(form[key] ?? "") as string | number}
              onChange={(e) => set(key, type === "number" ? Number(e.target.value) : e.target.value)}
              className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        ))}
        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Logo (optional — the Soblabs text wordmark is used until one is uploaded)
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            className="text-xs text-muted-foreground"
          />
          {logoPreview && (
            <img src={logoPreview} alt="Company logo" className="mt-2 h-10 w-auto object-contain" />
          )}
        </label>
      </div>
      <button
        onClick={save}
        className="rounded-lg bg-gradient-to-br from-brand to-accent px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Save settings
      </button>
    </div>
  );
}
