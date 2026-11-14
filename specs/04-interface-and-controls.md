# 04 — Interface and controls

[Specification index](README.md) · Implementation: [`src/ui/`](../src/ui/) (`game-app.ts`, `hud.ts`, `input.ts`, `overlays.ts`, `settings.ts`, `garage.ts`, `remote-dialog.ts`, `controller-page.ts`), [`src/i18n/`](../src/i18n/), [HTML](../web/index.html), [CSS](../web/style.css)

## Look

The 1.4 interface is a sunset-arcade cabinet: deep purple background, sun-yellow, hot pink and cyan accents, **Bungee** (display) and **Chakra Petch** (text) loaded from Google Fonts with system fallbacks (Impact/Arial Black and Segoe UI/system-ui, plus Japanese system fonts), hard outlines, offset shadows with no blur, square corners and a checkered strip at the top of the menu. The fonts are optional; the page must remain usable offline without them.

## Initial menu

The initial screen contains the PISTA 84 identity, animated scene and five action buttons: **JOGAR**, **GARAGEM**, **COMPRAR MOEDAS**, **RANKING** and **CELULAR COMO CONTROLE**. The top-right corner has two icon buttons: About (info) and Settings. Below are the selected vehicle (with a "change vehicle" link), the record distance and the coin balance, plus an "Enter to play" hint. Vehicle selection is available through both garage entry points. Starting hides the entire menu. Enter also starts a run.

- **Buy coins** is for signed-in players. A guest sees a localized notice that an account is needed, with no packs. A signed-in player sees a placeholder dialog that previews packs of 1,000, 3,000 and 7,500 coins at R$ 9.90, R$ 24.90 and R$ 49.90 with disabled "coming soon" buttons and a note that purchases are unavailable. Real-money coin packs remain pending work ([ECO-01 and COM-01](09-roadmap.md)).
- **Ranking** opens the online leaderboard: five pilots per page with rank, name, score and distance, the caller's own row marked "YOU" and previous/next paging. It needs a connection. Guests (no signed-in session) see a short localized message and an explicit Log in / Sign up button; no ranking request is made.
- **About** shows the author card (Igor Lisboa, GitHub link) and the project's story.

Playing never requires an account. Every control, the race, the tutorial, the demo and saving locally work offline, with or without a signed-in account; a guest can play indefinitely with no network request blocking any screen.

### First launch and tutorial

The first completed demo result includes a localized transition note: the GT was a demo loan, and the player's PISTA 84 journey now begins with the selected owned vehicle (Fusca 76 for a new player), racing to earn coins and grow the garage. It appears with the results rather than opening another modal, does not repeat on a continued demo or later races, and never changes the player's saved vehicle choice. Restart/menu/account/second-chance actions remain available.

On a new device, first launch opens only the five-step tutorial, with Back/Next and Skip. Closing or finishing it sets `tutorialDone`. No account form opens automatically at launch. The first run after the tutorial is the one-time Veloce GT demo. Its result offers an optional Log in / sign up action alongside restart and menu; it does not interrupt the result with a form. Players can ignore accounts indefinitely. Settings and the guest leaderboard provide explicit login/signup entry points. Later results retain the optional login action. If a new player has not moved after 5 seconds, the tutorial opens again and the run restarts when it closes. The demo announcement is one short line.


## Race interface

Only the road, vehicles and essential information remain during play. The HUD is a **top bar only**:

- **Left:** speed padded to three digits, in km/h or mph according to the Units setting.
- **Centre:** distance (km or mi, two decimals, localized), the score in points with the live pace multiplier (`1234 PTS · x1.4`; it drops after grass excursions until the next checkpoint), a checkpoint progress bar with the next checkpoint label (replaced by an off-road warning while on the grass) and a marker for the saved distance record.
- **Right:** fuel percentage and bar (the bar turns pink below 25), the pause button, and a red "-15%" flash under the gauge each time a grass excursion costs fuel.
- A small upcoming-curve hint (below the bar, left) appears when the bend ahead (about 108 m) exceeds 0.45 in magnitude, and blinks when it exceeds 0.8 above 150 km/h.
- Touch steering/pedals when applicable.
- Brief pickup/checkpoint/record/off-road feedback text over the road, rather than a persistent notification panel.

The text refreshes about 12 times per second. The bottom corners are reserved for the touch controls. Garage, wallet, record, account, audio settings and keyboard help must not surround the race canvas.

## Pause and result overlays

Pause (headed "A stop on the road" / "Paused") offers continue, options and initial menu. Settings are a modal over the paused state. Returning to the menu ends the active run and settles progress.

Every five seconds of racing, progress is saved locally and queued in the durable
offline outbox, without API calls. For signed-in players, automatic score/progress uploads run only on
first entry (launch), pause, game end, return to the menu or page exit/backgrounding. Guests upload nothing. Reconnecting does
not upload during play. Network failure never blocks these transitions or erases
local progress; the next permitted event retries. Resuming defers any unsent upload.

The result displays the failure reason, score in points, distance, run coins, the score-to-coins conversion (25 points = 1 coin, rounded down) and the best score; the panel fills phone screens in either orientation and uses a compact two-column layout on short landscape screens; essential result actions fit without scrolling. A crash (any contact with traffic or the barrier) shows the crash title **"VOCÊ BATEU!"** ("YOU CRASHED!", localized) and the impact speed; an empty tank shows the ordinary end title. Actions are restart, the **1,000-coin second chance** and initial menu. A guest also sees an **enter** action (labelled Log in / Sign up) that opens the sign-up / log-in screen from the result, so a player can enter at any game end; signed-in players do not see it. The second-chance button appears only while the run's single continuation is unused; it shows the price and the current balance ("one purchase per run") and is disabled while the wallet cannot pay. Restart creates a new run rather than restoring the failed one.

## Garage

Twenty-one cards, in ascending coin-price order, show model sprite, tagline, maximum speed, acceleration, consumption and purchase/selection state. All cars show their coin price, with purchase buttons disabled until the wallet can afford them. Paints have their own section (seventeen choices including factory paint). Two controls, **export** and **import** of a progress file, are available here when `PISTA84_PROGRESS_TOOLS=true` (the default). Setting it to `false` hides both controls and their disclaimer; automatic local saving and sync continue. There is no manual cloud backup or restore button. Changing vehicle returns to the initial menu; changing paint affects appearance only.

## Settings (Options)

The optional-account note is shown only to guests. Signed-in players see their account row without that note.

The options dialog has four groups. **Player:** a single Account row (there is no separate "new player"
action). **Game:** language picker, units, sound and tutorial. **Controls:** tilt, calibration, sensor status and keyboard help. **Device:** fullscreen and install. The dialog ends with a version label. The Account screen offers sign up / log in; for a signed-in player it shows the
username, a change-password form (current and new password) and logout. Changing the
password re-checks the current one, signs every other device out and keeps this device
signed in. The post-demo account screen and the guest Account screen share one layout: a
two-sided "Sign up | Log in" switch with the selected side highlighted, a short hint for
that side, labelled username/password fields and one full-width submit button that shows a
"please wait" label while the request runs. On the post-demo account screen "Play without an account" is always
available and keeps the player a guest; no name is needed. Closing the account form returns to the game with
the guest save unchanged. Forms use
password-manager autocomplete; passwords accept 5–128 Unicode characters with no
composition requirements. All account text is
localized. Login merges local and cloud progress before adopting the account
identity. Usernames are lower case, 3–16 characters of a–z, 0–9, `_` and `-` (no spaces; the field cleans text as it is typed). The signed-in pilot name always matches the unique account username, including after reload/import/restore. A duplicate signup keeps the form open, explains that the pilot name/username is already in use, and selects the username field so the player can choose another. Guests have no account name; the local save keeps the guest player id and no username is reserved. Failures keep local progress and allow retry. Expired sessions allow
reauthentication to the same account. Signed-in name actions open the
account screen, preventing accidental account renaming or identity replacement.
Logout explains that local records and unsynced data are cleared while the cloud
account remains; only sound, language and units carry into the empty guest save.
Successful logout also refreshes other open game tabs. A network failure during
session revocation reports failure and leaves local records available.

The online leaderboard is reserved for signed-in players. A guest opening it sees a
short localized message explaining that, with no ranking request and an explicit login/signup button.

Every dialog's close button is fixed in the dialog's top corner: it stays visible while a
long dialog scrolls, so the player never has to scroll back up to close it.

The sound switch displays the saved preference while the browser unlocks audio.
A delayed audio-context resume cannot override a later explicit sound choice.

Game group: the language picker is a wrapping grid of fifteen SVG flag buttons (active one highlighted); the **units** row toggles kilometres and miles for speed and distance (saved as `units`, default km); a single sound toggle controls music + engine + effects; the **tutorial** row replays the how-to-play steps. Controls group: optional tilt, calibration (shown only while tilt is on), sensor status and compact control help. Device group: fullscreen and an always-visible installation button (native prompt when available; Home Screen instructions for iOS or other browsers otherwise; disabled and relabelled when running as an installed app). Sound state is saved (default **on**). Tilt is enabled per session, not automatically granted from a saved preference. Fullscreen failure must not block play; Safari can use Add to Home Screen instead.

## Languages

Fifteen interface languages: **pt-BR** (source), **en**, **pt-PT**, **fr**, **it**, **ja**, **de**, **es**, **hi**, **zh-CN**, **id**, **ur**, **bn**, **ru** and **am**. The choice is made in Options, applied immediately without reload and saved as `lang` in the save. With no saved choice the language comes from `navigator.languages` (`pt` maps to pt-BR unless it is pt-PT; other tags match by base language); an unknown language falls back to English. Message keys (252 today) are typed from the pt-BR table; a locale may omit keys and then falls back to pt-BR per key (only pt-PT does this: it overrides 185 keys). Tests require every locale except pt-PT to translate every key with the same `{placeholders}`, forbid unknown keys and forbid emoji. Static HTML is translated through `data-i18n` and `data-i18n-aria` attributes. The phone controller page also follows the browser language. Translations still need native-speaker review (I18N-01 in the [roadmap](09-roadmap.md)).

## Input mapping

| Action | Desktop | Touch / phone controller |
| --- | --- | --- |
| Steer left/right | Left/right arrows, A/D | Separate left/right buttons or optional tilt |
| Accelerate | Up arrow, W | Accelerate pedal |
| Brake | Down arrow, S, Space | Brake pedal |
| Start / continue | Enter (while not racing) / JOGAR | JOGAR, or remote **Iniciar corrida** |
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

Tilt is optional, starts from an explicit button gesture and is for landscape play. Require a secure context and the motion and orientation permissions where the browser exposes `requestPermission()` (iOS asks for both). While tilt is on the page asks for landscape: where the lock is refused (iOS Safari, or a tab outside fullscreen) a "turn your phone" prompt covers the game and a running race pauses until the phone is landscape again.

Steering reads the phone's **roll in its own screen plane from gravity** (`devicemotion`, `accelerationIncludingGravity`), mapped onto the screen axes for the current orientation. It does not use Euler angles, so it does not wrap or flip past 90° and does not depend on how square the phone is held. The sign convention is fixed once from the upright reading, so Android and iOS steer the same way. The first sample after activation becomes neutral; calibration resets neutral to the current comfortable position. The roll is normalized by **25 degrees**, has a **0.06** dead zone and is clamped to [-1, 1]. `deviceorientation` Euler angles are used only when no motion sample arrives. Rotation recalibrates on the next sample. No sample within **5 s** disables tilt and directs the player to buttons.

Permission rejection, missing sensors and unsupported audio/fullscreen must leave solo touch play available. Every browser, including Safari, uses the WebSocket controller transport; see [remote control](07-remote-control-api.md).

## Responsive layout and focus

The initial menu centers its identity, action stack and selected vehicle in portrait, with flexible breathing room above and below. Landscape uses a centered, fluid two-column composition: identity and vehicle on one side, actions on the other. Header tools and footer records remain separate from the content; all five actions stay reachable at 320x568 and 568x320 without horizontal overflow. Compact portrait dialogs and pause content center vertically when they fit; long dialogs keep their top-first internal scrolling.

Use actual `visualViewport.height` when available and safe-area insets for notches/home indicators. The fixed 960 x 720 camera is uniformly contained in every viewport without stretching or cropping. On short landscape screens, speed and trip information stack at the upper left while fuel and pause sit at the upper right; the bend warning sits below the left stack. HUD panels stay above the steering buttons and pedals, with horizontal safe-area insets respected.

Phone dialogs (width 600 px or less, or landscape height 500 px or less) fill the whole screen inside the safe areas, with the close button in the top corner. On short landscape screens (height 500 px or less) dialog type and spacing tighten so the compact dialogs (sign-up, shop, tutorial) fit without scrolling. Long dialogs (settings, About and garage) begin at the top and scroll internally, with the close button kept in the corner. Result overlays fill phone screens and use two columns in short landscape windows so their essential actions fit without scrolling. The reference for this is an iPhone SE (375 x 667) in portrait and landscape.

Gestures never change the page: pinch zoom is blocked (viewport `maximum-scale=1,user-scalable=no`, plus gesture and multi-touch cancellation), double taps do not select text or zoom, and text selection is off everywhere except form fields. Form fields keep normal selection and editing.

Layouts cover portrait, landscape and short landscape menus. Hidden race/menu layers must not intercept taps. Hiding the document pauses the game. Touch-device browser-chrome blur alone does not pause it. Wake lock is best-effort, not a requirement to play. `prefers-reduced-motion` disables CSS transitions and animations.

## Audio unlock

Browsers only allow audio after a user gesture. Sound defaults to on in the save, and the first tap, key press or race start switches the audio context on (when the saved preference is on). Until then the menu is silent. If Web Audio is missing the game shows a toast and stays playable.

## Phone-controller screen

Dedicated controller layout: connection status, start, pause, tilt toggle and calibration (shown while tilt is on) in the top bar, a steering wheel illustration (rotating up to 50°), left/right steering buttons (hidden while tilt is on), brake and accelerator pedals, and a short note. Start and pause are 700 ms pulses so a lost packet cannot leave them stuck. The phone samples controls every 40 ms and requests a screen wake lock when it can. A link without a room or token shows a "bad link" message. Sensor permission is not needed for buttons. A hidden phone page sends neutral input, and losing input pauses the main game. Inside the native wrapper, the pairing dialog directs the player to the web version.

## Alignment and icon update

Player text uses no emoji; small SVG icons supply consistent controls. HUD card sizes remain stable as numbers change, phone popups fill the viewport in both orientations; long settings and About content starts at the top and scrolls internally, and garage cards and paint options have aligned grids. See [interface-v4.md](../docs/interface-v4.md).

The eight locales beyond the original seven are es (Spain), hi, zh-CN, id, ur, bn, ru and am. All eight translate every source key. Urdu uses RTL text while physical driving controls remain LTR. Full locale scope and browser-detection behavior: [languages-v5.md](../docs/languages-v5.md).

## Translation maintenance contract

Use [pista-localization](../.agents/skills/pista-localization/SKILL.md) for every player-facing wording change. Translate new/changed strings into all fifteen locales with identical placeholders, preserving the meaning and natural regional phrasing. pt-PT remains an explicitly partial legacy table; every new or changed key must nevertheless have a European Portuguese entry. Keep units, model names and controls consistent. Check Urdu RTL and script coverage, short button/HUD wording and iPhone SE layouts. Automated coverage does not constitute native-speaker certification; I18N-01 remains pending.
