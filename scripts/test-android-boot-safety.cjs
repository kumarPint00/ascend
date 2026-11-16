// Regression guard: Expo SDK 58 + expo-background-task crashes when R8 strips
// androidx.work / androidx.room reflective constructors in Android releases.
// https://github.com/expo/expo/issues/52173 (open as of 2026-11-16)
const fs=require('node:fs');
const assert=require('node:assert/strict');
const pkg=require('../apps/mobile/package.json');
assert.ok(pkg.dependencies['expo-background-task'],'Guard must be reevaluated if background tasks are removed');
for(const flow of ['android-apk.yml','android-test-apk.yml']){
  const s=fs.readFileSync('.github/workflows/'+flow,'utf8');
  assert.match(s,/\.\/gradlew :app:assembleRelease --no-daemon -Pandroid\.enableMinifyInReleaseBuilds=false/,
    flow+' must disable R8 for Expo background-task release builds');
  assert.doesNotMatch(s,/-Pandroid\.enableMinifyInReleaseBuilds=true/,
    flow+' must not enable the affected optimization');
}
const app=require('../apps/mobile/app.json').expo;
const minifyPlugin=app.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-build-properties');
assert.ok(minifyPlugin,'App should disable native R8 for non-CI builds too');
assert.equal(minifyPlugin[1]?.android?.enableMinifyInReleaseBuilds,false,
  'Android local builds must not re-enable startup-breaking R8');
console.log('Android startup guard PASS: both CI builds and local Expo prebuild disable affected R8 optimization');
