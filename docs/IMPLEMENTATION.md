# Soblabs Factory — first implementation

The supplied Lovable LED configurator is retained, with a desktop business workspace using its dark, cyan, violet, and mint styling.

## Running locally

Use the existing checkout; do not create a worktree unless requested.

Requirements: Node 24 (validated with 24.19.0), npm 11. Run from the repository root:

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 3000
```

The root route is an explicitly labelled design sandbox. It uses browser localStorage, with editable fictional example equipment, and needs no cloud credentials. Use sample information. It is not a production database. Settings provides JSON backup/restore. Save failures are displayed, and invalid backups are refused without replacing existing data.

For a built Node production server, run `npm run build`, then `PORT=3001 HOST=0.0.0.0 npm start`. The imported Vite preview command targeted a different output directory; the scripts now start the actual Nitro Node output. Lovable-hosted builds may override the Nitro deployment target.

## Implemented workflows

- Projects, stage and currency settings, customer labels, and follow-up tasks.
- Read-only Zoho CRM dashboard, manual secure refresh, source links, and deal-to-project links. See [Zoho setup](ZOHO-DASHBOARD.md). Legacy CRM accounts, contacts, leads, deals and activities; reviewed Zoho account imports, account exports, search/filtering, lead conversion and won-deal project handoff. See [CRM details](CRM.md).
- BOM editing, quantity units, per-item currency/FX/markup/tax, optional costs, alternatives, and calculated totals. Missing costs/FX prevent complete pricing.
- XLSX template download, previewed import, export and reimport. Item IDs preserve identity; reimports retain drawing ports/rack definitions and omitted items. Legacy HOEM-style tabs import as alternatives with unknown FX so scope/currency/labour units must be checked. Workbook summary rows are ignored.
- SVG schematic canvas with zoom/pan, grid snapping, equipment ports, directed connections, editable cable IDs/types/lengths, cable schedule, and cable-to-BOM mapping.
- 42U rack front elevation, drag-and-drop/numeric placement and overlap/overflow checks. It shares device identities with the schematic.
- Reconciliation for drawing/BOM quantities, excluded equipment, missing cable items/lengths, basic connector mismatches/direction, and rack space. This does not validate signal capacity, electrical safety, mounting, cable ratings or protocol compatibility.
- SVG drawing exports; generic symbols rather than manufacturer artwork.
- LED wall-fit sizing and drawing using the imported geometry engine; idempotent BOM cabinet quantity updates. Product dimensions/resolution must be verified. Maximum 5,000 drawn cabinets.
- Manual PLAUD text-PDF intake, retained extracted source text/filename, reviewed action-item suggestions, and tasks linked to the meeting. No OCR. Unknown deadlines remain blank. Original PDFs are not stored in the app.

The sandbox supports undo of the last 30 workspace changes. It is one working revision, not an immutable issued-quote/version history. The original authenticated catalogue/quote/PDF tools remain at their existing routes; they have not been tested against a live backend.

## Secure account workspace

`/workspace` requires a Supabase login, an authenticator MFA session, and an active profile. `/mfa` implements TOTP enrollment/challenge. There is no self-registration UI. Disable public signup in Supabase Auth before enabling account mode. Bootstrap the initial administrator through trusted Supabase administration, not by allowing a public first signup. New users receive salesperson status by default.

Copy `.env.example` to `.env.local` and configure the intended Supabase project. Keep credentials out of Git and chat. The public URL/key must be available at Vite build time; the service-role key is server-only and is only needed for account administration.

Apply all files in `supabase/migrations` in timestamp order to the intended project, first on staging. The original migrations are supplied application schema, not verified live state. Review differences if an existing Lovable database has already applied them. The new migration adds:

- Owner-specific JSON workspace storage and MFA/active-account read policy.
- An RPC that saves only the authenticated owner's data, requires MFA and an active profile, and checks the expected revision to prevent stale overwrite.
- Restrictive MFA/active-account policies on existing public RLS tables and private quote PDFs.
- Protection against self-reactivation/profile identity changes; elimination of automatic first-signup administrator privilege.

No live migrations have been applied. No Supabase account has been created. Local PostgreSQL/PGlite tests cover policy enforcement but do not establish production readiness. Before production, verify email/password login, MFA enrollment/challenge, recovery, inactive accounts, two-user direct-request isolation, existing catalogue/quote exports, and deployment backups. Define a recovery procedure for lost authenticators. Account workspace storage is owner-specific; cross-user project sharing and audit history remain to be built.

## Integrations and remaining product work

Microsoft 365, SharePoint background ingestion, AI CRM updates, daily digests, distributor live pricing, purchasing orders/receiving, customer quote generation from this BOM, immutable revisions, multi-rack/rear views, advanced engineering checks and multi-user sharing are not implemented. They are shown as disconnected/planned where exposed.

For Microsoft 365, a chat connector is not a deployed app identity. Next implementation needs a Microsoft Entra app, a chosen access model, least-privilege Microsoft Graph permissions, and the site/library/mailbox scope for soblabs.ca. Start with a selected SharePoint library for PLAUD PDFs; preserve source IDs/version hashes, deduplicate imports, and put uncertain project/contact associations in a review queue. Confirm access to the intended tenant before enabling ingestion. Do not ask for credential values in chat.

## Validation

```sh
npm run typecheck
npm test
npm run test:browser
npm run build
```

Browser tests require a running development server and Chromium. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects an installed Chromium; otherwise install Playwright Chromium through its supported installer. Tests generate synthetic XLSX/PDF fixtures by default. Set `SOBLABS_LEGACY_BOM` and `SOBLABS_PLAUD_PDF` to private sample paths to exercise the supplied user files without committing them.

The first implementation was tested with the user's HOEM workbook and PLAUD PDF. Browser tests check project/BOM persistence, drawing/rack identity, imports, reviewed actions, idempotent cabinet generation, Excel round-trip and unconfigured-login behavior. Model tests cover pricing, missing inputs, alternatives, tax, reconciliation, deletion, backup validation and CRM import/migration workflows. A PostgreSQL/PGlite test runs the new migration against representative prerequisite tables and tests MFA, ownership, active status and save conflicts.
