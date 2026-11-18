# ASCEND // REFORGED — Phase 4 UX Candidate (v0.13.1, build 19)

## Shipped in source

- apps/mobile/src/experience/HunterWorld.tsx: original shader-based articulated humanoid
  made from generated mesh geometry. The GPU draws a character with head/visor,
  armor, segmented arms/legs, glowing chest, cloak, weapons unlocked by level,
  a portal ring, sanctuary platform, monoliths and a starfield.
  Body motion runs only while foregrounded. The scene has a graceful static fallback.
  **This is procedural 3D, not glTF or professional skeletal rigging.**
- Home Realm shows the character with rank and XP progress; Hunter inspection lets
  users rotate the avatar and change its armor aura (Azure / Royal / Ember).
  Level >=5 adds a blade; level >=10 adds an ascended core. No fake XP is created.
- apps/mobile/src/experience/RealmMap.tsx: six real navigation gates:
  Hunter Sanctuary, Mission Forge, Journey Archives, Tactical Hall, Oracle Tower,
  and Memory Vault. All remain open, so users cannot be blocked from important work.
- apps/mobile/src/experience/JourneyPath.tsx: milestone map with true
  completion and prerequisite states. Plans go to Planner; available milestones
  use the existing guarded completion transaction.
- Reorganized bottom navigation: Realm, Missions, Journey, Hunter, Hub.
  Planner, Insights, Oracle and Connections remain available from real controls.
  Android hardware Back returns to a predictable parent screen.
- Hero/action dock, today's mission counts/XP, horizontal mission filters, more
  readable quest cards, Oracle quick-start ideas and Connect source summary.
- Design language and motion: coherent glass surfaces and legible controls,
  native-driver page transitions, existing cinematic rank/boss effects,
  short quest-completion vibration with permission.
- Graphics controls are stored in Expo SecureStore:
  Immersive (~45fps budget), Balanced (~30fps), Battery Saver (one static GPU frame, then JS animation loop stops).
  OS reduced-motion preferences override ongoing graphics animation.
- No added mandatory cloud, new paid SDK or tracking. Existing SQLite v6 and
  signing package com.ascendrpg.personal remain unchanged.

## Known gaps (do not represent these as complete)

1. A rigged glTF humanoid, realistic animations, fully editable gear inventory
   and advanced visual asset pipeline are **not implemented**.
2. Sanctuary navigation is a functional 2D interactive gateway. There is one
   GPU sanctuary scene; multiple 3D zones, NPCs and camera exploration remain.
3. Oracle still creates one reviewed quest/goal proposal at a time. Full
   goal-to-questline decomposition, voice dialogue and multi-agent life planning
   are future work and require safety gates.
4. True shared-element navigation, animated card expansion, gesture-based
   interactions and visual-regression baselines remain to be implemented.
5. Device-specific rendering quality is not verified on a physical Samsung.
   No claim of native Gemini Nano generation or Health Connect success without
   real-account testing.
6. In Battery mode the 3D character intentionally freezes after the first
   frame; some non-3D UI gradients remain.

## How to validate

1. Export a full progress backup (and separate protected Context export if used).
2. Install the permanently signed build over the existing app; **never uninstall**.
3. Confirm prior XP, quest controls, goal milestones, adaptive records and
   Context Hub remain intact after additive version upgrade.
4. Open Realm, complete a due quest, inspect the character and switch armor aura.
5. Open Sanctuary Gates and test every destination plus Android back actions.
6. Expand a goal, follow the journey path, verify locked and due milestones.
7. Test Immersive, Balanced and Battery modes; disable animations in Android
   accessibility settings and confirm all flows remain usable.
8. Test low battery / app background / resume / graphics context loss; check
   for excessive GPU usage and overheating over extended use.
9. Test TalkBack, 1.4× fonts, small devices and long quest titles.
10. Verify Gemini Nano, Health Connect, Google OAuth and local encryption
    on the actual phone as separate acceptance gates.

## Release gate

GitHub Actions signing, TypeScript checks and three Android 15 cold launches
are necessary but not sufficient. Keep v0.13.0 as an Actions candidate and
do not replace the v0.9.1 public release until actual Samsung acceptance.
