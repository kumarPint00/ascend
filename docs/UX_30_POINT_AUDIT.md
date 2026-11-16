# ASCEND · 30-point UX and motion acceptance rubric

This is a working checklist reconstructed from the 20 animation/UX principles discussed previously, with ten product-quality checks added for ASCEND. It is **not** a claim that all 30 are fully satisfied.

## Animation craft (1–12)
1. **Squash & stretch** — press feedback should feel tactile but never distort content. *Status: improved in v0.9.2; physical touch feedback still needs review.*
2. **Anticipation** — show intent before significant state transitions (e.g., completing a major milestone). *Status: partial.*
3. **Staging the focus** — emphasize the next useful action rather than simultaneous highlights. *Status: applied to daily board.*
4. **Pose to pose** — define beginning, middle and end of level-up transitions. *Status: partial.*
5. **Follow-through** — reward feedback should settle gracefully. *Status: partial.*
6. **Slow in & slow out** — ease state transitions; avoid abrupt flicker. *Status: partial.*
7. **Motion in arcs** — reserve curved motion for major reward effects, not ordinary navigation. *Status: deferred.*
8. **Secondary action** — use restrained energy particles or ambient glows; avoid decorative noise. *Status: static original sigil.*
9. **Snappy timing** — short feedback for frequent actions; bigger reveal only for rare rank changes. *Status: partial.*
10. **Exaggerated feedback** — use emphatic treatment sparingly for milestone unlocks. *Status: deferred.*
11. **Solid drawing in 3D** — preserve consistent lighting, depth and perspective in logo and avatars. *Status: applied to brand asset, not full avatar.*
12. **Overall appeal** — intentional original identity, not imitation of copyrighted anime artwork. *Status: in progress.*

## Human–computer interaction (13–20)
13. **Fitts’s law** — frequent taps should be easy and nearby. *Status: 43–48 px minimum main controls.*
14. **Bigger hit areas** — main navigation and completion controls target at least 44×44 dp. *Status: mostly applied; audit every small text button.*
15. **Hick’s law** — reduce choice overload with five primary tabs and focused filters. *Status: applied.*
16. **Miller’s law** — break large goal sets into small visible groups. *Status: 8-goal pages, 20-quest pages.*
17. **Doherty threshold** — give immediate feedback for taps and background operations. *Status: improved source loading/reward states; real-device responsiveness pending.*
18. **Postel’s law** — tolerate valid user input, reject unsafe imported data clearly. *Status: JSON validation with actionable errors.*
19. **Jakob’s law** — use recognizable navigation, search, progress and buttons. *Status: applied.*
20. **Frequency of use** — daily actions get priority; rare administration lives in More. *Status: applied.*

## Production usability, accessibility and trust (21–30)
21. **Visibility of system status** — show progress, XP reward and completion state for each action. *Status: applied.*
22. **Error prevention and recovery** — confirm destructive actions; keep imports atomic and repeat-safe. *Status: v0.9.2 recent-completion undo implemented with transactional XP reversal; destructive full restore still requires explicit confirmation.*
23. **Recognition over recall** — display category, XP, cadence and status in each quest. *Status: applied.*
24. **Consistency & mapping** — one vocabulary for quests, milestones, goals and rank across views. *Status: partial; refine.*
25. **Progressive disclosure** — start with today's quests, expand weekly/milestone/long-range context. *Status: applied.*
26. **Accessible contrast & type scaling** — >= 4.5:1 for normal text; accommodate larger fonts and screen readers. *Status: scalable type and larger touch controls implemented in v0.9.2; device contrast and TalkBack audit pending.*
27. **Reduced motion** — respect OS preference, no mandatory motion for success feedback. *Status: v0.9.2 level/rank feedback respects reduced-motion setting; full device audit pending.*
28. **Responsive layouts & safe areas** — work on small Android screens, tablets, gesture navigation and keyboards. *Status: additional small-control fixes in v0.9.2; both small/large device tests pending.*
29. **Clear information hierarchy & empty states** — primary action first, next-step guidance when empty. *Status: applied.*
30. **Performance, privacy and trust** — fast launch, no network dependency for daily use, private data not in public repo, no misleading “verified” XP. *Status: offline app, private import, reproducible npm lockfile and memoized planner calculations; backup and real-device performance testing pending.*

## Before release

- Test on a small Android phone and on a larger Samsung model, with 1× and increased font sizes.
- Import the full private plan: 30 goals, 180 quest/milestone entries. Verify no stalls, duplicate completions or duplicate import.
- Verify app launcher icon (round/adaptive/themed), launch splash and all five nav destinations.
- Check quest search, filter, pagination, goal search, milestone expansion, confirmation and backup/restore.
- Confirm original app ID, incremented versionCode, and same signing key for in-place updates.
- Never publish the user's private quest pack in the repository, app bundle, Vercel or CI artifact.
- Do not call an unchecked item completed based solely on TypeScript compilation.

## v0.9.2 stabilization evidence

- Source-level UX changes: accessible controls (48dp standard targets), explicit labels, scalable text, wrapped headers and no mandatory animation where reduced motion is enabled.
- Recent quest completions can be undone within ten minutes, with database transaction safeguards against invalidating dependent milestones.
- Rank/level feedback differs from ordinary rewards. Boss verification must still reflect measurable evidence.
- Planner calendar, recommendations and XP aggregation now use memoization to avoid recalculating large lists on unrelated state updates.

**Not signed off:** animation arc work, original 3D avatar scenes, every screen-reader reading order, contrast measurements, responsiveness on multiple physical devices and real notification timing. These cannot be marked complete based on TypeScript, emulator boot or marketing screenshots alone.
