---
name: pista-vehicles
description: Add PISTA 84 vehicles or change existing vehicle speed, acceleration, handling, braking, engine sound and sprites, preserving saved ownership.
---

Read `AGENTS.md`, specs 02/03/05 and `pista-docs` before implementation. Existing IDs are save identities: never rename or reuse them to rebalance a car. State the requested change in spec 03 first; preserve all unrequested stats, prices and ownership.

For real models, identify year, trim and engine. Browse manufacturer manuals, archives or technical sheets for maximum speed, 0-100, engine cylinders, RPM and gearbox. Record exact URLs and distinguish published specifications, estimates and game values. When sources disagree, record the chosen variant and uncertainty. Explicit meme/arcade requests override realism (notably `uno` with ladder); never present these as real specifications. Do not silently retune the whole fleet.

For acceleration changes inspect `cars.ts` AND `vehicle-tuning.ts`. Measure 0-100 and 70/90/95% times through `Race` at 20 ms steps, no traffic, unlimited fuel and centered steering. Keep taper smooth, positive below max and zero at max. Validate initial pull and approach to max independently; update `docs/acceleration-v6.md` and tests. Test save sanitization/merge with new IDs and preservation of old ownership.

For additions, match the existing authored atlas quality and elevated rear camera. Use imagegen for raster assets, preserving provenance/prompt. Require a transparent sheet with complete straight, mild-right and strong-right poses; mirror left poses. Verify cropped poses differ in silhouette/perspective, not just translation. Preserve aspect ratio with uniform scaling, scale against fleet widths, and check mirrors/tyres/roof margins, paint masks and brake lights. Supply a contact sheet showing straight, both turn strengths in both directions, and factory/custom paint with braking. Review real gameplay as well as garage previews. Procedural art is only a loading fallback.

Register the ID in catalog, tuning, all locale taglines, audio profile, atlas loading/counts, paint masks, fallback renderer and service-worker assets/cache. For audio use documented cylinder/RPM/gear references and a model-specific harmonic profile; compare audible shifts and load at idle/launch/cruise/redline. Synthesized resemblance is not a real recording or certified fidelity. Record physical-speaker review as pending when unavailable.

Run the checks in AGENTS.md and relevant sprite/browser specs. Update owning specs, roadmap, matrix, baseline, provenance and evidence in the same change.
