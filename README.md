# ASCEND — Real-Life Leveling System

## ASCEND // REFORGED v0.13.2 (signed candidate)

The Phase 4 UX foundation now includes an original **procedurally articulated 3D Hunter** in a celestial sanctuary, inspect/rotation controls, rank-aware colors, level-driven equipment, and three locally saved armor styles. A new **Realm / Missions / Journey / Hunter / Hub** bottom navigation separates routine tasks from immersive character screens. The accessible **Sanctuary Gates** world map opens six functional app areas; mission cards have a compact view, today's raid summary, and one-tap completion. Questlines show real milestone states in an interactive journey path. Oracle includes suggested starting intents. Connect shows concise private-source totals. GPU quality settings offer Immersive, Balanced and Battery modes, with reduced-motion compliance.

**Implementation limit:** The character is custom procedural WebGL geometry with limb motion, **not a professionally rigged glTF humanoid**. One sanctuary scene and an interactive navigational map exist, not a multi-world game, animated NPC campaign, or a complete cinematic equipment inventory. Google, Gemini Nano, Health Connect and physical migration still require real-account/device acceptance. No user data is moved into the public repository.

**v0.13.1 hardening:** Android hardware Back navigates immersive screens predictably, and Battery Saver/reduced-motion rendering no longer schedules recurring animation frames.

**v0.13.2 GPU fix:** Align WebGL vertex/fragment precision to address a GPU link failure discovered in v0.13.1 Android emulator screenshots. The corrected renderer requires fresh screenshot verification.

**Candidate testing:** signed APK and Android 15 emulator smoke through GitHub Actions; do not promote the release feed until Samsung S25 Ultra upgrade, backups, GPU rendering, and provider permissions are verified.

[Reforged technical specification](docs/PHASE4_REFORGED.md).


Android-first, offline-first, Solo Leveling-*inspired* (not affiliated) personal growth RPG. Original identity; no copyrighted art, logos or music.

## Download ASCEND for Android

**Latest official release: [ASCEND v0.9.1 signed APK](https://github.com/kumarPint00/ascend/releases/download/v0.9.1/ascend-android.apk)**

[GitHub Releases](https://github.com/kumarPint00/ascend/releases/latest) · [Signed build verification](https://github.com/kumarPint00/ascend/actions/runs/43782629911) · [Three Android emulator cold launches passed](https://github.com/kumarPint00/ascend/actions/runs/43781182287)

**Update in place:** If ASCEND is already installed, do not uninstall or clear app data. Installing a permanently signed APK with the same certificate preserves the existing app data. The v0.9.1 release addresses an Android cold-start crash present in v0.9.0. A real-device upgrade test is still recommended.

## Next signed build: v0.9.2 stabilization candidate

Development source has advanced to **v0.9.2 / Android build 12**, but the latest public update remains **v0.9.1**.
The stabilization candidate fixes direction-aware goal/boss checks, synthetic measurement histories, safe reminder rescheduling, backup-owned file pruning, and adds confirmable completion undo, accessibility improvements, memoized planning, and reproducible dependency installation.

**Do not uninstall the existing app** for a candidate update. Validation requires a permanently signed APK, Android emulator cold launches, then actual Samsung in-place upgrade and backup/restore checks. The candidate must not be published until acceptance.

## Phase 3 personal adaptation · v0.10.0 candidate

ASCEND now includes optional **offline habit learning**, editable suggestions for lighter or stretch routines, user-approved quest/milestone/goal drafts, and strict new-workload safeguards. Lite recurring quest completions award reduced XP (max 10), while keeping the existing one-completion-per-period rule and evidence restrictions. All decisions remain private on-device and are included in the new v4 backup format.

The model is **explainable local rules, not a generative LLM**. Advanced on-device natural-language AI and broader original character animations remain separately planned. No paid API, user account or mandatory cloud sync is added.

[Phase 3 technical specification](docs/PHASE3_ADAPTIVE.md) · [Device acceptance](docs/DEVICE_ACCEPTANCE_PHASE3.md)

**Release safety:** The latest official public release remains v0.9.1. The v0.10.0 signed candidate requires Samsung in-place migration and backup checks before publication.

## ASCEND // NOCTURNE v0.11.0 (signed candidate)

The personal RPG is being redesigned around a real-time **procedural WebGL 3D ascension realm** and a **native on-device Gemini Nano Quest Architect**. The new experience includes animated nebula and stars, luminous panels and navigation, cinematic rank/level rewards, and an opt-in AI draft workflow with explicit approval and offline fallback.

Gemini Nano is available only when Android AICore reports readiness, and generation is performed on-device in the foreground. Users may opt to include a small number of quest titles; no private data is sent to an ASCEND server. AI suggestions go through the same creation limits and Backlog-first policy as existing adaptive rules.

The 3D scene is an **original abstract emblem**, not a full animated humanoid avatar. Native AI generation, 3D performance and device migration have not yet been tested on the owner's Samsung S25 Ultra.

See [Nocturne implementation details and acceptance criteria](docs/PHASE3_CINEMATIC_NANO.md).

## ASCEND Connect v0.12.0 — Personal Context Hub

ASCEND now includes a new optional **More → ASCEND Connect** area for approved
sources: selected ChatGPT conversations, WhatsApp/Android Share Sheet text,
Health Connect/Samsung Health summaries, local file selection, Google Calendar,
Gmail, Google Drive metadata and GitHub assigned issues. Data ingestion is
manually authorized and does not automatically create XP, recurring quests,
medical goals or external actions.

Sensitive context fields and provider credentials use Android Keystore-backed
AES-GCM encryption. Private source records are excluded from the regular
plaintext progress backup; use **protected Context Export** with a passphrase
before changing devices. User-approved suggestions become Backlog quests using
the existing adaptive safeguards.

Some connectors require a Google OAuth client configured outside the app and
scoped provider consent. Samsung Health sync, actual Gemini Nano generation,
Google authorization and physical device migration remain acceptance tests,
**not claims of completed real-account integration**.

[Connection setup and privacy documentation](docs/ASCEND_CONNECT.md)

## What's already implemented
- Dashboard: XP, level, E–S rank, today's quests and primary goals.
- Quest board: create, edit, archive and complete quests with daily / weekly / one-off recurrence.
- Six XP-based attributes; deterministic rank and level calculations.
- Long-term questlines and XP/completion analytics.
- Local SQLite persistence and transaction-backed duplicate reward protection.
- Data export as selectable JSON text.
- Automated game-engine tests and manual GitHub Actions APK workflow.

> **Current state:** Android source **v0.9.2 (stabilization candidate); public release v0.9.1** with offline planner, schedules, goals, skills, bosses, analytics, local reminders and complete backup. CI validates game rules, SQLite schema migration and TypeScript. Android release builds run through GitHub Actions. Real-device acceptance testing remains necessary.

## Run it

Requirements: Node.js 22.13+, npm, a compatible Android development environment (or Expo Go corresponding to your SDK).

```bash
npm install
npm test
npm run typecheck
npm run start
```

To compile an Android APK: use **Actions → Build ASCEND test APK (no signing setup)** for a temporary certificate, or **Actions → Build signed updatable Android APK** for the permanent signing key and optional GitHub Release. **Never install the temporary test APK over an existing signed release**; Android rejects mismatched signatures.

### First-time dependency installation

Package versions target **Expo SDK 58**, React 19.3 and React Native 0.88. The Node/npm commands above require internet for the initial install. Run `npx expo install --check` after install and resolve any SDK compatibility warnings. Commit `package-lock.json` after your first successful online install to lock dependency versions. The initial workflows use `npm install` because a lockfile could not be generated offline; switch them to `npm ci` once the lockfile is committed. The workflows have been exercised in GitHub Actions; check the latest run for authoritative build status.

If you want to run a phone-specific release build locally, install Android Studio SDK tools and run `npm run android` (debug development); use the GitHub Actions release job for an installable test APK.

## Cost policy

**V0.9 has zero required recurring cloud costs:** no Supabase, Firebase, Vercel, paid AI API, push service, remote database or analytics needed. Your device is the primary database. GitHub-hosted Actions are free without metered runner compute for standard public repositories; private repositories have included monthly quotas and may incur charges if billing permits overages. Configure billing spending limits to prevent surprises.

A future public app cannot be guaranteed zero infrastructure cost indefinitely, and store registration may have separate one-time costs. Plan paid upgrades only after proving retention and having actual revenue.

## Protect your data

**No automatic cloud backup is used.** ASCEND v0.9 supports opt-in automatic local backups to an Android folder you choose: Planner → Settings → Automatic verified backups. Backups are unencrypted JSON, reread/validated before old ASCEND-managed copies are pruned, with a best-effort WorkManager schedule and foreground catch-up. Manual full backup sharing/restore remains available. Never uninstall without an independently accessible backup, and never post private JSON in public repositories.

## Repository layout

```
apps/mobile/              Expo / React Native app (Android-first)
packages/game-engine/     Testable deterministic TypeScript game rules
docs/                     Architecture and roadmap
.github/workflows/        Validation and manual build workflows
```

## License and assets

No external anime assets are included. All styling is an original design. Choose and add an explicit license before publishing source publicly; absent a license, default copyright applies.

## Browser preview (separate from the Android app)

Open `web-preview/index.html` in a normal browser, or serve `web-preview` with any static file server. It is a fully local, dependency-free interactive demo using the SAME compiled XP rules from `packages/game-engine` and the browser's `localStorage`. The browser demo has its own quest editor, XP/rank stats, goals, seven-day chart, and JSON export/import. It does not synchronize with the Android app. Rebuild the HTML after changing game-engine rules:

```bash
npm run build:preview
```

If you prefer a hosted test URL, `web-preview/index.html` can be served as a static file on any host, including the free Vercel Hobby plan for *non-commercial* personal testing; do not treat the Hobby tier as free commercial hosting.

See `docs/COST_POLICY.md` for no-spend operating rules and `docs/ROADMAP.md` for missing capabilities.

## In-app Android updates (V0.2)

ASCEND checks [official GitHub Releases](https://github.com/kumarPint00/ascend/releases) and offers **More → Check for updates → Download & update**. Android still asks for installation consent; compatible upgrades preserve local SQLite data without uninstalling the app.

**Before publishing APKs, configure a persistent private signing key in GitHub Actions secrets.** The old V0.1 test APKs used temporary debug signing and may require a one-time migration; back up your existing data before uninstalling an old build. Full instructions: [Android updates and signing](docs/ANDROID_UPDATES.md).

No paid update backend is required. An APK release still requires device verification, and no signed release is published automatically by a source commit.

## Private personal quest packs (v0.3.0)

ASCEND imports private JSON goal, quest and milestone packs from a local file through **More > Personal quest pack**. The import is transactional, additive and repeat-safe; it never grants XP automatically. See [private quest-pack instructions](docs/PRIVATE_QUEST_PACKS.md).

**Privacy:** No user-specific plan is stored in this public GitHub repository.

## Original brand, splash and v0.4 UX

- `npm install` generates original PNG assets via `scripts/generate-brand-assets.cjs`; no paid design tools or binary asset commits.
- Native `expo-splash-screen` configuration, Android adaptive and monochrome icons, and an in-app branded loading state.
- Focused five-item icon navigation; profile accessible from the level badge and dashboard hero.
- Searchable quest board with Today, Weekly, Milestones, Pending, Done and All filters; show-more pagination prevents rendering 180 quests at once.
- Searchable goals with expandable milestones, a refined dark RPG palette and more accessible touch targets.
- Respects the OS reduced-motion preference for quest completion toast transitions.
- [30-point UX and motion audit](docs/UX_30_POINT_AUDIT.md) — implemented and pending checks are explicitly distinguished.

**Personal data is not bundled.** Download the user's private quest pack in the conversation, then import locally from More → Personal quest pack. The public repository must never contain it.

## Integrated Phase 2 (v0.8.0)

The **Planner** tab provides active/backlog/paused quest management, priority-based daily missions, a rolling 14-day calendar, custom weekdays/due dates/snoozes, optional quiet-hour local reminders, measurable goal outcomes, prerequisite milestones, an 18-node skill tree, achievements, boss challenges, focus logs, goal forecasts, weekly reviews, and an on-device database integrity check.

The schema migrates existing v1 SQLite data additively to v2 and keeps original XP events and completions. **Planner → Settings** exports a full v2 JSON file outside the app and validates/restores backups; v1 backup import remains supported.

See [Phase 2 architecture and limitations](docs/PHASE2.md) and [30-point UX audit](docs/UX_30_POINT_AUDIT.md). No personal quest packs or financial/health information are committed to this public repository.

**Important:** Temporary-key APKs cannot replace signed installations. Use the permanently signed GitHub Actions workflow with the existing keystore for in-place upgrades; do not delete your current installation without an external backup. Newly introduced data flows still require device-level verification before wider release.

## Phase 2 depth · v0.9.0

- Explainable offline quest prioritization based on time budget, priority, deadlines and real completion history.
- 14, 30 or 90-day planning, native repeating Android reminders and one-off overdue alerts.
- SQLite v3 metric timeline, downward and upward goal progress, and cautious outcome-based forecasts.
- Selected Android Storage Access Framework folder for automatic backups with 12/24/72-hour interval, 2–30 copy retention and readback verification. Background timing depends on Android.
- Expanded original RPG interface with boss encounters, skill progress and reduced-motion victory effects.
- v3 full-data JSON backup; older v1/v2 restore formats remain recognized.

The repository's [Phase 2 implementation guide](docs/PHASE2.md) and [Android acceptance checklist](docs/DEVICE_ACCEPTANCE_PHASE2.md) distinguish code completion from physical-device validation.
