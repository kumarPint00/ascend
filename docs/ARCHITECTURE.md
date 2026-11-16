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

## Current Phase 3 personal-adaptation design (v0.10.0)

- SQLite v5 adds `adaptive_settings`, `adaptive_decisions` and
  `completion_modes` without rewriting older XP or quest identities.
- `packages/game-engine/src/adaptive.ts` evaluates scheduled opportunities,
  real completion history and recorded focus-session minutes. This is an
  explainable on-device model, not a generative LLM.
- `apps/mobile/src/data/adaptive.ts` owns transactional acceptance,
  dismissal, edit validation, daily/weekly/monthly quota enforcement and
  user consent. New quests are always inserted in Backlog.
- A Lite recurring completion uses easy-level XP and exactly the same
  (quest_id,period_key) uniqueness as a normal completion. One-off milestones
  and active boss proof cannot use Lite; boss verification excludes all Lite
  completion modes.
- Full schema-v4 JSON exports include adaptive feedback, settings and
  completion mode. Older backup formats continue to restore.
- `Planner → Adapt` exposes privacy controls, energy self-report, workload
  limits and editable proposals. Animations honor Android reduced-motion.
- `docs/PHASE3_ADAPTIVE.md` contains rollout and default guardrails.

## Known remaining limitations

- Physical-device migration, external backup restore and Android notification
  timing still require real Samsung and small-screen acceptance checks.
- External JSON backups are plaintext; choose a private folder.
- On-device generative AI is not included in v0.10.0; runtime model capability
  and deterministic fallback need separate validation.
- Native crashes before React mounts still require Android crash logs.
- Local XP is self-reported, not suitable for public rankings without
  trusted server-side verification.
