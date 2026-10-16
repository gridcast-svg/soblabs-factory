# Factory AV editor

Vendored from https://github.com/synergycodes/ng-diagram-av-schematic at
658ac55efc25b2adb7ca37d6ec484fb96bb427e6 (MIT). The original LICENSE is retained.
The ng-diagram dependency is Apache-2.0; the Angular production build emits
third-party license notices with its assets.

Factory modifications: same-origin project bridge, empty initial diagram,
project BOM palette, persistent custom library and unfinished cable routes,
shared equipment specifications, Factory branding, and selection events.
This runs locally as a same-origin embedded editor, never a hosted third-party
iframe. Project data contains technical equipment information, not prices or
account credentials. Factory validates all incoming documents before persistence.

Root npm run dev/build compiles this app to ignored public/av-editor assets.
Render uses the existing root build command. No second service is required.
After changing the embedded editor source, restart root npm run dev. Its predev
step compiles Angular before Vite scans the generated public assets. Keep
package-lock.json and LICENSE when updating.
