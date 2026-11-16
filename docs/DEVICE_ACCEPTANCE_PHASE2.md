# Phase 2 Android acceptance — test later, before publishing

**Current stage:** v0.9.2 stabilization is implemented in source. A signed candidate must pass final emulator and physical-device checks before publication; v0.9.1 remains the latest public release.

## Protect existing data first
1. In the currently installed version, open More → View Backup JSON, save the entire export *outside the app*, and verify it can be opened. If using v0.9.2, use Planner → Settings → Export & Share Backup.
2. Preserve the original signing key. A signed build can upgrade an earlier app only if `com.ascendrpg.personal` and the signing certificate both match.
3. The v4 migration is **forward-only**. Downgrading to v0.3 after it has upgraded your database is not supported. Uninstalling to downgrade deletes local app data unless separately backed up.
4. Verify a test device or disposable progress before using your main data.

## Quick device acceptance
- [ ] Android's installer offers an **Update** (not uninstall); existing level, XP and local quests remain.
- [ ] Launcher icon, native splash, keyboard, back navigation, and smaller-screen layout display correctly.
- [ ] Import private pack with 30 goals and 180 quests/milestones; importing twice does not duplicate or award XP.
- [ ] Active, backlog, paused, snoozed and weekday-scheduled missions behave consistently.
- [ ] PLAN from Home, Quests and Goals opens the correct mission editor.
- [ ] Completing a quest twice in the same period awards XP at most once; unmet prerequisites block a milestone.
- [ ] 14-day calendar, selected weekdays and future milestones display on appropriate days.
- [ ] Reminders require consent, do not ring during quiet hours and still work after returning to the app.
- [ ] Skill unlocks and boss victories require recorded progress; achievements don't fabricate results.
- [ ] Weekly review and focus minutes survive app restart.
- [ ] Export full v3 JSON backup file to outside storage, restore into a disposable clean install, and compare goals, XP, planner settings, skill unlocks and reviews.
- [ ] Test Android accessibility with larger text and reduced motion.

If a test fails, **do not publish the candidate to GitHub Releases**. File a reproducible issue with steps and environment details, excluding private information.

## v0.9.2 depth checks

- [ ] Check 90-day planner on a real Android device and verify indefinite daily/weekly notifications after several days without opening ASCEND.
- [ ] Select a private Android external folder and enable automatic backup. Verify the generated JSON file is visible outside ASCEND and opens after a device restart.
- [ ] Run 2–3 backups, verify the readback success timestamp, and confirm retention never removes non-ASCEND files.
- [ ] Record three measurements of one goal over at least seven days, inspect history and direction-aware forecasts. Verify incompatible units do not produce a misleading forecast.
- [ ] Set available minutes to 30 and confirm the Today recommendations respect priority, backlog and the time budget.
- [ ] Unlock a skill and clear a boss with evidence, then check the reduced-motion reveal and larger system font setting.
- [ ] Restore a v2 backup into a disposable v0.9.2 installation and verify historical measurements were not fabricated.

External automatic backup files are unencrypted. Do not choose a shared folder.

## v0.9.2 stabilization acceptance (additional checks)

- [ ] Install build 12 *over* v0.9.1 on the Samsung without clearing data; verify XP, milestones, goals and the private pack remain intact.
- [ ] Create an increasing outcome (target 10, current 7), verify boss cannot be claimed until 10. Repeat with a decreasing outcome (target 64, current 70); ensure it cannot be claimed until 64 or below.
- [ ] Verify switching a metric from kg to lb starts a new single-unit history segment rather than creating a misleading progress forecast. Synthetic migration baselines must show observation date unknown.
- [ ] Complete a quest, undo within 10 minutes and verify XP and completion are reversed; reject undo after the window and when a dependent milestone has already been completed.
- [ ] Schedule two reminders, change one time; verify the other remains scheduled even if an OS scheduling operation fails. Check quiet hours, repeated app opens, device reboot and background restrictions.
- [ ] In a selected external folder, add an unrelated JSON file named similarly to ASCEND's backups, create several backups, and verify retention never deletes the unrelated file. Validate readback before pruning.
- [ ] Test alert and recovery UI with enlarged font/Android TalkBack, reduced motion and smaller screen size. No private data should appear in logs.
- [ ] Import the private quest pack and navigate 90-day calendar, Goals and Insights without long UI stalls.
- [ ] Confirm GitHub CI, emulator cold-start, exact package ID and same permanent signing certificate before publication.

Testing on Android emulator is valuable but **not evidence** of Samsung device backup, notification or in-place upgrade behavior.
