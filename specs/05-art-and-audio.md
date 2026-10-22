# 05 — Art direction and audio

[Specification index](README.md)

## Reference and visual identity

The latest supplied screenshot is the primary in-game visual reference: a winding grey road with blue/white edges, a city skyline, conifers, muted sky, large rear-view vehicles with visible roofs, and limited HUD information. Earlier mountain/coastal scenery and thin procedural car icons are superseded by the 1.3 art direction.

The initial menu retains PISTA 84 branding. The reference is a style/composition guide, not a background pasted over an otherwise nonfunctional game.

## Camera, road and scene

- Horizon: **25.5% of canvas height**.
- Player ground position: `horizon + 0.855 × remainingRoadHeight`.
- Curved perspective is shared by road, lane markers, traffic and roadside objects.
- Asphalt is subdued blue-grey; roadside grass has restrained bands rather than a high-contrast neon pattern.
- Blue/white shoulder strips, white road edges and dashed lane separators.
- Layered pixel city with windows, rooftops, antennae and landmark towers; pixel-cluster clouds and shaded conifers.
- City/tree caches avoid rebuilding complex static details each frame.
- Camera offset keeps lateral driving readable near the edges. Portrait and landscape preserve the world aspect ratio.
- Rain, fog and night remain dynamic rather than fixed into the artwork.

## Vehicle artwork

Final asset: [vehicle-atlas-v1.png](../web/assets/vehicle-atlas-v1.png). Eight vehicles map to the catalog IDs: Fusca, Brasília, Gol, Palio, urban motorcycle, Veloce GT, Bruto SUV and Raio sports motorcycle.

The atlas has transparent alpha. Runtime regions are trimmed to visible alpha bounds; every model preserves its own width/height ratio. Motorcycles are narrower; sports-car width is adjusted independently. Garage/menu thumbnails fit the full vehicle inside their canvas rather than cutting off the roof.

Rendering uses nearest-neighbor scaling and disabled Canvas image smoothing. Custom paints remap body-color hues while preserving lightness and transparency. Braking adds light feedback; steering slightly inclines the vehicle. Procedural 128×80 sprites remain a load-failure fallback, not the intended main artwork.

Atlas creation used the built-in imagegen tool followed by a badge-removal edit. Exact prompts and provenance remain in [ART_DIRECTION.md](../docs/ART_DIRECTION.md). The user-provided screenshot itself is not shipped as a game asset.

[reference-scene.png](../docs/screenshots/reference-scene.png) is a deterministic composition drawn by the actual renderer, with a red sports car, yellow sports car, beige Fusca and blue hatch. It is a visual review scene, not a second game mode or evidence of player progression.

## Audio implementation

Web Audio is activated through a user gesture. Missing support must produce a clear message and leave racing functional. Sound preference persists; a subsequent start gesture can resume enabled audio.

Each vehicle has its own engine base frequency, speed ratio, oscillator waveform, low-pass base and braking-noise frequency. Engine frequency is `base + speed × ratio`; filter frequency is `filterBase + speed × 2`. Braking uses band-pass noise while the run is active and speed exceeds 15 km/h.

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

Music is a synthesized chiptune arpeggio with bass/percussive tones. Note interval is `max(0.12, 0.26 - runTime / 1800)` seconds; an additional upper voice appears after 50 seconds. Pickup, impact and game-over tones provide feedback. Engine/music/braking activity follows the running state.

The current soundtrack is a synthesized procedural loop, not a delivered catalog of composed/licensed synthwave songs. Audio hardware behavior and subjective mixing still require physical-device review.
