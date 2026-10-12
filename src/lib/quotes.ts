import { supabase } from "@/integrations/supabase/client";
import { defaultConfig, type Quote, type QuoteItemRow } from "./types";

export async function nextQuoteNumber(): Promise<string> {
  const { data, error } = await supabase.rpc("next_quote_number");
  if (error) throw error;
  return data as unknown as string;
}

export async function createQuote(ownerId: string): Promise<Quote> {
  const [{ data: settings }, quoteNumber] = await Promise.all([
    supabase.from("business_settings").select("*").maybeSingle(),
    nextQuoteNumber(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const validity = settings?.quote_validity_days ?? 30;
  const validUntil = new Date(Date.now() + validity * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      quote_number: quoteNumber,
      owner_id: ownerId,
      status: "draft",
      currency: settings?.default_currency ?? "CAD",
      exchange_rate: settings?.default_exchange_rate ?? 1.35,
      exchange_rate_date: today,
      tax_rate: settings?.default_tax_rate ?? 0,
      issue_date: today,
      valid_until: validUntil,
      payment_terms: settings?.default_payment_terms ?? null,
      lead_time: settings?.default_lead_time ?? null,
      warranty: settings?.default_warranty ?? null,
      exclusions: settings?.default_exclusions ?? null,
      config: defaultConfig,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Quote;
}

/** Duplicate a quote as a fresh draft. Optionally refresh LED cost from the live catalogue. */
export async function duplicateQuote(
  quote: Quote,
  items: QuoteItemRow[],
  ownerId: string,
  refreshFromCatalogue: boolean,
): Promise<Quote> {
  const quoteNumber = await nextQuoteNumber();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("quotes")
    .insert({
      quote_number: quoteNumber,
      revision: 1,
      owner_id: ownerId,
      status: "draft",
      is_demo: quote.is_demo,
      customer_company: quote.customer_company,
      contact_name: quote.contact_name,
      contact_email: quote.contact_email,
      contact_phone: quote.contact_phone,
      project_name: quote.project_name,
      currency: quote.currency,
      exchange_rate: quote.exchange_rate,
      exchange_rate_date: quote.exchange_rate_date,
      tax_rate: quote.tax_rate,
      markup_pct: quote.markup_pct,
      margin_pct: quote.margin_pct,
      pricing_mode: quote.pricing_mode,
      issue_date: today,
      valid_until: quote.valid_until,
      config: quote.config,
      snapshot: (refreshFromCatalogue ? {} : quote.snapshot) as never,
      payment_terms: quote.payment_terms,
      lead_time: quote.lead_time,
      warranty: quote.warranty,
      exclusions: quote.exclusions,
      notes: quote.notes,
      parent_quote_id: quote.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  const created = data as unknown as Quote;

  if (items.length) {
    const { error: itemErr } = await supabase.from("quote_items").insert(
      items.map((i) => ({
        quote_id: created.id,
        category: i.category,
        description: i.description,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        cost_currency: i.cost_currency,
        taxable: i.taxable,
        markup_override: i.markup_override,
        margin_override: i.margin_override,
        included_in_led: i.included_in_led,
        freight_mode: i.freight_mode,
        sort_order: i.sort_order,
      })),
    );
    if (itemErr) throw itemErr;
  }
  return created;
}

export const STATUS_STYLES: Record<string, string> = {
  draft: "bg-white/10 text-muted-foreground",
  issued: "bg-accent/15 text-accent",
  accepted: "bg-mint/15 text-mint",
  declined: "bg-destructive/15 text-destructive",
};
