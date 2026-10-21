# Factory visual theme

Factory uses a scoped adaptation of [Boldcase by uiverse-astronaut](https://uiverse.io/ui-kits/boldcase): warm paper and bone surfaces, ink borders, Bricolage Grotesque headings, chartreuse actions, lilac supporting tiles, and Soblabs coral highlights.

`src/features/workspace/boldcase.css` applies through `.ws-app.ws-boldcase`. The workspace shell, dashboard, project cards, CRM, BOM, meetings, settings, drawing revision panels, and planner controls share the theme. Authentication and the legacy catalogue keep their existing styles. The embedded AV editor has its own Boldcase light and dark palettes in `apps/av-editor/src/boldcase.css`. New browsers open in paper mode; an explicitly saved light/dark preference persists. Its library, properties panels, nodes, wiring labels, export controls, and canvas share the palette. LED and projection drafting surfaces also support paper and dark palettes, using their own persistent canvas switch. Print exports keep their existing white background and readable routing colors.

The workspace and embedded editor share the font hosted in `public/fonts`, with its SIL Open Font License in `public/licenses/bricolage-grotesque.txt`. Boldcase attribution and the MIT notice are in `public/licenses/boldcase.txt`. No new runtime packages or external font requests are required.

Normal desktop layouts were visually inspected at 1920 × 1080 and 3840 × 2160. Existing browser tests cover project/BOM persistence, CRM imports and conversion, PLAUD imports, drawing exports, and expanded/fullscreen AV, LED, and projection editors at both desktop sizes. Keyboard focus indicators and reduced-motion styling are included. This is a visual update; integration connection status and storage behavior are unchanged.
