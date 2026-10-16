# Blend Calc modules

Source: https://github.com/stoatworks-labs/blend-calc
Pinned commit: `de187a161b6ee926a18727341b04dc81237a4044`
MIT copyright Stoatworks Labs; see LICENSE.

Factory vendors the pure geometry, units and Resolume export modules only.
Upstream dependencies, catalogue, UI, service worker and deployment scripts are
not installed. Formatting may differ. Factory adds validation, optical guards,
vertical shift checks, blend-compensated brightness, native desktop UI, project
storage, BOM integration and technical reports. See docs/PROJECTION-PLANNER.md.

Resolume export represents a geometry preset with virtual outputs, not calibrated
soft-edge settings. The upstream format targets Arena 7.27; it has not been
round-tripped through a running Arena or tested on physical projectors here.
