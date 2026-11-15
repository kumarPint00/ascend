# ASCEND Android in-app updates

The Android app checks the public [ASCEND GitHub Releases](https://github.com/kumarPint00/ascend/releases) feed at startup and via **More → Check for updates**. A supported update downloads to the app cache and launches Android's package installer. The user must confirm installation and may need to enable **Allow from this source** once. The user must NOT uninstall the app for normal updates.

## Nonnegotiable compatibility rules
- Preserve Android application ID `com.ascendrpg.personal` across all releases.
- Sign all upgrades using the **same long-lived private signing key**. Never store it in the public repository, chat, logs, or build artifacts.
- Increase both `expo.version` and `android.versionCode` before publishing a newer build.
- Do not bypass the Android installation confirmation. Android enforces package signatures and controls the final installation.
- Publish a GitHub Release with asset `ascend-android.apk`. The GitHub Actions workflow generates the signed artifact and update metadata.

## One-time GitHub Actions signing setup
Generate a private signing keystore **on a trusted machine**, store an encrypted offline backup, and keep the passwords private. For example:

```bash
keytool -genkeypair -v -keystore ascend-release.jks -storetype PKCS12 -alias ascend -keyalg RSA -keysize 3072 -validity 10000
```

On GitHub → **Repository Settings → Secrets and variables → Actions**, add four repository secrets:

1. `ASCEND_ANDROID_KEYSTORE_BASE64` containing base64 of the binary keystore (Linux: `base64 -w0 ascend-release.jks`).
2. `ASCEND_ANDROID_KEYSTORE_PASSWORD` with the keystore password.
3. `ASCEND_ANDROID_KEY_ALIAS` with the alias, usually `ascend`.
4. `ASCEND_ANDROID_KEY_PASSWORD` with the key password.

The build intentionally fails if signing credentials are missing. This prevents another APK using an ephemeral debug certificate from being distributed as an upgrade.

## Publishing
1. Increase `expo.version` and `android.versionCode` in `apps/mobile/app.json`.
2. Push the reviewed, tested version to `main`.
3. GitHub → **Actions → Build signed updatable Android APK → Run workflow**, enable `publish_release`.
4. Confirm the signed artifact and new Release exist at https://github.com/kumarPint00/ascend/releases.
5. On Android, use **More → Check for updates → Download & update** and confirm the installer. Existing SQLite data should survive a compatible in-place installation.

No Vercel, Supabase, Firebase, EAS Update or paid update server is needed for this APK-based update path.

## First migration from V0.1
The first V0.1 test builds used ephemeral debug signing keys. Unless the original signing key was preserved (it wasn't in the workflow), the new securely signed APK cannot upgrade the V0.1 install directly. **Do not uninstall an app holding important data before saving its backup.** Use **More → View Backup JSON**, copy it off-device, and confirm it is intact. Version 0.2 introduces a manual **Restore Saved JSON** feature after a one-time reinstall if certificate mismatch occurs. From the first securely signed version onward, future APKs should upgrade in place using the same signing key.

## Security and future Play Store
The client only accepts a published GitHub Release from the official repository, exact `ascend-android.apk` asset and package identity, and a newer build code. It compares downloaded size and delegates certificate verification to Android. Future hardening should verify SHA-256 in-app as well. Updates cannot be silently installed without consent.

The sideload build requests `REQUEST_INSTALL_PACKAGES`. Before publishing on Google Play, replace the sideload installer with Play In-App Updates and remove or justify that permission in accordance with Play policy. Device testing is still required.
