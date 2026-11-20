#!/usr/bin/env bash
set -euo pipefail
APP="com.ascendrpg.personal"
APK="apk/ascend-android.apk"
test -s "$APK"
mkdir -p test-output
adb install -r "$APK"
adb logcat -c
adb shell am force-stop "$APP" || true
adb shell am start -W -n "$APP/.MainActivity"
sleep 7
shot() {
  local name="$1"
  test -n "$(adb shell pidof "$APP" | tr -d '\r')"
  adb exec-out screencap -p > "test-output/$name.png"
  test -s "test-output/$name.png"
  echo "Captured $name"
}
go_tab() {
  local name="$1" x="$2"
  adb shell input tap "$x" 2260
  sleep 3
  shot "$name"
}
shot realm
go_tab missions 310
# Capture a real keyboard-open screen for layout inspection, without requiring
# device-specific pixel coordinates or private account data.
adb shell uiautomator dump /sdcard/ascend_ui.xml >/dev/null 2>&1 || true
adb exec-out cat /sdcard/ascend_ui.xml > test-output/ascend-ui-before-keyboard.xml 2>/dev/null || true
SEARCH_BOUNDS="$(python3 - <<'PY'
import re,xml.etree.ElementTree as ET
try:
    root=ET.parse('test-output/ascend-ui-before-keyboard.xml').getroot()
    for element in root.iter('node'):
        if 'Search quests' in element.attrib.get('content-desc',''):
            box=element.attrib.get('bounds','')
            numbers=[int(v) for v in re.findall(r'\d+',box)]
            if len(numbers)==4:
                print((numbers[0]+numbers[2])//2,(numbers[1]+numbers[3])//2)
                break
except Exception:
    pass
PY
)"
if [[ -n "$SEARCH_BOUNDS" ]]; then
  read -r SEARCH_X SEARCH_Y <<< "$SEARCH_BOUNDS"
  adb shell input tap "$SEARCH_X" "$SEARCH_Y"
  sleep 2
  shot missions-keyboard-open
  adb shell input keyevent KEYCODE_BACK
  sleep 1
else
  echo 'WARN: Quest search field not found in Android UI hierarchy; keyboard screenshot skipped'
fi
go_tab journey 525
go_tab hunter 755
go_tab hub 971
go_tab realm-return 110
# Sanctuary button is below the quick action bar on 1080x2400 Pixel_6.
adb shell input tap 520 1524
sleep 3
shot sanctuary-gates
adb logcat -d -v time > test-output/device-logcat-full.tmp
grep -Ei 'ASCEND/Hunter|ReactNativeJS|AndroidRuntime|ANR in |expo-gl|GLView' \
  test-output/device-logcat-full.tmp > test-output/gpu-and-runtime.log || true
rm test-output/device-logcat-full.tmp
if grep -q '\[ASCEND/Hunter\] GPU scene unavailable' test-output/gpu-and-runtime.log; then
  echo 'FAIL: Hunter WebGL fell back during real UI tour'
  cat test-output/gpu-and-runtime.log
  exit 1
fi
if grep -E 'FATAL EXCEPTION|E/ReactNativeJS' test-output/gpu-and-runtime.log; then
  echo 'FAIL: fatal JS/native exception during screen tour'
  exit 1
fi
if grep -qi 'ANR in com.google.android.apps.nexuslauncher' test-output/gpu-and-runtime.log; then
  echo 'WARN: Android emulator Pixel Launcher ANR was observed. Inspect screenshots.'
fi
echo 'PASS: navigated Realm, Missions, Journey, Hunter, Hub, Sanctuary with no Hunter GPU fallback'
