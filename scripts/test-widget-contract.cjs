const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const base='apps/mobile/modules/ascend-context/android/src/main/';
const manifest=read(base+'AndroidManifest.xml');
const provider=read(base+'java/expo/modules/ascendcontext/AscendWidgetProvider.kt');
const bridge=read(base+'java/expo/modules/ascendcontext/AscendContextModule.kt');
const js=read('apps/mobile/src/widgets/snapshot.ts');
const app=read('apps/mobile/src/App.tsx');
const ids=['daily','hunter','planner','progress'];
const classes=['DailyQuestWidget','HunterStatusWidget','FocusPlannerWidget','ProgressWidget'];
for(let i=0;i<ids.length;i++){
  assert.match(manifest,new RegExp('expo.modules.ascendcontext.'+classes[i]));
  assert.match(manifest,new RegExp('@xml/ascend_widget_'+ids[i]));
  assert.match(provider,new RegExp('class '+classes[i]+':AscendWidgetProvider'));
  const meta=read(base+'res/xml/ascend_widget_'+ids[i]+'.xml');
  assert.match(meta,/android:resizeMode="horizontal\|vertical"/);
  assert.match(meta,/android:widgetCategory="home_screen"/);
  assert.match(meta,/android:updatePeriodMillis="1800000"/);
}
for(const layout of ['compact','wide']){
  const xml=read(base+'res/layout/ascend_widget_'+layout+'.xml');
  for(const id of ['root','title','primary','secondary','tertiary','progress'])
    assert.ok(xml.includes('ascend_widget_'+id));
}
assert.ok(bridge.includes('AsyncFunction("publishWidgets")'));
assert.ok(provider.includes('PendingIntent.FLAG_IMMUTABLE'));
assert.ok(provider.includes('ascendrpg://widget/'));
assert.ok(provider.includes('LocalDate.now()'));
assert.ok(provider.includes('!fresh'));
assert.ok(js.includes('activeMissionList('));
assert.ok(js.includes('derivePlayer('));
assert.ok(js.includes('if(!enabled)'));
assert.ok(js.includes('showTitles&&next'));
assert.ok(!js.includes('HealthSummary'));
assert.ok(app.includes('Linking.getInitialURL()'));
assert.ok(app.includes('publishHomeWidgets(JSON.stringify(projection))'));
assert.ok(app.includes('HIDE QUEST TITLES'));
assert.ok(app.includes('PAUSE WIDGETS'));
console.log('PASS: four registered widgets, privacy/redaction, lifecycle, routing and JS bridge contracts');
