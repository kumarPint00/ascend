const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const app=read('apps/mobile/src/App.tsx');
const planner=read('apps/mobile/src/phase2/Planner.tsx');
const oracle=read('apps/mobile/src/experience/NanoCoach.tsx');
const groq=read('apps/mobile/src/ai/groq.ts');
const connect=read('apps/mobile/src/connect/ConnectHub.tsx');
const widget=read('apps/mobile/src/widgets/snapshot.ts');
const engine=read('packages/game-engine/src/phase2.ts');
const config=JSON.parse(read('apps/mobile/app.json')).expo;

assert.equal(config.android.softwareKeyboardLayoutMode,'resize');
assert.ok(app.includes('dueMissionList(quests'));
assert.ok(app.includes("questFilter==='Daily'"));
assert.ok(app.includes("kind==='monthly'?'Monthly'"));
assert.ok(app.includes("matchesQuestCadence(q,questFilter)"));
assert.ok(app.includes("['Today','Daily','Weekly','Monthly'"));
assert.ok(oracle.includes("once/daily/weekly/monthly"));
assert.ok(oracle.includes("o.repeatRule==='monthly'?'monthly'"));
assert.ok(app.includes("setQuestFilter('All')")); // JSON and AI import
assert.ok(app.includes('Keyboard.addListener'));
assert.ok(app.includes('!keyboardVisible&&<View style={s.nav}'));
assert.ok(app.includes("behavior={Platform.OS==='ios'?'padding':undefined}")); // Android resize handles IME; no double shrink;
assert.ok(planner.includes("behavior={Platform.OS==='ios'?'padding':undefined}")); // Android resize avoids double-IME adjustments
assert.ok(oracle.includes("behavior={Platform.OS==='ios'?'padding':'height'}"));
assert.ok(connect.includes("behavior={Platform.OS==='ios'?'padding':'height'}"));
assert.ok(connect.includes('keyboardShouldPersistTaps="handled"'));
// User-visible Hunter animation must come from original generated raster artwork,
 // never from procedural GL geometry or a network image.
const hunter=read('apps/mobile/src/experience/HunterWorld.tsx');
const illustrated=read('apps/mobile/src/experience/hunter-illustrated-frames.ts');
assert.ok(hunter.includes('HUNTER_ILLUSTRATED_FRAMES'));
assert.ok(hunter.includes("Image source={imageSource}"));
assert.ok(hunter.includes("quality!=='battery'"));
assert.ok(hunter.includes("!reduceMotion"));
assert.ok(!hunter.includes('GLView'));
assert.equal((illustrated.match(/data:image\/jpeg;base64,/g)||[]).length,4);
assert.ok(app.includes("width:'100%',alignSelf:'stretch'"));
assert.ok(planner.includes("width:'100%',alignSelf:'stretch'"));
assert.ok(oracle.includes("width:'100%',alignSelf:'stretch'"));
assert.ok(connect.includes("width:'100%',alignSelf:'stretch'"));
assert.ok(engine.includes('export function dueMissionList('));
assert.ok(widget.includes('dueMissionList('));
// No hardcoded secrets, and no silent cloud inference or automatic quest approval.
assert.match(groq,/SecureStore\.getItemAsync\(API_KEY_NAME\)/);
assert.match(groq,/SecureStore\.setItemAsync\(API_KEY_NAME/);
assert.ok(groq.includes("https://api.groq.com/openai/v1/chat/completions"));
assert.ok(groq.includes("openai/gpt-oss-20b"));
assert.ok(groq.includes("Authorization':'Bearer '+key"));
assert.ok(groq.includes("signal?.addEventListener('abort',cancel)"));
assert.ok(oracle.includes('cloudConsent'));
assert.ok(oracle.includes("setCloudConsent(false)"));
assert.ok(oracle.includes("generateWithProviders(prompt,'quest'"));
assert.ok(oracle.includes("'groq-cloud'|'gemini-cloud'|'openrouter-cloud'"));
assert.ok(oracle.includes("cloudConsent"));
assert.ok(oracle.includes('await onAccept(draft)'));
assert.ok(!/\bgsk_[A-Za-z0-9_-]{25,}\b/.test(groq+oracle));
console.log('PASS: exact recurrence filters, monthly AI drafts, keyboard form layouts and consented hybrid cloud review');
