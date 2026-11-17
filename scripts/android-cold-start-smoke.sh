#!/usr/bin/env bash
set -euo pipefail
APK="${1:-apk/ascend-android.apk}"
APP="com.ascendrpg.personal"
test -s "$APK"
mkdir -p test-output
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
  if [ "$attempt" -eq 3 ]; then
    adb exec-out screencap -p > test-output/ascend-default-font.png
    test -s test-output/ascend-default-font.png
  fi
done
# Exercise a non-default font scale to catch immediate native/JS startup
# regressions. This is a smoke test, not a visual or TalkBack sign-off.
adb shell settings put system font_scale 1.4
adb logcat -c || true
adb shell am force-stop "$APP" || true
adb shell am start -W -n "$APP/.MainActivity"
sleep 10
if ! adb shell pidof "$APP" >/dev/null; then
  echo 'FAIL: ASCEND process exited under enlarged Android font scale'
  adb logcat -d -b crash | tail -n 160 || true
  exit 1
fi
adb exec-out screencap -p > test-output/ascend-large-font.png
test -s test-output/ascend-large-font.png
# Exercise the Android Share Sheet entry point (selected text, never private chats).
# This verifies that the exported intent route does not crash Android startup.
adb logcat -c || true
adb shell am force-stop "$APP" || true
adb shell "am start -W -n $APP/.MainActivity -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT 'ASCEND QA: please review a sample task'"
sleep 9
if ! adb shell pidof "$APP" >/dev/null; then
  echo 'FAIL: app stopped when receiving a selected text share'
  adb logcat -d -b crash | tail -n 150 || true
  exit 1
fi
if adb logcat -d -b crash | grep -F "$APP"; then
  echo 'FAIL: Android crashed during shared text intake'
  adb logcat -d -b crash | tail -n 150
  exit 1
fi
adb exec-out screencap -p > test-output/ascend-share-review.png
test -s test-output/ascend-share-review.png
echo 'PASS: 3 emulator cold launches, large font, and Android text share route without recorded crash'
