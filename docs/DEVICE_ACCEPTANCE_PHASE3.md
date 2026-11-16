# ASCEND v0.10.0 — Physical Android acceptance (before publishing)

**Do not uninstall your current app or wipe app storage.**
The signed candidate uses package `com.ascendrpg.personal`, build 13,
SQLite v5 and the permanent signing certificate. It is a forward-only
migration from Phase 2. v0.9.1 remains the published fallback until verified.

## In-place update and recovery

- [ ] Export a complete v0.9.2/v0.9.1 backup outside the phone-app sandbox.
- [ ] Install the signed v0.10.0 APK **over** the existing installation.
- [ ] Check the app starts cold three times, quests/goals/XP and imported
      personal quests are unchanged after upgrade.
- [ ] Generate a v4 JSON backup containing adaptive settings and Lite history;
      validate, restore on a disposable profile and compare the XP ledger.
- [ ] Ensure old v1/v2/v3 backup files still restore without fabricating
      historical measurements, XP or feedback.

## Adaptive intelligence

- [ ] Open Planner → Adapt: low/medium energy and workload controls work.
- [ ] A new user with no history receives no fabricated behavioral assessment.
- [ ] After enough logged activity, inspect reason and numerical evidence.
- [ ] Repeatedly incomplete/small-focus activities can offer a lighter plan.
- [ ] Steady high-completion habits can optionally suggest a small stretch,
      but never when energy is low or the day exceeds the budget.
- [ ] New quest, milestone and goal proposals can be edited and approved.
      No suggestion can create or award XP automatically.
- [ ] New quests start as Backlog; new goal target is the edited count.
- [ ] A second approval of the same proposal does not create duplicates.
- [ ] Dismissal and accepted decisions persist after app restart and backup.
- [ ] Manual pause / seven-day snooze suppresses recommendations.
- [ ] Limits for proposals/day, new quests/week and goals/month are enforced,
      including during repeated taps and while the screen is stale.

## Lite and XP safeguards

- [ ] A recurring medium/hard quest can be completed as Lite.
- [ ] Lite awards at most 10 XP, never full hard XP, and cannot pay twice
      in the same day/week period.
- [ ] One-off milestones and active boss proof cannot use Lite.
- [ ] A historical Lite completion cannot be reused to win a new boss.
- [ ] Undo of a recent Lite completion reverses its actual awarded XP.
- [ ] Daily XP cap of 250 holds with mixed Lite/standard completions.

## Visual, performance and privacy

- [ ] Animated transitions and panels respect Android reduced-motion settings.
- [ ] TalkBack names all actionable controls; large-font UI remains usable.
- [ ] 180-entry personal pack and extended completion history load without stalls.
- [ ] Background/quiet-hours reminders survive changes to quest plans.
- [ ] Review external JSON privacy: the file is plaintext and should never
      be stored in a public or shared folder.
- [ ] Review `adb logcat` for native crashes, **without sharing personal data**.

## Publication gate

Require passing automated tests, signed versionCode 13 build, same signature,
three emulator cold starts, physical in-place migration, and a verified
restore before making v0.10.0 the latest GitHub Release.
