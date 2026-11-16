# Phase 2 Android acceptance — test later, before publishing

**Current stage:** v0.9.2 is a signed release candidate. No automatic publication until device acceptance.

## Protect existing data first
1. In the currently installed version, open More → View Backup JSON, save the entire export *outside the app*, and verify it can be opened. If using v0.9.2, use Planner → Settings → Export & Share Backup.
2. Preserve the original signing key. A signed build can upgrade an earlier app only if `com.ascendrpg.personal` and the signing certificate both match.
3. The v2 migration is **forward-only**. Downgrading to v0.3 after it has upgraded your database is not supported. Uninstalling to downgrade deletes local app data unless separately backed up.
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
- [ ] Export full v2 JSON backup file to outside storage, restore into a disposable clean install, and compare goals, XP, planner settings, skill unlocks and reviews.
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

## v0.9.2 recovery and privacy acceptance

- [ ] From an existing v0.9.1 installation, upgrade in place and confirm all quests, XP, goals and real dated measurements remain.
- [ ] Verify migrated directional goals require explicit review before linked boss victories.
- [ ] Make a successful encrypted automatic backup to an external folder and confirm the file does not contain plaintext goal titles.
- [ ] Save the 64-character recovery key outside the phone; verify it can restore on a fresh disposable installation.
- [ ] Verify incorrect recovery key and a truncated encrypted backup cannot mutate the database.
- [ ] Test that reminder scheduling errors do not erase the previous scheduled generation.
- [ ] Complete then undo a quest and verify XP, skill-tree state and achievements stay consistent; repeat after two minutes and confirm refusal.
- [ ] Verify 48dp tap targets, larger system text and TalkBack announcements on Samsung and a smaller emulator.
