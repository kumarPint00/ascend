# ASCEND Widgets v1 — v0.14.0 / build 22

## Included

Four native Android home-screen widgets, available from the launcher after the
new signed APK is installed:

| Widget | Main content | Opens |
| --- | --- | --- |
| Daily Quests | Daily cleared/available missions, earned XP, completion bar | Missions |
| Hunter Status | Actual rank, level, total XP and next-level progress | Hunter |
| Focus & Planner | Earliest scheduled time, available missions and estimated effort | Planner |
| Progress | Cleared missions, today's XP, active goals and today's board | Insights |

Widgets use the same source-of-truth game engine functions as the main app:
activeMissionList() and derivePlayer(). The native widget never queries the
private SQLite database, writes any quest, awards XP, or calls a cloud model.
Android receivers render a minimized presentation snapshot published by the
Expo application. Unverified AI drafts are never shown as earned progress.

## Add a widget on Samsung One UI / Android

1. Export your current progress backup; install the signed APK **over** the
   previous version without uninstalling it.
2. Open ASCEND and confirm previous XP and quests are present.
3. Long-press empty space on your home screen → Widgets → ASCEND.
4. Select Daily Quests, Hunter Status, Focus & Planner, or Progress.
5. Resize with launcher handles. Compact and wider views adjust to size.
6. Tap the widget to open its destination in ASCEND. Complete quests only
   through the app's existing verification controls.

If the launcher doesn't immediately show ASCEND, reopen the app and check
the launcher widget picker again.

## Privacy and settings

In **Hub → Android Home Widgets**:

- Pause widgets replaces the cached projection with a non-personal message.
- Show quest titles is **off by default**. Opting in allows selected
  quest titles to appear on the unlocked home screen and in private
  app-specific SharedPreferences storage. Opting out clears these titles
  from the next published snapshot.
- No email, WhatsApp, ChatGPT conversations, health data, contacts, or
  linked-account tokens are used in widget projections.
- Widget data is a compact display cache, **not a backup**.

## Update and battery constraints

- The app republishes the widget snapshot when real quests and XP refresh.
  Every installed widget is then refreshed immediately.
- Android may request redraws about every 30 minutes, subject to OS policy,
  but this redraw does not run React Native, read SQLite or earn XP.
- When a saved daily snapshot belongs to a previous day, the widget shows
  "Open ASCEND to refresh" instead of mislabeling yesterday's totals as today.
- There is no continuously rendered 3D animation or live timer in the widget.
  No new internet, cloud, location or health permissions are requested.

## Implementation references

- Native: apps/mobile/modules/ascend-context/android/src/main/java/expo/modules/ascendcontext/AscendWidgetProvider.kt
- Layouts: apps/mobile/modules/ascend-context/android/src/main/res/
- Bridge: apps/mobile/modules/ascend-context/index.ts
- Projection builder: apps/mobile/src/widgets/snapshot.ts
- App controls/links: apps/mobile/src/App.tsx
- Contract tests: scripts/test-widget-contract.cjs
- Android test: scripts/android-cold-start-smoke.sh

## Device acceptance (not yet claimed)

- [ ] Add all four widgets and resize them on Samsung One UI.
- [ ] Test widget taps from cold and running app states.
- [ ] Confirm XP and quests stay unchanged until verified in the app.
- [ ] Test widget pause and quest-title permission toggles.
- [ ] Confirm midnight rollover hides stale daily stats.
- [ ] Validate upgrade from v0.13.3 with SQLite, XP and backups preserved.
- [ ] Test enlarged fonts, compact widgets and power consumption.

No Galaxy Watch tiles/complications, direct in-widget XP-awarding actions, or
live widget timers are claimed. Native Android RemoteViews was chosen instead
of Jetpack Glance for compatibility with the existing native Expo module and
to avoid an unneeded extra dependency in the initial version.
