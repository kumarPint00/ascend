# ASCEND v0.9.0 startup crash — v0.9.1 recovery

## Symptom

On Android, ASCEND v0.9.0 may immediately close or never render the first screen after installing the signed release APK.

## Identified high-confidence cause

Expo SDK 58 enabled R8 code shrink/minification by default in release builds. The v0.9.0 APK included `expo-background-task`, which initializes Android WorkManager/Room at native startup. A confirmed upstream SDK 58 bug reports that R8 can remove constructors WorkManager loads reflectively, causing a **native process crash before JavaScript or React mounts**.

- Upstream issue: https://github.com/expo/expo/issues/52173
- Expo SDK 58 R8 default: https://expo.dev/changelog/sdk-58
- v0.9.0 build log included `Task :app:minifyReleaseWithR8`.

This is a likely diagnosis, not a substitute for device `adb logcat`.

## Hotfix v0.9.1 (Android versionCode 11)

- Use `expo-build-properties` with `android.enableMinifyInReleaseBuilds=false` in `apps/mobile/app.json`.
- Both signed and unsigned APK workflows explicitly compile with `-Pandroid.enableMinifyInReleaseBuilds=false`.
- Regression guard `npm run test:android-startup` prevents accidental R8 reintroduction while background-task is installed.
- Preserve the original Android package `com.ascendrpg.personal` and original permanent signing key, allowing an in-place upgrade without wiping SQLite data.
- Do not publish the crash-prone v0.9.0 APK to GitHub Releases.

## User recovery (preserve local data)

1. **Do not uninstall ASCEND or clear its app storage.**
2. Download the v0.9.1 permanently signed APK from the passing GitHub Action artifact.
3. Open the APK on Android and select **Update** when asked.
4. Open ASCEND, verify your quests, XP and Planner are present.
5. Create a verified external backup in Planner → Settings before changing anything else.

If Android says **App not installed** or **Conflicting package**, do not uninstall. Check the signing certificate and installed version first.

## If it still crashes

From a connected Mac with Android platform-tools and USB debugging enabled:

```sh
adb devices
adb logcat -c
adb shell am force-stop com.ascendrpg.personal
adb shell monkey -p com.ascendrpg.personal 1
sleep 4
adb logcat -d -b crash > ascend-android-crash.txt
```

Share only the Java/Kotlin exception, stack trace and relevant `FATAL EXCEPTION` lines, **never secrets or private quest data**. Native crash logs help distinguish R8/WorkManager from database or other runtime errors.

The real-phone fix remains unverified until cold-launch and upgrade tests succeed.


## Verification completed for signed v0.9.1 / Android build 11

- Build: https://github.com/kumarPint00/ascend/actions/runs/43780164463 — `success`
- Signed APK V2 certificate SHA-256: `60b4aef9ee10d6f696063ddd45601216e277be0771fe967db156ad6dd6ec5521` (matches v0.9.0's permanent signing certificate).
- Generated native `android/gradle.properties` explicitly includes `android.enableMinifyInReleaseBuilds=false`; APK assembly and signature verification passed.
- Android 15 (API 35) x86_64 emulator test: https://github.com/kumarPint00/ascend/actions/runs/43781182287 — `success`. Fresh install and **three separate cold launches** each kept the app process alive without a crash-buffer entry.
- Physical-device cold start and on-device SQLite preservation still need to be checked. Do not claim this emulator run proves Samsung-specific behavior.

**Do not delete the original application data to install the hotfix.** An in-place install is required to preserve existing SQLite records.
