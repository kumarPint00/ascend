# ASCEND Partial JSON Import

Use Hub > Partial JSON import to choose a local JSON file or paste content.
Unlike Restore backup, importing is additive and does not replace saved progress.

## Goals-only JSON

~~~json
{
  "packId": "my-skills",
  "goals": [{"key":"learn-python","title":"Learn Python",
    "attribute":"intelligence","targetCount":20}]
}
~~~

## Quests-only JSON, imported separately

~~~json
{
  "packId": "my-skills",
  "quests": [
    {"key":"practice","title":"Practice Python for 20 minutes",
      "goalKey":"learn-python","repeatRule":"daily","difficulty":"easy"},
    {"key":"notes","title":"Organize learning notes"}
  ]
}
~~~

The second quest is unlinked. New one-off quests start in Backlog.

## Milestones-only JSON, imported separately

~~~json
{
  "packId": "my-skills",
  "milestones": [
    {"key":"first-project","title":"Finish first project",
      "goalKey":"learn-python","dueOn":"2027-01-15"}
  ]
}
~~~

A milestone never completes automatically. For an in-app manually created goal,
use goalTitle instead of goalKey with its unique exact title.

## Mixed JSON with selective import

~~~json
{
  "format":"ascend-partial-pack",
  "schemaVersion":1,
  "packId":"new-year",
  "title":"Annual development",
  "goals":[{"key":"skill","title":"Improve technical skills"}],
  "quests":[{"key":"study","title":"Study 25 minutes",
    "goalKey":"skill","repeatRule":"daily"}],
  "milestones":[{"key":"review","title":"Quarterly review",
    "goalKey":"skill","dueOn":"2027-03-31"}]
}
~~~

You can omit any two categories. Preview lets you select Goals, Quests and/or
Milestones after validating JSON. The legacy strict ascend-quest-pack format
is still accepted unchanged.

## Fields and safety rules

- Goal: required title; optional key, attribute (discipline), targetCount (10).
- Quest: required title; optional key, description, goalKey or goalTitle
  (not both), attribute (linked in-file goal attribute, otherwise discipline),
  difficulty (medium), repeatRule (once), dueOn (YYYY-MM-DD).
- Milestone: same as quest, but always one-time.
- packId defaults to personal. Use the same packId for staged imports that
  reference an earlier goalKey. Use unique packIds for independent projects.
- Stable keys are recommended. When omitted, the key derives from title.
  Changing that title can create another imported item on a later run.
- Valid attributes: strength, intelligence, discipline, finance,
  relationships, recovery. Difficulty: easy, medium, hard.
  Repeat: once, daily, weekly.
- Limits: 30 goals, 180 quests and milestones combined, 100 KB JSON.
- All selected entries are imported in one exclusive SQLite transaction.
  Missing/archived goal links or ambiguous goalTitle cancel the entire batch.
- Repeated imports with the same packId and key skip existing records. They
  never overwrite existing quests, schedules, archive state, completions or XP.
- Import does not award XP. Manually created entries with similar titles are
  not automatically merged.
- Keep personal JSON files outside public GitHub repositories.

## Steps

1. Open Hub, choose CHOOSE JSON FILE or PASTE PARTIAL JSON.
2. Press VALIDATE & PREVIEW, and inspect names, links and due dates.
3. Toggle Goals, Quests and Milestones to choose sections.
4. Press IMPORT SELECTED SECTIONS, then confirm the summary.
5. Review counts for added and skipped items.
6. Find linked milestones in Journey, unlinked tasks in Missions and
   configure scheduling in Planner if needed.

Partial JSON import is separate from ChatGPT conversations export and ASCEND
Connect data import, which have other formats and privacy requirements.
