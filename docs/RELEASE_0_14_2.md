# ASCEND v0.14.2 / Android Build 24

## Fixed: daily quest exists but appears missing

**Root cause:** "Today" reused a function that deliberately returned only the top
four missions from the daily focus budget. Saved recurring quests outside this
limit existed in SQLite but did not appear on this filter or the Home shortlist.

**Changes:**
- New \`dueMissionList()\` computes *all* eligible tasks without a work cap.
- \`activeMissionList()\` still returns the bounded focus picks used for
  low-pressure daily planning and reminders.
- Today displays every eligible task. New **Daily** filter lists every
  unarchived daily quest, even if it is paused, scheduled later or in Backlog.
- Saving a daily quest clears search and opens **Missions → Daily**.
- Importing a partial JSON pack opens **Missions → All**.
- Home shows a "+N more due today" action and the full due count.
- Widgets count all due missions but keep their first focus pick.
- AI-suggested quests still require explicit approval and are saved in
  **Backlog**, not activated automatically. To activate: **Hub → Planner →
  Quest library → Plan → Active**.

## Fixed: keyboard overlaps and inconsistent text fields

- Android \`softwareKeyboardLayoutMode=resize\` explicitly configured.
- Main bottom navigation hides while a text keyboard is visible.
- Quest/Goal/Planner/Oracle/Connect inputs use full-width responsive layouts,
  readable 16sp text and aligned padding/borders.
- Modal form wrappers resize with the keyboard. Long forms, JSON imports,
  Restore and Connections dialogs scroll as necessary instead of clipping.
- Keyboard-open emulator screenshot capture added to visual-QA workflow when
  the relevant Android accessibility node is available.

Actual S25 Ultra keyboard/One UI and font-scale behavior still require
physical-device verification.

## AI providers: Gemini Nano + optional Groq Cloud + offline fallback

The existing native **Gemini Nano** integration remains. This is *not* the same
as Google **Nano Banana**, which is an **image-generation model**. Groq in this
release is a text LLM fallback for creating quest and goal proposals; it cannot
replace a graphics/image generation model.

Groq model: \`openai/gpt-oss-20b\`, JSON response mode, constrained input size,
locally validated output and review-before-save.

### Personal setup

1. In Groq Console create a personal API key (see
   https://console.groq.com/keys). Do not place it in GitHub, an Expo
   environment variable, screenshots or any shared chat.
2. In ASCEND open **Oracle → AI Provider → Groq Cloud**.
3. Select **Configure Groq Key**, paste the key and save. It is held in Android
   SecureStore on that device and can be deleted from the same screen.
4. Enter an intention, acknowledge AI fallibility, and explicitly check the
   Groq Cloud consent box. Enabling optional sharing of recent quest titles
   is a separate choice.
5. Generate and review the proposed draft. Only accepting it will create
   a local Backlog item. Activate it separately in Planner if desired.
6. If Groq returns 401/429 or network errors, ASCEND explains the issue and
   provides a conservative offline starter draft. No XP is awarded.

"Auto" tries a ready local Gemini Nano model first. It only calls Groq when
a personal key **and explicit per-session cloud consent** are present. Cloud
requests stop when the Oracle closes. No automatic health, email, WhatsApp,
document or financial records are sent to Groq.

Groq usage can be subject to free-tier quotas, account eligibility and paid
plans. No promise of permanent free inference is made. Direct BYOK API calls
are suitable only for this private installation; a public launch would require
a secure authenticated backend proxy.

## Test matrix and acceptance

- [x] Engine regression verifies due missions beyond the focus cap.
- [x] JS source tests for form layouts, cloud opt-in and secure key storage.
- [ ] Confirm signed v0.14.2 Android build and native signing.
- [ ] Confirm three Android 15 emulator cold starts and screenshot tour.
- [ ] On Samsung, create 5+ daily quests and check Home/Today/Daily/Widget.
- [ ] Open a quest, Planner and Oracle form, focus lower text fields and verify
      the keyboard does not cover input or Save actions at different font scales.
- [ ] Configure a real Groq key and generate a valid proposal; test rate limits,
      airplane mode, invalid key and key deletion.
- [ ] Verify package update over v0.14.1 without losing XP, quests, or backups.

Do not promote the public GitHub Release until physical-device acceptance.
