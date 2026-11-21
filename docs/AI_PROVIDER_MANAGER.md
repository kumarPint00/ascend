# ASCEND Hybrid AI Provider Manager — v0.16.0 → v0.16.1

## v0.16.1 — Shared AI keys and model selection

The single-quest Oracle previously displayed an incorrectly labeled **Hybrid Cloud**
panel with only a Groq key editor. The full roadmap had separate Gemini, Groq
and OpenRouter key controls. Both modes now use the SAME
`ProviderSettings` component and the SAME SecureStore configuration.

- Configure **Gemini API**, **Groq** and **OpenRouter** keys independently,
  with clear saved/not-configured status and explicit Add/Replace/Remove actions.
- Choose a **default cloud provider**: Auto, Gemini, Groq, or OpenRouter.
  The preference remains saved after closing/reopening Oracle and across
  signed Android upgrades.
- Choose an **LLM independently for each provider**:
  - Gemini: `gemini-2.5-flash`, `gemini-2.5-flash-lite`.
  - Groq: `openai/gpt-oss-20b`, `openai/gpt-oss-120b`.
  - OpenRouter: `openrouter/free` (rotating free-model router).
- The saved model affects the real API request URL/body, not merely the UI.
  The allowlist excludes arbitrary model IDs and paid model routers.
- Keys remain available until explicitly replaced/removed, app data is
  cleared, the app is uninstalled, or Android's underlying secure storage
  becomes unavailable. Keys cannot technically survive all device changes
  or app uninstalls automatically, and do NOT enter app backups.
- Cloud consent remains per session and is not automatically remembered;
  the requested provider is tried first, then configured fallback providers.
- Gemini Nano is selectable in the on-device Oracle mode and has no cloud key.
  ChatGPT Plus remains a manual roadmap JSON import/export route, not an
  API key or billable OpenAI provider.
- Display is scrollable with 44px minimum action controls and responsive
  wrapping for longer model names.
- The signed Android package ID remains `com.ascendrpg.personal`.

**User test:** Open Oracle → Single Quest → Cloud AI. Configure Gemini, Groq
and/or OpenRouter keys and select the desired model. Return to Full Roadmap;
the same keys, default provider and per-provider model choices must appear.
Close and restart ASCEND; settings must still be present. Check that no
API keys are visible in app backups or exported quest plans.

## Capabilities implemented

- Personal **bring-your-own-key** routing across **Google Gemini API** (model
  `gemini-2.5-flash`), **GroqCloud** (`openai/gpt-oss-20b`) and
  **OpenRouter** (`openrouter/free`). The selected provider is tried first,
  followed by other configured free model endpoints on retriable failure.
- **On-device Gemini Nano** remains the preferred private short-quest option
  when the model is ready; the existing deterministic offline quest suggestion
  remains available without internet, account or paid API.
- **Android SecureStore** stores each cloud key separately. The earlier Groq
  key is migrated in-place from `ascend.groq.personal-key.v1`; neither old
  nor new secrets are bundled in the APK, SQLite draft, JSON import/export,
  or GitHub. Key removal deletes both storage slots for Groq.
- **Permission gate:** roadmap cloud requests require fresh user approval.
  Auto quest flow checks separate consent for cloud fallback. User types the
  goal; no diaries, health records, ChatGPT conversations or XP histories
  are inserted into cloud prompts.
- **Conservative local quota controls:** per-provider requests/day, estimated
  input/output tokens, 429 hits and retry blocks are stored in SQLite v7.
  Response usage metadata is used when provided; otherwise counters are
  explicitly estimates. Local caps (Gemini 20 requests/90k tokens, Groq
  60 requests/150k tokens, OpenRouter 35 requests/45k tokens daily) are
  **app safety ceilings, not the provider's official quota**. Providers
  may apply stricter limits at any time.
- **Typed schema validation:** untrusted provider JSON must pass the existing
  `parseRoadmapBlueprint`, `parseRoadmapWeek` and/or
  `parseNanoDraft` validators. Bad output is never accepted as a valid
  generation and can trigger fallback.
- **Resumable roadmaps:** SQLite tables `ai_roadmap_sessions` and
  `ai_roadmap_stages` persist a validated curriculum and each generated
  week, keyed to the exact goal, start date, duration, level and minutes.
  A 30/60/90-day plan can resume after rate limiting, cancellation, process
  interruption or app restart. Already validated weeks are not regenerated.
  Drafts can be explicitly erased without touching quests, XP or milestones.
- **User approval:** the existing preview edits daily titles/proof and weekly
  and monthly achievements, lets users select items and calls the existing
  transactional, deterministic-id partial importer. No partial generation
  automatically creates a quest or awards XP.
- **ChatGPT Plus manual interchange:** users can import a complete
  `ascend-ai-roadmap` v1 JSON file from ChatGPT and export a reviewed plan
  to the same format, without requiring the separately billed OpenAI API.
- **Existing data:** schema v7 adds tables only. Quest, goal, XP, completion,
  backup v4, adaptive history and notifications are not rewritten.

## Cloud privacy and cost boundaries

These are direct Android BYOK requests: they are suitable for a private app
but not for a shared public application with a developer-owned key. Always
review provider privacy terms before sending confidential personal content.
Cloud free access is not equivalent to on-device inference.

**No provider account is automatically made free by ASCEND.** The app routes
to zero-priced model names and has local safety caps, but it cannot determine
whether a Google project is on a paid billing plan or whether pricing changed.
Use free-tier-only projects/keys, configure spending caps in provider
dashboards, and do not assume daily token counters reflect provider billing.

**ChatGPT Plus does not provide OpenAI API credits.** There is no attempt
to automate ChatGPT's consumer website or extract session credentials.

## ChatGPT JSON import contract

Request a complete JSON document with this structure (replace the placeholder
arrays with the exact number of weeks and days):

```json
{
  "format": "ascend-ai-roadmap",
  "schemaVersion": 1,
  "request": {
    "intent": "Learn LLM engineering through practical projects",
    "startDate": "2026-12-01",
    "duration": 30,
    "dailyMinutes": 45,
    "startingLevel": "intermediate"
  },
  "blueprint": {
    "title": "Practical LLM Engineering Roadmap",
    "objective": "Build and evaluate a working RAG application",
    "attribute": "intelligence",
    "weeklyThemes": [
      {"week": 1, "theme": "Project fundamentals", "achievement": "A reproducible starter app"}
    ],
    "monthlyAchievements": [
      {"month": 1, "title": "Working prototype", "proof": "Demo with recorded evaluation results"}
    ]
  },
  "weeks": [
    {
      "week": 1,
      "theme": "Project fundamentals",
      "achievement": "A reproducible starter app",
      "days": [
        {"day": 1, "title": "Create a typed project skeleton",
         "deliverable": "Commit the working project and dependency lockfile",
         "minutes": 40}
      ]
    }
  ]
}
```

The example above is **illustrative and intentionally incomplete**; it
**will not import**. For 30/60/90 days, ChatGPT must produce exactly 5/9/13
weekly themes, 1/2/3 monthly achievements and 30/60/90 numbered daily
activities, grouped in consecutive 7-day weeks (short final week).
`blueprint.weeklyThemes` and `weeks` must have matching week numbers and
themes. Every daily title and deliverable must be meaningful and
nonduplicated within its week. Save as a UTF-8 `.json` file and choose
**Oracle → Full Roadmap → Import ChatGPT Plus Roadmap JSON**. Check every
entry before approving any import.

A sample instruction to paste into ChatGPT:

> Create a complete ASCEND `ascend-ai-roadmap` schemaVersion 1 JSON file
> for [goal], starting on [YYYY-MM-DD], for [30/60/90] days, [N] minutes/day,
> at [beginner/intermediate/advanced] level. Include the exact numbered
> weekly themes, monthly proof-based achievements, every sequential numbered
> daily quest with measurable deliverable and minutes. No placeholders or
> missing days. Return the entire valid JSON document as a file.

## How resume works

1. Tap Generate with a configured free provider key and explicit cloud consent.
2. ASCEND validates a curriculum blueprint before saving it.
3. Each accepted week is persisted as an independent validated checkpoint.
4. If any stage fails, no quest or goal is imported. Fix the key/limit or
   wait for quota renewal, then tap **Resume Saved Roadmap** with the same
   request details. Existing weeks are reused.
5. Review the completed roadmap and approve selected daily, weekly and monthly
   entries. Their IDs remain stable across repeated imports.
6. Optionally erase the generation draft afterward. Stored checkpoints are
   private app-local data and **not included in full-backup v4 exports**.

## Known release limitations

- Live Gemini/Groq/OpenRouter generation with personal API keys is not tested
  in GitHub CI; cloud request correctness and billing must be validated on
  the owner's phone/account.
- Gemini Nano supports short user-invoked quest drafts, not a full 90-day
  offline curriculum. Offline manual JSON import and existing quest features
  remain functional.
- Local counters measure this application's requests only and cannot inspect
  organization-wide usage or authoritative remaining provider quota.
- Saved generation drafts are app-private local SQLite records. They are
  not included in the existing full-backup export. Export a finished reviewed
  roadmap JSON separately if you need portable recovery.
- No consumer ChatGPT subscription is connected to an API endpoint.

## Validation and device gate

- `npm test`: game-engine, roadmap schema, SQL migrations, XP integrity,
  UI contract and provider-manager integration.
- `npm run typecheck`: strict mobile and engine TypeScript checks.
- GitHub Actions: signed Android build, original signing key, package
  `com.ascendrpg.personal`, versionCode 31, emulator cold starts.
- Physical Samsung: add/remove keys, cloud consent, 429 behavior, offline
  fallback, partial-week resume, 30/60/90-day import into existing data,
  backup recovery and keyboard-safe UI.

References:
- https://ai.google.dev/gemini-api/docs/pricing
- https://console.groq.com/docs/rate-limits
- https://openrouter.ai/collections/free-models/
