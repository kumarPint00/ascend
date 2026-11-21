# ASCEND — Detailed AI Learning Roadmaps (v0.15.x → v0.16.0)

> **v0.16.0 update:** Roadmap generation now uses the [Hybrid AI Provider Manager](AI_PROVIDER_MANAGER.md) with Gemini API, Groq and OpenRouter free-model routing, SecureStore key management, local quota counters, and per-week SQLite checkpoints for interruption/resume. Original Groq keys are migrated. Gemini Nano stays available for short device-local quests but cannot reliably generate a full 90-day curriculum. ChatGPT Plus can exchange completed roadmap JSON files manually; it does not provide OpenAI API credits. In-progress generation drafts are not included in full-backup v4. The Groq-only description below documents the earlier v0.15.x behavior.\n\n## What changed
Oracle previously created only one brief quest. Full Roadmap is now its default mode, while Single Quest remains available through Back.

Choose a goal (for example, "Build practical LLM engineering skills"), initial ability (Beginner / Intermediate / Advanced), a 30-, 60- or 90-day horizon, daily time (20–90 minutes), and start date. The result provides:
- One overarching measurable goal
- Distinct weekly learning themes and proof-based checkpoints
- One dated actionable achievement for every day, with effort estimate and specific evidence
- Monthly checkpoints at days 30, 60 and 90
- A review screen that allows editing daily task titles, proof requirements, monthly and weekly achievements, excluding selected tasks, and editing the overall title

A 90-day roadmap builds useful skills but does not guarantee expertise.

## Generation and safety
1. The user stores a personal Groq key in Android SecureStore; it is never bundled in the APK or sent to GitHub.
2. Roadmap mode requests separate cloud consent each time. Only the typed goal, start date, ability level and time settings are sent. Imported personal context, private health records, chats and XP histories are not included.
3. One JSON-only Groq call creates the weekly and monthly curriculum. Each subsequent week is generated in a bounded separate request containing exactly seven dated tasks (or fewer for the last week).
4. The deterministic game engine validates every day, title, deliverable, duration, sequence, calendar date, achievement and batch bound. Malformed or incomplete output is rejected before database changes.
5. The user reviews and optionally edits each proposed achievement. Only after explicit approval is a bounded partial quest pack generated and imported in one transaction using deterministic stable IDs. Existing quests, completion history and XP are never overwritten.
6. Each imported daily step is a dated ONCE quest, not a recurring daily habit. Each weekly and monthly checkpoint is a dated ONCE milestone. Newly imported approved roadmap steps are activated so they show up when due. Ordinary JSON imports and single quest drafts retain existing safe backlog defaults.

## Where to find the roadmap
- Journey → goal → Milestones: weekly and monthly outcomes with evidence
- Journey → Daily Learning Roadmap: dated daily tasks under the new goal; seven are initially shown, with Show Next 7
- Missions → Today: all incomplete achievements actually due on this date
- The Daily / Weekly / Monthly filters remain strict recurrence filters, preventing the misclassification fixed in v0.14.4

## Groq limitations
30 days needs 1+5 API requests, 60 days 1+9, and 90 days 1+13. Free-tier rate limits, model output truncation or internet interruptions may cause generation to fail. The app displays generation progress and supports cancellation. An incomplete roadmap is never imported. Start with 30 days if provider limits are restrictive.

## Validation
- packages/game-engine/tests/roadmap.test.cjs checks 30/60/90-day completeness, calendar boundaries, evidence milestones, partial selection and malformed AI output
- scripts/test-roadmap-contract.cjs checks visible UI, cloud consent, local key handling and integration into the idempotent SQLite import
- npm test, npm run typecheck, signed GitHub Actions APK, emulator smoke and real Android device acceptance remain release requirements
- Live Groq output quality is not verified by static tests and must be reviewed in the app

## Example: Practical LLM engineering
Goal: Ship working LLM tools with testing, RAG and basic deployment.
Month 1: Build reliable prompting and structured output prototypes.
Week 1: Set up a reproducible Python/LLM workspace.
Day 1: Configure a Python project and environment; submit requirements and a working notebook.
Day 2: Measure token usage for multiple prompt styles; document trade-offs.
Day 3: Write a repeatable prompt test harness; save sample input/output pairs.
Day 4: Implement JSON validation and retry handling; submit tests.
Day 5: Evaluate five model answers against a rubric; record failures.
Day 6: Add safe timeout and secret-handling practices; run smoke tests.
Day 7: Demonstrate the prototype and document open issues.
Week 1 proof: Running prototype, checked tests and a one-page reflection.
Month 2: Create a measurable retrieval-augmented application.
Month 3: Evaluate and deploy a small production-style LLM service.

This is illustrative, not an actual generated plan. The app generates a complete tailored day-by-day sequence after user approval for Groq Cloud.
