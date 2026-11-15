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

test('supports maximum 30 goals and 180 quests, rejecting excessive packs',()=>{
  const g=Array.from({length:30},(_,i)=>({key:'goal-'+i,title:'Goal '+i,attribute:'discipline',targetCount:10}));
  const q=Array.from({length:180},(_,i)=>({key:'quest-'+i,goalKey:'goal-'+(i%30),
    title:'Review '+i,description:'User-controlled task',attribute:'discipline',
    difficulty:'medium',repeatRule:'once',kind:i%2?'milestone':'quest'}));
  const p={format:'ascend-quest-pack',schemaVersion:1,packId:'large-pack',title:'Stress test',goals:g,quests:q};
  const parsed=parseQuestPack(JSON.stringify(p));
  assert.equal(parsed.goals.length,30);
  assert.equal(parsed.quests.length,180);
  p.quests.push({...q[0],key:'overflow'});
  assert.throws(()=>parseQuestPack(JSON.stringify(p)));
});
