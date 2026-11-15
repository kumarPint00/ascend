# Phase 2 Android acceptance — test later, before publishing

**Current stage:** v0.8.1 is a signed release candidate. No automatic publication until device acceptance.

## Protect existing data first
1. In the currently installed version, open More → View Backup JSON, save the entire export *outside the app*, and verify it can be opened. If using v0.8.1, use Planner → Settings → Export & Share Backup.
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
