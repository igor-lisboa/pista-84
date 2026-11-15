# Interface composition review — 2026-11-14

The supplied physical-phone screenshots identify oversized landscape forms, overly wide reading lines, crowded result actions, small garage previews and inconsistent use of empty space. The responsive layer in `web/interface-layout.css` owns the revised composition independently of the arcade colors, icons and typefaces.

Account forms use a bounded reading column, 16 px inputs, a compact rules block and a clearly separated submit action. Short landscape screens place username and password beside each other. Empty status regions take no height; password-change forms retain their own vertical layout. Guest notices center a readable content block. Long settings/About/garage dialogs still open at the top and scroll internally with the close control available.

Results group summary and actions separately, with a divider and two columns in landscape. Portrait keeps the complete card centered; the smallest supported phones use tighter spacing so the demo explanation and all actions remain visible. The existing localized end-of-run kicker replaces the contradictory crash slogan about having no second chances. No translation keys, placeholders or locale wording change. HUD side columns stay equal, with reduced panel height on portrait phones. Garage uses three desktop columns, two short-landscape columns and one portrait-phone column, with larger previews and content-sized model/tagline text. Pairing uses a QR/instructions split in short landscape.

## Vehicle proportions

The [22-vehicle common-scale contact sheet](screenshots/interface-v6/fleet-common-scale.png) draws every model at scale 1 on aligned ground lines. Compact hatchbacks remain below the Kombi/SUV; sports cars retain low rooflines. CG/Biz remain slender, Hayabusa is broader and the Harley remains a touring bike with a human-sized rider. The comparison does not justify another fleet retune; existing sprite dimensions, simulation width/collision rules, tuning and save identities are preserved. Existing authored-pose and paint/brake checks remain relevant.

## Validation and limits

Reviewed captures: [portrait result](screenshots/interface-v6/result-portrait.png), [landscape result](screenshots/interface-v6/result-landscape.png), [portrait account](screenshots/interface-v6/account-portrait.png), [landscape account](screenshots/interface-v6/account-landscape.png), [portrait garage](screenshots/interface-v6/garage-portrait.png), [landscape garage](screenshots/interface-v6/garage-landscape.png). Pairing is checked by element visibility and close-path assertions; its room QR credential is not committed as a screenshot.

The review covers configured Chromium/WebKit emulation, all fifteen locales in demo/result layout tests, account actions/close paths, settings/garage navigation, purchases and paint alignment, viewport-safe results, offline CSS loading and the common-scale fleet comparison. Exact completion counts are recorded in spec 08. Physical keyboard/safe-area behavior, native sensors and native-speaker approval remain QA-01/I18N-01. No service or production deployment is performed.

Initial layout tests caught asymmetric HUD columns and overflowing result actions at 568×320 and 320×568. Equal-width HUD sides, landscape grouping and a separate compact portrait rhythm correct those findings without loosening assertions. New handwritten CSS and test modules remain below 300 lines; existing implementation overages remain QLT-01.

Completion: production build, strict typecheck, documentation consistency and all 180 Node tests pass. Across affected browser runs, 174 distinct cases pass in Chromium/WebKit, with no remaining failures or skips; final preview alignment and portrait-only compact HUD changes each have 14-case shared-layout/mobile reruns. No complete repository browser rerun is claimed for this UI follow-up. Offline cache is `pista84-v36`, including the new composition stylesheet.
