# ASCEND Phase 2 · v0.9.2 stabilization release candidate (Android)

This is a local-first implementation for **personal use**, not a claim that device QA is complete.
See `docs/UX_30_POINT_AUDIT.md` for visual and accessibility items requiring device review.

## Feature status

| Area | Implemented | Limitations / verification |
|---|---|---|
| 2.1 Quest intelligence | SQLite lifecycle: active/backlog/paused, priorities, daily 1–8 focused missions, snooze, status filters, 180-entry search, dependency locks before awarding XP | Not AI-powered; deliberately rule-based and auditable |
| 2.2 Calendar and reminders | 14/30/90-day calendar, selected weekdays, target dates, opt-in Android repeating daily/weekly reminders and one-off reminders with quiet hours | Repeating notifications survive long periods unopened; Android Doze and background scheduling may still defer notifications |
| 2.3 Epic questlines | Measurable goals with value/target/unit/deadline, prerequisite edges between one-off milestones, cycle prevention | SQLite v3 historical measurements and consistent-unit outcome forecasts implemented; no guarantee from limited data |
| 2.4 Skills and bosses | Six attributes, 18 unlockable skill nodes, six evidence-based achievements, goal-linked boss battles with proof checks | No fictitious XP for claiming boss victories; original visual assets only |
| 2.5 Analytics and review | 7-day XP chart, activity-day consistency, attribute XP contribution, conservative goal projections, focus-minute ledger, weekly reviews | Forecast absent if insufficient recent evidence; XP is not a validated performance score |
| 2.6 Motion and UX | Native icon/splash, original boss-gate visuals, skill-level progress, reduced-motion victory reveal, searchable library and focused navigation | 30-point checklist not fully signed off without device tests |
| 2.7 Data/reliability | Additive SQLite schema v1→v4, database integrity checks, full backup v3 with planner/skills/reviews/measurements and v1/v2 import support, atomic restore transaction, local file share/picker, GitHub Actions CI, invariant tests | Optional selected-folder automatic local backups with readback verification, 2–30 retention and WorkManager catch-up; no automatic cloud backup; same JKS required |

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
- Old quests, goals, completions, XP events and stable IDs are preserved by the additive v1→v4 migrations.
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
`apps/mobile/src/data/phase2.ts` owns the latest SQLite persistence alongside `apps/mobile/src/data/repository.ts` (schema v4).
`apps/mobile/src/data/backup.ts` owns external file backup/restore.
`apps/mobile/src/phase2/reminders.ts` owns local notification scheduling.
`apps/mobile/src/phase2/Planner.tsx` owns the interactive Phase 2 interface.

Keep private personal details in the user-imported JSON on their device, never in public source, workflows, logs or screenshots.

## v0.8.1 release-candidate fixes

- Completing a quest now checks its persisted lifecycle, selected weekdays, snooze and due date **inside the same SQLite transaction as XP**. UI and database behavior agree.
- Home, Quests, Goals and Planner no longer offer the completion action for an off-schedule or blocked quest.
- The PLAN action on a quest or imported milestone opens that exact quest's editor; no searching through 180 entries.
- Android's document picker can select JSON backup files that are advertised as a generic MIME type; file content is validated before replacement.
- Due dates and snoozes reject impossible dates such as February 30.
- GitHub's signed Android build workflow produces an APK using the configured permanent JKS, but doesn't publish a GitHub Release unless explicitly enabled.

### Personal acceptance gate

The signed APK is a **candidate**, not proof of runtime correctness. Verify an in-place upgrade to v0.9.2 on your Android device with a disposable backup, permission behavior and full restoration before publishing. **v0.9.1 is the latest public release.**

## Phase 2 depth improvements (v0.9.0)

The following close the functionality gaps highlighted after v0.8.1. Implemented in source; real-device acceptance remains outstanding.

| Earlier limitation | New behavior | Remaining platform reality |
|---|---|---|
| Only a rolling 14-day planner | 14/30/90-day calendar selector; indefinitely repeating Android local daily/weekly notifications for stable recurring quests; one-off reminders target their actual date, including overdue catch-up | Native Android Doze, battery policies and exact-alarm restrictions can delay delivery; WorkManager is best-effort, not a clock |
| No goal metric history | Additive SQLite v3 `goal_measurements` ledger, values/units/timestamps, goal timeline and direction-aware progress | Earlier v2 data can supply only one baseline; no historical values are invented |
| Forecasts based on quest activity | Three or more consistent-unit measurements spread over at least 7 days produce conservative outcome trends; insufficient/contradictory data yields no ETA | No model can guarantee personal, financial, or medical results |
| Only manual backups | Opt-in selected external Android Storage Access Framework folder; 12/24/72 hour interval, 2–30 copy retention, readback and JSON validation, automatic catch-up on foreground and WorkManager maintenance | User grants folder access; background execution is OS-controlled; files are plaintext and remain private only if the selected folder is private |
| Basic deterministic recommendation | Offline explainable scoring from priority, due date, last completion, difficulty/effort, available minutes and diversity of life areas | No online AI/LLM or automatic knowledge of actual availability |
| Generic progression visuals | Distinctive gradient boss-gate cards, skill-level progress meters, verified victory reveal and OS reduced-motion support | Full 3D avatars, elaborate animation scenes and all 30 physical-device checks are not implied |

### Operational notes

- **Database v4 migration** preserves all prior XP, quests, goals and v2 planner data.
- **JSON backup schema v3** stores goal measurements; v1/v2 imports are supported with carefully bounded history (a single existing-baseline record rather than invented older measurements).
- **External-folder backups** are explicitly opted into. They are not added to GitHub, Firebase, Supabase or Vercel. ASCEND only prunes automatically named `ASCEND-AUTO-...` files and leaves other files alone.
- **No automatic cloud backup:** if your phone's storage fails and your chosen folder is on that same storage, the backup can be lost too. You can choose a cloud-synced folder if its Android document provider supports persisted write access, but this is a third-party capability and not promised by ASCEND.
- **Auto background worker:** `expo-background-task` uses Android WorkManager at a minimum interval; it is not guaranteed to run exactly every 12/24/72 hours, particularly if the app is force-stopped or battery-restricted. The app attempts overdue backups on foreground as well.
- **Android in-place upgrades** still require the identical package ID and original keystore. This is a platform rule, not an ASCEND design choice.
- **Security:** external JSON is unencrypted; never select a publicly shared folder. Verify backup/restore on a disposable profile before entrusting it with personal data.

Do not publish a new GitHub Release to the in-app update feed until signed APK validation and device acceptance are complete.

## v0.9.2 Phase 2 stabilization (source implemented; device acceptance pending)

The Android package remains `com.ascendrpg.personal`. Version `0.9.2` uses Android build code `12`, must use the existing permanent signing key, and must **not** be automatically published.

| Priority | Stabilization | Evidence / limitation |
|---|---|---|
| P0 | Boss verification now uses a shared direction-aware predicate with measurement history. Lower-is-better goals cannot be won before the target is reached | Unit and target-equality regression tests; on-device boss completion still needs testing |
| P0 | SQLite v4 corrects synthetic migration baseline timestamps and preserves actual observed values and XP | SQL migration test and forward-only backup/restore precautions; legacy baseline observation date is still *unknown* |
| P0 | Native reminders stage replacements before removing old alarms; unchanged reminder schedules stay in place | Android notification OS behavior remains non-transactional and battery constrained |
| P0 | Recent mission completions support confirmable transactional undo, with XP reversal and evidence/dependency safeguards | Ten-minute window; proofs supporting a completed boss/dependent milestone are not silently removed |
| P1 | Automatic external backup retention tracks ASCEND-created SAF document URIs, reducing risk of touching unrelated files | JSON files are not encrypted; external folder permissions and cleanup must be tested on Samsung |
| P1 | Game engine and planner use consistent-unit metric segments, memoized scheduling/XP calculations, touch targets, larger text and improved labels | Physical accessibility audit required; no synthetic benchmark claims |
| P1 | Original level/rank feedback and a JavaScript error recovery boundary provide actionable UI | Native crashes before React starts still require Android logs |
| P1 | Committed `package-lock.json`, `npm ci` in validation/build workflows and deterministic tests | Signed build and emulator verification must use final v0.9.2 source commit |

### Outstanding acceptance gates

1. Signed release candidate APK built from the **final** stabilization commit, verified package ID and permanent signing certificate.
2. Three fresh emulator cold launches for the final artifact, without a process crash.
3. In-place installation on the Samsung S25 Ultra preserving local database, XP and imported private goal/quest pack; **never uninstall the current app to test upgrades**.
4. Android SAF folder backup write/read/restore, retention with unrelated files, device reboot and background scheduling behavior.
5. Notifications including permission denied, quiet hours, unchanged schedules, reschedules, device restart and Doze behavior.
6. UX audit at standard and enlarged Android font sizes on both small and large screens.

**No automatic cloud sync, paid AI service or recurring paid infrastructure was added.**
