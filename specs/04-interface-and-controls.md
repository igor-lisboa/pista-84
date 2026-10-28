# 04 — Interface and controls

[Specification index](README.md) · Implementation: [`src/ui/`](../src/ui/) (`game-app.ts`, `hud.ts`, `input.ts`, `overlays.ts`, `settings.ts`, `garage.ts`, `remote-dialog.ts`, `controller-page.ts`), [`src/i18n/`](../src/i18n/), [HTML](../web/index.html), [CSS](../web/style.css)

## Look

The 1.4 interface is a sunset-arcade cabinet: deep purple background, sun-yellow, hot pink and cyan accents, **Bungee** (display) and **Chakra Petch** (text) loaded from Google Fonts with system fallbacks (Impact/Arial Black and Segoe UI/system-ui, plus Japanese system fonts), hard outlines, offset shadows with no blur, square corners and a checkered strip at the top of the menu. The fonts are optional; the page must remain usable offline without them.

## Initial menu

The initial screen contains the PISTA 84 identity, animated scene, **JOGAR**, **GARAGEM**, **CELULAR COMO CONTROLE**, a settings button (⚙), selected vehicle (with a "change vehicle" link), record distance and coin balance. Vehicle selection is available through both garage entry points. Starting hides the entire menu. Enter also starts a run.

## Race interface

Only the road, vehicles and essential information remain during play. The HUD is a **top bar only**:

- **Left:** speed in km/h, padded to three digits.
- **Centre:** distance in kilometers (two decimals, localized), the score in points with the live pace multiplier (`1234 PTS · x1.4`), a checkpoint progress bar with the next checkpoint label (replaced by an off-road warning while on the grass) and a marker for the saved distance record.
- **Right:** fuel percentage and bar (the bar changes to a warning color below 25) and the pause button.
- A small upcoming-curve hint (below the bar, left) appears when the bend ahead (about 108 m) exceeds 0.45 in magnitude, and blinks when it exceeds 0.8 above 150 km/h.
- Touch steering/pedals when applicable.
- Brief pickup/checkpoint/record/off-road feedback text over the road, rather than a persistent notification panel.

The text refreshes about 12 times per second. The bottom corners are reserved for the touch controls. Garage, wallet, record, backup, audio settings and keyboard help must not surround the race canvas.

## Pause and result overlays

Pause offers continue, options and initial menu. Settings are a modal over the paused state. Returning to the menu ends the active run and settles progress.

The result displays the failure reason, score in points, distance, run coins and the best score. A crash (any contact with traffic or the barrier) shows the crash title **"VOCÊ BATEU!"** ("YOU CRASHED!", localized) and the impact speed; an empty tank shows the ordinary end title. Actions are restart, one free second chance if unused, and initial menu. Restart creates a new run rather than restoring the failed one.

## Garage

Eighteen cards show model sprite, tagline, maximum speed, acceleration, consumption and purchase/selection state. All cars show their coin price, with purchase buttons disabled until the wallet can afford them. Paints have their own section. File import/export and hosted account-backup controls are available here. Changing vehicle returns to the initial menu; changing paint affects appearance only.

## Settings (Options)

Language picker (a wrapping grid of fifteen SVG flag buttons, active one highlighted), a single sound toggle for music + engine + effects, optional tilt, calibration, fullscreen, an always-visible installation button (native prompt when available; Home Screen instructions otherwise; disabled when running as an installed app), compact control help and the version label. Sound state is saved (default **on**). Tilt is enabled per session, not automatically granted from a saved preference. Fullscreen failure must not block play; Safari can use Add to Home Screen instead.

## Languages

Fifteen interface languages: **pt-BR** (source), **en**, **pt-PT**, **fr**, **it**, **ja**, **de**. The choice is made in Options, applied immediately without reload and saved as `lang` in the save. With no saved choice the language comes from `navigator.languages` (`pt` maps to pt-BR unless it is pt-PT; other tags match by base language); an unknown language falls back to English. Message keys are typed from the pt-BR table; a locale may omit keys and then falls back to pt-BR per key (pt-PT only overrides part of the table). Tests require every full locale (en, fr, it, ja, de) to translate every key with the same `{placeholders}` and forbid unknown keys. Static HTML is translated through `data-i18n` and `data-i18n-aria` attributes. The phone controller page also follows the browser language. Translations still need native-speaker review (I18N-01 in the [roadmap](09-roadmap.md)).

## Input mapping

| Action | Desktop | Touch / phone controller |
| --- | --- | --- |
| Steer left/right | Left/right arrows, A/D | Separate left/right buttons or optional tilt |
| Accelerate | Up arrow, W | Accelerate pedal |
| Brake | Down arrow, S, Space | Brake pedal |
| Start / continue | Enter / JOGAR | JOGAR, or remote **Iniciar corrida** |
| Pause/continue | P, Escape / pause button | Pause button / remote **Pausar**, overlay Continue |

Input must not override typing in form fields. Keyboard controls do not act through an open modal. Default arrow/space scrolling is prevented when controlling the game. Keyboard, on-screen buttons, tilt and a paired phone are merged into one drive input per frame.

## Touch behavior

- On coarse-pointer devices the **pedals sit at the bottom right** (accelerate and brake) and the **steering arrows at the bottom left**. While tilt steering is on (`body[data-tilt=on]`) the arrows are hidden.
- Support independent simultaneous touches: steering and a pedal can be held together.
- Use Pointer Events and pointer capture where available; fall back to touch/mouse listeners otherwise.
- Track touch/pointer identity; release, cancellation and lost capture clear the corresponding held action.
- Control buttons suppress browser context menus, gesture scrolling and double-tap zoom; a release must not leave an input stuck. Native touch completion is cancelled even on Pointer Events browsers to prevent Safari double-tap zoom. The surrounding app uses `touch-action: manipulation`.
- Touch feedback visually marks held buttons.

## Tilt behavior and Safari

Tilt is optional and starts from an explicit button gesture. Require a secure context and motion permission where the browser exposes `DeviceOrientationEvent.requestPermission()`.

The first sensor sample after activation becomes neutral. Calibration resets neutral to the current comfortable position. Read gamma in portrait and signed beta in landscape; normalize by **25 degrees**, apply a **0.06** dead zone and clamp to [-1, 1]. Rotation recalibrates on the next sample. No sample within **5 s** disables tilt and directs the player to buttons.

Permission rejection, missing sensors and unsupported audio/fullscreen must leave solo touch play available. On Safari the controller uses HTTPS compatibility transport; see [remote control](07-remote-control-api.md).

## Responsive layout and focus

Use actual `visualViewport.height` when available and safe-area insets for notches/home indicators. The fixed 960 x 720 camera is uniformly contained in every viewport without stretching or cropping. On short landscape screens, speed and trip information stack at the upper left while fuel and pause sit at the upper right; the bend warning sits below the left stack. HUD panels stay above the steering buttons and pedals, with horizontal safe-area insets respected.

Layouts cover portrait, landscape and short landscape menus. Hidden race/menu layers must not intercept taps. Hiding the document pauses the game. Touch-device browser-chrome blur alone does not pause it. Wake lock is best-effort, not a requirement to play. `prefers-reduced-motion` disables CSS transitions and animations.

## Audio unlock

Browsers only allow audio after a user gesture. Sound defaults to on in the save, and the first tap, key press or race start switches the audio context on (when the saved preference is on). Until then the menu is silent. If Web Audio is missing the game shows a toast and stays playable.

## Phone-controller screen

Dedicated controller layout: connection status, start, pause, steering wheel illustration, optional tilt/calibration, steering buttons, brake and accelerator. The wheel illustration reflects steering. Sensor permission is not needed for buttons. Blocking the phone or losing input pauses the main game. The private Site requires authorized login on both devices.

## Alignment and icon update

Player text uses no emoji; small SVG icons supply consistent controls. HUD card sizes remain stable as numbers change, phone popups are centred with scrollable content, and garage cards and paint options have aligned grids. See [interface-v4.md](../docs/interface-v4.md).

The additional locales are es (Spain), hi, zh-CN, id, ur, bn, ru and am. All eight translate every source key. Urdu uses RTL text while physical driving controls remain LTR. Full locale scope and browser-detection behavior: [languages-v5.md](../docs/languages-v5.md).
