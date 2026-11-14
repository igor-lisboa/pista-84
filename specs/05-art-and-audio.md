# 05 — Art direction and audio

[Specification index](README.md) · Implementation: [`src/render/`](../src/render/), [`src/audio/`](../src/audio/)

## Reference and visual identity

The latest supplied screenshot is the primary in-game visual reference: a winding grey road, a city skyline, conifers, muted sky, large rear-view vehicles with visible roofs, and limited HUD information. Earlier mountain/coastal scenery and thin procedural car icons are superseded by the 1.3 art direction.

The 1.4 interface wraps the scene in a **sunset-arcade** look: deep purple panels, sun-yellow, hot pink and cyan, Bungee and Chakra Petch fonts (Google Fonts, optional, with system fallbacks), hard outlines, offset shadows and a checkered strip on the menu. See [interface and controls](04-interface-and-controls.md).

The initial menu retains PISTA 84 branding. The reference is a style/composition guide, not a background pasted over an otherwise nonfunctional game.

## Camera, road and scene

- Horizon: **27.5% of canvas height**.
- Player ground position: `horizon + 0.855 × remainingRoadHeight`.
- Curved perspective is shared by road, lane markers, traffic and roadside objects.
- Asphalt is subdued blue-grey; roadside grass has restrained bands rather than a high-contrast neon pattern.
- Red/white shoulder strips, white road edges and dashed lane separators.
- Layered pixel city with windows, rooftops, antennae and landmark towers; pixel-cluster clouds and shaded conifers.
- City/tree caches avoid rebuilding complex static details each frame.
- Road surface rectangles are batched by paint layer to reduce Canvas submissions while preserving the same row geometry, lane markings and wheel tracks. Curvature integration reuses its sample buffers and precomputed projection depths; bounded section caching avoids recomputing seeded road parameters without changing the track or physics.
- Full paint/fallback sprite caches evict one oldest entry instead of clearing every warmed sprite at once, keeping their existing memory bounds without periodic mass repaint work.
- Camera offset keeps lateral driving readable near the edges. A fixed 960 x 720 camera is uniformly fitted with object-fit: contain, preserving the complete gameplay frame in portrait, landscape and square windows.
- Rain, fog and night remain dynamic rather than fixed into the artwork.
- Lane dashes are 3 m on and 3 m off (a 6 m cycle), so markings pass twice as often as the earlier 12 m cycle at every speed. This is paint cadence only; physics, curves and traffic keep their metre positions.
- Road projection spans 104 m; road paint, guardrails, scenery and traffic share the same metre-based motion. Roadside scenery slots are 12 m apart, with a billboard every 19 slots (228 m), alternating sides. Billboard text and colors come from `src/render/billboards.ts`; these are offline house ads, with no ad-network integration or tracking.
- Speed effects use fast = clamp((speed - 35) / 115, 0, 2.75), reaching the previous flat-out intensity at 150 km/h and building through 350 km/h. Streak count/length, bounded vignette opacity, car bob, rumble above 85 km/h and filtered wind noise reinforce speed; impact and off-road feedback remain.

## Vehicle artwork

Biz 125 and Hayabusa add six straight/mild/strong right sprites in `vehicle-motorcycles-v1.png`, mirrored for left turns. Model references, prompt, paint/brake support and review evidence: [motorcycle notes](../docs/motorcycles-v1.md).

Authored asset: [vehicle-atlas-v1.png](../web/assets/vehicle-atlas-v1.png). Eight vehicles map to the original catalog IDs: Fusca, Brasília, Gol, Palio, urban motorcycle, Veloce GT, Bruto SUV and Raio sports motorcycle.

The atlas has transparent alpha. Runtime regions are trimmed to visible alpha bounds; every model preserves its own width/height ratio. Motorcycles are narrower; sports-car width is adjusted independently. Garage/menu thumbnails fit the full vehicle inside their canvas rather than cutting off the roof.

Rendering uses nearest-neighbor scaling and disabled Canvas image smoothing. Custom paints remap body-color hues while preserving lightness and transparency. Braking adds light feedback; steering selects separate authored mild/strong rear three-quarter turn frames. Left frames mirror their right counterpart. No row shearing or body rotation is used.

Turn poses: [vehicle-turns-v2.png](../web/assets/vehicle-turns-v2.png) adds 16 transparent frames for the eight atlas models. Full generation prompt and built-in imagegen provenance: [turn-sprites-v2.md](../docs/turn-sprites-v2.md). Straight and turning frames preserve each source frame's aspect ratio using uniform scaling.

### Classic vehicle atlas

Kombi 78, Uno com Escada, Chevette 82, CG 125, Opala SS and Maverick GT use vehicle-classics-v2.png with 18 transparent authored sprites: straight, gentle right turn and hard right turn for every model. Left turns mirror the authored poses. They share the original atlas renderer, alpha cropping, paint remapping and uniform scaling. The hand-composed sprites remain an asset-loading fallback. Prompts, crop layout, camera behavior and review instructions: [vehicle-classics-v2.md](../docs/vehicle-classics-v2.md).

Fiat 147, Marea Turbo, Passat 85 and Puma GT use [vehicle-brazilian-v1.png](../web/assets/vehicle-brazilian-v1.png), with twelve transparent authored sprites, distinct turn views, model-specific proportions and brake lights. Generation prompts, tuning and review screenshots: [brazilian-cars-v1.md](../docs/brazilian-cars-v1.md).

Atlas creation used the built-in imagegen tool followed by a badge-removal edit. Exact prompts and provenance remain in [ART_DIRECTION.md](../docs/ART_DIRECTION.md). The user-provided screenshot itself is not shipped as a game asset.

[reference-scene.png](../docs/screenshots/reference-scene.png) is a deterministic composition drawn by the actual renderer, with a red sports car, yellow sports car, beige Fusca and blue hatch. It is a visual review scene, not a second game mode or evidence of player progression.

## Audio implementation

All audio is synthesized with Web Audio; there are no audio files. The audio context is activated through a user gesture (the first tap or key press unlocks it). Missing support must produce a clear message and leave racing functional. **One toggle** (Options) switches music, engine and effects together; the preference is saved and **defaults to on**.

### Engines

Each of the **21** vehicles has its own engine profile in `AUDIO_PROFILES` (`src/audio/engine-voices.ts`, re-exported by `src/audio/audio.ts`). Every profile models an automatic gearbox: a list of gear redline speeds, cylinder count, idle and redline RPM, and a set of exhaust harmonic amplitudes that builds a model-specific periodic waveform. The firing frequency is `rpm / 60 × cylinders / 2`, where RPM follows the road speed within the current gear (never below idle), so pitch drops at each gear change. A quieter triangle oscillator one octave below adds a low exhaust layer. Only the Marea Turbo has `turbo: true`, adding quiet bandpass-filtered turbo air noise that grows with load. If a profile had no gear data it would fall back to `base + speed × ratio` with the listed waveform, which no catalog car uses today.

The low-pass engine filter opens with `filter + speed × 2` (plus 350 Hz while accelerating). Engine gain is 0.28 × 0.8 coasting or × 1.5 accelerating. Braking combines broad, lower-pitched friction noise (bandpass at `brake + speed × 1.5`) with a quiet per-model tonal squeal scaled by `squeal` in `vehicle-tuning.ts`; the Veloce GT has `squeal: 0` (friction only) and a 680 Hz brake filter base. Full braking peaks at friction level **0.42** and squeal **0.09** (scaled by the car's brake rate and squeal mix), so braking reads clearly over the engine. Envelopes respond in about 60 ms and fade as the car stops. **Tyre squeal** while cornering: bandpass noise at `1200 + speed × 4` Hz, rising with the steering load (`|steer|`) and with speed above 20 km/h (full at 100 km/h), scaled by `0.5 + squeal` from [vehicle-tuning](../src/game/vehicle-tuning.ts) and silent while braking. Wind noise rises with speed (40–350 km/h). Effects gain is 0.20; music bus gain is 0.07 in menus and 0.0455 (× 0.65) in races. The sound toggle controls the full mix.

| Vehicle ID | Engine base Hz | Speed ratio | Waveform | Filter base Hz | Brake base Hz | Cylinders | Idle / redline RPM |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| fusca | 39 | 0.65 | sawtooth | 480 | 650 | 4 | 800 / 4800 |
| brasilia | 46 | 0.62 | triangle | 650 | 850 | 4 | 800 / 4900 |
| gol | 54 | 0.80 | sawtooth | 720 | 1100 | 4 | 850 / 6200 |
| palio | 50 | 0.76 | triangle | 800 | 1000 | 4 | 850 / 6400 |
| moto | 95 | 1.40 | square | 1100 | 1500 | 1 | 1400 / 9500 |
| suv | 22 | 0.50 | sawtooth | 320 | 520 | 4 | 750 / 4200 |
| kombi | 33 | 0.55 | triangle | 420 | 600 | 4 | 800 / 4600 |
| uno | 62 | 0.90 | sawtooth | 760 | 1050 | 4 | 900 / 6200 |
| uno-normal | 58 | 0.85 | sawtooth | 760 | 1050 | 4 | 900 / 6200 |
| chevette | 48 | 0.78 | sawtooth | 700 | 950 | 4 | 850 / 5800 |
| cg125 | 105 | 1.50 | square | 1000 | 1400 | 1 | 1400 / 8500 |
| opala | 30 | 0.90 | sawtooth | 560 | 800 | 6 | 700 / 4800 |
| maverick | 25 | 1.00 | sawtooth | 900 | 1300 | 8 | 700 / 5200 |
| fiat147 | 61 | 0.70 | triangle | 620 | 800 | 4 | 850 / 5700 |
| marea | 43 | 1.05 | sawtooth | 1150 | 1150 | 5 | 800 / 6500 (turbo) |
| passat | 52 | 0.74 | sawtooth | 740 | 980 | 4 | 900 / 6100 |
| puma | 36 | 0.88 | triangle | 880 | 1080 | 4 | 850 / 5500 |
| gt | 27 | 1.10 | sawtooth | 1300 | 680 | 8 | 950 / 8500 |
| superbike | 125 | 1.80 | square | 1800 | 1000 | 4 | 1300 / 13000 |
| biz125 | 85 | 1.15 | triangle | 900 | 1250 | 1 | 1400 / 7500 |
| hayabusa | 100 | 1.65 | sawtooth | 1650 | 950 | 4 | 1050 / 11000 |

### Music

Music is procedural: a lookahead scheduler (`src/audio/music.ts`) walks a 16-step grid of data-only tracks (`src/audio/tracks.ts`, four-bar loops with chords, bass, arpeggio, stabs, kick/snare/hats and a per-voice mix) and renders each voice with plain oscillators and noise. Switching between menu and race music crossfades (about 0.35 s). There are eight tracks: the menu loop and seven race tracks.

| Track | Used for | Tempo | Character |
| --- | --- | ---: | --- |
| `menu` | Menu, pause, result screens | 74 bpm | Calm Am7–Fmaj7–Cmaj7–G6 pad, sine bass and arpeggio, no drums |
| `neon-highway` | Race | 132 bpm | Four-on-the-floor synthwave in A minor |
| `turbo-rush` | Race | 150 bpm | Fast E-minor chase with rolling hi-hats |
| `sunset-drive` | Race | 118 bpm | Laid-back upbeat D-minor groove with off-beat stabs |
| `nitro-circuit` | Race | 142 bpm | Punchy arcade pulse in G minor with a galloping bass |
| `midnight-run` | Race | 124 bpm | Dark night-city cruise in C minor: sparse bass, off-beat stabs, light pad and a steady kick |
| `checkered-flag` | Race | 138 bpm | Bright major-key victory lap: fast arpeggios over a bouncing bass |
| `redline` | Race | 160 bpm | Relentless high-tempo drive in B minor, the most intense of the set |

The menu loop plays whenever the race is not running; each time race music starts it picks one of the seven race tracks at random and never the same one as the previous pick. Because pausing switches to the menu loop, resuming after a pause starts a different race track. Pickup, checkpoint, off-road (including its fuel penalty), crash and game-over tones provide feedback (short oscillator beeps/thuds on the effects bus).

The current soundtrack is a synthesized procedural loop set, not a catalog of composed/licensed songs. Audio hardware behavior and subjective mixing still require physical-device review.

Model sizes, common-scale garage previews, skyline fog and the earlier audio mix: [vehicle-balance-v3.md](../docs/vehicle-balance-v3.md); per-vehicle widths, braking rates and squeal levels live in `src/game/vehicle-tuning.ts`.

Normal Uno uses `vehicle-uno-v1.png`: three transparent authored poses derived from the ladder Uno reference, with a clean roof. See [provenance and poses](../docs/uno-v1.md). Its audio retains the former Uno profile; the meme ladder version keeps four cylinders but stretches its five gear limits to 60/120/200/300/400 km/h. Both are synthesized approximations.
