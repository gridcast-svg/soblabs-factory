
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','salesperson');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE POLICY "profiles readable by self and admins" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles self update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles insert self" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "roles readable by self and admins" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN (SELECT count(*) FROM public.user_roles) = 0 THEN 'admin'::public.app_role ELSE 'salesperson'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- CATALOGUES
CREATE TABLE public.manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.led_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE RESTRICT,
  series text,
  model text NOT NULL,
  sku text,
  description text,
  is_demo boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  application text NOT NULL DEFAULT 'indoor',
  pixel_pitch_mm numeric(8,3) NOT NULL,
  cabinet_width_mm numeric(10,2) NOT NULL,
  cabinet_height_mm numeric(10,2) NOT NULL,
  cabinet_depth_mm numeric(10,2),
  cabinet_pixel_width integer NOT NULL,
  cabinet_pixel_height integer NOT NULL,
  diode_technology text,
  diode_manufacturer text,
  diode_package text,
  diode_notes text,
  power_supply_brand text,
  power_supply_qty integer,
  power_supply_redundancy text,
  power_typical_w numeric(10,2),
  power_max_w numeric(10,2),
  cabinet_weight_kg numeric(10,3),
  brightness_nits integer,
  refresh_rate_hz integer,
  service_access text,
  ip_rating text,
  supplier_cost_per_sqm numeric(14,4),
  supplier_currency text NOT NULL DEFAULT 'USD',
  receiver_card_included boolean NOT NULL DEFAULT false,
  receiver_cards_per_cabinet integer NOT NULL DEFAULT 1,
  integrated_processing boolean NOT NULL DEFAULT false,
  processing_requirements text,
  datasheet_url text,
  spec_source text,
  last_verified_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER led_products_touch BEFORE UPDATE ON public.led_products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.processors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  manufacturer_name text,
  model text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  is_demo boolean NOT NULL DEFAULT false,
  max_pixels bigint,
  max_pixel_width integer,
  max_pixel_height integer,
  outputs text,
  cost numeric(14,4),
  cost_currency text NOT NULL DEFAULT 'USD',
  spec_notes text,
  datasheet_url text,
  last_verified_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER processors_touch BEFORE UPDATE ON public.processors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.receiver_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  manufacturer_name text,
  model text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  is_demo boolean NOT NULL DEFAULT false,
  max_pixels bigint,
  max_pixel_width integer,
  max_pixel_height integer,
  cost numeric(14,4),
  cost_currency text NOT NULL DEFAULT 'USD',
  spec_notes text,
  datasheet_url text,
  last_verified_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER receiver_cards_touch BEFORE UPDATE ON public.receiver_cards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.led_receiver_compat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  led_product_id uuid NOT NULL REFERENCES public.led_products(id) ON DELETE CASCADE,
  receiver_card_id uuid NOT NULL REFERENCES public.receiver_cards(id) ON DELETE CASCADE,
  verified boolean NOT NULL DEFAULT false,
  notes text,
  UNIQUE (led_product_id, receiver_card_id)
);

CREATE TABLE public.receiver_processor_compat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receiver_card_id uuid NOT NULL REFERENCES public.receiver_cards(id) ON DELETE CASCADE,
  processor_id uuid NOT NULL REFERENCES public.processors(id) ON DELETE CASCADE,
  verified boolean NOT NULL DEFAULT false,
  notes text,
  UNIQUE (receiver_card_id, processor_id)
);

CREATE TABLE public.business_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  company_name text NOT NULL DEFAULT 'Soblabs',
  logo_url text,
  address text,
  phone text,
  email text,
  website text,
  default_currency text NOT NULL DEFAULT 'CAD',
  default_exchange_rate numeric(12,6) NOT NULL DEFAULT 1.35,
  default_tax_rate numeric(6,3) NOT NULL DEFAULT 0,
  default_payment_terms text,
  default_lead_time text,
  default_warranty text,
  default_exclusions text,
  quote_validity_days integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.business_settings (id) VALUES (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturers, public.led_products, public.processors, public.receiver_cards, public.led_receiver_compat, public.receiver_processor_compat, public.business_settings TO authenticated;
GRANT ALL ON public.manufacturers, public.led_products, public.processors, public.receiver_cards, public.led_receiver_compat, public.receiver_processor_compat, public.business_settings TO service_role;

ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.led_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiver_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.led_receiver_compat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiver_processor_compat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manufacturers read" ON public.manufacturers FOR SELECT TO authenticated USING (true);
CREATE POLICY "manufacturers admin write" ON public.manufacturers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "led read" ON public.led_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "led admin write" ON public.led_products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "proc read" ON public.processors FOR SELECT TO authenticated USING (true);
CREATE POLICY "proc admin write" ON public.processors FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "rc read" ON public.receiver_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "rc admin write" ON public.receiver_cards FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "lrc read" ON public.led_receiver_compat FOR SELECT TO authenticated USING (true);
CREATE POLICY "lrc admin write" ON public.led_receiver_compat FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "rpc read" ON public.receiver_processor_compat FOR SELECT TO authenticated USING (true);
CREATE POLICY "rpc admin write" ON public.receiver_processor_compat FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "settings read" ON public.business_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.business_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- QUOTES
CREATE SEQUENCE public.quote_number_seq START 1000;
CREATE OR REPLACE FUNCTION public.next_quote_number()
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'SQ-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.quote_number_seq')::text, 4, '0')
$$;
GRANT EXECUTE ON FUNCTION public.next_quote_number() TO authenticated;

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text NOT NULL UNIQUE,
  revision integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_demo boolean NOT NULL DEFAULT false,
  customer_company text,
  contact_name text,
  contact_email text,
  contact_phone text,
  project_name text,
  currency text NOT NULL DEFAULT 'CAD',
  exchange_rate numeric(12,6),
  exchange_rate_date date,
  tax_rate numeric(6,3) NOT NULL DEFAULT 0,
  markup_pct numeric(8,4) NOT NULL DEFAULT 25,
  margin_pct numeric(8,4) NOT NULL DEFAULT 20,
  pricing_mode text NOT NULL DEFAULT 'markup',
  issue_date date,
  valid_until date,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_terms text,
  lead_time text,
  warranty text,
  exclusions text,
  notes text,
  pdf_path text,
  parent_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER quotes_touch BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL DEFAULT 1,
  unit_cost numeric(14,4) NOT NULL DEFAULT 0,
  cost_currency text NOT NULL DEFAULT 'USD',
  taxable boolean NOT NULL DEFAULT true,
  markup_override numeric(8,4),
  margin_override numeric(8,4),
  included_in_led boolean NOT NULL DEFAULT false,
  freight_mode text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes, public.quote_items TO authenticated;
GRANT ALL ON public.quotes, public.quote_items TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes owner or admin select" ON public.quotes FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "quotes insert own" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "quotes update own or admin" ON public.quotes FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin()) WITH CHECK (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "quotes delete own or admin" ON public.quotes FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "quote items via quote" ON public.quote_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND (q.owner_id = auth.uid() OR public.is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND (q.owner_id = auth.uid() OR public.is_admin())));

CREATE INDEX quotes_owner_idx ON public.quotes(owner_id);
CREATE INDEX quote_items_quote_idx ON public.quote_items(quote_id);

-- SEED: manufacturers only (no fabricated specs) + one clearly fictional demo product set
INSERT INTO public.manufacturers (name) VALUES
  ('Unilumin'),('Absen'),('MoonTechno'),('Sony'),('Planar'),('Samsung'),('NovaStar'),('Colorlight'),('Soblabs Demo');

INSERT INTO public.led_products (
  manufacturer_id, series, model, sku, description, is_demo, application,
  pixel_pitch_mm, cabinet_width_mm, cabinet_height_mm, cabinet_depth_mm,
  cabinet_pixel_width, cabinet_pixel_height, diode_technology, diode_manufacturer, diode_package,
  power_supply_brand, power_supply_qty, power_typical_w, power_max_w, cabinet_weight_kg,
  brightness_nits, refresh_rate_hz, service_access, ip_rating,
  supplier_cost_per_sqm, supplier_currency, receiver_cards_per_cabinet, receiver_card_included,
  spec_source, last_verified_at
) VALUES (
  (SELECT id FROM public.manufacturers WHERE name = 'Soblabs Demo'),
  'DEMO Series', 'DEMO-P2.5-500', 'DEMO-P25-500SQ',
  'FICTIONAL DEMONSTRATION PRODUCT — specifications are illustrative only and must not be quoted to a client.',
  true, 'indoor',
  2.5, 500, 500, 80,
  200, 200, 'SMD (demo)', 'Not specified', 'Not specified',
  'Not specified', 2, 150, 450, 8.5,
  800, 3840, 'Front and rear (demo)', 'IP31 (demo)',
  1000, 'USD', 1, false,
  'Fictional demonstration data', CURRENT_DATE
);

INSERT INTO public.receiver_cards (manufacturer_id, manufacturer_name, model, description, is_demo, max_pixels, max_pixel_width, max_pixel_height, cost, cost_currency, spec_notes)
VALUES ((SELECT id FROM public.manufacturers WHERE name='Soblabs Demo'), 'Soblabs Demo', 'DEMO-RX-256', 'FICTIONAL demonstration receiver card.', true, 655360, 1024, 640, 60, 'USD', 'Demonstration data only.');

INSERT INTO public.processors (manufacturer_id, manufacturer_name, model, description, is_demo, max_pixels, max_pixel_width, max_pixel_height, cost, cost_currency, spec_notes)
VALUES ((SELECT id FROM public.manufacturers WHERE name='Soblabs Demo'), 'Soblabs Demo', 'DEMO-PROC-4K', 'FICTIONAL demonstration processor.', true, 8847360, 4096, 2160, 1800, 'USD', 'Demonstration data only.');

INSERT INTO public.led_receiver_compat (led_product_id, receiver_card_id, verified, notes)
SELECT l.id, r.id, true, 'Demonstration pairing' FROM public.led_products l, public.receiver_cards r WHERE l.is_demo AND r.is_demo;

INSERT INTO public.receiver_processor_compat (receiver_card_id, processor_id, verified, notes)
SELECT r.id, p.id, true, 'Demonstration pairing' FROM public.receiver_cards r, public.processors p WHERE r.is_demo AND p.is_demo;
