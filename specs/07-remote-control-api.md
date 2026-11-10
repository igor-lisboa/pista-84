# 07 — Remote control and API contracts

[Specification index](README.md) · Sources: [net/remote.ts](../src/net/remote.ts), [server/signaling.ts](../src/server/signaling.ts), [server/cloud.ts](../src/server/cloud.ts), [server/player-api.ts](../src/server/player-api.ts), [server/auth.ts](../src/server/auth.ts), [scripts/node-server.ts](../scripts/node-server.ts), [worker/index.ts](../worker/index.ts), [ui/remote-dialog.ts](../src/ui/remote-dialog.ts), [ui/controller-page.ts](../src/ui/controller-page.ts)

## Pairing flow

1. The main display creates a Redis room with one HTTP POST, then opens `/api/controller`.
2. Its first socket frame authenticates the host with the room ID, host token and a random session ID. Tokens are never placed in the socket URL.
3. A QR/link opens the phone page with `controller=<roomId>&token=<joinToken>`. The phone retrieves the room with GET and claims it with POST.
4. The phone opens its own socket and authenticates with its controller token and session ID.
5. Commands travel through Redis Pub/Sub to the host socket, even when the two sockets reach different server instances.

There are **three room HTTP requests** for normal pairing and no room polling or HTTP input loop during play. Host close adds one DELETE. The legacy `transport=relay` parameter is ignored; all browsers, including Safari, use WebSockets. No WebRTC or TURN service is required.

The QR is rendered locally. No camera or microphone permission is requested. A localhost link can be replaced with the detected LAN address for testing. Deployment protection, when enabled, must allow both devices.

## Socket contract and input

Connect to `wss://<game-origin>/api/controller` (local HTTP uses `ws:`). The first text frame is:

```json
{"type":"auth","room":"<48-hex-room-id>","role":"host","token":"<role-token>","session":"<uuid>"}
```

The role is `host` or `controller`. Server `{"type":"ready"}` acknowledges authentication and subscription. The controller then sends:

```json
{"type":"input","input":{"steer":-0.5,"accelerate":true,"brake":false,"start":false,"pause":false}}
```

The host receives `{type: "input", input, time}`. Peer disconnects produce `{type: "disconnected", role}`. Only controllers may send input. Payloads are capped at 1024 bytes; authentication must complete within eight seconds. Invalid credentials, expired rooms and competing sessions close with code 1008.

The phone samples controls every 40 ms. Changed input is sent immediately; unchanged input has a 500 ms heartbeat. Server input accepts at most one update per 25 ms and bounds outstanding writes/output buffers. Input is sanitized and published atomically with its two-second Redis snapshot. Old input is never replayed when a socket reconnects.

The host's two-second watchdog clears inputs and pauses a running race when packets stop. Socket loss pauses immediately; reconnect does not automatically resume the race. The player presses Start to resume. Start/pause pulses clear on connection loss.

## Reconnects, lifetime and authorization

- Room ID, host token and join token are separate random 48-character hex values. HTTP authorization remains `Authorization: Bearer <roleToken>`.
- Host token is never put in the QR. Only a host can delete a room; only a claimed controller can send input.
- One HTTP answer is claimed atomically. Duplicate answers return 409.
- Supplied HTTP/socket Origin must match the serving origin.
- Redis presence is leased for **15 seconds**, renewed every **5 seconds**, and capped by the room's remaining lifetime.
- Each role has one session owner. Reconnecting the same session replaces its old connection atomically; stale sends and stale cleanup cannot modify the replacement.
- Redis Pub/Sub is live delivery, not an input history. Socket objects themselves remain in their accepting process.
- Network/function-duration disconnects reconnect after 500 ms, backing off up to ten seconds. Invalid/expired credentials stop retries. Reloading a used controller link requires a new QR; automatic reconnect applies to the same live page.
- Rooms still expire **ten minutes after creation**, even when active. See NET-02. Heartbeats never extend a room.
- Production requires Redis. In-memory rooms/events are available only for isolated local development.

## Room endpoints

All JSON responses are `no-store`. Fields below describe current implemented contracts, not proposed payment APIs.

The host GET and HTTP input endpoint remain for older clients. The current client
does not poll them; its offer/answer fields contain serialized `{"type":"socket"}`.

| Method/path | Role and request | Success response |
| --- | --- | --- |
| `POST /api/rooms` | Create; `{ "offer": "serialized offer or relay JSON" }` | 201 `{ id, hostToken, joinToken, expires }` |
| `GET /api/rooms/:id` | Host Bearer | `{ answer, expires, input, inputTime }` |
| `GET /api/rooms/:id` | Join Bearer | `{ offer, answered, expires }` |
| `POST /api/rooms/:id` | Join Bearer; `{ "answer": "serialized answer or relay JSON" }` | `{ ok: true }` |
| `POST /api/rooms/:id/input` | Joined controller Bearer; `{ input: { ... } }` | `{ ok: true }`, optionally `throttled: true` |
| `DELETE /api/rooms/:id` | Host Bearer | `{ ok: true }` |

Offer/answer request text is limited to 24,000 characters, with the serialized field limited to 20,000. Input text is limited to 1,000. Typical errors (JSON `{ "error": "<English message>" }`, e.g. `Invalid offer.`, `Invalid code.`, `Room expired. Generate a new QR code.`, `Room already occupied. Generate a new QR code.`): 400 invalid input/JSON, 403 wrong role/token/origin, 404 unknown route or room, 405 unsupported method, 409 already answered, 410 missing/expired room, 413 excessive size, 503 service failure. Server messages are English; the client shows its own translated text for the common cases. If a browser gets HTML instead of JSON, show a sign-in/reopen-link explanation.

## Account and player endpoints

Every endpoint below runs through the shared authorization in `player-api.ts` (Node server and Vercel functions). All JSON responses are `no-store`. Mutations check `Origin`/`Sec-Fetch-Site` (cross-site fetches get 403 `Invalid origin.`). Account GUIDs are never authorized by a header: a request that names an account's GUID without that account's session gets 401 `Sign in required.`. Storage failures return 503 and never a volatile success; a missing MongoDB connection returns 503 `Online storage is not configured.`.

### `/api/auth`

| Method / body | Success | Errors |
| --- | --- | --- |
| `GET` | `{ user: { id, username } \| null }` for the session cookie | 403 origin |
| `POST {action: "signup", username, password}` | `{ user }` and a new session cookie | 400 `invalid`, 409 `taken`, 429 `limited` |
| `POST {action: "login", username, password}` | `{ user }`; rotates this device's session cookie | 400 `invalid`, 401 `credentials`, 429 `limited` |
| `POST {action: "logout"}` | `{ ok: true }`; deletes only this device's session and clears the cookie | none beyond origin/JSON |
| `POST {action: "password", password, newPassword}` | `{ user }`; replaces the hash, revokes every session of the account and issues a fresh one for this device | 401 `session` (not signed in), 400 `invalid`, 401 `credentials` (wrong current password), 429 `limited` |

Request bodies must be `application/json` (415 `invalid` otherwise), at most 4,000 characters (413) and a JSON object (400 `invalid`). Other errors: 400 `invalid` for an unknown action, 400 `secure` (`HTTPS is required.`) when production receives HTTP, 403 `origin`, 405 for other methods, 503 `unavailable`. Error bodies are `{ error: "<English message>", code }`. Login and signup share the budgets of ten attempts per normalized name per 15 minutes and 300 per minute overall (429 adds `Retry-After: 900`); password changes use the same per-account budget. Usernames follow `normalizeUsername` (lower case, 3–16 characters of `a-z`, `0-9`, `_`, `-`); passwords are 5–128 Unicode characters. The session cookie is `__Host-pista84-session` (Secure, HttpOnly, SameSite=Strict, Path=/, 30 days) over HTTPS and `pista84-session` over local HTTP.

### `PUT /api/account`

Needs a session (401 otherwise); other methods 405. Body `{ save }` (at most 16,000 characters; the save needs an `owned` array and numeric `coins`, else 400 `Invalid progress.`). It reconciles the guest/local save with the account's `account-progress` record and returns `{ save }` (the merged, sanitized save, with the configured balance override applied). If the save's `playerId` is another registered account, the call returns 403 `Cannot merge another account.`. When the save came from a guest GUID, that guest's ranking row is absorbed into the account row only if it has the account's own name.

### `POST /api/score` and `GET /api/leaderboard`

| Method/path | Request | Success |
| --- | --- | --- |
| `POST /api/score` | `{ playerId, username, score, distance }` (needs a session) | `{ rank }`; a score of 0 returns `{ rank: 0 }` |
| `GET /api/leaderboard?page=&size=` | public; the session (if any) marks the caller's own row | `{ entries: [{ rank, name, score, distance, mine }], page, pages, size, total }` |

Score and distance must be finite, non-negative and at most 10,000,000, with a valid GUID and username, otherwise 400 `Invalid score.`. The ranking keeps the highest score and distance per GUID and orders by score, then earlier achievement, then GUID. Score writes for a signed-in account always use the account username; a guest-style submission using a registered username returns 409 `Username is reserved.`. Page size defaults to 5 (maximum 50). Public responses never contain GUIDs. Reading the ranking may retire duplicate guest rows (rate limited). Other methods return 405 `Invalid method.`.

### `/api/progress`

| Method/path | Request | Success |
| --- | --- | --- |
| `GET /api/progress?device=<uuid>` | session plus `x-player-id` GUID header | `{ save, revision }`, or `{ save: null, revision: 0 }` |
| `PUT /api/progress?device=<uuid>` | `{ save: <validated casual save>, revision: <current integer> }` | `{ revision: previous + 1, updated }` |

Without a session the call returns 401 `Sign in required.` (a guest never reaches storage); without a valid GUID header 401 `Missing player id.`. Origin mismatch 403; malformed progress 400 `Invalid progress.`; bad `device` 400; invalid JSON 400; unsupported method 405; conflicting revision 409 (also returned when an older save timestamp would replace a newer device snapshot); body above 16,000 characters 413 `File too large.`; full store 507; storage failure 503. Revision 0 creates the first record; subsequent writes conditionally update the existing revision. With `?device=` the record is the isolated automatic device snapshot (the game always sends it); without it the legacy manual `backups` record is addressed (the game no longer writes it). A successful write by the account's own GUID also reconciles `account-progress`. Reads apply the configured balance override without changing the stored row.

## Supporting routes

- `GET /runtime-config.json` (Node and Worker, `no-store`) returns the public runtime config `{ "coins": number | null, "progressTools": boolean }`; see [architecture](06-architecture-and-data.md).
- `GET /health` (Node, Vercel `api/health.ts`, proxied by the Worker) returns `{ ok: true, cloudBackup: boolean, storage: "mongodb" | "unconfigured", pairing }`. `cloudBackup` is true when MongoDB is configured; `pairing` is `"redis"` or `"unconfigured"` on Vercel and `"redis"` or `"memory"` on the local Node server. It reports configuration, not a live-service ping. The signed-in game reads it once after launch before it publishes scores.
- `GET /network` (local development only, absent in production) reports the detected LAN host used in QR links.
- `/api/controller` is the active shared WebSocket endpoint (Vercel returns 426 `WebSocket connection required.` for plain HTTP). There is no local `/relay`.
- Local Node `GET /qr?text=` is a legacy PNG endpoint (text up to 2048 characters); the current UI renders the QR in the browser (`src/qr.ts`).
- The hosted Worker serves `/runtime-config.json`, embedded static assets, and proxies `/api/*` and `/health` to the HTTPS `API_ORIGIN` (503 `Online backend is unavailable.` if it is missing, not HTTPS or the same origin). The Node server also serves static files from `www/`.

Do not log or embed database/service credentials in browser code. Vercel function duration limits still apply to sockets; the client reconnects and Redis coordinates instances. Verify the actual upgrade after deployment.
