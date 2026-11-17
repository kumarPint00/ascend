# ASCEND Connect · Personal Context Hub (v0.12.0 candidate)

## Scope and status

ASCEND Connect is a personal-use, offline-first context intake feature, not a
general surveillance agent. No external services are connected automatically.
The implementation includes:

| Source | Actual implemented path | Extra configuration needed |
|---|---|---|
| Android Share Sheet / WhatsApp | `ACTION_SEND` / `ACTION_SEND_MULTIPLE` selected text preview, encrypted storage | Turn on Share to ASCEND; share explicitly |
| ChatGPT | `conversations.json` selected conversation import, recent user-authored text only, source previews | Export from ChatGPT, unzip, choose file |
| Samsung Health / Health Connect | Native Android Health Connect permission request, read-only 1–30-day steps, sleep, exercise and heart-rate summaries | Install/configure Health Connect, sync watch through Samsung Health, grant permissions |
| Google Calendar | OAuth PKCE read-only primary calendar events in recent/upcoming window | Google Cloud OAuth Android client ID and user consent |
| Gmail | OAuth PKCE read-only recent email subject/snippet metadata | Gmail restricted OAuth scope approval/verification may apply |
| Google Drive | OAuth PKCE read-only file metadata | Google Cloud OAuth client and user consent |
| GitHub | Fine-grained read-only token, assigned open issues | User-created limited-scope token |
| Device Files | Android file picker, local text snippets or PDF/image filenames (no automatic OCR) | User chooses files |

**Known restrictions:** This does not bypass WhatsApp's consumer chat privacy
model, access all ChatGPT conversations live, read unsupported watch sensor
streams, extract text from scanned PDFs/images or auto-grant Google API access.
Files are imported by user selection. Provider tokens never enter the public
GitHub repository. No source content is transmitted to hosted AI by ASCEND.

## Security architecture

- SQLite schema v6 is additive to v5, leaving quests, XP and achievements alone.
- `connected_sources` tracks consent and retention (7, 14, 30, 90, 180 days).
- `context_items` stores original IDs and metadata with title, excerpt and
  origin URL encrypted by AES-256-GCM keys generated in Android Keystore.
- `context_decisions` tracks user-approved/dismissed quest suggestions; a
  deterministic recommendation cannot auto-create XP or active quests.
- OAuth access/refresh tokens and GitHub PATs reside inside encrypted source
  configuration; not in JS logs or plaintext SQLite.
- Source disconnect deletes cached context, settings and local token material.
  Remote token revocation for Google is best-effort if online.
- Ordinary plaintext ASCEND v4 progress backup intentionally **excludes
  sensitive context**. Context exports are a separate password-encrypted file,
  protected using PBKDF2-HMAC-SHA256 + AES-256-GCM.
- Restoring context on a new Android device requires the user's export
  passphrase; permissions stay disabled and must be regranted.
- Automatic import is off for every source until enabled; sync is user-invoked.
- The Context Hub purges expired records on opening and on user request.
- Health summary is for information only; no automatic medical advice,
  diagnosis, new fitness targets or XP.
- Source text is untrusted. External requests or prompt-injection-like content
  are data, not instructions. Model handoff requires an explicit tap and
  Gemini Nano consent. Health records cannot be handed to AI from this UI.

## Setup on Android

1. Install the signed APK over the existing app. **Do not uninstall**; make a
   regular progress backup before migration.
2. Open **More → ASCEND Connect → OPEN MY CONNECTIONS**.
3. Enable a source; choose the retention period. Disabled sources do not sync.
4. For ChatGPT: Settings → Data Controls → Export Data, unzip the archive and
   select `conversations.json` (max 25 MB for now). Review and select up to
   100 conversations per batch. Larger archives should be split first.
5. For WhatsApp: select a message in WhatsApp and use Android's share menu to
   send text to ASCEND, then review and save the encrypted copy. This is not
   24/7 monitoring.
6. For Health Connect: ensure Samsung Health is sharing the permitted data
   types to Android Health Connect, grant ASCEND read-only permissions in its
   permission dialog, and then run **SYNC READ-ONLY**. Some device sensors or
   watch data types may not be synchronized.
7. For Google: create/configure a Google OAuth installed-app client ID for
   Android package `com.ascendrpg.personal` with the official signing
   certificate and configure the OAuth consent screen in Google Cloud.
   Enter the public client ID under the relevant source. Never put a client
   secret into ASCEND. Android redirect scheme is `ascendrpg://oauth`;
   check current Google redirect requirements and device compatibility.
   Google OAuth/provider approval is a **device acceptance gate** until tested.
8. For GitHub: create a minimal-scope fine-grained token with only necessary
   issue read permissions. Enter it inside the encrypted connector dialog.
9. Open the inbox to review items and possible commitments. Accepting a
   proposal creates a **Backlog** quest only through the existing guarded
   adaptive approval transaction.

## Important fallback behavior

- All imported items preserve source, original identifier, timestamp and
  source type. Syncing the same item again is a no-op.
- Gmail retrieval is restricted to a small recent batch. An API error or
  revoked scope causes a visible failure, not silent success.
- Google Drive currently imports **metadata only**; it does not silently
  download files.
- A PDF or image imported through the file picker currently stores a
  source reference and filename, not extracted text. Text and JSON files
  under 15KB can capture a preview.
- ChatGPT snapshots contain only selected conversation titles and recent
  *user-authored* text; assistant replies aren't promoted to facts.
- No background email/health/WhatsApp surveillance or unlimited ingestion.
- The Google OAuth flow requires the developer-provided OAuth client and
  production device testing; the app does not provide an embedded Google
  client ID or bypass the provider's scope verification.
- Encryption key loss makes local cached ciphertext unrecoverable. Create
  a passphrase-protected external context export before changing devices.

## Verification

Automated:
- deterministic ChatGPT parsing, selection, dedupe and conservative
  recommendation unit tests;
- SQLite v1→v6 upgrade, foreign keys and source uniqueness tests;
- mobile strict TypeScript; signed APK construction and signature verification;
- Android emulator cold launch 3× if a signed artifact is produced.

Physical Samsung S25 Ultra acceptance required:
- in-place upgrade with existing XP/quests and exported backup verified;
- actual Health Connect grant/read and Samsung Health data sync;
- actual Google OAuth redirect, consent, token refresh and scoped fetch;
- share intent while the app is closed and while it's open;
- encryption export/import with wrong-passphrase handling;
- no native crash, memory leak, 3D rendering regression or major battery drain;
- Galaxy Watch sync lag and background restrictions accurately reflected.

See `docs/DEVICE_ACCEPTANCE_PHASE3.md` for earlier Phase 3 criteria. The
GitHub Actions signed APK is a candidate until physical acceptance. Never
publish it into the automatic update feed without that acceptance.
