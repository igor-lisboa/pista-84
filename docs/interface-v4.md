# Interface alignment and paint options v4

The main menu centers its portrait stack with breathing room around the identity, actions and selected vehicle. Landscape uses fluid paired columns instead of fixed-width tracks, with separate header tools and footer records. Compact portrait dialogs and pause menus center vertically; long dialogs retain top-first scrolling. Responsive composition lives in `web/menu-layout.css`, included in the offline cache.

Tilt steering uses a screen-facing upright phone, level for straight and rotated like a steering wheel for turns. Settings and the paired controller no longer show calibration controls. Landscape is requested on enable; unsupported locks use a portrait blocker with Use buttons. A blocked phone controller pauses the host and sends neutral driving controls. Sensor loss restores buttons and refreshes the settings switch.

Player-facing strings no longer embed emoji or decorative icon characters. A small inline SVG set in `src/ui/icons.ts` provides consistent artwork for settings, play/pause, steering, controller, coin, fuel, info, trophy, user, volume, fullscreen, install, help, units, tilt, calibration, restart and bend icons. Currency amounts are localized text. Keyboard-help arrows still describe the actual arrow keys; language flags remain authored SVGs.

HUD columns and card dimensions are fixed per responsive layout. Score lines and checkpoint labels cannot resize their parent cards; numeric text uses tabular figures and values stay right-aligned. Phone landscape retains its left/right arrangement.

Desktop pause/results use centered cards. Phone overlays fill the viewport; result cards use two columns on short landscape screens. Phone dialogs fill the viewport in both orientations, and settings/About open at scroll position zero with internal scrolling for long content. Desktop dialogs keep bounded widths. Feedback and toast messages have bounded, centred text blocks.

The first completed demo result adds a highlighted explanation that the GT was a loan and the journey begins with the player's selected owned vehicle (Fusca 76 by default). It introduces racing, coin earnings and garage progression in fifteen languages, with no extra modal. Demo results group their summary separately from actions in landscape, and compact spacing keeps the note and actions visible at 320x568/568x320. Later results omit the note.

Garage grids use zero-minimum tracks, uniform image/title/description areas and fixed-height purchase buttons. Stats use aligned label/value columns with unbroken numeric units. Paint options share equal-width columns. Disabled paint choices retain full swatch opacity so players can see the available colors even before earning their price.

The paint shop has **17 choices including factory paint**, adding scarlet, royal blue, forest green, sunflower yellow, tangerine, violet, ivory, obsidian, metallic silver, turquoise, rose and burgundy. New colors cost 90 or 120 coins. IDs and existing purchases remain compatible. The recoloring pipeline now adjusts luminance for dark/light colors and supports neutral saturation, retaining alpha silhouettes and body shading.

Browser checks cover stable HUD geometry across growing numbers, phone popup centring, garage button alignment, equal-width paint choices, purchase persistence and the brightness difference between black and white across every vehicle and pose.
