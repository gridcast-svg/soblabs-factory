# Workspace dashboard and demo projects

The overview starts with a compact action bar and the six most recently edited project/tool combinations across the workspace. A recent-work entry selects its project and opens the corresponding tool. Page views do not create edit events. Changes to BOMs, system drawings, LED layouts, projection plans, meetings, and project details/follow-ups update the list. Entries persist with the workspace and its backups; legacy workspaces start with an empty list rather than inferred timestamps.

In the design sandbox, **Add demo projects** adds three clearly named fictional projects alongside existing work:

- Demo · Lobby LED wall
- Demo · AV control rack
- Demo · Gallery projection

Each demo contains three BOM items, saved drawing sets with linked BOM snapshots, saved LED layouts, saved projection plans, meeting summaries, and follow-ups. Projection equipment is fictional and unverified; prices remain unknown. Demo notes are text fixtures, not actual PLAUD PDF imports. Existing projects and all CRM accounts, contacts, leads, deals, and activities are preserved. Stable demo project IDs prevent duplicate imports. The loader is unavailable in the account workspace; settings and live integrations are not populated with fake connections.

Existing browser data is stored on the user's device. Deploying this feature makes the loader available; it does not write into that browser until **Add demo projects** is selected.

Validation covers legacy schema compatibility, edit detection and deduplication, project deletion cleanup, demo idempotency, unchanged CRM data, browser persistence, correct recent-work navigation, and sample entries in every tool. Normal dashboard layouts were inspected at 1920×1080 and 3840×2160.
