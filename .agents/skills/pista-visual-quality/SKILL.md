---
name: pista-visual-quality
description: Review PISTA 84 interface composition, icon alignment and vehicle artwork across screen shapes, paint colors and steering poses.
---

Read `AGENTS.md`, specs 04/05 and the affected UI/rendering code. Use the
`pista-quality` build/runtime gate and `pista-docs` evidence gate. This review
adds visual evidence; passing a screenshot assertion alone is not visual approval.

For interface changes, inspect desktop and phone portrait/landscape captures,
including 320×568, 568×320 and a recent phone's four safe insets. Check readable
line length, content hierarchy, breathing room, centered icon boxes, equal action
alignment, focus rings, disabled states and scroll/close paths. Compare SVG boxes
with their button content boxes, not text baselines. Inspect settings, account,
garage, result/pause and controller surfaces affected by shared CSS. Use the
existing locale-fit cases for fifteen languages and Urdu RTL. Do not save pairing
QR credentials in committed screenshots.

For vehicles or paints, run `tests/browser/vehicle-paint-integrity.spec.ts` and
the authored-pose, traffic-art and icon/layout cases relevant to the change.
Review every catalog model in every garage paint and traffic color, all three
authored poses, both mirrored left turns and brakes off/on. Lamps, tires, rims,
glass, plates and rider clothing retain their material colors; body panels must
actually change, including black/white paint. Check alpha/clipping and human/fleet
scale. A hue threshold is not a semantic body mask: red bodywork and red lenses,
or blue paint and tire/glass reflections, can share a hue.

Brake feedback must follow the authored lens silhouette and pose; reject floating
rectangles, light on tires/body panels, changed alpha and mirrored offsets. Review
enlarged contact sheets as well as actual gameplay scale. Region assertions and
color-difference totals cannot establish that a mask covers the right pixels.

Inspect tire contact, shadow placement and rear-lamp road reflections through
straight, mild and strong steering in both directions. Day/dry and night/wet
captures must use the same pose geometry as the sprite. Source lens masks remain
independent of custom paint; sample shaded body panels as well as total changes.
Include bright paint on neutral panels and blue-grey exhaust/rim highlights:
changed-pixel totals can miss clipped white paint or colored chrome.
Inspect plates independently from body paint, especially motorcycle plates and
white-car side panels. Rider bounding boxes overlap tail fairings and cargo:
verify actual garment pixels and painted panels separately against source artwork.
Check upper wheel rims as well as the bottom tire strip. Braking must not light
amber indicators; verify independently chosen indicator pixels in turning poses.
Keep model differences in atlas/material data and shared family painters; avoid
introducing a separate loading or scene pipeline for an individual vehicle.

Record reviewed captures, defects corrected, executed checks and any remaining
unverified surfaces or hardware limits in a dated `docs/` report. Preserve tuning,
save identities and unrelated artwork unless the request includes changing them.
