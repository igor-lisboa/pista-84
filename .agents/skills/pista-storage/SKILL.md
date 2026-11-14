---
name: pista-storage
description: Maintain PISTA 84 MongoDB persistence, Redis controller state, backend APIs and storage diagnostics. Use for data or API changes, not gameplay tuning.
---

Read root `AGENTS.md` and `docs/STORAGE.md`. Follow the affected data path through
`players.ts` / `cloud.ts`, `mongo-store.ts` / `mongo-player-store.ts`, `signaling.ts` / `redis-rooms.ts`, and
the relevant `api/`, local server or Worker entrypoint.

Keep durable writes scoped to one player. Update callbacks can be retried: keep
them synchronous and free of external effects. Preserve score maxima and times,
backup ownership and stale-revision rejection. Use version-filtered replacement
and unique `_id` insertion to handle concurrent MongoDB writers.

Use Redis atomic scripts for room claims and input updates. Every ephemeral key
must have a bounded relative TTL; input must neither revive a closed room nor
outlive its room. Put keys used by a script in the same Cluster hash slot.
Never add instance-memory storage for a deployed API or a silent volatile save.
Live WebSocket handles remain process-local and must close on disconnect/expiry.

Add meaningful tests for changed concurrency, expiry, authorization or failure
behavior. Run `npm run build`, `npm run typecheck`, `npm test`. For requested or
necessary live validation, `npm run online:check` exercises configured services
with unique probes and cleanup; do not print driver errors containing secrets.
To verify without real services, `bash scripts/local.sh up` then `check` or `test`
runs the game against disposable MongoDB and Redis in Docker; extend
`scripts/check-local.ts` when an endpoint or data contract changes.

Treat `docs/STORAGE.md` and `specs/06`/`specs/07` as the source of truth: read them
before changing a contract and follow `.agents/skills/pista-docs/SKILL.md`. Update
`docs/STORAGE.md`, `.env.example`, `specs/06`, `specs/07`, `specs/08` and
`docs/TECH-DEBT.md` in the same change when the data contract, endpoints, error
codes, keys, TTLs or limitations change. Deployment must configure MongoDB/Redis on Node and
`API_ORIGIN` on an edge Worker. Report validation and any migration/deployment steps.

Follow `.agents/skills/pista-quality/SKILL.md` for completion review: strict typing, focused modules, build/test evidence and affected user interactions. Full quality audits run the complete configured suite and report failures, skips and coverage gaps.
