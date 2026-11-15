# Private quest packs

ASCEND's repository is public. **Never commit your private plan JSON** with family names, work deadlines, financial details, health information or private projects.

## Import your personal plan
1. Download the private `.json` quest pack supplied directly in your ChatGPT conversation.
2. Install ASCEND Android v0.3.0+ from the signed release workflow when available.
3. Open **More > Personal quest pack > Choose quest pack file** and select the downloaded JSON.
4. Review the goal/quest/milestone counts and confirm. Alternatively paste JSON manually.
5. Open **Goals**, expand **Milestones**, and edit or archive stale items.

- Imports are **additive, atomic and repeat-safe**. Existing goals, completions, XP and edited entries remain unchanged.
- Milestones are one-time goal-linked quests with the ◆ marker. Dates are descriptive only; **no scheduled reminders** are created.
- No item is completed and no XP is granted on import.
- The app does not upload imported data to GitHub, Vercel, Firebase or Supabase.
- The personal plan isn't bundled with the APK; you explicitly import it on your device.
- The current engine supports daily, weekly and one-off quests, not custom weekday schedules.
- This is not live synchronization with any other project, calendar or wedding app.

## Safe generic example

```json
{
  "format": "ascend-quest-pack",
  "schemaVersion": 1,
  "packId": "example-2026",
  "title": "Example Progression Pack",
  "goals": [
    {"key":"learning","title":"Develop a useful skill","attribute":"intelligence","targetCount":12}
  ],
  "quests": [
    {"key":"study","goalKey":"learning","title":"Practice for 20 minutes","description":"Record one insight.","attribute":"intelligence","difficulty":"medium","repeatRule":"daily","kind":"quest"},
    {"key":"demo","goalKey":"learning","title":"Demonstrate a working skill","description":"Verify result before marking done.","attribute":"intelligence","difficulty":"hard","repeatRule":"once","kind":"milestone","dueOn":"2026-12-31"}
  ]
}
```

Pack IDs, goal keys and quest keys use lowercase ASCII letters, numbers and hyphens. A pack supports up to 30 goals and 180 quests/milestones within a 100 KB text limit. Re-importing an unchanged pack does not duplicate items. Imported items can be edited or archived individually.
