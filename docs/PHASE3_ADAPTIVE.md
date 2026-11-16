# ASCEND Phase 3 — Adaptive Personal RPG (v0.10.0 preview)

## Purpose and scope

This is the **personal**, offline-first Phase 3 direction, not a public beta.
The first release candidate implements an explainable habit-learning engine, an
Adaptive Planner UI, easier alternatives and guardrails. No mandatory cloud,
paid API, login, ads, guild, or public leaderboard is involved.

**AI qualification:** adaptive recommendations here use locally computed statistical
patterns and transparent rules, not a generative LLM. Optional on-device
generative language is a later, separately tested capability. Don't label it
Gemini Nano or promise automatic natural-language generation without a proven
runtime integration on the actual device.

## Implemented v0.10.0 (Android build 13)

- **SQLite v5 (additive):** private adaptive preferences, proposal decisions,
  standard/Lite completion provenance. Quest IDs, existing XP, skill nodes and
  v4 database history remain intact.
- **Live feedback loop:** evaluate scheduled opportunities against actual
  logged completions, with focus-session duration where available. Absence
  of a completion is "not logged", never a moral judgment or verified failure.
- **Explainable proposals:** decrease an existing routine's estimated minutes,
  offer modest stretch increases after sustained consistency, or draft a
  reflection quest, milestone, or new goal when enough evidence exists.
- **Explicit user approval:** proposed content never auto-activates, creates
  XP or alters a goal without approval. The app lets you edit the title,
  planned minutes, and target count before accepting.
- **Personal safety settings:** user-reported energy 1–5, daily mission budget,
  daily available minutes, 0–3 new quests per week, 0–2 new goals per month,
  1–3 suggestions per day, pause and seven-day snooze.
- **Real-time acceptance constraints:** an existing goal in the attribute,
  recent acceptance quota, or overloaded planned work blocks over-creation.
- **Lite alternative:** recurring medium/hard quests can be completed at
  easy difficulty XP (up to 10 XP) at most once in the recurrence period.
  One-off milestones and active boss-proof quests cannot use Lite. Later
  boss verification rejects Lite completion evidence.
- **Feedback memory:** accepted/dismissed decisions are stored locally and
  persist through v4 JSON export/restore. Dismissal suppresses same-category
  suggestions for 21 days.
- **RPG UX:** accessible new Adapt section, expandable suggestion cards and
  editor, animated section transitions (respect reduced-motion), fast Lite
  action from Home/Quest and Planner screens.

## Safety invariants

1. No autonomous creation of goals, quests, milestones or expense/health actions.
2. No XP for generating, suggesting, approving or rejecting a proposal.
3. Lite always earns easy-tier XP and respects the existing daily XP cap.
4. New suggested quests are always **Backlog** until activated by the user.
5. Rest days and missing task logs do not generate debt or penalty quests.
6. Energy 1–2 suppresses stretch/new-goal proposals; even energy 5 cannot
   bypass active workload safety limits.
7. A dismissed proposal cannot be silently reactivated.
8. All writes are SQLite transactions and preserve existing identifiers.
9. Adaptive preferences and history are included in schema v4 backups.
10. Full access remains offline and free.

## Default thresholds (configurable safety controls)

| Setting | Default |
|---|---|
| Daily available time | 90 minutes |
| Max daily missions | 4 |
| Max new quests per seven days | 2 |
| Max new goals per 30 days | 1 |
| Max proposals per day | 2 |
| Energy | 3 / 5 |
| Min observation window for changes | 5 scheduled opportunities |
| Easier recommendation threshold | At most 45% recorded completion ratio in 14 days, or user-reported low energy / short focus sessions |
| Stretch recommendation threshold | At least 85% ratio and 8 scheduled opportunities, with energy ≥4 and workload capacity |
| Max stretch effort increase | 25% at approval |
| Dismissal cooldown | 21 days |

The system is designed to *suggest*, not to pressure. All statistics are
derived from local logs; they are not estimates of health or work capacity.

## Migration and recovery

- v0.9.2 uses SQLite schema v4. v0.10.0 upgrades **forward-only** to v5.
- The v4 backup file format preserves adaptive settings, feedback history
  and completion mode, while accepting older v1/v2/v3 backups.
- A Lite completion is represented by the same single completion period and a
  separate `completion_modes` row; it can never award both Lite and full XP.
- Before installing over a production phone, export the old full backup to
  private external storage. Never uninstall to force an upgrade.
- Do not publish v0.10.0 as the latest public release until Samsung
  in-place upgrade, data recovery and notification tests pass.

## Work left for broader Phase 3

- Verified **on-device generative model** integration behind a runtime capability
  and consent gate, with offline deterministic fallback.
- Wider animations (original character/art assets, stronger quest narratives),
  tested for performance and accessibility.
- Habit opt-out, explicitly recorded skip/reason/effort signals, data retention
  controls, better user personalization and direct calendar integration.
- End-to-end physical Android tests, long-running 180-entry quest pack stress
  tests, full v4 backup migration/restore on a disposable device.
