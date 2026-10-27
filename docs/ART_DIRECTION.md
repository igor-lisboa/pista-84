# PISTA 84 — art direction 1.4

Reference: image supplied by the user in this conversation, used as visual direction; not included as an asset in the game.

## Integrated result

- Chase camera with the horizon at 27.5% of the screen, larger vehicles, with the roof and rear visible.
- Layered city, pixel-cluster clouds, conifers with shadows and a blue/white shoulder.
- Transparent atlas with eight vehicles (`web/assets/vehicle-atlas-v1.png`) and a turn sheet with 16 poses (`vehicle-turns-v2.png`, see [turn-sprites-v2.md](turn-sprites-v2.md)); rendering without smoothing and cutouts by alpha bounds. Paints keep working through color remapping at runtime.
- **Six new vehicles without atlas art** (Kombi 78, Uno com Escada, Chevette 82, CG 125, Opala SS and Maverick GT): they use procedural 128×80 pixel-art sprites drawn on Canvas by `src/render/sprites.ts` (two-tone Kombi with a split rear window, Uno with a roof ladder, Chevette with round taillights, Opala with a long trunk, Maverick with a black stripe and three taillights). The same procedural sprites serve as a fallback for the eight atlas cars if the PNG cannot load. Authored atlas art for these six vehicles is still pending (ART-01 in the [roadmap](../specs/09-roadmap.md)).
- Skyline and trees are original Canvas code (`src/render/scenery.ts`), with caching to avoid redrawing thousands of windows per frame.
- `docs/screenshots/reference-scene.png` is a deterministic composition made by the real renderer (`node scripts/reference-shot.ts`), with a red sports car, a yellow sports car, a Beetle and a blue hatchback. It is not a generated mockup.
- **Interface 1.4 (arcade sunset):** dark purple background, sun yellow, pink and cyan; Bungee (headings) and Chakra Petch (text) fonts via Google Fonts, with a system fallback; hard outlines, offset shadows without blur and a checkered strip at the top of the menu. The HUD is just a top bar (speed on the left; distance, points and checkpoint in the center; fuel and pause on the right). The bottom corners are left for touch controls.

## Provenance and tooling

Atlas created by the integrated `image_gen` tool, built-in mode, with transparency. The second call removed emblems. No secret or API key was needed. The full prompts are below.

### Generation

Use case: stylized-concept. Asset type: production transparent sprite atlas for a playable 16-bit pseudo-3D racing game. Reference image role: the attached user image is a visual style/camera reference, not an edit target. Create ONE square transparent PNG atlas containing exactly EIGHT original vehicle sprites arranged on a precise 4-column by 2-row grid, each vehicle entirely inside its cell with ample transparent separation. No labels, text, ground, road, shadow background, grid lines, logos or watermark. All vehicles face away from the viewer, viewed from elevated rear chase camera at about 35 degrees down: visible roof, rear windshield, rear deck and substantial rear bumper, rear wheels, subtle view of sides. Each sprite is symmetric rear view, aligned straight ahead, high quality hand drawn pixel art like the supplied 1990s 16-bit racing screenshot. Crisp pixel clusters, dark blue outlines, sophisticated limited-palette highlights and body shading, clearly readable taillights and chrome/exhaust, no smooth illustration or photoreal 3D. Row 1 left to right: (1) rounded beige 1970s Brazilian beetle with curved roof and oval rear window, round tail lamps and chrome bumper; (2) mint green boxy vintage Brazilian station wagon; (3) cobalt blue rounded 1990s hatchback; (4) orange compact 1990s hatchback. Row 2 left to right: (5) small white commuter motorcycle with helmeted rider, rear view; (6) bright red classic exotic wedge supercar with dark rear louvered deck, broad horizontal taillights, rear spoiler and twin exhausts, similar visual detail and proportions to the central red car in the reference; (7) olive-beige rugged boxy 4x4 SUV, rear spare tire; (8) purple sports motorcycle with helmeted rider. Ensure each car has substantial vertical depth like the reference, NOT a flat thin rear bumper icon. Sprites at consistent camera angle and scale; motorcycles narrower. Canvas square; each cell quarter canvas width and half height. Every sprite centered in its cell. True transparent alpha background.

### Final adjustment

Edit only tiny identifying emblems/logos on the cars: remove the small horse badge at the center of the red sports car rear and replace that tiny area with the same plain dark grille pixels. Remove any other tiny maker insignia while preserving body pixels. Keep every vehicle, its position, size, colors, pixel-art details and transparent alpha exactly unchanged. Do not rearrange, redraw, crop, add text or change the canvas dimensions. This is the final transparent sprite atlas used in a playable game.

