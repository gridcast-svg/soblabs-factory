# Soblabs Factory

A desktop business workspace for LED and AV system projects, using the supplied Soblabs display builder as its foundation.

## Development

Use Node 24 and npm. `package-lock.json` is the canonical dependency lockfile.

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 3000
```

The root route is a clearly labelled local design sandbox with fictional example equipment. It supports projects, CRM contacts, BOM editing and Excel import/export, schematic and rack design, LED geometry, and manual PLAUD PDF intake.

The account workspace requires Supabase configuration, database migrations, an active account and authenticator MFA. No backend credentials are included. Microsoft 365, SharePoint sync, daily CRM automation, purchasing, and team sharing remain to be implemented.

See [implementation and deployment notes](docs/IMPLEMENTATION.md) for capabilities, limitations, security prerequisites, and validation.

```sh
npm run typecheck
npm test
# Start the development server first; install or select Chromium.
npm run test:browser
npm run build
```

The supplied application’s original [LED specification](docs/ORIGINAL-LED-SPEC.md) is retained for reference.
