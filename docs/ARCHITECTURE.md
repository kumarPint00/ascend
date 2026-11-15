# ASCEND Architecture Notes

## Offline-first split
- `packages/game-engine`: pure TypeScript. XP, dates, ranks, attributes, validation.
- `apps/mobile/src/data/repository.ts`: SQLite migrations and transactional persistence.
- `apps/mobile/src/App.tsx`: UI only. All score decisions go through game engine and repository.

## Integrity model
- `completions` unique `(quest_id, period_key)` so a quest cannot pay twice in a recurrence period.
- `xp_events` unique `(completion_id)`; each accepted completion yields one immutable XP event.
- Daily local calendar key (`YYYY-MM-DD`) caps awarded XP at 250 (not completed quests).
- XP derived from events, never editable directly. Difficulty changes don't rewrite prior XP.
- Existing local storage is not authentication or anti-cheat. Public rankings need server validation.
- ISO weeks reset on Monday; one-time quests use constant `once` key.

## Personal-to-public upgrade approach
- All IDs are stable local identifiers, and cloud sync will map local records to authenticated owners.
- Supabase is a future optional integration, not required to make V0.1 run.
- Introduce an outbox with operation IDs, server-issued XP events, and per-entity versioning before public multi-device use.
- Build a migration to map existing local records without loss of history.
- Never include Supabase service_role credentials or private tokens in the mobile bundle.
- RLS for every user-owned table; all privileged score calculations on trusted server.

## Known technical debt
- Offline data backup is manual JSON text; import flow not yet implemented.
- No notification scheduler, health metrics or AI yet.
- Only game engine tests can be executed in the current offline build environment.
- Need CI typecheck and Android device test after dependencies can be downloaded.
- `newId()` is a non-cryptographic local identifier; switch to platform UUIDs before cloud sync.
- An untrusted local device can change SQLite; XP must not be trusted for public leaderboards.
