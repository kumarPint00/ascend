# ASCEND Phase 2 · Integrated v0.8.0 (Android)

This is a local-first implementation for **personal use**, not a claim that device QA is complete.
See `docs/UX_30_POINT_AUDIT.md` for visual and accessibility items requiring device review.

## Feature status

| Area | Implemented | Limitations / verification |
|---|---|---|
| 2.1 Quest intelligence | SQLite lifecycle: active/backlog/paused, priorities, daily 1–8 focused missions, snooze, status filters, 180-entry search, dependency locks before awarding XP | Not AI-powered; deliberately rule-based and auditable |
| 2.2 Calendar and reminders | 14-day calendar, selected weekdays, target dates, time-of-day settings, Android local opt-in reminders, quiet hours, permission handling | Rolling horizon refreshed on foreground/edits; Android battery/notification settings can delay delivery; no background server |
| 2.3 Epic questlines | Measurable goals with value/target/unit/deadline, prerequisite edges between one-off milestones, cycle prevention | Metric history/forecast based on real values is a later enhancement |
| 2.4 Skills and bosses | Six attributes, 18 unlockable skill nodes, six evidence-based achievements, goal-linked boss battles with proof checks | No fictitious XP for claiming boss victories; original visual assets only |
| 2.5 Analytics and review | 7-day XP chart, activity-day consistency, attribute XP contribution, conservative goal projections, focus-minute ledger, weekly reviews | Forecast absent if insufficient recent evidence; XP is not a validated performance score |
| 2.6 Motion and UX | Native icon/splash from v0.4, five primary tabs with Planner, focused cards, searchable library, accessible motion-reduced transitions, original palette | 30-point checklist not fully signed off without device tests |
| 2.7 Data/reliability | Additive SQLite schema v1→v2, database integrity checks, backup v2 with planner/skills/reviews and v1 import support, atomic restore transaction, local file share/picker, GitHub Actions CI, invariant tests | Backup is manual; no automatic cloud backup; signed upgrade requires same JKS |

## User journey

1. Install using the same Android package ID (`com.ascendrpg.personal`) and your permanent release key.
2. From **More → Personal quest pack**, import the private JSON file shared in the conversation. Do not commit it to GitHub.
3. Open **Planner → Library**. By default one-time/milestone quests are backlogged; recurring ones are active. Activate only those you intend to pursue.
4. Tap **PLAN** to set priority, selected weekdays, target date, snooze, estimated minutes and reminder time. For one-time missions, add same-goal prerequisite quests.
5. **Planner → Today** suggests up to four active tasks (configurable 1–8), sorted by a deterministic priority rule.
6. **Planner → Goals** records measurable results; create linked boss challenges. Verification requires an actual linked completion or goal target.
7. **Planner → Skills** shows earned nodes and achievements; **Planner → Insights** shows recorded activity and review.
8. **Planner → Settings** enables local reminders and exports the full backup to an external destination.

## Data integrity

- No automatic XP on import, claimed achievements or boss creations.
- Completion checks are transactional and prevent double-awarding an active quest period.
- Paused/backlog quests and unmet prerequisites cannot award XP.
- Old quests, goals, completions, XP events and stable IDs are preserved by the v2 migration.
- New personal import carries one-off milestone target dates into planner metadata without activating the whole backlog.
- Backups are schema-versioned and validate all references before replacing the database in a single transaction.
- Reminder data stays on-device and is only scheduled following explicit opt-in.
- No Supabase, Firebase, Vercel server, FCM, paid LLM, or cloud storage is required for this personal build.

## Release and testing

- Update `apps/mobile/app.json` version and `android.versionCode` on every build.
- **Signed** artifacts from `.github/workflows/android-apk.yml` are the only safe in-place update route when their signing certificate matches your installed app. The separate test APK job uses an incompatible ephemeral key.
- Run `npm test && npm run typecheck`; build `assembleRelease` in GitHub Actions.
- Perform device checks for migration from 0.3/0.4, full private-pack import, all planner tabs, notification permission/quiet hours, local backup export→restore, accessibility and two screen sizes before wider release.
- Free GitHub Actions for a public repo and local-only app features have no mandatory recurring service charges; quota terms and public commercial distribution remain separate considerations.

## Architecture boundaries

`packages/game-engine/src/phase2.ts` contains deterministic, testable rules. 
`apps/mobile/src/data/phase2.ts` owns v2 SQLite persistence.
`apps/mobile/src/data/backup.ts` owns external file backup/restore.
`apps/mobile/src/phase2/reminders.ts` owns local notification scheduling.
`apps/mobile/src/phase2/Planner.tsx` owns the interactive Phase 2 interface.

Keep private personal details in the user-imported JSON on their device, never in public source, workflows, logs or screenshots.
