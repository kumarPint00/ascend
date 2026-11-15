# ASCEND Roadmap

## V0.1 — Offline single-player prototype (this package)
- [x] Deterministic leveling/XP, rank boundaries, attribute XP
- [x] Daily, weekly, one-time quests with unique completion periods
- [x] Daily XP cap and append-only ledger logic
- [x] Offline SQLite database, seed quests, CRUD/archive
- [x] Create/edit goals; progress by linked quest completions
- [x] Dashboard, quest board, hunter stats, progress charts, settings
- [x] Human-copyable JSON export (NOT automatic backup)
- [x] Platform-independent game engine tests
- [x] Manual GitHub Actions Android APK build workflow
- [ ] First device APK build / smoke test (needs online CI after repository import)

## V0.2 — Personal daily driver
- [ ] Review behavior on-device and balance quest difficulty
- [ ] Proper export/import backup files, restore tests, optional Android Auto Backup
- [ ] Calendar-based quest scheduling and rescheduling
- [ ] Reliable reminder notifications with opt-in and quiet hours
- [ ] Midnight refresh on foreground, analytics improvements
- [ ] Skill trees and non-quantitative real-world milestones
- [ ] Accessibility audit and animation preferences

## V0.3 — Optional cloud
- [ ] Supabase Auth and RLS-secured schema
- [ ] Outbox sync with idempotent server awards, conflict policy, offline retries
- [ ] Data export / delete account, security testing
- [ ] Monitor free limits and avoid adding billing/payment method

## Public beta (only after personal validation)
- [ ] Onboarding, privacy policy, terms, account recovery
- [ ] Server-authoritative ranking and anti-abuse, analytics/observability
- [ ] Load testing, penetration testing, backups, paid-service budget guardrails
- [ ] Original art assets, subscriptions only if justified

## Constraints
- No paid API, mandatory subscription, account, or telemetry in V0.1.
- XP is a participation score, not a medical/psychometric assessment.
- Offline data is not automatically recoverable after uninstall/device loss.
- Public distribution may incur app-store registration costs.
