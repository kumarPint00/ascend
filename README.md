# ASCEND — Real-Life Leveling System

Android-first, offline-first, Solo Leveling-*inspired* (not affiliated) personal growth RPG. Original identity; no copyrighted art, logos or music.

## What's already implemented
- Dashboard: XP, level, E–S rank, today's quests and primary goals.
- Quest board: create, edit, archive and complete quests with daily / weekly / one-off recurrence.
- Six XP-based attributes; deterministic rank and level calculations.
- Long-term questlines and XP/completion analytics.
- Local SQLite persistence and transaction-backed duplicate reward protection.
- Data export as selectable JSON text.
- Automated game-engine tests and manual GitHub Actions APK workflow.

> **Current state:** Android source v0.4.0. CI validates the game engine and TypeScript. Android APK builds run in GitHub Actions; device-level accessibility, layout and update testing remains necessary.

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

**V0.4 has zero required recurring cloud costs:** no Supabase, Firebase, Vercel, paid AI API, push service, remote database or analytics needed. Your device is the primary database. GitHub-hosted Actions are free without metered runner compute for standard public repositories; private repositories have included monthly quotas and may incur charges if billing permits overages. Configure billing spending limits to prevent surprises.

A future public app cannot be guaranteed zero infrastructure cost indefinitely, and store registration may have separate one-time costs. Plan paid upgrades only after proving retention and having actual revenue.

## Protect your data

**There is no cloud backup in this version.** Before uninstalling, resetting the device, or replacing a phone, use **More → View Backup JSON**, copy all JSON and save it securely. **More → Restore Saved JSON** supports a validated manual restore that replaces local records. Verify your export before a signing-key migration. Do not store personal health or financial secrets in public GitHub issues or repository files.

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
