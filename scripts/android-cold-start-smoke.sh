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
    # Capture the illustrated Hunter as well as Home to catch art framing
    # regressions. Pixel 6 emulator bottom tabs: Hunter is tab 4 of 5.
    dimensions="$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1)"
    screen_width="${dimensions%x*}"
    screen_height="${dimensions#*x}"
    if [[ "$screen_width" =~ ^[0-9]+$ && "$screen_height" =~ ^[0-9]+$ ]]; then
      adb shell input tap "$((screen_width*75/100))" "$((screen_height*95/100))"
      sleep 3
      adb exec-out screencap -p > test-output/ascend-hunter-portrait.png
      test -s test-output/ascend-hunter-portrait.png
      adb shell input tap "$((screen_width*10/100))" "$((screen_height*95/100))"
    fi
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
# Ensure all four native receivers merged into the signed Android APK.
PACKAGE_DUMP="$(adb shell dumpsys package "$APP")"
for widget in DailyQuestWidget HunterStatusWidget FocusPlannerWidget ProgressWidget; do
  if ! printf '%s\n' "$PACKAGE_DUMP" | grep -Fq "$widget"; then
    echo "FAIL: widget receiver $widget missing from installed APK"
    exit 1
  fi
done
# Exercise the same URI that widget PendingIntents launch. No XP writes here.
adb shell am start -W -a android.intent.action.VIEW \
  -d 'ascendrpg://widget/quests' -n "$APP/.MainActivity"
sleep 6
if ! adb shell pidof "$APP" >/dev/null; then
  echo 'FAIL: widget deep link terminated ASCEND'
  exit 1
fi
adb exec-out screencap -p > test-output/ascend-widget-deep-link.png
test -s test-output/ascend-widget-deep-link.png
echo 'PASS: 3 emulator launches, large font, share route, four widget receivers and widget deep link'
