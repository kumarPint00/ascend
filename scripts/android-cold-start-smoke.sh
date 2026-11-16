#!/usr/bin/env bash
set -euo pipefail
APK="${1:-apk/ascend-android.apk}"
APP="com.ascendrpg.personal"
test -s "$APK"
adb install -r "$APK"
for attempt in 1 2 3; do
  echo "Cold launch $attempt of 3"
  adb logcat -c || true
  adb shell am force-stop "$APP" || true
  adb shell am start -W -n "$APP/.MainActivity"
  sleep 10
  if ! adb shell pidof "$APP" >/dev/null; then
    echo 'FAIL: ASCEND process exited after cold start'
    adb logcat -d -b crash | tail -n 160 || true
    exit 1
  fi
  if adb logcat -d -b crash | grep -F "$APP"; then
    echo 'FAIL: Android crash buffer contains ASCEND'
    adb logcat -d -b crash | tail -n 160
    exit 1
  fi
done
echo 'PASS: ASCEND survived three Android emulator cold launches without a recorded crash'
