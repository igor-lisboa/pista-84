# PISTA 84 tech debt

Online storage now uses per-player MongoDB records and expiring Redis keys.
See [STORAGE.md](STORAGE.md) for architecture, configuration and consistency.

## Remaining limitations

- Scores are client-reported. Strong anti-cheat and verified run scoring are not implemented.
- Player GUID is the backup credential. Strong account authentication is still needed before progress has financial value.
- Backup and score publication are separate operations; callers may need to reload a backup after a partial failure.
- Controller fallback uses HTTPS polling; TURN and a shared WebSocket/pub-sub relay remain future work.
- Local WebSocket handles belong to one Node process; they expire after one hour and cannot cross instances.
- Historical SQL schema/migrations remain for reference, with no active D1 binding.
- Old remotely stored records are not automatically imported or deleted. Retain/import needed data before switching traffic.
- Vercel backend auto-detection treats root/src/browser bundles named app, index, server or main as server entrypoints. Preserve client.ts, game.js and dev-server.ts naming and the tests guarding them.
