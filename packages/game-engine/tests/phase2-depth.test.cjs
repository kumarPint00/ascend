const test=require('node:test'),assert=require('node:assert/strict');
const {metricForecast,adaptiveMissionRecommendations,autoBackupFilename,autoBackupPruneCandidates,
  defaultQuestControl}=require('../dist/index.js');
const date=new Date(2026,10,16,12);
const q=(id,attribute='discipline')=>({id,title:id,description:'',attribute,
  difficulty:'medium',repeatRule:'daily',goalId:null,createdAt:'2026-01-01T12:00:00Z',archived:false});
test('metric trend requires three spaced observations and correct direction',()=>{
  const m=(id,value,day)=>({id,goalId:'g',value,unit:'kg',recordedAt:day+'T08:00:00Z'});
  const h=[m('1',70,'2026-10-16'),m('2',69,'2026-10-26'),m('3',68,'2026-11-06')];
  const forecast=metricForecast(h,64,date);
  assert.ok(forecast);assert.equal(forecast.direction,'decrease');
  assert.ok(forecast.estimatedWeeks>0);assert.equal(forecast.sampleCount,3);
  assert.equal(metricForecast(h,75,date),null);
  assert.equal(metricForecast(h.slice(1),64,date),null);
  assert.equal(metricForecast([m('a',2,'2026-11-14'),m('b',3,'2026-11-15'),m('c',4,'2026-11-16')],8,date),null);
});
test('recommendations are evidence-based and respect time budget, backlog and priorities',()=>{
  const quests=[q('urgent','intelligence'),q('backlog'),q('regular','relationships'),q('paused')];
  const controls={
    urgent:{...defaultQuestControl(quests[0]),priority:1,estimateMinutes:20},
    backlog:{...defaultQuestControl(quests[1]),status:'backlog'},
    regular:{...defaultQuestControl(quests[2]),estimateMinutes:20},
    paused:{...defaultQuestControl(quests[3]),status:'paused'},
  };
  const list=adaptiveMissionRecommendations(quests,controls,[],[],date,35,4);
  assert.equal(list.length,1);assert.equal(list[0].quest.id,'urgent');
  assert.ok(list[0].reason.includes('High priority'));
});
test('auto backup retention only removes well-formed managed files',()=>{
  const names=Array.from({length:10},(_,i)=>autoBackupFilename(new Date(2026,10,i+1,12)));
  names.push('ASCEND-manual.json','bank-account.json','ASCEND-AUTO-evil.json');
  const stale=autoBackupPruneCandidates(names,4);
  assert.equal(stale.length,6);
  assert.ok(stale.every(x=>x.startsWith('ASCEND-AUTO-')));
  assert.equal(stale.includes('bank-account.json'),false);
});
