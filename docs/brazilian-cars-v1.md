# Brazilian vehicle refinement v1

The four added models now use [vehicle-brazilian-v1.png](../web/assets/vehicle-brazilian-v1.png): 12 detailed transparent sprites, with straight rear, gentle right and strong right views. Left turns mirror the corresponding right views. Each cell is cropped by its alpha bounds; rendering keeps the image aspect ratio and the fleet's common scale. Fiat 147 is narrower than Marea; Puma has a noticeably lower roofline. Model-specific brake-light locations and paint remapping work in each pose.

The sheet is 1024 x 1536, with authored column cuts 0, 320, 675, 1024 and row cuts 0, 384, 768, 1152, 1536. All twelve cells were checked for transparent borders and complete silhouettes. The old procedural artwork remains the loading fallback. The new asset is included in service-worker cache v23.

These are arcade approximations of period road cars, not homologation measurements. Fuel is a relative game multiplier, not litres per 100 km. Acceleration times are measured through the actual tapered acceleration function on dry asphalt, with continuous throttle.

| Model | Speed ceiling (km/h) | Approx. 0–100 (seconds) | Fuel multiplier | Handling | Width relative to compact |
| --- | ---: | ---: | ---: | ---: | ---: |
| Fiat 147 | 132 | 23.3 | 0.68 | 1.02 | 0.88 |
| Marea Turbo | 220 | 7.2 | 1.35 | 1.08 | 1.02 |
| Passat 85 | 170 | 12.3 | 0.88 | 1.04 | 0.94 |
| Puma GT | 160 | 13.3 | 0.83 | 1.18 | 0.95 |
| Veloce GT | 350 | 4.9 | 1.20 | 1.15 | 1.18 |

The GT acceleration rating rises from 64 to 70 (9.375% stronger pull), retaining its 350 km/h ceiling. Its previous 0–100 time was approximately 5.35 seconds.

The four new cars and GT now have model-specific exhaust harmonics, firing rates derived from cylinder count and simulated RPM, automatic gear pitch drops, a low exhaust layer and smooth pitch/filter envelopes. Marea uses a five-cylinder voice plus quiet load-dependent filtered turbo air noise. Puma uses a deeper flat-four spectrum. These remain synthesized game sounds, not recordings of the real vehicles. Existing legacy voices retain their profiles. Non-running states mute engine layers; braking removes turbo load.

Historical references used as context: [Fiat's 147 history](https://www.media.stellantis.com/br-pt/fiat/press/fiat-147-50-anos-do-modelo-que-transformou-a-industria-automotiva-brasileira) and [Fiat's Marea Turbo report](https://www.media.stellantis.com/br-pt/fiat/press/fiat-marea-weekend-turbo-e-destaque). Numerical values above describe the game tuning.

Validation: unit checks cover acceleration bands, fuel tradeoffs, speed limits, gearing and turbo load. Browser checks cover complete atlas cells, all turn directions, paint, fleet proportions, purchases and audio model switching. Web Audio execution is skipped on browser builds without that API.

Run `node scripts/review-brazilian-cars.ts` with the dev server running to regenerate [the pose review](screenshots/brazilian-cars-v1/vehicle-poses.png) and the four driving screenshots.

## Image creation

Created using the built-in image_gen tool under the imagegen skill; no API or CLI fallback. The existing classic-car sheet was a style reference. Selected output copied into the project at `web/assets/vehicle-brazilian-v1.png`.

### Generation prompt

```text
Use case: stylized-concept. Asset: production transparent PNG sprite atlas for an existing Brazilian rear-chase racing game. Input image is STYLE REFERENCE ONLY, not an edit target. Match its handsome detailed automotive illustration: dimensional shaded metal bodywork, reflections in glass, crisp dark contours, visible tires, realistic model identities. Create a NEW sprite sheet with EXACTLY THREE COLUMNS and FOUR ROWS (12 whole vehicles). Canvas portrait 1024 x 1536; each equal cell has generous fully transparent gutters on every side. BACKGROUND MUST BE REAL ALPHA=0 TRANSPARENCY, with NO smoke, colored glow, ground, shadow, scenery, labels or watermark.
Each row is one specific car, accurate rear shape and body proportions consistent across all columns. Column 1 dead straight rear view, column 2 gentle RIGHT turn yaw 12 degrees, column 3 strong RIGHT turn yaw 28 degrees. All cars drive AWAY from viewer: in right-turn frames rear is at left and visible right-hand flank extends toward upper right, same turn direction as reference. Camera slightly elevated rear chase, about 12 degrees above horizontal; roofs visible but not top-down. In turns expose genuine side doors, wheel arches and side windows. Preserve body length, physical width, wheelbase, height and paint across poses. Wheels aligned with body, no cartoon leaning. Four wheels grounded, correct tire sizes.
ROW 1: golden mustard yellow Fiat 147 early Brazilian compact 3-door hatchback (not Uno). Short narrow square body, tall upright rear hatch and rectangular large rear glass, slim roof pillars, small rectangular red/amber tail lamps at corners, skinny tires, small chrome/black bumper, clearly tiny economical 1970s hatch.
ROW 2: dark muted metallic green Fiat Marea Turbo late 1990s 4-door sedan. Longer and broader than Fiat 147. Low rounded aerodynamic roof, distinct separate trunk, narrow horizontal red/white rear lamp clusters spanning corners toward license recess, body-color bumper, subtle twin exhaust, tasteful factory wheels, realistic stock proportions, no racing wings.
ROW 3: burgundy red Volkswagen Passat 1985 Brazilian B1 2-door FASTBACK. Period angular long sloping rear hatch, long side window, thin pillars, rectangular horizontal red amber rear lamps, black trim and slim chrome bumpers, narrow classic tires. This is first generation Passat NOT a modern sedan. Longer and lower than Fiat 147, slimmer and shorter than Marea.
ROW 4: warm cream yellow Brazilian Puma GT 1970s air-cooled fiberglass coupe (NOT Ford Puma). Very LOW small wide curvaceous sports coupe, sloping fastback rear window, curved rear fenders, rear engine cooling slots, round red tail lamps, discreet chrome split bumper, small wide wheels, short overhangs and twin exhaust. Significantly lower silhouette than hatchbacks, compact and smaller than the Marea.
Use whole-cell composition centered per cell and complete vehicle in every cell. Similar drawing scale across rows showing true relative sizes. No stretched wide bodies, no huge roofs, no front views. Refined detailed illustrations matching reference polish, realistic proportions, enough pixel detail to read at 100px tall.
```

### Follow-up edit prompt

```text
Edit target: this 3-column 4-row vehicle sprite sheet. Preserve the 12 vehicle identities, model details, colors, high quality illustration, straight/gentle-right/hard-right pose order and true alpha transparency. Correct ONLY spacing and yaw: shrink each individual vehicle by 18 percent about its own cell center so EVERY car including wheels and mirrors has at least 30 fully transparent pixels clearance from its cell boundary. Exact equal cells: columns x=0..341,342..682,683..1023; rows y=0..383,384..767,768..1151,1152..1535. Center each vehicle horizontally within its own cell. Do not move rows or columns or change model identities. Third column should have distinctly stronger 28 degree right yaw than column two's gentle 12 degrees, showing noticeably more right flank with rear to left, front away upper right. Entire body within cell. Remove all smoky colored backdrops, halos and floor shadows: ONLY vehicle pixels, everything else completely alpha zero. No text outside car badges. Transparent background production sprite atlas.
```

