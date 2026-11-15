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

> **Current state:** V0.1 source implementation. Game engine tests pass locally. Expo dependencies and Android APK could not be installed/built in the author's network-restricted environment, so the UI has not yet been device-tested. GitHub Actions can perform those steps after repository import.

## Run it

Requirements: Node.js 22.13+, npm, a compatible Android development environment (or Expo Go corresponding to your SDK).

```bash
npm install
npm test
npm run typecheck
npm run start
```

To compile an Android APK via GitHub Actions: put this project at the root of your own repository, push the project files, open **Actions → Build Android APK (manual, no EAS required) → Run workflow**, and download the `ascend-android-v0.1` artifact from that run. The APK is a test build, not a production-distribution signed release.

### First-time dependency installation

Package versions target **Expo SDK 58**, React 19.3 and React Native 0.88. The Node/npm commands above require internet for the initial install. Run `npx expo install --check` after install and resolve any SDK compatibility warnings. Commit `package-lock.json` after your first successful online install to lock dependency versions. The initial workflows use `npm install` because a lockfile could not be generated offline; switch them to `npm ci` once the lockfile is committed. The included workflows are configuration only: they have not been executed yet.

If you want to run a phone-specific release build locally, install Android Studio SDK tools and run `npm run android` (debug development); use the GitHub Actions release job for an installable test APK.

## Cost policy

**V0.1 has zero required recurring cloud costs:** no Supabase, Firebase, Vercel, paid AI API, push service, remote database or analytics needed. Your device is the primary database. GitHub-hosted Actions are free without metered runner compute for standard public repositories; private repositories have included monthly quotas and may incur charges if billing permits overages. Configure billing spending limits to prevent surprises.

A future public app cannot be guaranteed zero infrastructure cost indefinitely, and store registration may have separate one-time costs. Plan paid upgrades only after proving retention and having actual revenue.

## Protect your data

**There is no cloud backup in this version.** Before uninstalling, resetting the device, or replacing a phone, use **More → View Backup JSON**, copy all JSON and save it securely. Import/restore is a planned enhancement; this export currently needs a developer-assisted restore path. Do not store personal health or financial secrets in public GitHub issues or repository files.

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
