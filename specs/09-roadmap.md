# 09 — Pending work and completion criteria

[Specification index](README.md)

This is the current backlog, not a list of already delivered features. Priorities: **P0** prerequisite for financial integrity; **P1** distribution/commercial readiness; **P2** optimization or broader validation. A pending item is complete only after both implementation and its stated evidence exist.

## ECO-01 — Server-authoritative commercial economy

**P0 before attaching real money to balances.** Casual coins/backup currently trust the client.

Implement authenticated server-issued race sessions, bounded/plausible progress events, idempotent run settlement, an append-only commercial wallet ledger and authoritative entitlements. Keep imports/backup from granting paid currency or rights. Define a migration policy for existing free coins without treating them as cash credit.

**Accept:** editing localStorage, importing fabricated balances, repeating settlement and racing in two tabs cannot create commercial credit. Only authorized server events alter the ledger; restore never replaces actual paid entitlements.

## COM-01 — Payments, premium currency and paid vehicles

**P1; depends on ECO-01, catalog/prices/countries, provider accounts and credentials.** No payment provider is connected. All cars are priced in coins with no premium distinction, so real-money flows only concern coin packs; a billing integration (web checkout, Google Play or App Store) still has to be built.

Create new migrations for `orders`, `payment_events`, `wallet_entries` and `entitlements`. Implement:

- `POST /api/checkout`: accept an allowed SKU, obtain price/identity server-side, return provider checkout URL and order ID.
- Signed `POST /api/payments/webhook`: validate provider signature/expiration, deduplicate event ID and atomically fulfill confirmed payment.
- `GET /api/entitlements`: return actual paid rights for the authenticated account.
- States `pending → paid → fulfilled`; cancellation/failure grants nothing; refund/revocation updates rights.
- Native receipt validation and restore purchases for the corresponding stores.

**Accept:** sandbox success/failure/cancel, duplicate and invalid webhooks, refunds, receipt restoration on a second device and forged balance attempts; purchased coin packs are credited only after a confirmed entitlement. Activate real sales only after provider configuration and successful sandbox validation.

## ADS-01 — Rewarded ads and ad removal

**P1; depends on provider account, ad units/SDK and server-issued race/reward identity.** The existing second chance remains explicitly free.

Provide an `isAvailable / showRewarded / removeAds` adapter. Support `continue` and `double_coins` rewards tied to a unique run/event, validated through the provider where supported. Opening/closing an ad is not proof of completion. Unavailable ads must not block restarting. Respect the paid remove-ads entitlement.

**Accept:** completion grants one reward; cancellation/error grants none; repeated callbacks cannot duplicate; continuation/doubling limited to once per run; ad-free users receive no ordinary ads.

## NET-01 — TURN and direct-connection optimization

**P2; optional for basic operation because HTTPS fallback exists.** Requires a configured TURN provider and temporary credentials.

Add an authenticated ICE-configuration endpoint with expiring TURN credentials, limits/metrics and ICE restart. Never put durable secrets in the bundle.

**Accept:** a forced `iceTransportPolicy: 'relay'` connection across restrictive Wi-Fi/mobile networks; expiration/renewal; safe pause on loss; no stuck inputs; latency/request-cost comparison with the HTTPS fallback.

## NET-02 — Active remote sessions beyond ten minutes

**P2; current implementation limit found during specification audit.** Rooms expire ten minutes after creation and inputs do not renew them; the current timer also expires an active controller session.

Separate the initial pairing deadline from active-session lifetime. Renew or heartbeat a connected session with bounded inactivity expiration, preserve one-controller authorization and provide explicit host termination. Do not silently turn an expired pairing link into an unlimited reusable invitation.

**Accept:** a run/controller remains functional beyond ten minutes while active; inactive sessions expire; old links cannot claim another controller; reconnect/new QR still works; expiration clears input and pauses safely.

## NAT-01 — Android build, signing and distribution

**P1; generated/synced project exists, but validated binaries do not.** The verified development environment lacked JDK/Android SDK tooling.

Install compatible tools, run `npm run native:sync`, build `android/gradlew.bat assembleDebug`, and install on an Android device. Configure a private release keystore outside source control and produce a signed AAB for an internal Play track.

**Accept:** debug installation and startup; signed internal-track release; audio, focus/resume, rotation, controls and persisted progress validated. Successful generation/sync alone is insufficient.

## NAT-02 — iOS build, signing and TestFlight

**P1; generated/synced Xcode project exists.** Requires macOS/Xcode, package resolution and Apple signing/team configuration.

Open `ios/App/App.xcodeproj`, set the final application identity/team, resolve Swift packages, compile and sign. Preserve the motion-use description. Certificates/provisioning profiles must remain outside the repository.

**Accept:** simulator build, physical iPhone run, granted/denied motion permission, rotation, audio after interruption and a signed TestFlight build. In-app payments additionally depend on COM-01.

## ART-01 — Authored atlas art for the six newer vehicles

**Implemented.** All fourteen vehicles now have authored straight, gentle-turn and hard-turn sprites, mirrored left turns and runtime paint remapping. The six classic vehicles use vehicle-classics-v2.png; procedural art remains an asset-loading fallback. All 18 new cells have transparent borders, and browser checks compare cropped poses to reject sideways translations. See [provenance, prompts and review captures](../docs/vehicle-classics-v2.md).

## I18N-01 — Translation review

**P2 before wider distribution.** The six non-source locales (en, pt-PT, fr, it, ja, de) have not been reviewed by native speakers, and pt-PT only overrides part of the pt-BR table (the rest falls back to pt-BR).

Have a native speaker per language review every string for tone, length in the HUD, overlays and buttons, and complete pt-PT if full coverage is wanted. Verify fonts for Japanese on target devices (the CSS uses system Japanese fallbacks, not a bundled font).

**Accept:** a reviewer sign-off per language, no truncated or overflowing text at 390 px wide, and the i18n tests still passing (add pt-PT to the full-coverage test if completed).

## QA-01 — Physical-device validation

**P1 before public mobile distribution.** Automated Chromium/WebKit results do not replace actual devices.

Test Android Chrome/native and iPhone Safari/native in portrait/landscape. Exercise tilt permission denial, calibration, dead zone, simultaneous touches, screen lock, resume, sensor loss and battery behavior. Run at least 15 minutes per platform through rain/night/fog, recording FPS, memory and temperature. Define the minimum supported device; target 30 sustained FPS there. Native-wrapper remote control needs separate authentication/service validation before enabling it.

**Accept:** report listing device, OS, browser/build, results and resolved defects; no claim of physical support based only on emulation.

## QA-02 — Balance and broader browser/release validation

**P2 before commercial release.** Complete human playtests and broader browser/update checks.

Test Chromium, Firefox and WebKit; PWA install/update; at least ten runs per vehicle category (14 vehicles); fuel availability, coin prices against score-based earnings, the pace multiplier, the 240 s traffic ramp, survival time and avoidable traffic layouts. Validate save migration, offline/online transitions, service-worker upgrades, keyboard focus and touch target sizes.

**Accept:** recorded metrics drive balance changes; all vehicle categories remain viable; no update loses legitimate progress; no unsupported global browser/device claim.

## Dependency order

Run physical/balance QA alongside native tool provisioning. ART-01 is implemented; I18N-01 remains independent content work. Address ECO-01 before COM-01. Configure providers before ADS-01. NET-01 is optimization; NET-02 is a separate functional lifetime limitation. Do not mark purchases, ads or store releases delivered merely because their future API contracts are documented here.
