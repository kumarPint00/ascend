const test=require('node:test');
const assert=require('node:assert/strict');
const {
  roadmapWeekCount,roadmapDate,roadmapDaysForWeek,parseRoadmapBlueprint,
  parseRoadmapWeek,assembleRoadmap,compileRoadmapPack,parseImportableQuestPack,
  importGoalId,importQuestId
}=require('../dist/index.js');

const duration=30;
const themes=Array.from({length:5},(_,i)=>({
  week:i+1,theme:'LLM learning stage '+(i+1),
  achievement:'Demonstrate a working skill from stage '+(i+1)+' with a saved artifact'
}));
const checkpoints=[{month:1,title:'LLM prototype verified',
  proof:'Show one working LLM prototype, reproducible evaluation and error analysis'}];
function blueprint(days=duration){
  return JSON.stringify({
    title:'Build applied LLM engineering skills',
    objective:'Build working LLM applications using RAG, evaluation and deployment',
    attribute:'intelligence',
    weeklyThemes:Array.from({length:roadmapWeekCount(days)},(_,i)=>({
      week:i+1,theme:'LLM learning stage '+(i+1),
      achievement:'Demonstrate a working skill from stage '+(i+1)+' with a saved artifact'
    })),
    monthlyAchievements:Array.from({length:Math.ceil(days/30)},(_,i)=>({
      month:i+1,title:'Month '+(i+1)+' practical project',
      proof:'Demo project '+(i+1)+' with reproducible test results'
    }))
  });
}
function weekPayload(week,days){
  return JSON.stringify({week,days:Array.from({length:days},(_,i)=>{
    const day=(week-1)*7+i+1;
    return {day,title:'Implement LLM skill '+day,
      deliverable:'Save test result '+day+' in a notebook and explain failure cases',
      minutes:45};
  })});
}
function makePlan(days=30){
  const b=parseRoadmapBlueprint(blueprint(days),days);
  const weeks=b.weeklyThemes.map(w=>parseRoadmapWeek(
    weekPayload(w.week,roadmapDaysForWeek(days,w.week)),
    days,w.week,45,w
  ));
  return assembleRoadmap({intent:'Become skilled at building LLM applications',
    title:b.title,objective:b.objective,attribute:b.attribute,durationDays:days,
    dailyMinutes:45,startDate:'2026-11-21',monthlyAchievements:b.monthlyAchievements},weeks);
}

test('roadmap dates remain stable across calendar year, months and leap days',()=>{
  assert.equal(roadmapDate('2026-11-21',1),'2026-11-21');
  assert.equal(roadmapDate('2026-11-21',30),'2026-12-20');
  assert.equal(roadmapDate('2026-12-30',4),'2027-01-02');
  assert.equal(roadmapDate('2028-02-28',2),'2028-02-29');
  assert.equal(roadmapDate('2028-02-28',3),'2028-03-01');
  assert.throws(()=>roadmapDate('2026-02-30',1),/Invalid/);
});
test('30-day roadmap produces 30 dated daily achievements and evidence checkpoints',()=>{
  const p=makePlan();
  assert.equal(p.weeks.length,5);
  assert.equal(p.weeks.at(-1).days.length,2);
  const pack=compileRoadmapPack(p);
  assert.equal(pack.goals.length,1);
  assert.equal(pack.goals[0].targetCount,36); // 30 days + 5 weekly + 1 monthly
  assert.equal(pack.quests.length,36);
  assert.equal(pack.quests.filter(q=>q.kind==='quest').length,30);
  assert.equal(pack.quests.filter(q=>q.kind==='milestone').length,6);
  assert.equal(pack.quests.find(q=>q.key==='day-001').dueOn,'2026-11-21');
  assert.equal(pack.quests.find(q=>q.key==='day-030').dueOn,'2026-12-20');
  assert.equal(pack.quests.find(q=>q.key==='month-01').dueOn,'2026-12-20');
  assert.ok(pack.quests.every(q=>q.repeatRule==='once'&&!!q.dueOn&&q.description.includes('Proof:')||q.description.includes('Evidence:')));
  const parsed=parseImportableQuestPack(JSON.stringify(pack));
  assert.equal(parsed.quests.length,36);
  assert.equal(parsed.goals[0].targetCount,36);
});
test('60/90 day roadmaps cover every day but stay under import caps',()=>{
  for(const days of [60,90]){
    const p=makePlan(days),pack=compileRoadmapPack(p);
    assert.equal(p.weeks.flatMap(w=>w.days).length,days);
    assert.equal(pack.quests.length,days+roadmapWeekCount(days)+days/30);
    assert.ok(pack.quests.length<=180);
    assert.equal(pack.quests.find(q=>q.key==='day-'+String(days).padStart(3,'0')).dueOn,
      roadmapDate('2026-11-21',days));
    assert.doesNotThrow(()=>parseImportableQuestPack(JSON.stringify(pack)));
  }
});
test('selective import remains idempotent and never invents a completion',()=>{
  const plan=makePlan();
  const full=compileRoadmapPack(plan),partial=compileRoadmapPack(plan,
    {days:[1,2],weeks:[1],months:[1]});
  assert.equal(full.packId,partial.packId);
  assert.equal(partial.quests.length,4);
  assert.equal(partial.goals[0].targetCount,4);
  assert.equal(importGoalId(full.packId,'learning-goal'),
    importGoalId(partial.packId,'learning-goal'));
  assert.equal(importQuestId(full.packId,'day-001'),
    importQuestId(partial.packId,'day-001'));
  assert.equal(Object.hasOwn(partial,'completions'),false);
  assert.equal(Object.hasOwn(partial,'xpEvents'),false);
  assert.throws(()=>compileRoadmapPack(plan,{days:[],weeks:[],months:[]}),/Select/);
});
test('untrusted AI cannot omit days, reorder weeks, create oversized titles or fake milestones',()=>{
  const w=themes[0];
  assert.throws(()=>parseRoadmapWeek(weekPayload(1,6),30,1,45,w),/incomplete/);
  assert.throws(()=>parseRoadmapWeek(weekPayload(2,7),30,1,45,w),/incomplete/);
  const payload=JSON.parse(weekPayload(1,7));payload.days[1].day=1;
  assert.throws(()=>parseRoadmapWeek(JSON.stringify(payload),30,1,45,w),/day 2/);
  const wrong=JSON.parse(blueprint());wrong.weeklyThemes.pop();
  assert.throws(()=>parseRoadmapBlueprint(JSON.stringify(wrong),30),/omitted/);
  wrong.weeklyThemes=themes;wrong.monthlyAchievements=[];
  assert.throws(()=>parseRoadmapBlueprint(JSON.stringify(wrong),30),/omitted/);
  const oversized=JSON.parse(weekPayload(1,7));
  oversized.days[0].title='x'.repeat(90);
  assert.throws(()=>parseRoadmapWeek(JSON.stringify(oversized),30,1,45,w),/day 1/);
});
