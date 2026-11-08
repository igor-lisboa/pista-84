# 07 — Remote control and API contracts

[Specification index](README.md) · Sources: [net/remote.ts](../src/net/remote.ts), [server/signaling.ts](../src/server/signaling.ts), [server/cloud.ts](../src/server/cloud.ts), [dev-server.ts](../dev-server.ts), [worker/index.ts](../worker/index.ts), [ui/remote-dialog.ts](../src/ui/remote-dialog.ts), [ui/controller-page.ts](../src/ui/controller-page.ts)

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

## Progress endpoints

| Method/path | Request | Success |
| --- | --- | --- |
| `GET /api/progress` | `x-player-id` GUID header | `{ save, revision }`, or `{ save: null, revision: 0 }` |
| `PUT /api/progress` | `{ save: <validated casual save>, revision: <current integer> }` | `{ revision: previous + 1, updated }` |

Missing identity returns 401; origin mismatch 403; malformed progress 400; unsupported method 405; conflicting revision 409; body above 16,000 characters 413. Revision 0 creates the first record; subsequent writes conditionally update the existing revision. GUIDs act as backup credentials, not verified account authentication. Optional `?device=<uuid>` selects the isolated automatic device snapshot.

## Supporting and legacy routes

- `GET /runtime-config.json` (Node and Worker, `no-store`) returns the public runtime config `{ "coins": number | null }`; see [architecture](06-architecture-and-data.md).
- `/health` reports configured MongoDB/Redis availability; it is not a live-service ping. Local `/network` reports the detected LAN host used in QR links.
- `/api/controller` is the active shared WebSocket endpoint. The unused local-only `/relay` implementation was removed.
- Local `/qr?text=` is a legacy server QR endpoint (PNG, text up to 2048 characters); the current UI renders the QR in the browser (`src/qr.ts`).
- The hosted Worker serves only the routes above plus the embedded static assets; the Node server also serves static files from `www/`.

Do not log or embed database/service credentials in browser code. Vercel function duration limits still apply to sockets; the client reconnects and Redis coordinates instances. Verify the actual upgrade after deployment.
