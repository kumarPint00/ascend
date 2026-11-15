# Zero-spend operating policy

## Rules
1. Personal V0.1 requires no cloud and no payment card.
2. Never activate pay-as-you-go tiers, billing upgrades, or paid AI endpoints without explicit approval and a demonstrated use case.
3. No auto-upgrading services. If a free quota is exceeded, features must degrade gracefully instead of making charges.
4. Avoid platform lock-in: local SQLite is the source of truth and complete data must be exportable.
5. Reassess pricing, commercial-use restrictions and app-store fees BEFORE public launch, regardless of whether revenue exists.

## Service decision table
| Provider | V0.1 status | Future use | Caution |
|---|---|---|---|
| On-device SQLite | ACTIVE | Primary offline store | Device loss without a backup means data loss. |
| GitHub | Repository required for CI | Source and automated APK | Public standard runners have free compute. Private repos have quota limits; review billing controls. |
| Supabase | NOT provisioned | Authentication, sync and PostgreSQL | Free quotas and inactivity pausing; do not enable Pro without approval. |
| Firebase | NOT provisioned | Optional notifications/crash reporting | Use Spark only; never enable pay-as-you-go Blaze without approval. |
| Vercel | NOT provisioned | Optional personal web demo | Hobby is for personal/non-commercial use; commercial products require an eligible plan. |
| AI provider | NONE | Opt-in quest planner | Use local rules first, budget separately if needed. |
| Google Play | NOT published | Future public store | Developer registration is generally a one-time US$25 fee; sideload test APKs for free instead. |

Official pricing references (verified November 2026):
- GitHub Actions: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Vercel pricing and Hobby use: https://vercel.com/pricing
- Supabase: https://supabase.com/pricing
- Firebase Spark: https://firebase.google.com/pricing
- Play developer registration: https://support.google.com/googleplay/android-developer/answer/6112435

## Status of this delivery
The project contains a source-code implementation, an offline browser demo, unit tests for the game engine, a SQLite migration and GitHub Actions definitions. It does **not** include an APK or a deployed backend. Network restrictions prevented installation of Expo dependencies and a native Android build in the preparation environment.
