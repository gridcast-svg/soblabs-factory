import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("workspace migration enforces MFA, active account, ownership and optimistic concurrency", async () => {
  const db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 GRANT USAGE ON SCHEMA auth, public, storage TO authenticated;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,is_active boolean DEFAULT true,email text,full_name text);
 ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
 CREATE POLICY profile_read ON public.profiles FOR SELECT TO authenticated USING (true);
 CREATE POLICY profile_update ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK(id=auth.uid());
 GRANT UPDATE ON public.profiles TO authenticated;
 CREATE TABLE public.user_roles(user_id uuid,role text,UNIQUE(user_id,role));
 CREATE TABLE public.quotes(id uuid);
 ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON public.quotes TO authenticated;
 CREATE POLICY allow_read ON public.quotes FOR SELECT TO authenticated USING(true);
 CREATE TABLE storage.objects(id uuid,bucket_id text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON storage.objects TO authenticated;
 CREATE POLICY allow_read ON storage.objects FOR SELECT TO authenticated USING(true);
 GRANT SELECT ON public.profiles TO authenticated;
 INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
 INSERT INTO public.profiles(id) SELECT id FROM auth.users;
 INSERT INTO public.quotes VALUES(gen_random_uuid());
 INSERT INTO storage.objects VALUES(gen_random_uuid(),'quote-pdfs');`);
  await db.exec(readFileSync("supabase/migrations/20261012170000_business_workspace.sql", "utf8"));
  const owner = "00000000-0000-0000-0000-000000000001";
  const other = "00000000-0000-0000-0000-000000000002";
  const state = JSON.stringify({ version: 1, projects: [], contacts: [] });
  async function session(id: string, aal: string) {
    await db.exec("RESET ROLE");
    await db.query(
      "SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [id, JSON.stringify({ aal })],
    );
    await db.exec("SET ROLE authenticated");
  }
  await session(owner, "aal1");
  await assert.rejects(
    () => db.query("SELECT public.save_business_workspace($1::jsonb,0)", [state]),
    /MFA required/,
  );
  assert.equal((await db.query("SELECT * FROM public.quotes")).rows.length, 0);
  assert.equal((await db.query("SELECT * FROM storage.objects")).rows.length, 0);
  await session(owner, "aal2");
  await assert.rejects(
    () => db.query("UPDATE public.profiles SET is_active=false WHERE id=$1", [owner]),
    /administrative service/,
  );
  let result = await db.query<{ revision: number }>(
    "SELECT public.save_business_workspace($1::jsonb,0) AS revision",
    [state],
  );
  assert.equal(Number(result.rows[0]!.revision), 1);
  assert.equal((await db.query("SELECT * FROM public.business_workspaces")).rows.length, 1);
  await assert.rejects(
    () => db.query("SELECT public.save_business_workspace($1::jsonb,0)", [state]),
    /changed elsewhere/,
  );
  await session(other, "aal2");
  assert.equal((await db.query("SELECT * FROM public.business_workspaces")).rows.length, 0);
  await session(owner, "aal2");
  result = await db.query("SELECT public.save_business_workspace($1::jsonb,1) AS revision", [
    state,
  ]);
  assert.equal(Number(result.rows[0]!.revision), 2);
  await db.exec("RESET ROLE");
  await db.query("UPDATE public.profiles SET is_active=false WHERE id=$1", [owner]);
  await session(owner, "aal2");
  assert.equal((await db.query("SELECT * FROM public.business_workspaces")).rows.length, 0);
  await assert.rejects(
    () => db.query("SELECT public.save_business_workspace($1::jsonb,2)", [state]),
    /Active account/,
  );
  await db.close();
});
