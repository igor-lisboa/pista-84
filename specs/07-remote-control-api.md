# 07 — Remote control and API contracts

[Specification index](README.md) · Sources: [remote.js](../src/remote.js), [signaling.js](../src/signaling.js), [cloud.js](../src/cloud.js)

## Pairing flow

1. The main display opens **CELULAR COMO CONTROLE** and creates a room.
2. Where supported, it prepares a WebRTC offer; otherwise it uses `{"type":"relay"}`. ICE collection waits up to 3.5 s. The default STUN endpoint is `stun:stun.cloudflare.com:3478`; no TURN credentials are configured.
3. A QR/link opens the phone controller with `controller=<roomId>&token=<joinToken>`. Query parameters preserve the link through browser login redirects. An explicit `transport=relay` forces compatibility mode.
4. The phone retrieves the offer, submits exactly one answer, then sends an acknowledged neutral HTTPS command before reporting connected.
5. The player can start or pause from the phone, or start from the main display.

The private publication requires authorized login on both devices. The QR is generated locally in the browser; no camera or microphone permission is requested by the game. A localhost link can be replaced with the Node server's detected LAN address for testing.

## Transport and input

Safari starts in HTTPS compatibility mode. Other browsers may use a WebRTC DataChannel, with HTTPS as fallback. The controller samples input every **40 ms**. Effective HTTPS sends are at least **100 ms** apart when no direct channel is open, or **500 ms** for its compatibility heartbeat when direct transport is active. Requests do not overlap.

The host polls every **450 ms** before an answer and **110 ms** afterward. It applies new compatibility input by timestamp when the direct channel is not open. HTTP requests have an **8 s** timeout. Server input updates within **70 ms** of the previous accepted one are acknowledged as throttled.

```json
{
  "steer": -0.5,
  "accelerate": true,
  "brake": false,
  "start": false,
  "pause": false
}
```

Steering must be finite and is clamped to [-1, 1]. Action flags only accept boolean `true`. Start/pause are edge-triggered by the app; phone buttons hold their command for 700 ms to survive polling. Direction/pedals remain held until release or input clearing.

The host detects stale compatibility input after **1.8 s**. The app also has a **2 s** remote-input watchdog. Failure/disconnection clears remote controls and pauses a running game. A new QR is the supported reconnection path; refreshing an already used controller link is not an automatic rejoin.

## Room lifecycle and authorization

- ID, host token and join token are separate random 48-character hex values.
- API authorization is `Authorization: Bearer <roleToken>`.
- Host token is never put in the QR. Only the host can delete the room; only a joined controller can post inputs.
- One answer is stored atomically; duplicate answers fail with 409.
- Supplied `Origin` must match the request origin.
- Room expiration is currently **10 minutes from creation**, including an active session; input does not renew it. This is a current limitation, not just a pairing-window label. See NET-02 in the roadmap.
- Expired rows are cleaned on later room creation; explicit host close deletes its room.
- Only the latest input and timestamp are stored, not an input history.

## Room endpoints

All JSON responses are `no-store`. Fields below describe current implemented contracts, not proposed payment APIs.

| Method/path | Role and request | Success response |
| --- | --- | --- |
| `POST /api/rooms` | Create; `{ "offer": "serialized offer or relay JSON" }` | 201 `{ id, hostToken, joinToken, expires }` |
| `GET /api/rooms/:id` | Host Bearer | `{ answer, expires, input, inputTime }` |
| `GET /api/rooms/:id` | Join Bearer | `{ offer, answered, expires }` |
| `POST /api/rooms/:id` | Join Bearer; `{ "answer": "serialized answer or relay JSON" }` | `{ ok: true }` |
| `POST /api/rooms/:id/input` | Joined controller Bearer; `{ input: { ... } }` | `{ ok: true }`, optionally `throttled: true` |
| `DELETE /api/rooms/:id` | Host Bearer | `{ ok: true }` |

Offer/answer request text is limited to 24,000 characters, with the serialized field limited to 20,000. Input text is limited to 1,000. Typical errors: 400 invalid input/JSON, 403 wrong role/token/origin, 405 unsupported method, 409 already answered, 410 missing/expired room, 413 excessive size, 503 service failure. If a browser gets HTML instead of JSON, show a sign-in/reopen-link explanation.

## Progress endpoints

| Method/path | Request | Success |
| --- | --- | --- |
| `GET /api/progress` | Gateway-authenticated identity | `{ save, revision, updated }`, or `{ save: null, revision: 0 }` |
| `PUT /api/progress` | `{ save: <validated casual save>, revision: <current integer> }` | `{ revision: previous + 1, updated }` |

Missing identity returns 401; origin mismatch 403; malformed progress 400; unsupported method 405; conflicting revision 409; body above 16,000 characters 413. Revision 0 creates the first record; subsequent writes conditionally update the existing revision. A client cannot choose another user's ID.

## Supporting and legacy routes

- Hosted `/health` returns `ok`, `transport: "webrtc"` and `cloudBackup: true`. The transport label is a capability label; it does not mean a particular session is using WebRTC.
- Local `/health` reports local availability; local `/network` reports a detected LAN host.
- The Node server retains `/relay`, a legacy WebSocket protocol (`host`, `join`, `input`, `connected`, `disconnected`) with its own ephemeral rooms. The current menu/phone flow uses the HTTP/WebRTC contracts above.
- Local `/qr` is a legacy server QR endpoint; the current UI bundles QR generation in the browser.

Do not log or embed service-access credentials in browser code. HTTPS fallback solves basic restricted-network operation; TURN remains an optional low-latency enhancement.
