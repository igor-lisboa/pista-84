# 04 — Interface and controls

[Specification index](README.md) · Implementation: [app.js](../pista-84/src/app.js), [garage.js](../pista-84/src/garage.js), [HTML](../pista-84/web/index.html), [CSS](../pista-84/web/style.css)

## Initial menu

The initial screen contains the PISTA 84 identity, animated scene, **JOGAR**, **GARAGEM**, **CELULAR COMO CONTROLE**, settings, selected vehicle, record and coin balance. Vehicle selection is available through both garage entry points. Starting hides the entire menu.

## Race interface

Only the road, vehicles and essential information remain during play:

- Distance in kilometers, localized to `pt-BR` with two decimals.
- Speed in km/h, padded to three digits.
- Fuel percentage and bar; the bar changes to a warning color below 25.
- Pause button and a small upcoming-curve hint when curvature magnitude exceeds 0.5.
- Touch steering/pedals when applicable.
- Brief pickup/impact feedback, rather than a persistent notification panel.

Desktop with a fine pointer uses the compact lower-right HUD. Touch layouts retain the upper HUD to leave the bottom corners for controls. Garage, wallet, record, backup, audio settings and keyboard help must not surround the race canvas.

## Pause and result overlays

Pause offers continue, options and initial menu. Settings are a modal over the paused state. Returning to the menu ends the active run and settles progress.

The result displays the failure reason, distance and run coins. Actions are restart, one free second chance if unused, and initial menu. Restart creates a new run rather than restoring the failed one.

## Garage

Eight cards show model sprite, description, maximum speed, acceleration, consumption, resistance and purchase/selection state. Paints have their own section. File import/export and hosted account-backup controls are available here. Changing vehicle returns to the initial menu; changing paint affects appearance only.

## Settings

Sound toggle, optional tilt, calibration, fullscreen, installation where the browser provides an install prompt, and compact control help. Sound state is saved. Tilt is enabled per session, not automatically granted from a saved preference. Fullscreen failure must not block play; Safari can use Add to Home Screen instead.

## Input mapping

| Action | Desktop | Touch / phone controller |
| --- | --- | --- |
| Steer left/right | Left/right arrows, A/D | Separate left/right buttons or optional tilt |
| Accelerate | Up arrow, W | Accelerate pedal |
| Brake | Down arrow, S, Space | Brake pedal |
| Start | Enter / JOGAR | JOGAR, or remote **Iniciar corrida** |
| Pause/continue | P, Escape / pause button | Pause button / remote **Pausar**, overlay Continue |

Input must not override typing in form fields. Keyboard controls do not act through an open modal. Default arrow/space scrolling is prevented when controlling the game.

## Touch behavior

- Support independent simultaneous touches: steering and a pedal can be held together.
- Use Pointer Events and pointer capture where available; fall back to touch/mouse listeners otherwise.
- Track touch/pointer identity; release, cancellation and lost capture clear the corresponding held action.
- Control buttons suppress browser context menus and gesture scrolling; a release must not leave an input stuck.
- Touch feedback visually marks held buttons.

## Tilt behavior and Safari

Tilt is optional and starts from an explicit button gesture. Require a secure context and motion permission where the browser exposes `DeviceOrientationEvent.requestPermission()`.

The first sensor sample after activation becomes neutral. Calibration resets neutral to the current comfortable position. Read gamma in portrait and signed beta in landscape; normalize by **25 degrees**, apply a **0.06** dead zone and clamp to [-1, 1]. Rotation recalibrates on the next sample. No sample within **5 s** disables tilt and directs the player to buttons.

Permission rejection, missing sensors and unsupported audio/fullscreen must leave solo touch play available. On Safari the controller uses HTTPS compatibility transport; see [remote control](07-remote-control-api.md).

## Responsive layout and focus

Use actual `visualViewport.height` when available and safe-area insets for notches/home indicators. Canvas backing resolution follows its displayed aspect ratio instead of cropping a wide road into portrait. Internal render width is 480 on displays narrower than 600 CSS pixels, otherwise 960; backing height follows the viewport ratio.

Layouts cover portrait, landscape and short landscape menus. Hidden race/menu layers must not intercept taps. Hiding the document pauses the game. Touch-device browser-chrome blur alone does not pause it. Wake lock is best-effort, not a requirement to play.

## Phone-controller screen

Dedicated controller layout: connection status, start, pause, optional tilt/calibration, steering buttons, brake and accelerator. The wheel illustration reflects steering. Sensor permission is not needed for buttons. Blocking the phone or losing input pauses the main game. The private Site requires authorized login on both devices.
