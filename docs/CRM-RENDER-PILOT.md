# CRM Render pilot

The Comp AI CRM source is packaged in `services/crm`, separately from Factory's current web app. The upstream MIT license and exact source revision are preserved. Basic CRM onboarding does not require a Context.dev key; optional research remains in Settings. No AI worker or mailbox schedule is deployed in this pilot.

## Proposed resources

- `soblabs-crm-api-sandbox`: Docker API, database migrations at startup, `/health` readiness.
- `soblabs-crm-web-sandbox`: Docker Next.js web app.
- `soblabs-crm-sandbox-db`: dedicated PostgreSQL, containing fictional test records initially.

Configuration is in `deploy/crm.render.yaml`. Both images use Bun 1.3.12 and Node 24.19.0. Web uses the supported Webpack build. Docker build contexts exclude .env files, dependencies, generated files, credentials and local datasets. Containers run as the unprivileged node user. The cloud CA build secret is optional and only supports this development environment's TLS proxy; Render does not need that secret for ordinary public downloads.

The manifest proposes free plans for evaluation. Check current account limits, PostgreSQL availability/expiry and plan terms before creating resources. Free services can sleep. Do not use the pilot for production records or assume backups/persistence beyond the provider's free-plan terms. Paid resources require a separate plan decision.

## Browser authentication origins

Use two HTTPS sandbox hostnames under soblabs.ca, proposed:

- Web: `https://crm-sandbox.soblabs.ca`
- API: `https://crm-api-sandbox.soblabs.ca`

These hostnames are proposed, not created. Set custom domains in Render and use the exact DNS records it supplies at GoDaddy. Verify TLS before OAuth testing.

Both services need `APP_URL` set to the web origin and `API_URL` set to the API origin. Set `AUTH_COOKIE_DOMAIN=.soblabs.ca`. Set these values before building the web image: Next.js embeds the public API origin during build, so changing it requires a rebuild. Render supplies matching environment variables as Docker build arguments for the declared `API_URL` and `APP_URL` arguments.

Do not test the two-service login across separate default onrender.com origins with this cookie-domain configuration. It will not store the soblabs.ca session cookie there. API health can still be checked on its Render-provided URL.

## Secure runtime settings

Both services need the same persistent PostgreSQL connection, the same independently generated `BETTER_AUTH_SECRET` (32+ characters), and the Microsoft registration settings. Enter secrets in Render's environment settings or an environment group; never store them in Git or chat. Codex cloud settings do not automatically configure Render.

- `MICROSOFT_CLIENT_ID=7876357c-f916-4a7b-a927-207ee479d824`
- `MICROSOFT_TENANT_ID=6e251351-5ca8-49aa-9167-872b0e540566`
- `MICROSOFT_CLIENT_SECRET`: secure value from Entra.
- `ALLOWED_SIGN_IN=shawn@soblabs.ca` initially.
- `CRM_TELEMETRY_DISABLED=1`.

Do not reuse local development authentication secrets or dev-session helpers in the hosted pilot. The test helper is never a hosted login path. The first real Microsoft user becomes workspace owner; keep the allowlist narrow during setup.

Add the Microsoft Web redirect URI only after the API domain resolves and TLS works:

`https://crm-api-sandbox.soblabs.ca/api/auth/callback/microsoft`

Verify the actual chosen hostname rather than blindly copying this proposed value. Confirm delegated Graph User.Read/Mail.Read permissions and MFA enforcement with an actual Microsoft sign-in. Microsoft sign-in alone does not guarantee MFA. Secret expiry requires a rotation reminder.

## Deployment order

1. Use the user's Render plugin when its tools are available. The plugin is installed by the user but not exposed in the current session; no hosted resources are created yet.
2. Deploy from the review branch `codex/crm-render-pilot` in gridcast-svg/soblabs-factory. Do not change the existing Factory service to point at the CRM Dockerfiles.
3. Create the dedicated database, API and web services using the manifest. Verify free plans and supply secure settings, then configure the custom domains/DNS.
4. Confirm API `/health` reports database up and anonymous CRM routes return 401. Confirm web redirects to sign-in.
5. Register the confirmed API callback in Entra, sign in as Shawn, verify MFA and cookie persistence, and complete workspace setup without a research key.
6. Test a fictional company, contact and CAD deal. Import the saved Zoho records only after identity mapping and persistence checks pass.
7. Add a guarded mailbox schedule deliberately after reviewing real-mail access. Outlook sync is forward-only; initial synchronization does not backfill historical mail. No automatic daily CRM sync runs yet.

Factory project/BOM/drawing integrations and matching Soblabs visual styling remain later work. This pilot does not replace Factory's current CRM screen automatically.

## Validation

- Factory TypeScript check, 17 existing tests, and production build pass.
- 28 CRM onboarding tests pass, including the optional research behavior and preserved login/workspace checks.
- The API container build includes OpenSSL and runs as user node.
- Final Docker runtime checks and web-image build results are recorded in the review PR.

Upstream files are imported as published, including existing formatting and line endings. Only the documented Factory-specific onboarding and deployment changes are modified.
