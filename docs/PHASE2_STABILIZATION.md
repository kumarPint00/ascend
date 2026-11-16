# ASCEND Phase 2 stabilization — v0.9.2 (Android build 12)

Branch: `stabilization/v0.9.2` · PR #2 · **not an official published update until signed acceptance**.

## Implemented hardening

1. **Verifiable directional goals:** explicit increase/decrease selected by user; existing v3 goal outcomes are **unreviewed** until the user confirms them. An unreviewed direction cannot award boss victory. Boss eligibility and victory are verified atomically in SQLite.
2. **Truthful measurement history:** v3→v4 migration removes generated `baseline:` observations that misleadingly used the goal-creation timestamp. Existing XP, completions, goals and real measurements are retained. Old v2/v3 backup imports cannot fabricate observation dates.
3. **Unit-safe analytics:** forecasts and progress use only comparable units and explicit goal direction. Changing units requires the user to set a new target. No forecast without sufficient observations.
4. **Reminder safety:** a new local notification generation is scheduled and validated before old notifications are cancelled. If replacement fails, newly created notifications are rolled back and existing ones remain. Reminder selection is stable and priority-aware; Android Doze still controls actual delivery.
5. **Undo:** the last quest completion can be reversed within two minutes. Completion, XP and dependent skill unlocks are updated in one transaction; a completion linked to a won boss is not silently removed.
6. **Encrypted automatic backups:** AES-256-GCM with fresh native nonce. A 256-bit key is kept in Android Keystore-backed SecureStore; the user must save and explicitly acknowledge the 64-character hexadecimal recovery key before automatic backups can be enabled. Readback is decrypted and schema-validated before retention cleanup.
7. **Portable restore:** an encrypted backup from another phone can be restored by entering its recovery key. Restoration remains atomic; wrong keys or tampering cannot replace the database. Manual legacy JSON export remains **unencrypted** and is labeled clearly.
8. **UI/UX and performance:** React memoization of large planner, calendar, skills and goal calculations; 48dp common tap targets; scalable text; accessible XP/level/rank feedback and an undo control; clearer recovered-metric warnings.
9. **Build integrity:** root `package-lock.json` and `npm ci` for deterministic dependency installation, original permanent signing identity and package name retained. No new paid infrastructure.

## Acceptance tests and unverified behavior

- [x] Unit tests for goal direction and misleading forecasts
- [x] SQLite migrations through v4 with XP/history preservation and integrity checks
- [x] Existing engine, update policy, TypeScript and static Android boot-safety checks (per PR CI)
- [ ] Cold-launch v0.9.2 on an Android emulator with crypto and SecureStore native modules
- [ ] Install over v0.9.1 on an actual Samsung device without uninstalling or clearing data
- [ ] Create two encrypted backups, copy the recovery key elsewhere, and restore one with the key
- [ ] Verify automatic backup retention after app restart and test a wrong recovery key
- [ ] Confirm daily/weekly/paused/quiet-hour notifications after Android battery restrictions
- [ ] Check large-font, TalkBack, small-screen, keyboard, landscape (app portrait-locked) and reduce-motion behavior
- [ ] Re-review remaining visual animation rubric items and physical-device performance

## Known constraints

- Existing v0.9.1 automatic backup files are plaintext JSON. Delete or move those manually **only after** confirming an encrypted replacement; the new retention policy intentionally will not delete anything except ASCEND-named old copies.
- Encrypted automatic backups cannot be recovered after phone loss unless the **recovery key** was saved outside the phone. The app cannot retrieve a lost recovery key.
- Manual `Export & Share Backup` remains **plaintext** for compatibility; use a private destination. Do not commit backup data or key material to GitHub.
- Android's WorkManager and Doze are best-effort, not precise timing mechanisms.
- Device QA remains mandatory before tagging v0.9.2 as the latest GitHub Release.

## Rollback and data safety

Do not uninstall ASCEND to downgrade. SQLite schema v4 is not supported by v0.9.1; in-place downgrades are unsupported. Preserve an external backup before upgrading. New releases must use `com.ascendrpg.personal` and the existing permanent signing key.
