const test=require('node:test'),assert=require('node:assert/strict');
const {
  DEFAULT_ADAPTIVE_SETTINGS,buildAdaptiveProposals,defaultQuestControl,
  liteMinutes,liteQuestIsAllowed,liteCompletionDifficulty,
  countScheduledOpportunities,validateAdaptiveSettings,periodKey
}=require('../dist/index.js');
const now=new Date(2026,10,16,12);
const quest=(id='q',extra={})=>({
  id,title:'Practice focus',description:'',attribute:'intelligence',
  difficulty:'hard',repeatRule:'daily',goalId:null,
  createdAt:'2026-08-01T08:00:00Z',archived:false,...extra
});
const logged=(q,days)=>days.map(n=>{
  const d=new Date(2026,10,16-n,12);
  return {id:'c'+q.id+n,questId:q.id,periodKey:periodKey(q.repeatRule,d),
    completedAt:d.toISOString()};
});
const settings=(patch={})=>({...DEFAULT_ADAPTIVE_SETTINGS,...patch});
const get=(qs,controls,cs,st=settings(),decisions=[],goals=[])=>buildAdaptiveProposals({
  quests:qs,goals,controls,completions:cs,focusSessions:[],
  decisions,settings:st,now
});
test('Lite alternative is bounded and only recurring, and always easy-level XP',()=>{
  assert.equal(liteMinutes(80),20);assert.equal(liteMinutes(10),5);
  assert.ok(liteQuestIsAllowed(quest()));
  assert.equal(liteQuestIsAllowed(quest('one',{repeatRule:'once'})),false);
  assert.equal(liteCompletionDifficulty('hard'),'easy');
});
test('Low recorded consistency suggests a lighter, editable alternative',()=>{
  const q=quest(),ctrl={...defaultQuestControl(q),status:'active',estimateMinutes:50};
  const proposals=get([q],{q:ctrl},logged(q,[0,5,9]));
  const ease=proposals.find(p=>p.kind==='ease');
  assert.ok(ease);assert.equal(ease.estimateMinutes,20);
  assert.match(ease.reason,/not recorded|missing logs/i);
});
test('High consistency and energy permit gradual stretch, not unbounded growth',()=>{
  const q=quest(),ctrl={...defaultQuestControl(q),status:'active',estimateMinutes:40};
  const proposals=get([q],{q:ctrl},logged(q,[0,1,2,3,4,5,6,7,8,9,10,11,12,13]),settings({energy:5}));
  const stretch=proposals.find(p=>p.kind==='stretch');
  assert.ok(stretch);assert.equal(stretch.estimateMinutes,50);
});
test('Low energy and overloaded days suppress stretch and new-quest creation',()=>{
  const q=quest(),ctrl={...defaultQuestControl(q),status:'active',estimateMinutes:100};
  const cs=logged(q,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
  const low=get([q],{q:ctrl},cs,settings({energy:1}));
  assert.equal(low.some(p=>p.kind==='stretch'||p.kind==='quest'||p.kind==='goal'),false);
  const busy=get([q],{q:ctrl},cs,settings({energy:5,dailyBudgetMinutes:30}));
  assert.equal(busy.some(p=>p.kind!=='ease'),false);
});
test('New goals are never proposed when the attribute has an active goal',()=>{
  const q=quest(),cs=logged(q,Array.from({length:21},(_,i)=>i));
  const ctrl={...defaultQuestControl(q),status:'active',estimateMinutes:20};
  const proposals=get([q],{q:ctrl},cs,settings({energy:5,suggestionsPerDay:3}),[],
    [{id:'g',title:'Existing goal',attribute:'intelligence',targetCount:8,createdAt:q.createdAt,archived:false}]);
  assert.equal(proposals.some(p=>p.kind==='goal'),false);
  assert.ok(proposals.some(p=>p.kind==='quest'));
  assert.ok(proposals.every(p=>p.status==='backlog'||p.kind==='stretch'));
});
test('Cooldown after dismissal and no duplicate accepted suggestions',()=>{
  const q=quest(),ctrl={...defaultQuestControl(q),status:'active',estimateMinutes:50};
  const cs=logged(q,[0,3,6]);
  const dismissed=[{id:'ease:q',kind:'ease',sourceId:'q',decision:'dismissed',decidedAt:now.toISOString()}];
  assert.equal(get([q],{q:ctrl},cs,settings(),dismissed).some(p=>p.kind==='ease'),false);
  const accepted=[{...dismissed[0],decision:'accepted'}];
  assert.equal(get([q],{q:ctrl},cs,settings(),accepted).some(p=>p.kind==='ease'),false);
});
test('Suggestion cap, weekly goal budget, pause and disabled state',()=>{
  const q=quest(),ctrl={...defaultQuestControl(q),status:'active',estimateMinutes:50};
  const cs=logged(q,[0,2,4]);
  assert.ok(get([q],{q:ctrl},cs).length<=2);
  assert.deepEqual(get([q],{q:ctrl},cs,settings({enabled:false})),[]);
  assert.deepEqual(get([q],{q:ctrl},cs,settings({pauseUntil:'2026-11-20'})),[]);
  assert.deepEqual(get([q],{q:ctrl},cs,settings({energy:2,maxNewQuestsPerWeek:0,maxNewGoalsPerMonth:0}))
    .filter(p=>['stretch','quest','milestone','goal'].includes(p.kind)),[]);
});
test('Weekly opportunity count is per period, never per weekday',()=>{
  const q=quest('week',{repeatRule:'weekly'});
  const ctrl={...defaultQuestControl(q),status:'active',weekdays:[1,2,3]};
  const x=countScheduledOpportunities(q,ctrl,[],now,14);
  assert.ok(x.opportunities<=3);
});
test('Invalid safety settings cannot silently expand quotas',()=>{
  assert.throws(()=>validateAdaptiveSettings(settings({maxDailyMissions:99})));
  assert.throws(()=>validateAdaptiveSettings(settings({dailyBudgetMinutes:1000})));
  assert.throws(()=>validateAdaptiveSettings(settings({maxNewGoalsPerMonth:10})));
});

test('Recorded short focus sessions can trigger a lighter workload even with good completion logging',()=>{
  const q=quest(),ctrl={...defaultQuestControl(q),status:'active',estimateMinutes:80};
  const cs=logged(q,[0,1,2,3,4,5,6,7,8,9,10,11,12]);
  const focusSessions=[0,3,6].map(i=>({id:'f'+i,questId:q.id,minutes:20,
    createdAt:new Date(2026,10,16-i,12).toISOString()}));
  const proposals=buildAdaptiveProposals({quests:[q],goals:[],controls:{q:ctrl},
    completions:cs,focusSessions,decisions:[],settings:settings({energy:3}),now});
  assert.ok(proposals.some(x=>x.kind==='ease'));
  assert.match(proposals.find(x=>x.kind==='ease').reason,/focus sessions/i);
});
test('Accepted easing is time-limited while new draft creation remains approved-only',()=>{
  const q=quest(),ctrl={...defaultQuestControl(q),status:'active',estimateMinutes:50};
  const cs=logged(q,[0,4,9]);
  const recent=[{id:'ease:q:20',kind:'ease',sourceId:'q',
    decision:'accepted',decidedAt:now.toISOString()}];
  assert.equal(get([q],{q:ctrl},cs,settings(),recent).some(p=>p.kind==='ease'),false);
  const old=[{...recent[0],decidedAt:'2026-10-01T12:00:00Z'}];
  assert.ok(get([q],{q:ctrl},cs,settings(),old).some(p=>p.kind==='ease'));
  assert.equal(liteQuestIsAllowed(quest('q-easy',{difficulty:'easy'})),false);
});
