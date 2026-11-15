const test=require('node:test'), assert=require('node:assert/strict');
const {defaultQuestControl,validateControl,isQuietTime,questDueOn,blockedByDependencies,
 introducesCycle,activeMissionList,occurrencesForDays,skillLevel,derivedAchievements,
 outcomeProgress,xpTrend}=require('../dist/index.js');
const date=new Date(2026,10,16,12); // Monday
const q=(id,rule='daily')=>({id,title:id,description:'',attribute:'discipline',
 difficulty:'easy',repeatRule:rule,goalId:null,createdAt:'2026-01-01T00:00:00Z',archived:false});
test('one-off quests start in backlog, recurring quests active',()=>{
 assert.equal(defaultQuestControl(q('a','once')).status,'backlog');
 assert.equal(defaultQuestControl(q('b','daily')).status,'active');
});
test('quiet hours spans midnight and leaves daytime alone',()=>{
 assert.equal(isQuietTime('23:00','22:00','07:00'),true);
 assert.equal(isQuietTime('06:59','22:00','07:00'),true);
 assert.equal(isQuietTime('10:00','22:00','07:00'),false);
});
test('selected weekdays and snooze suppress quests',()=>{
 const quest=q('x');
 const control={...defaultQuestControl(quest),weekdays:[2,4],status:'active'};
 assert.equal(questDueOn(quest,control,date),false);
 assert.equal(questDueOn(quest,{...control,weekdays:[1]},date),true);
 assert.equal(questDueOn(quest,{...control,weekdays:[],snoozedUntil:'2026-11-18'},date),false);
});
test('priority selects a few relevant missions, not an entire 180 item pack',()=>{
 const quests=Array.from({length:180},(_,i)=>q('q'+i,'daily'));
 const controls=Object.fromEntries(quests.map((x,i)=>[x.id,{...defaultQuestControl(x),priority:i===5?1:3}]));
 const top=activeMissionList(quests,controls,[],[],date,4);
 assert.equal(top.length,4);assert.equal(top[0].id,'q5');
});
test('dependency gates and cycles detect invalid prerequisite chains',()=>{
 const deps=[{questId:'b',requiresQuestId:'a'}];
 assert.equal(blockedByDependencies(q('b','once'),deps,[]),true);
 assert.equal(blockedByDependencies(q('b','once'),deps,[{id:'1',questId:'a',periodKey:'once',completedAt:date.toISOString()}]),false);
 assert.equal(introducesCycle(deps,{questId:'a',requiresQuestId:'b'}),true);
 assert.equal(introducesCycle(deps,{questId:'c',requiresQuestId:'b'}),false);
});
test('planning a calendar does not schedule paused quests',()=>{
 const a=q('active'),b=q('paused');
 const controls={active:defaultQuestControl(a),paused:{...defaultQuestControl(b),status:'paused'}};
 const occurrences=occurrencesForDays([a,b],controls,[],[],date,7);
 assert.equal(occurrences.length,7);
 assert.ok(occurrences.every(o=>o.quests.some(q=>q.id==='active')&&!o.quests.some(q=>q.id==='paused')));
});
test('control data rejects invalid weekdays and durations',()=>{
 const c=defaultQuestControl(q('x'));
 assert.throws(()=>validateControl({...c,weekdays:[1,1]}));
 assert.throws(()=>validateControl({...c,estimateMinutes:900}));
 assert.deepEqual(validateControl(c),c);
});
test('skills, outcomes and XP trends derive from real ledger, not claims',()=>{
 assert.equal(skillLevel(0),1);assert.ok(skillLevel(1000)>1);
 assert.equal(outcomeProgress({goalId:'a',target:20,value:3,unit:'km',deadline:null}),.15);
 const events=[{id:'1',completionId:'1',dayKey:'2026-11-16',amount:25,attribute:'discipline',createdAt:date.toISOString()}];
 assert.equal(xpTrend(events,date,7).at(-1).xp,25);
});
test('achievements require recorded evidence',()=>{
 const first=derivedAchievements([q('a')],[{id:'1',questId:'a',periodKey:'2026-11-16',completedAt:date.toISOString()}],[],[]);
 assert.equal(first.find(a=>a.id==='awakening').unlocked,true);
 assert.equal(first.find(a=>a.id==='boss').unlocked,false);
});
