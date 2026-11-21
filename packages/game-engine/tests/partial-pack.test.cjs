const test=require('node:test');
const assert=require('node:assert/strict');
const {parseImportableQuestPack,parsePartialQuestPack,filterImportItems,importGoalId,importQuestId}=require('../dist/index.js');

test('partial goals only with optional fields and stable generated keys',()=>{
  const source=JSON.stringify({goals:[{title:'Learn TypeScript'}]});
  const a=parseImportableQuestPack(source),b=parsePartialQuestPack(source);
  assert.equal(a.packId,'personal');
  assert.equal(a.goals.length,1);assert.equal(a.quests.length,0);
  assert.equal(a.goals[0].attribute,'discipline');
  assert.equal(a.goals[0].targetCount,10);
  assert.equal(a.goals[0].key,b.goals[0].key);
  assert.equal(importGoalId(a.packId,a.goals[0].key),importGoalId(b.packId,b.goals[0].key));
});
test('partial quests only supports unlinked standalone items and safe backlog defaults',()=>{
  const a=parsePartialQuestPack(JSON.stringify({packId:'custom',quests:[{title:'Write a technical note'}]}));
  assert.equal(a.quests[0].goalKey,null);
  assert.equal(a.quests[0].repeatRule,'once');
  assert.equal(a.quests[0].difficulty,'medium');
  assert.equal(a.quests[0].description,'');
  assert.equal(importQuestId(a.packId,a.quests[0].key),importQuestId(a.packId,a.quests[0].key));
});
test('milestones-only link to a previously imported goalKey',()=>{
  const a=parsePartialQuestPack(JSON.stringify({packId:'winter',milestones:[{
    key:'first-checkpoint',goalKey:'career',title:'Finish foundation',
    dueOn:'2026-12-25'
  }]}));
  assert.equal(a.goals.length,0);assert.equal(a.quests.length,1);
  assert.equal(a.quests[0].kind,'milestone');
  assert.equal(a.quests[0].goalKey,'career');
  assert.equal(a.quests[0].repeatRule,'once');
});
test('supports manual goal title links, defaults from selected goals and section filters',()=>{
  const data={packId:'project',goals:[{key:'research',title:'Research',attribute:'intelligence'}],
    quests:[{key:'read',title:'Read paper',goalKey:'research',repeatRule:'daily'},
      {key:'personal',title:'Review existing goal',goalTitle:'Fitness Journey'}],
    milestones:[{key:'finish',title:'Publish report',goalKey:'research'}]};
  const a=parsePartialQuestPack(JSON.stringify(data));
  assert.equal(a.quests[0].attribute,'intelligence');
  assert.equal(a.quests[1].goalTitle,'Fitness Journey');
  const only=filterImportItems(a,{goals:false,quests:true,milestones:false});
  assert.equal(only.goals.length,0);assert.equal(only.quests.length,2);
  assert.equal(a.quests.length,3);
});
test('repeated batches can share packId and IDs',()=>{
  const g=parsePartialQuestPack(JSON.stringify({packId:'journey',goals:[{key:'skill',title:'Skill'}]}));
  const q=parsePartialQuestPack(JSON.stringify({packId:'journey',quests:[
    {key:'day-one',title:'Start learning',goalKey:'skill'}]}));
  assert.equal(importGoalId(g.packId,g.goals[0].key),'pack:journey:g:skill');
  assert.equal(importQuestId(q.packId,q.quests[0].key),'pack:journey:q:day-one');
});
test('legacy strict pack continues working',()=>{
  const fixture={format:'ascend-quest-pack',schemaVersion:1,packId:'legacy',title:'Legacy',
    goals:[{key:'career',title:'Career',attribute:'intelligence',targetCount:10}],
    quests:[{key:'daily',goalKey:'career',title:'Practice',description:'',
      attribute:'intelligence',difficulty:'easy',repeatRule:'daily',kind:'quest'}]};
  const a=parseImportableQuestPack(JSON.stringify(fixture));
  assert.equal(a.format,'ascend-quest-pack');assert.equal(a.quests.length,1);
  assert.throws(()=>parseImportableQuestPack(JSON.stringify({...fixture,goals:[]})));
});
test('invalid references, bad dates, duplicate identifiers and overlarge batches reject',()=>{
  const base={goals:[{key:'g',title:'G'}],quests:[{key:'q',title:'Q'}],
    milestones:[{key:'m',title:'M'}]};
  assert.throws(()=>parsePartialQuestPack(JSON.stringify({...base,quests:[
    {key:'m',title:'Collision'}]})),/Duplicate/);
  assert.throws(()=>parsePartialQuestPack(JSON.stringify({milestones:[{
    title:'Bad date',dueOn:'2026-02-30'}]})),/dueOn/);
  assert.throws(()=>parsePartialQuestPack(JSON.stringify({milestones:[{
    title:'Recurring',repeatRule:'daily'}]})),/Milestones/);
  assert.throws(()=>parsePartialQuestPack(JSON.stringify({quests:[{
    title:'Ambiguous',goalKey:'g',goalTitle:'Existing'}]})),/either/);
  assert.throws(()=>parsePartialQuestPack(JSON.stringify({goals:[],quests:[],milestones:[]})),/at least one/);
  assert.throws(()=>parsePartialQuestPack('x'.repeat(100001)),/100 KB/);
  assert.throws(()=>parsePartialQuestPack(JSON.stringify({goals:Array.from({length:31},(_,i)=>({title:'Goal '+i}))})),/Maximum/);
});
test('nonlatin names receive stable and valid generated IDs',()=>{
  const a=parsePartialQuestPack(JSON.stringify({goals:[{title:'स्वास्थ्य सुधार'}]}));
  assert.match(a.goals[0].key,/^[a-z0-9-]+$/);
  assert.equal(a.goals[0].key,parsePartialQuestPack(JSON.stringify({goals:[{title:'स्वास्थ्य सुधार'}]})).goals[0].key);
});

test('monthly partial quest pack keeps monthly recurrence without coercion',()=>{
  const pack=parseImportableQuestPack(JSON.stringify({
    quests:[{title:'Monthly financial summary',repeatRule:'monthly'}]
  }));
  assert.equal(pack.quests[0].repeatRule,'monthly');
  assert.throws(()=>parseImportableQuestPack(JSON.stringify({
    quests:[{title:'Unknown frequency',repeatRule:'quarterly'}]
  })),/repeatRule/);
});
