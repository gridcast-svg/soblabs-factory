# Sandbox at factory.soblabs.ca

Prepared, not yet deployed. GoDaddy manages the DNS; a Node-compatible host serves the application. Render is the proposed default. An existing Node host can instead run the same build/start commands.

## Access and data

The sandbox is protected by a separate shared preview username/password over HTTPS. This is review access, not the final user-account/MFA system. The gateway protects every page and asset; only `/healthz` is public and returns a minimal health result. The built application binds to loopback behind the gateway. Missing access settings prevent startup.

The app continues to store sandbox project data in each browser. It has no shared business database, no daily CRM sync, and no connected Microsoft 365/SharePoint account. Use sample data and export JSON backups. Shared preview access does not provide individual permissions, MFA, or an audit trail. Do not load production business data into this review deployment.

## Render setup

1. Make the application source available to the hosting account through the GitHub repository. The current application source is local; it has not been pushed by this deployment task.
2. In Render, connect the repository and create a web service using the included `render.yaml`, or use its equivalent settings. The proposed free plan is for review and may suspend while idle; confirm current availability and limits in the account. No paid plan or subscription has been created.
3. Enter `SANDBOX_USERNAME` and a unique random `SANDBOX_PASSWORD` of at least 16 characters securely in Render environment settings. Do not send credentials in chat or commit them. These are raw runtime values entered at the host, not outbound proxy-secret placeholders.
4. Use Node 24.19.0. Build with `npm ci --include=dev && npm run build`. Start with `npm run start:sandbox`. Render supplies `PORT`; HTTPS terminates at the host. The host health check is `/healthz`.
5. Test the assigned Render hostname: no credentials should produce HTTP 401; correct preview access should load the app. Verify the BOM, drawings, and PDF intake before adding the domain. Automatic deployments are disabled in the proposed blueprint.

## Custom domain and GoDaddy DNS

1. Add `factory.soblabs.ca` as a custom domain on the deployed service.
2. Read the exact DNS target supplied by the host. Do not guess a Render hostname or use this cloud workspace's private IP address.
3. In GoDaddy's DNS editor for `soblabs.ca`, if GoDaddy hosts the authoritative DNS, add:

   | Type  | Name    | Value                                       | TTL     |
   | ----- | ------- | ------------------------------------------- | ------- |
   | CNAME | factory | The exact hostname supplied by the app host | Default |

   The value is a hostname without `https://` or a path. If the host supplies a verification record, add that exact record too. If authoritative DNS is hosted elsewhere, make the change at that DNS provider. Check for an existing `factory` record before adding or changing anything. Preserve unrelated website and Microsoft 365 MX/TXT records.

4. Ask the host to verify the domain, wait for its certificate to be issued, and test `https://factory.soblabs.ca` with and without preview credentials. Do not announce the domain as live until these checks pass.

The current environment could not resolve the domain's nameservers through its DNS resolver (`ECONNREFUSED`), so neither authoritative DNS ownership nor existing `factory` records have been established.

## Local deployment validation

```sh
npm run build
# Set preview access variables securely in your shell/session; do not commit values.
PORT=10000 npm run start:sandbox
```

Run `npm run test:sandbox` after building. `tests/sandbox-server.test.ts` creates disposable test credentials in memory and verifies denied requests, static-asset access, valid access, and health status against the built Node output. It never uses or prints real credentials.
