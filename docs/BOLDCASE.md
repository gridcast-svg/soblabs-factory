# Factory visual theme

Factory uses a scoped adaptation of [Boldcase by uiverse-astronaut](https://uiverse.io/ui-kits/boldcase): warm paper and bone surfaces, ink borders, Bricolage Grotesque headings, chartreuse actions, lilac supporting tiles, and Soblabs coral highlights.

`src/features/workspace/boldcase.css` applies through `.ws-app.ws-boldcase`. The workspace shell, dashboard, project cards, CRM, BOM, meetings, settings, drawing revision panels, and planner controls share the theme. Authentication and the legacy catalogue keep their existing styles. AV iframe content and technical drawing surfaces retain their own dark palettes; the parent theme does not override SVG signal colors or drawing export styles.

The font is hosted locally in `public/fonts`, with its SIL Open Font License in `public/licenses/bricolage-grotesque.txt`. Boldcase attribution and the MIT notice are in `public/licenses/boldcase.txt`. No new runtime packages or external font requests are required.

Normal desktop layouts were visually inspected at 1920 × 1080 and 3840 × 2160. Existing browser tests cover project/BOM persistence, CRM imports and conversion, PLAUD imports, drawing exports, and expanded/fullscreen AV, LED, and projection editors at both desktop sizes. Keyboard focus indicators and reduced-motion styling are included. This is a visual update; integration connection status and storage behavior are unchanged.
