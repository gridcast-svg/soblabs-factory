# Factory sales dashboard with Zoho CRM

Zoho owns accounts, contacts, deals, and follow-ups. Factory shows a read-only snapshot with source links and connects deals to existing Factory projects. Factory continues to own projects, BOMs, drawings, and production work. The Comp AI CRM deployment is no longer the proposed direction. No CRM database, AI worker, or LLM subscription is required for this dashboard.

## What is implemented

CRM opens the Zoho dashboard by default. It shows Accounts, Contacts, Deals, and Follow-ups, with name/owner search, separate currency pipeline totals, source record links, and last successful refresh time. A deal links to one existing Factory project; each project links to at most one deal. Links survive refreshes, including a deal disappearing from the snapshot. Previously saved local Factory CRM records and the manual account importer remain under **Previously saved Factory CRM records**. They are not merged into the Zoho snapshot.

Refresh is manual. The server reads only selected fields from four Zoho CRM v8 modules. It never writes CRM records. Only the OAuth token exchange uses POST. It pages up to 2,000 records per module and refuses to save a partial snapshot. Failed refreshes preserve the saved snapshot. A one-minute per-process cooldown and in-flight deduplication limit repeated refreshes; multiple replicas require a shared limiter before scaling.

Snapshots save inside the existing owner-scoped Factory workspace, using its existing storage. There is no new database schema. Older backups remain valid. Snapshots contain contact information and appear in account workspace backups; handle those exports as customer data. The shared sandbox neither fetches nor displays live Zoho snapshots. Do not put customer data into the design sandbox or Git.

## Secure connection setup

First configure and verify Factory account mode, its existing database migrations, active-account policy, and MFA. The current Render design sandbox is insufficient for real customer data. The Zoho server function uses Factory's existing validated-token/MFA/active-account middleware, then restricts access to the single configured Factory user. This is a single-user integration, not a multi-user credential broker.

Create a Zoho OAuth client and obtain an offline refresh token for the intended CRM user and organization. Request only:

- `ZohoCRM.modules.accounts.READ`
- `ZohoCRM.modules.contacts.READ`
- `ZohoCRM.modules.deals.READ`
- `ZohoCRM.modules.tasks.READ`

Use the account's correct Zoho data center. Store these values only in the hosting platform's server environment or an ignored local environment file; never use VITE-prefixed variables, commit them, or paste secrets into chat:

| Variable               | Value                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `ZOHO_REGION`          | `com`, `ca`, `eu`, `in`, `com.au`, `jp`, `com.cn`, or `sa`; match the account data center |
| `ZOHO_CRM_ORG_ID`      | Numeric organization ID from the actual CRM URL                                           |
| `ZOHO_FACTORY_USER_ID` | UUID of the authorized Factory account, not its email or the Zoho user ID                 |
| `ZOHO_CLIENT_ID`       | OAuth client ID                                                                           |
| `ZOHO_CLIENT_SECRET`   | OAuth client secret                                                                       |
| `ZOHO_REFRESH_TOKEN`   | Offline refresh token with the four read scopes                                           |
| `ZOHO_BASE_CURRENCY`   | Verified organization currency, such as CAD; fallback for records without Currency        |
| `ZOHO_CLOSED_STAGES`   | Exact closed stage labels separated by `                                                  | `, e.g. `Closed Won | Closed Lost`; include all customized won/lost stages |

The selected fields use standard API names. Custom stage labels are preserved. Closed stages use the explicit configured list rather than guessing from probability or names. Tasks with `Status=Completed` count as completed; customized completion statuses require mapping before use. Verify field availability and currency behavior on the actual free account. Any missing scope/module or invalid field response fails the entire refresh instead of silently presenting missing data as empty.

In account mode, open CRM and select **Refresh Zoho**. Confirm counts, record URLs, stage categories, amounts/currencies, task status, and owner names against Zoho. Link a fictional test deal to a project, refresh, reload, and confirm the link survives. Verify anonymous, non-MFA, inactive, and other Factory accounts cannot refresh. Confirm OAuth refresh works after an access token expires. A changed Zoho organization is rejected when a previous snapshot exists, to preserve project-link identity.

## MCP and costs

The Zoho Codex plugin/MCP connection enables conversational inspection during development. It does not supply credentials to the deployed Factory backend. The dashboard uses deterministic API requests and needs no model. Zoho lists MCP at no additional charge; API requests use the edition's existing quota. Free CRM currently lists 5,000 credits per rolling 24 hours. Hosting/storage remain subject to existing Factory limits.

- https://www.zoho.com/crm/developer/docs/api/v8/get-records.html
- https://www.zoho.com/crm/developer/docs/api/v8/refresh.html
- https://www.zoho.com/crm/developer/docs/api/v8/api-limits.html
- https://www.zoho.com/mcp/pricing.html

## Verification and remaining setup

Automated tests use fictional records and mocked Zoho responses. They cover string IDs, read-only requests, permissions, field validation, custom closed stages, currency separation, pagination, partial-read rejection, workspace compatibility, and the disconnected sandbox browser flow. Live Zoho login, field compatibility, and account-mode persistence are unverified until secure credentials and Factory account access are available. This change does not deploy services or alter Zoho records.
