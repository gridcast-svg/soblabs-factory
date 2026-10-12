import type { Currency, LengthUnit, PricingMode } from "./led-calc";

export type LedProduct = {
  id: string;
  manufacturer_id: string;
  series: string | null;
  model: string;
  sku: string | null;
  description: string | null;
  is_demo: boolean;
  status: string;
  application: string;
  pixel_pitch_mm: number;
  cabinet_width_mm: number;
  cabinet_height_mm: number;
  cabinet_depth_mm: number | null;
  cabinet_pixel_width: number;
  cabinet_pixel_height: number;
  diode_technology: string | null;
  diode_manufacturer: string | null;
  diode_package: string | null;
  diode_notes: string | null;
  power_supply_brand: string | null;
  power_supply_qty: number | null;
  power_supply_redundancy: string | null;
  power_typical_w: number | null;
  power_max_w: number | null;
  cabinet_weight_kg: number | null;
  brightness_nits: number | null;
  refresh_rate_hz: number | null;
  service_access: string | null;
  ip_rating: string | null;
  supplier_cost_per_sqm: number | null;
  supplier_currency: Currency;
  receiver_card_included: boolean;
  receiver_cards_per_cabinet: number;
  integrated_processing: boolean;
  processing_requirements: string | null;
  datasheet_url: string | null;
  spec_source: string | null;
  last_verified_at: string | null;
  manufacturers?: { name: string } | null;
};

export type Hardware = {
  id: string;
  manufacturer_name: string | null;
  model: string;
  description: string | null;
  status: string;
  is_demo: boolean;
  max_pixels: number | null;
  max_pixel_width: number | null;
  max_pixel_height: number | null;
  cost: number | null;
  cost_currency: Currency;
  spec_notes: string | null;
  datasheet_url: string | null;
  last_verified_at: string | null;
};

export type QuoteConfig = {
  ledProductId: string | null;
  unit: LengthUnit;
  mode: "wall" | "desired";
  wallWidth: number;
  wallHeight: number;
  clearanceX: number;
  clearanceY: number;
  targetWidth: number;
  targetHeight: number;
  columns: number;
  rows: number;
  mountingDepthMm: number | null;
  receiverCardId: string | null;
  processorId: string | null;
  processorQty: number;
};

export const defaultConfig: QuoteConfig = {
  ledProductId: null,
  unit: "m",
  mode: "wall",
  wallWidth: 6,
  wallHeight: 3,
  clearanceX: 0,
  clearanceY: 0,
  targetWidth: 5,
  targetHeight: 3,
  columns: 0,
  rows: 0,
  mountingDepthMm: null,
  receiverCardId: null,
  processorId: null,
  processorQty: 1,
};

export type Quote = {
  id: string;
  quote_number: string;
  revision: number;
  status: "draft" | "issued" | "accepted" | "declined";
  owner_id: string;
  is_demo: boolean;
  customer_company: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  project_name: string | null;
  currency: Currency;
  exchange_rate: number | null;
  exchange_rate_date: string | null;
  tax_rate: number;
  markup_pct: number;
  margin_pct: number;
  pricing_mode: PricingMode;
  issue_date: string | null;
  valid_until: string | null;
  config: QuoteConfig;
  snapshot: Record<string, unknown>;
  payment_terms: string | null;
  lead_time: string | null;
  warranty: string | null;
  exclusions: string | null;
  notes: string | null;
  pdf_path: string | null;
  parent_quote_id: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteItemRow = {
  id: string;
  quote_id: string;
  category: string;
  description: string;
  quantity: number;
  unit_cost: number;
  cost_currency: Currency;
  taxable: boolean;
  markup_override: number | null;
  margin_override: number | null;
  included_in_led: boolean;
  freight_mode: string | null;
  sort_order: number;
};

export const CATEGORY_LABELS: Record<string, string> = {
  led: "LED cabinets / display",
  processor: "Processor",
  receiver: "Receiver cards",
  mounting: "Mounting structure",
  installation: "Installation",
  spares: "Spare parts",
  freight: "Freight",
  other: "Other charge",
};
