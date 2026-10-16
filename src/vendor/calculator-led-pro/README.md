# Calculator LED Pro modules

Vendored from https://github.com/matecodedev/calculator-led-pro at commit
`7bc11b4e42fb484958b448021594b735bf3586dc` (MIT; see LICENSE).

Selected pure domain modules only. No upstream UI, service worker, catalogue,
backend, package scripts or dependencies are installed. Factory supplies its
own project storage, English desktop UI, verified user specifications, BOM
bridge and reports. Formatting and strict TypeScript annotations may differ.

Factory guards undersized ports and circuits before calling upstream functions
which otherwise clamp capacity to one cabinet. Factory wall-fit retains floor
rounding; upstream dimension targeting rounds up and is not used for wall-fit.
See docs/LED-PLANNER.md for integration details and validation.
