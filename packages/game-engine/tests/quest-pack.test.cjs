const test = require('node:test');
const assert = require('node:assert/strict');
const {parseQuestPack,isMilestoneQuest,importedQuestTitle,importedQuestDescription,importGoalId,importQuestId} = require('../dist/index.js');
const fixture=()=>({
  format:'ascend-quest-pack',schemaVersion:1,packId:'demo-pack',title:'Safe demo pack',
  goals:[{key:'career',title:'Architecture practice',attribute:'intelligence',targetCount:12}],
  quests:[
    {key:'weekly',goalKey:'career',title:'Review design',description:'Document decisions',attribute:'intelligence',difficulty:'medium',repeatRule:'weekly',kind:'quest'},
    {key:'launch',goalKey:'career',title:'Deliver milestone',description:'Verify with evidence',attribute:'discipline',difficulty:'hard',repeatRule:'once',kind:'milestone',dueOn:'2026-12-05'},
  ],
});
test('valid pack provides unique IDs and milestone labels',()=>{
  const p=parseQuestPack(JSON.stringify(fixture()));
  assert.equal(p.goals.length,1);
  assert.equal(p.quests.length,2);
  assert.equal(importGoalId(p.packId,'career'),'pack:demo-pack:g:career');
  assert.equal(importQuestId(p.packId,'launch'),'pack:demo-pack:q:launch');
  assert.equal(importedQuestTitle(p.quests[1]),'◆ Deliver milestone');
  assert.equal(isMilestoneQuest({title:importedQuestTitle(p.quests[1]),repeatRule:'once'}),true);
  assert.match(importedQuestDescription(p.quests[1]),/Target date: 2026-12-05/);
});
test('rejects invalid references, duplicates, dates and descriptions',()=>{
  const p=fixture();p.quests[0].goalKey='missing';assert.throws(()=>parseQuestPack(JSON.stringify(p)));
  const d=fixture();d.quests[1].key='weekly';assert.throws(()=>parseQuestPack(JSON.stringify(d)));
  const bad=fixture();bad.quests[1].dueOn='2026-02-30';assert.throws(()=>parseQuestPack(JSON.stringify(bad)));
  const long=fixture();long.quests[0].description='x'.repeat(1000);assert.throws(()=>parseQuestPack(JSON.stringify(long)));
});
test('rejects recurring milestones and oversized data',()=>{
  const r=fixture();r.quests[1].repeatRule='daily';assert.throws(()=>parseQuestPack(JSON.stringify(r)));
  assert.throws(()=>parseQuestPack('x'.repeat(100001)));
});
