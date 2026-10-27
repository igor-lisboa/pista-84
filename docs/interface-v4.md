# Interface alignment and paint options v4

Player-facing strings no longer embed emoji or decorative icon characters. A small inline SVG set in `src/ui/icons.ts` provides consistent settings, play/pause, steering, controller, coin and fuel artwork. Currency amounts are localized text. Keyboard-help arrows still describe the actual arrow keys; language flags remain authored SVGs.

HUD columns and card dimensions are fixed per responsive layout. Score lines and checkpoint labels cannot resize their parent cards; numeric text uses tabular figures and values stay right-aligned. Phone landscape retains its left/right arrangement.

Pause/results use a flex overlay with automatic vertical margins: cards are centred when they fit and scroll from the top on short screens. Dialogs are explicitly centred, with bounded widths and scrolling content. Feedback and toast messages have bounded, centred text blocks.

Garage grids use zero-minimum tracks, uniform image/title/description areas and fixed-height purchase buttons. Stats use aligned label/value columns with unbroken numeric units. Paint options share equal-width columns. Disabled paint choices retain full swatch opacity so players can see the available colors even before earning their price.

The paint shop now has **17 choices including factory paint**, adding scarlet, royal blue, forest green, sunflower yellow, tangerine, violet, ivory, obsidian, metallic silver, turquoise, rose and burgundy. New colors cost 90 or 120 coins. IDs and existing purchases remain compatible. The recoloring pipeline now adjusts luminance for dark/light colors and supports neutral saturation, retaining alpha silhouettes and body shading.

Browser checks cover stable HUD geometry across growing numbers, phone popup centring, garage button alignment, equal-width paint choices, purchase persistence and the brightness difference between black and white across every vehicle and pose.
