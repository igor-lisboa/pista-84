# Harley Electra Glide — 2026-11-14

## Model reference and game choices

The garage vehicle represents a **1977 Harley-Davidson FLH Electra Glide 1200 Shovelhead**, with a broad touring body, hard saddlebags, chrome rails, windshield and upright rider. [Harley-Davidson's Electra Glide history](https://www.harley-davidson.com/us/en/content/expert-advice/harley-davidson-electra-glide-history.html) documents the touring lineage, luggage and windshield/fairing development. The manufacturer's **1970–early 1978 service manual, part 99482-78**, available as an [archived primary-source scan](https://s81b12f53dcca2766.jimcontent.com/download/version/1654443768/module/12993977326/name/%2770-%2778%20Harley-Davidson%20FL%20FLH%20FX%20FXE%20FXS%20Shovelhead%20Service%20Manual%20PDF.pdf), covers this model. Its general specifications identify a 1207 cc four-stroke, two-cylinder 45-degree V engine and four-speed transmission; the engine description explains the unequal 315/405-degree firing intervals.

The game chooses **165 km/h**, acceleration rating **42**, gain **0.28**, falloff **1.7**, consumption **1.10**, handling **0.90**, width **0.84**, braking **40**, and a **6,000-coin** price. These are arcade values, not factory-certified top speed or 0–100 figures. It is visibly wider than Hayabusa (0.66) and the urban bike (0.56), with less nimble steering. Existing bike rain/collision rules apply; no other model is retuned.

The sound is a low two-cylinder synthesized approximation with four game gear limits (35/65/110/165 km/h), chosen idle/redline **950/5500 RPM**, a dark filter and a distinct harmonic spectrum. These RPM limits and gear speeds are game estimates. The synthesis does not reproduce exact unequal firing timing or a real exhaust recording; physical-speaker fidelity remains pending.

Real Race measurements use 20 ms steps, dry conditions, no traffic, unlimited fuel and centered steering: **9.86 s** to 100 km/h; **12.18/23.34/33.34 s** to 70/90/95% of maximum. See the [full acceleration table](acceleration-v6.md). The ID `harley` is new; old IDs/ownership and save format 2 remain intact.

## Artwork and provenance

Built-in imagegen created `web/assets/vehicle-harley-v1.png` from the existing motorcycle sheet as a style reference, with transparency on 2026-11-14. Factory teal paint and cream pinstripes are an illustrative livery, not a trim-exact manufacturer claim. There are complete straight, mild-right and strong-right rear views; left views mirror the right poses.

The 1536×1024 output's actual transparent gutters use column cuts **0/470/960/1536**, rather than assuming equal cells from the request. Alpha trimming preserves every bag, mirror, tyre and helmet. `src/render/harley-art.ts` owns these regions, the central brake-lamp placement and a broad touring-bike loading fallback. The authored atlas remains the normal art. Custom paint isolates teal panels and retains chrome, cream trim, rider, windshield and red lamps. Saved output: [transparent atlas](../web/assets/vehicle-harley-v1.png).

Reviewed captures: [five poses, custom paint/braking and fleet scale](screenshots/harley-v1/harley-poses.png), [phone portrait](screenshots/harley-v1/harley-gameplay-375x667.png), [phone landscape](screenshots/harley-v1/harley-gameplay-667x375.png). Silhouettes are complete, distinct and uniformly scaled; bags, tyres, helmet and mirrors remain inside their crops. Phone captures use emulated keyboard input, not physical touch/sensor hardware.

Exact prompt (built-in tool, transparent background):

> Production transparent pixel-art sprite sheet for an arcade racing game. Use the supplied motorcycle sheet only as the style and elevated REAR chase-camera reference. Create THREE complete sprites of the SAME big old-school 1977 Harley-Davidson FLH Electra Glide 1200 Shovelhead touring motorcycle with a helmeted rider: a broad heavy touring silhouette, large rear fender, two large hard saddlebags, low broad black saddle and chrome passenger backrest, generous bright chrome trim and long twin chrome exhausts, wide handlebars with mirrors, a hint of classic front touring windshield beyond the upright rider. Factory body paint is saturated deep TEAL green (#147d75), cream pinstripe accents; neutral charcoal leather jacket, dark trousers, cream open-face helmet viewed from behind. Red central rear tail lamp, amber signals, light blank license plate. Old-school cruiser, visibly bulky and substantially wider than the reference's slender urban bike, no modern racing fairings or forward racing crouch. Reference pixel clusters, shaded hard outlines, warm 16-bit detailing. Atlas exactly 1536 x 1024, ONE horizontal row of THREE equal 512 x 1024 cells. Column 1 straight directly from behind; column 2 gentle RIGHT steering/lean, showing more of the bike's right side; column 3 stronger RIGHT steering/lean with a clearly different rear three-quarter perspective. Upright rider and entire bike lean together naturally, complete silhouettes, same camera elevation and consistent apparent scale in all cells. Each sprite centered in its cell with ample fully transparent margin, at least 40 px every side including tyres, mirrors, bags and helmet. NO front view, NO text, NO labels, NO logos, NO badge lettering, NO scenery, NO ground shadow or glow, NO gridlines. Transparent background, exactly three isolated complete rider-and-bike sprites only.

## Review scope

Node checks exercise actual acceleration/ceiling, larger width/heavier handling, ownership/import and four-gear two-cylinder pitch behavior. Browser checks cover affordability, purchase/paint/reload, driving/pause/menu in both phone orientations, complete alpha borders, distinct five-direction poses, brake/paint support and neutral chrome preservation. All fifteen taglines have fit checks at 375×667, 667×375, 768×1024, 1024×768, 900×1440 and 1440×900, including Urdu RTL and font fallbacks; native-speaker review is not implied.

## Diff-to-spec and quality audit

Catalog/economy/measurements map to spec 03 and `acceleration-v6.md`; fifteen locale additions and key counts map to spec 04 and `languages-v5.md`; authored poses/paint/brakes/synthetic audio map to spec 05 and this provenance. Atlas module and v34 offline precache map to spec 06; validation maps to spec 08; delivery, VEH04 and baseline map to roadmap/matrix/spec index. Current fleet/voice counts are 22, locale count 15, source keys 253 and explicit pt-PT overrides 186. Existing vehicle IDs, tuning and prior working-tree edits are preserved.

The new `harley-art.ts` has 44 physical lines; touched `cars.ts`/`vehicle-tuning.ts`/`engine-voices.ts`/`sprite-paint.ts` have 86/51/89/158. Shared `sprites.ts` remains 619 lines under QLT-01, with Harley atlas/fallback ownership extracted. `game.spec.ts` remains an oversized 520-line test file; new Harley Node/browser tests have 54/115 lines. No new unsafe types, DOM dependencies in simulation, storage schema or services are introduced.

Executed with Node 24: `npm run build`, `npm run typecheck`, `npm run docs:check`, `npm test` (180 passed, zero failures/skips). An initial Node assertion incorrectly compared two-cylinder idle pitch with a single-cylinder bike; it now compares the four-cylinder sport bike without changing sound tuning.

Browser commands use the configured isolated server with live databases disabled:

```text
npx playwright test tests/browser/harley.spec.ts tests/browser/motorcycles.spec.ts tests/browser/traffic-art.spec.ts tests/browser/vehicle-refinement.spec.ts tests/browser/phone-screens.spec.ts tests/browser/garage-progress.spec.ts tests/browser/client-loading.spec.ts tests/browser/audio.spec.ts --workers=4
npx playwright test tests/browser/harley.spec.ts tests/browser/game.spec.ts tests/browser/motorcycles.spec.ts --grep 'Harley|production atlas|every vehicle|offline cache|camera on resize|drive, pause|locales at 1024x768|locales at 900x1440' --workers=1
```

The initial browser batch had 53 passes, four failures and three Windows WebKit skips (no Web Audio). Two paint-comparison failures came from test-only bilinear resampling: the comparison now disables smoothing like the production renderer and still requires zero neutral-pixel changes. Two concurrent Chromium portrait driving checks stalled under rendering load; the focused serial run preserves speed assertions, and Harley uses controlled animation-clock progression. This is test determinism, not an FPS benchmark. The broader initial batch exercises menu/garage tools, all-model traffic paint, installed lazy/offline loading and Chromium audio. Full-repository, physical-device and native validation are outside this affected-flow review.

The sheet is generated illustration, not manufacturer photography or endorsement. Hardware audio, physical-device and native validation remain QA-01; translations remain pending native review under I18N-01. Payments and ads stay pending.

