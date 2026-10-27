# 05 — Art direction and audio

[Specification index](README.md) · Implementation: [`src/render/`](../src/render/), [`src/audio/`](../src/audio/)

## Reference and visual identity

The latest supplied screenshot is the primary in-game visual reference: a winding grey road with blue/white edges, a city skyline, conifers, muted sky, large rear-view vehicles with visible roofs, and limited HUD information. Earlier mountain/coastal scenery and thin procedural car icons are superseded by the 1.3 art direction.

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
- Camera offset keeps lateral driving readable near the edges. A fixed 960 x 720 camera is uniformly fitted with object-fit: contain, preserving the complete gameplay frame in portrait, landscape and square windows.
- Rain, fog and night remain dynamic rather than fixed into the artwork.
- Road projection spans 104 m; road paint, guardrails, scenery and traffic share the same metre-based motion. Roadside scenery slots are 12 m apart, with a billboard every 19 slots (228 m), alternating sides. Billboard text and colors come from `src/render/billboards.ts`; these are offline house ads, with no ad-network integration or tracking.
- Speed effects use fast = clamp((speed - 35) / 115, 0, 2.75), reaching the previous flat-out intensity at 150 km/h and building through 350 km/h. Streak count/length, bounded vignette opacity, car bob, rumble above 85 km/h and filtered wind noise reinforce speed; impact and off-road feedback remain.

## Vehicle artwork

Authored asset: [vehicle-atlas-v1.png](../web/assets/vehicle-atlas-v1.png). Eight vehicles map to the original catalog IDs: Fusca, Brasília, Gol, Palio, urban motorcycle, Veloce GT, Bruto SUV and Raio sports motorcycle.

The atlas has transparent alpha. Runtime regions are trimmed to visible alpha bounds; every model preserves its own width/height ratio. Motorcycles are narrower; sports-car width is adjusted independently. Garage/menu thumbnails fit the full vehicle inside their canvas rather than cutting off the roof.

Rendering uses nearest-neighbor scaling and disabled Canvas image smoothing. Custom paints remap body-color hues while preserving lightness and transparency. Braking adds light feedback; steering selects separate authored mild/strong rear three-quarter turn frames. Left frames mirror their right counterpart. No row shearing or body rotation is used.

Turn poses: [vehicle-turns-v2.png](../web/assets/vehicle-turns-v2.png) adds 16 transparent frames for the eight atlas models. Full generation prompt and built-in imagegen provenance: [turn-sprites-v2.md](../docs/turn-sprites-v2.md). Straight and turning frames preserve each source frame's aspect ratio using uniform scaling.

### Classic vehicle atlas

Kombi 78, Uno com Escada, Chevette 82, CG 125, Opala SS and Maverick GT use vehicle-classics-v2.png with 18 transparent authored sprites: straight, gentle right turn and hard right turn for every model. Left turns mirror the authored poses. They share the original atlas renderer, alpha cropping, paint remapping and uniform scaling. The hand-composed sprites remain an asset-loading fallback. Prompts, crop layout, camera behavior and review instructions: [vehicle-classics-v2.md](../docs/vehicle-classics-v2.md).

Atlas creation used the built-in imagegen tool followed by a badge-removal edit. Exact prompts and provenance remain in [ART_DIRECTION.md](../docs/ART_DIRECTION.md). The user-provided screenshot itself is not shipped as a game asset.

[reference-scene.png](../docs/screenshots/reference-scene.png) is a deterministic composition drawn by the actual renderer, with a red sports car, yellow sports car, beige Fusca and blue hatch. It is a visual review scene, not a second game mode or evidence of player progression.

## Audio implementation

All audio is synthesized with Web Audio; there are no audio files. The audio context is activated through a user gesture (the first tap or key press unlocks it). Missing support must produce a clear message and leave racing functional. **One toggle** (Options) switches music, engine and effects together; the preference is saved and **defaults to on**.

### Engines

Each of the **14** vehicles has its own engine base frequency, speed ratio, oscillator waveform, low-pass base and braking-noise frequency. Engine frequency is `base + speed × ratio`; filter frequency is `filterBase + speed × 2`. Braking combines louder band-pass noise with a triangle-wave tyre squeal. The noise centre follows the vehicle brake base plus speed times 1.5; squeal pitch follows brake base times 1.35 plus speed times 2, with slight pitch movement. Both respond in 25 ms, fade with speed below 25 km/h, and stop below 2 km/h, on release or pause. The sound toggle controls the full mix. Engine level follows the running state.

| Vehicle ID | Engine base Hz | Speed ratio | Waveform | Filter base Hz | Brake base Hz |
| --- | ---: | ---: | --- | ---: | ---: |
| fusca | 39 | 0.65 | sawtooth | 480 | 650 |
| brasilia | 46 | 0.62 | triangle | 650 | 850 |
| gol | 54 | 0.80 | sawtooth | 720 | 1100 |
| palio | 50 | 0.76 | triangle | 800 | 1000 |
| moto | 95 | 1.40 | square | 1100 | 1500 |
| gt | 27 | 1.10 | sawtooth | 1300 | 2200 |
| suv | 22 | 0.50 | sawtooth | 320 | 520 |
| superbike | 125 | 1.80 | square | 1800 | 2500 |
| kombi | 33 | 0.55 | triangle | 420 | 600 |
| uno | 58 | 0.85 | sawtooth | 760 | 1050 |
| chevette | 48 | 0.78 | sawtooth | 700 | 950 |
| cg125 | 105 | 1.50 | square | 1000 | 1400 |
| opala | 30 | 0.90 | sawtooth | 560 | 800 |
| maverick | 25 | 1.00 | sawtooth | 900 | 1300 |

### Music

Music is procedural: a lookahead scheduler (`src/audio/music.ts`) walks a 16-step grid of data-only tracks (`src/audio/tracks.ts`, four-bar loops with chords, bass, arpeggio, stabs, kick/snare/hats and a per-voice mix) and renders each voice with plain oscillators and noise. Switching between menu and race music crossfades.

| Track | Used for | Tempo | Character |
| --- | --- | ---: | --- |
| `menu` | Menu, pause, result screens | 74 bpm | Calm Am7–Fmaj7–Cmaj7–G6 pad, sine bass and arpeggio, no drums |
| `neon-highway` | Race | 132 bpm | Four-on-the-floor synthwave in A minor |
| `turbo-rush` | Race | 150 bpm | Fast E-minor chase with rolling hi-hats |
| `sunset-drive` | Race | 118 bpm | Laid-back upbeat D-minor groove with off-beat stabs |

The menu loop plays whenever the race is not running; each time race music starts it picks one of the three race tracks at random and never the same one as the previous pick. Because pausing switches to the menu loop, resuming after a pause starts a different race track. Pickup, checkpoint, off-road, crash and game-over tones provide feedback (short oscillator beeps/thuds on the effects bus).

The current soundtrack is a synthesized procedural loop set, not a catalog of composed/licensed songs. Audio hardware behavior and subjective mixing still require physical-device review.
