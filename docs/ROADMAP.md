# ASCEND Product Roadmap (as of 2026-11-16)

## Phase 1 · MVP foundation (v0.1–v0.4)
- [x] React Native / Expo Android-first, offline SQLite
- [x] Quests, goals, milestones, XP ledger, level/rank/attributes
- [x] Private JSON pack import with repeat-safe IDs
- [x] Original launcher/splash assets, improved five-tab UX
- [x] GitHub Actions builds and permanent Android keystore workflow
- [ ] Device UX/accessibility and backup/restore migration acceptance test
- [ ] Confirm in-place upgrade on the user's phone before broadening the release

## Phase 2 · Full offline progression engine (v0.9.2 stabilization candidate; latest public v0.9.1)
- [x] Quest lifecycle (active, backlog, paused), priority, snooze, focused day selection
- [x] 14-day calendar, weekdays/date/time scheduling and local opt-in reminders with quiet hours
- [x] Measurable goal metrics and prerequisite milestone graph with cycle checks
- [x] 18 skill-tree nodes, achievements, evidence-gated boss challenges
- [x] XP/activity/focus trends, conservative goal forecast and weekly reviews
- [x] Planner UI with search, section transitions, OS reduced-motion support
- [x] Additive SQLite v2 migration, complete v2 backup file and transactional restore
- [x] Automated game rule, SQLite migration and TypeScript CI checks
- [x] Feature-depth pass: 90-day planning, repeating reminders, goal measurement history, adaptive time-budget recommendations, verified folder backups, and boss/skill motion polish
- [x] Phase 2 stabilization source changes: direction-aware boss verification and metrics; SQLite v4 migration protecting uncertain legacy baseline dates; transactional quest completion undo and evidence safeguards
- [x] Two-phase local reminder rescheduling, backup ownership-based pruning, better recovery/error boundaries, accessibility/touch targets, level/rank feedback and memoized planner calculations
- [x] Commit npm lockfile and adopt reproducible `npm ci`; regression tests for measurable goals, SQLite migrations and undo/data integrity
- [x] Publish v0.9.1 startup-crash hotfix to GitHub Releases after 3/3 Android emulator cold launches
- [x] Final v0.9.2 Android build 12 signed and certificate verified ([GitHub Actions](https://github.com/kumarPint00/ascend/actions/runs/43830851005)); three cold launches and 1.4× font startup passed ([emulator run](https://github.com/kumarPint00/ascend/actions/runs/43832468780))
- [ ] Run real-device in-place upgrade and restore checks on Samsung S25 Ultra, including active notifications, selected-folder backups, undo and large quest-pack performance
- [ ] Sign off outstanding 30-point UX/accessibility checks on both Samsung and smaller Android screens; tests must not assume physical-device success
- [ ] Publish v0.9.2 to the live update feed **only after** stabilization acceptance

## Phase 3 · Future public beta (not part of personal Phase 2)
- [ ] Opt-in Supabase login and RLS multi-tenant authorization
- [ ] Offline sync/outbox, conflict resolution, device recovery
- [ ] Accessible onboarding, privacy policy, terms, deletion/export and consent
- [ ] Public app store compliant update flow, abuse protection and telemetry opt-in
- [ ] Performance/a11y/security audits and explicit free-tier budget monitoring
- [ ] Only then consider paid AI features, community, guilds or monetization

## Costs and privacy
- Personal-use build requires no recurring paid services; local notifications need no push server.
- Never commit the private personal quest pack, signing credentials or user backup to public GitHub.
- Android in-place updates require the SAME package ID and private signing key.
- XP represents participation, not medical fitness, income, professional ability or self-worth.
