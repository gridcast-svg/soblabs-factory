-- Owner-scoped workspace persistence. Sharing/teams are a future migration.
CREATE TABLE public.business_workspaces (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object' AND state->>'version' = '1'),
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_workspaces ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.business_workspaces TO authenticated;
CREATE POLICY "owner reads workspace with MFA" ON public.business_workspaces
FOR SELECT TO authenticated USING (
  owner_id = auth.uid() AND auth.jwt()->>'aal' = 'aal2'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active)
);

-- Optimistic concurrency: a stale browser cannot silently overwrite another save.
CREATE FUNCTION public.save_business_workspace(new_state jsonb, expected_revision bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_revision bigint;
BEGIN
  IF auth.uid() IS NULL OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active)
  THEN RAISE EXCEPTION 'Active account and MFA required'; END IF;
  IF jsonb_typeof(new_state) IS DISTINCT FROM 'object' OR new_state->>'version' IS DISTINCT FROM '1'
    OR jsonb_typeof(new_state->'projects') IS DISTINCT FROM 'array'
    OR jsonb_typeof(new_state->'contacts') IS DISTINCT FROM 'array'
    OR octet_length(new_state::text) > 15000000
  THEN RAISE EXCEPTION 'Invalid workspace'; END IF;
  IF expected_revision = 0 THEN
    INSERT INTO public.business_workspaces(owner_id,state,revision)
    VALUES(auth.uid(),new_state,1) ON CONFLICT DO NOTHING RETURNING revision INTO next_revision;
  ELSE
    UPDATE public.business_workspaces SET state=new_state, revision=revision+1, updated_at=now()
    WHERE owner_id=auth.uid() AND revision=expected_revision RETURNING revision INTO next_revision;
  END IF;
  IF next_revision IS NULL THEN RAISE EXCEPTION 'Workspace changed elsewhere. Export your changes and reload before retrying.'; END IF;
  RETURN next_revision;
END;
$$;
REVOKE ALL ON FUNCTION public.save_business_workspace(jsonb,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_business_workspace(jsonb,bigint) TO authenticated;

CREATE FUNCTION public.active_account() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active)
$$;
REVOKE ALL ON FUNCTION public.active_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.active_account() TO authenticated;

-- Apply MFA to existing catalogue/quote/PDF policies as a restrictive requirement.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND tablename IN ('profiles','user_roles','manufacturers','led_products','processors','receiver_cards','led_receiver_compat','receiver_processor_compat','business_settings','quotes','quote_items') AND rowsecurity LOOP
    EXECUTE format('CREATE POLICY "require active MFA session" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (auth.jwt()->>''aal'' = ''aal2'' AND public.active_account()) WITH CHECK (auth.jwt()->>''aal'' = ''aal2'' AND public.active_account())',t.tablename);
  END LOOP;
END $$;
CREATE POLICY "require MFA for quote files" ON storage.objects AS RESTRICTIVE
FOR ALL TO authenticated USING (bucket_id <> 'quote-pdfs' OR (auth.jwt()->>'aal' = 'aal2' AND public.active_account()))
WITH CHECK (bucket_id <> 'quote-pdfs' OR (auth.jwt()->>'aal' = 'aal2' AND public.active_account()));

-- Self-service profile changes must not reactivate an account or alter its email.
CREATE FUNCTION public.guard_profile_admin_fields() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('postgres','service_role','supabase_admin')
    AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.email IS DISTINCT FROM OLD.email)
  THEN RAISE EXCEPTION 'Profile account fields require the administrative service'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_guard_self_update ON public.profiles;
DROP POLICY IF EXISTS "profiles insert self" ON public.profiles;
CREATE TRIGGER protect_profile_admin_fields BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_admin_fields();

-- Never grant administrator status merely for being the first signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id,email,full_name)
  VALUES (NEW.id,NEW.email,NEW.raw_user_meta_data->>'full_name') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id,role) VALUES (NEW.id,'salesperson') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
