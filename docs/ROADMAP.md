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

## Phase 3 · Adaptive Personal RPG & Life OS (v0.10.0 signed candidate)

- [x] Offline explainable habit learning from real completions and focus minutes, no invented skip/failure claims
- [x] Bounded adaptive suggestions: easier routines, small stretch challenges and editable draft quests, milestones and goals
- [x] Safety: explicit approval, no autonomous goal activation, energy and workload budgets, limited suggestions and cooldowns
- [x] Lite recurring quest completions with reduced XP, no duplicate rewards and no boss-proof substitution
- [x] SQLite v5 local feedback storage, schema v4 backup/restore for adaptive preferences, decisions and Lite evidence
- [x] Planner Adapt section with editable approval/dismissal, quick Lite action and reduced-motion-aware UI
- [x] Automated TypeScript, adaptive engine and SQLite migration tests
- [ ] On-device generative AI (Gemini Nano or another supported local model) after runtime capability and safety testing
- [ ] Expand original character animation / narrative presentation and optional deep personalization
- [ ] Complete Samsung physical-device in-place migration, v4 backup/restore and accessibility acceptance
- [ ] Publish signed v0.10.0 as latest GitHub release only after acceptance

See [Phase 3 design](PHASE3_ADAPTIVE.md) and [device acceptance checklist](DEVICE_ACCEPTANCE_PHASE3.md).

## ASCEND // NOCTURNE cinematic AI experience (v0.11.0 release candidate)

- [x] Original real-time GPU/WebGL 3D ascension emblem and orbital star scene on Home and Hunter
- [x] New cosmic visual system, animated star/nebula backdrop, premium navigation/cards, cinematic level/rank rewards
- [x] New immersive Quest Architect screen with user opt-in, safety prompt, editable draft review
- [x] Native Android Gemini Nano/AICore ML Kit direct-model bridge behind runtime capability checks
- [x] Explicit model-download consent, on-device generation and private history sharing controls
- [x] Fail-safe deterministic offline draft when AICore model is not available
- [x] AI-approved creations use existing SQLite safety transaction, quotas and inactive Backlog status
- [ ] Native APK signing and emulator cold starts (tracked by CI)
- [ ] Gemini Nano model readiness and inference verified on Samsung S25 Ultra
- [ ] Actual visual quality, GPU perf, battery and large-font accessibility verified on physical device
- [ ] Optional rigged 3D humanoid character and story-scene asset pipeline; current renderer is an abstract 3D emblem
- [ ] Public release after backup/upgrade/AI model acceptance on actual device

[Nocturne technical spec and acceptance gates](PHASE3_CINEMATIC_NANO.md)

## ASCEND Connect — Personal Context Hub (v0.12.0 signed candidate)

- [x] Additive SQLite v6 migration for permissioned, encrypted per-source context
- [x] Android Keystore AES-256-GCM and separate passphrase-protected context export/restore
- [x] Android Share Sheet (selected text only), private capture preview and deduplication
- [x] User-selected ChatGPT conversation export importer (user-authored text, no automatic full access)
- [x] Health Connect native read-only permission request + optional 1–30 day activity summaries
- [x] Google Calendar, Gmail and Drive scoped OAuth connector code and manual read-only sync
- [x] GitHub fine-grained token connector for assigned issue summaries
- [x] Local text file and document metadata import; PDFs/images do not yet have OCR
- [x] Source permission dashboard, per-source retention, audit, disconnect/delete and inbox search
- [x] Context-to-quest review via bounded adaptive transaction; explicit opt-in Nano handoff
- [x] Deterministic import and database migration tests
- [ ] Verify Health Connect, OAuth, Share Sheet and Gemini Nano on user's Samsung S25 Ultra with user consent
- [ ] Confirm v5→v6 real-phone migration, encrypted context export recovery and device rendering
- [ ] Encrypted multi-device sync, optional PDF OCR and expanded background delta sync deferred

[Connection setup and native acceptance checklist](ASCEND_CONNECT.md)

## Phase 4 · Reforged UX foundation (v0.13.2 signed candidate)

- [x] Original animated procedural 3D Hunter with tiered sanctuary, limb movement, level equipment and manual rotation controls
- [x] Three armor aura appearances, persisted locally; immersive/balanced/battery graphics modes
- [x] New Realm / Missions / Journey / Hunter / Hub navigation, contextual Planner/Oracle/Connect access
- [x] Accessible six-gate navigational sanctuary linking real app destinations
- [x] Daily raid summary, one-tap mission completion, concise quest cards and horizontal mission filters
- [x] Milestone journey path with real complete/locked/scheduled state and functional actions
- [x] Context HUD and Oracle quick-start intents; existing boss victory ceremony preserved
- [ ] Professional rigged glTF humanoid asset with skeletal animation and complete equipment inventory
- [ ] Fully navigable multi-scene 3D RPG world with original NPCs, environment interactions, and scripted boss scenes
- [ ] Multi-step AI Quest Director and real-time dialogue beyond existing one-draft native model flow
- [ ] Advanced gesture animations, shared-element navigation, automated golden screenshot comparison
- [ ] Samsung S25 Ultra in-place upgrade, real GPU performance/battery, accessibility and provider permissions acceptance
- [ ] Public release promotion once physical-device acceptance is complete

See [Reforged UI/UX design and implementation notes](PHASE4_REFORGED.md).

## Future public beta (not in personal Phase 3)

- [ ] Opt-in multi-user authentication and RLS, reliable multi-device sync and recovery
- [ ] Public onboarding, privacy policy, consent, deletion/export and app-store compliance
- [ ] Abuse protection, server-validated scoring, quotas, performance/security audits
- [ ] Public community, guilds, monetization and paid AI only after a separate decision

## Costs and privacy
- Personal-use build requires no recurring paid services; local notifications need no push server.
- Never commit the private personal quest pack, signing credentials or user backup to public GitHub.
- Android in-place updates require the SAME package ID and private signing key.
- XP represents participation, not medical fitness, income, professional ability or self-worth.
