# PISTA 84 tech debt

Online data lives in MongoDB (scores, accounts, sessions, account progress and device snapshots) and expiring Redis keys
(pairing rooms, socket presence, controller input, Pub/Sub).
See [STORAGE.md](STORAGE.md) for architecture, configuration and consistency, and
[specs/09-roadmap.md](../specs/09-roadmap.md) for planned work.

## Remaining limitations

- The local Docker stack ([STORAGE.md](STORAGE.md#local-docker-stack)) serves plain HTTP: tilt sensors and Secure cookies cannot be exercised there, and its `/network` endpoint reports the container address, so phone pairing needs the computer's LAN address typed by hand.

- **Client-reported scores.** Scores, distances and coins come from the browser. Accounts require sessions, but there is no
  verified run scoring, anti-cheat or server-side wallet; edited saves and device clock skew are possible. Timestamp-based
  reconciliation is not a currency ledger (ECO-01 before any real-money balance).
- **Score and snapshot writes are separate operations.** A snapshot can commit while score publication fails (or the reverse), so
  callers may need to read the snapshot before retrying and use its current revision.
- **Accounts are minimal.** Password recovery, email verification, MFA, account renaming, account deletion and remote logout of
  all devices (other than the one triggered by a password change) are not implemented.
- **Legacy data.** Guest GUID rows and the `backups` collection remain for compatibility but are no longer written by the
  game; a cross-device snapshot picker is not implemented. Retired guest rows are only cleaned when a ranking read finds them.
- **Native builds** need a separately verified same-origin HTTPS API and cookie setup; packaged static assets alone give no
  account backend. Native-wrapper remote control is directed to the web version.
- **Sockets on Vercel** are bound by function duration limits. Clients reconnect with bounded backoff and Redis coordinates
  instances, but the WebSocket upgrade can only be verified after a real deployment. Rooms still expire ten minutes after
  creation, even when active (NET-02).
- **Old provider data** is not imported or deleted. Retain or import needed records before switching traffic.
- **Vercel backend auto-detection** treats root, `src/` or browser bundles named `app`, `index`, `server` or `main` as server
  entrypoints. Preserve `client.ts`, `game.js` and `dev-server.ts` naming and the tests guarding them (`tests/vercel-config.test.ts`).

## Module-size debt

The 2026-11-15 maintenance refactor resolves the six existing production overages by separating application progress/platform/screens/onboarding, simulation driving/entities, and scene/atlas/fallback art responsibilities. All handwritten production TypeScript stays below 300 physical lines; `npm run quality:modules` enforces the 299-line limit and reports oversized tests separately. The shared atlas manifest and family painter registry replace the former Harley-specific pipeline.

The [maintenance audit](maintainability-2026-11-15.md) records exact module counts, validation, visual fixes and interaction coverage gaps. Oversized browser/Node test modules remain test-organization debt rather than hidden production exceptions. The size gate does not establish good design by itself; responsibility and dependency review remains required.

The locked-install audit reports no production dependency vulnerabilities and six moderate development/native-tool findings through Capacitor/Xcode and filesystem-glob tooling. Native dependency upgrades need their own build validation; no native build or real-device certificate is implied by browser checks.
