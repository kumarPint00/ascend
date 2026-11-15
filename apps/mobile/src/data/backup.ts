import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import type {Quest,Goal,Completion,XPEvent,QuestControl,QuestDependency,GoalOutcome,
  BossBattle,FocusSession,WeeklyReview,SchedulePreferences} from '@ascend/game-engine';
import {ATTRIBUTES,validateControl,introducesCycle,DEFAULT_PREFERENCES,validTime} from '@ascend/game-engine';
import {getDb,loadSnapshot,restoreJSON} from './repository';
import {loadPhaseTwoSnapshot,type PhaseTwoSnapshot} from './phase2';

type Core={quests:Quest[];goals:Goal[];completions:Completion[];xpEvents:XPEvent[]};
export interface FullBackup extends Core {
  format:'ascend-backup';schemaVersion:2;exportedAt:string;phase2:PhaseTwoSnapshot;
}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown,max=128):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
const date=(v:unknown)=>str(v,48)&&Number.isFinite(Date.parse(v));
const unique=(items:readonly {id:string}[])=>new Set(items.map(x=>x.id)).size===items.length;
const assert=(v:unknown,msg:string):asserts v=>{if(!v)throw new Error(msg);};
const array=(v:unknown,max:number,field:string):unknown[]=>{
  if(!Array.isArray(v)||v.length>max)throw Error('Invalid '+field);
  return v;
};
export async function exportFullBackup():Promise<string>{
  const base=await loadSnapshot(),phase2=await loadPhaseTwoSnapshot();
  return JSON.stringify({format:'ascend-backup',schemaVersion:2,
    exportedAt:new Date().toISOString(),...base,phase2},null,2);
}
/** Strict validation before entering the single replacement transaction. */
export function parseFullBackup(source:string):FullBackup{
  if(source.length>10_000_000)throw Error('Backup exceeds 10 MB');
  let raw:unknown;
  try{raw=JSON.parse(source);}catch{throw Error('Backup is not valid JSON');}
  if(!obj(raw)||raw.format!=='ascend-backup'||raw.schemaVersion!==2||!obj(raw.phase2))
    throw Error('Unsupported ASCEND v2 backup');
  const goals=array(raw.goals,50000,'goals') as Goal[],quests=array(raw.quests,50000,'quests') as Quest[];
  const completions=array(raw.completions,100000,'completions') as Completion[];
  const xpEvents=array(raw.xpEvents,100000,'xpEvents') as XPEvent[];
  const attr=(v:unknown)=>ATTRIBUTES.includes(v as never);
  if(!goals.every(g=>obj(g)&&str(g.id)&&str(g.title,100)&&attr(g.attribute)&&
    Number.isInteger(g.targetCount)&&g.targetCount>=1&&g.targetCount<=10000&&
    date(g.createdAt)&&typeof g.archived==='boolean')||!unique(goals))throw Error('Invalid goals');
  const gIds=new Set(goals.map(g=>g.id));
  if(!quests.every(q=>obj(q)&&str(q.id)&&str(q.title,100)&&typeof q.description==='string'&&
    q.description.length<=500&&attr(q.attribute)&&['easy','medium','hard'].includes(q.difficulty)&&
    ['daily','weekly','once'].includes(q.repeatRule)&&
    (q.goalId===null||gIds.has(q.goalId))&&date(q.createdAt)&&typeof q.archived==='boolean')||
    !unique(quests))throw Error('Invalid quests');
  const qIds=new Set(quests.map(q=>q.id));
  if(!completions.every(c=>obj(c)&&str(c.id)&&qIds.has(c.questId)&&
    str(c.periodKey,40)&&date(c.completedAt))||!unique(completions)||
    new Set(completions.map(c=>c.questId+'|'+c.periodKey)).size!==completions.length)
    throw Error('Invalid completion records');
  const cIds=new Set(completions.map(c=>c.id));
  if(!xpEvents.every(e=>obj(e)&&str(e.id)&&cIds.has(e.completionId)&&
    /^\d{4}-\d{2}-\d{2}$/.test(e.dayKey)&&Number.isInteger(e.amount)&&e.amount>=0&&e.amount<=50&&
    attr(e.attribute)&&date(e.createdAt))||!unique(xpEvents)||
    new Set(xpEvents.map(e=>e.completionId)).size!==xpEvents.length)
    throw Error('Invalid XP history');
  const p=raw.phase2;
  if(!obj(p.controls)||Object.keys(p.controls).length>50000)throw Error('Invalid quest controls');
  const controls=p.controls as Record<string,QuestControl>;
  for(const [id,c] of Object.entries(controls)){
    if(!qIds.has(id)||!obj(c)||c.questId!==id)throw Error('Invalid quest state reference');
    validateControl(c);
  }
  const dependencies=array(p.dependencies,100000,'dependencies') as QuestDependency[];
  const chain:QuestDependency[]=[];
  for(const d of dependencies){
    if(!obj(d)||!qIds.has(d.questId)||!qIds.has(d.requiresQuestId)||introducesCycle(chain,d))
      throw Error('Invalid or cyclic dependency');
    if(!chain.some(x=>x.questId===d.questId&&x.requiresQuestId===d.requiresQuestId))chain.push(d);
  }
  if(!obj(p.outcomes)||Object.keys(p.outcomes).length>50000)throw Error('Invalid goal outcomes');
  const outcomes=p.outcomes as Record<string,GoalOutcome>;
  for(const [id,o] of Object.entries(outcomes)){
    if(!gIds.has(id)||!obj(o)||o.goalId!==id||!Number.isFinite(o.target)||o.target<=0||
      !Number.isFinite(o.value)||o.value<0||!str(o.unit,24)||
      (o.deadline!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(o.deadline)))
      throw Error('Invalid measurable outcome');
  }
  const bosses=array(p.bosses,10000,'bosses') as BossBattle[];
  if(!bosses.every(b=>obj(b)&&str(b.id)&&str(b.title,100)&&typeof b.description==='string'&&
    b.description.length<=350&&(b.goalId===null||gIds.has(b.goalId))&&
    (b.questId===null||qIds.has(b.questId))&&(b.wonAt===null||date(b.wonAt))&&date(b.createdAt))||
    !unique(bosses))throw Error('Invalid boss records');
  const focusSessions=array(p.focusSessions,1000,'focus sessions') as FocusSession[];
  if(!focusSessions.every(x=>obj(x)&&str(x.id)&&
    (x.questId===null||qIds.has(x.questId))&&Number.isInteger(x.minutes)&&
    x.minutes>=1&&x.minutes<=480&&date(x.createdAt))||!unique(focusSessions))
    throw Error('Invalid focus records');
  const weeklyReviews=array(p.weeklyReviews,100,'weekly reviews') as WeeklyReview[];
  if(!weeklyReviews.every(r=>obj(r)&&/^\d{4}-W\d{2}$/.test(r.weekKey)&&
    typeof r.wins==='string'&&r.wins.length<=1200&&typeof r.blockers==='string'&&
    r.blockers.length<=1200&&typeof r.nextFocus==='string'&&r.nextFocus.length<=1200&&
    date(r.createdAt))||new Set(weeklyReviews.map(r=>r.weekKey)).size!==weeklyReviews.length)
    throw Error('Invalid weekly review records');
  const skillUnlocks=array(p.skillUnlocks,100,'skill unlocks') as string[];
  if(!skillUnlocks.every(x=>typeof x==='string'&&/^(strength|intelligence|discipline|finance|relationships|recovery)-[123]$/.test(x))||
    new Set(skillUnlocks).size!==skillUnlocks.length)throw Error('Invalid skill unlocks');
  if(!obj(p.preferences))throw Error('Invalid preferences');
  const pref=p.preferences as unknown as SchedulePreferences;
  if(typeof pref.remindersEnabled!=='boolean'||!validTime(pref.quietStart)||
    !validTime(pref.quietEnd)||!Number.isInteger(pref.dailyMissionLimit)||
    pref.dailyMissionLimit<1||pref.dailyMissionLimit>8)
    throw Error('Invalid reminder preferences');
  return {format:'ascend-backup',schemaVersion:2,exportedAt:date(raw.exportedAt)?raw.exportedAt as string:new Date().toISOString(),
    goals,quests,completions,xpEvents,phase2:{controls,dependencies:chain,outcomes,bosses,
      focusSessions,weeklyReviews,skillUnlocks,preferences:pref}};
}
export async function restoreFullBackup(source:string):Promise<void>{
  if(source.length>10_000_000)throw Error('Backup exceeds 10 MB');
  let summary:unknown;
  try{summary=JSON.parse(source);}catch{throw Error('Backup is not valid JSON');}
  // Legacy backup remains supported with its existing validated restoration.
  if(obj(summary)&&summary.schemaVersion===1){await restoreJSON(source);return;}
  const data=parseFullBackup(source);
  const db=await getDb(),p=data.phase2;
  await db.withExclusiveTransactionAsync(async tx=>{
    await tx.runAsync('DELETE FROM xp_events');
    await tx.runAsync('DELETE FROM completions');
    await tx.runAsync('DELETE FROM quest_dependencies');
    await tx.runAsync('DELETE FROM quest_state');
    await tx.runAsync('DELETE FROM focus_sessions');
    await tx.runAsync('DELETE FROM boss_battles');
    await tx.runAsync('DELETE FROM goal_outcomes');
    await tx.runAsync('DELETE FROM weekly_reviews');
    await tx.runAsync('DELETE FROM skill_unlocks');
    await tx.runAsync('DELETE FROM quests');
    await tx.runAsync('DELETE FROM goals');
    for(const g of data.goals)await tx.runAsync('INSERT INTO goals(id,title,attribute,target_count,created_at,archived) VALUES(?,?,?,?,?,?)',
      g.id,g.title,g.attribute,g.targetCount,g.createdAt,g.archived?1:0);
    for(const q of data.quests)await tx.runAsync(
      'INSERT INTO quests(id,title,description,attribute,difficulty,repeat_rule,goal_id,created_at,archived) VALUES(?,?,?,?,?,?,?,?,?)',
      q.id,q.title,q.description,q.attribute,q.difficulty,q.repeatRule,q.goalId,q.createdAt,q.archived?1:0);
    for(const c of data.completions)await tx.runAsync('INSERT INTO completions(id,quest_id,period_key,completed_at) VALUES(?,?,?,?)',
      c.id,c.questId,c.periodKey,c.completedAt);
    for(const e of data.xpEvents)await tx.runAsync(
      'INSERT INTO xp_events(id,completion_id,day_key,amount,attribute,created_at) VALUES(?,?,?,?,?,?)',
      e.id,e.completionId,e.dayKey,e.amount,e.attribute,e.createdAt);
    for(const control of Object.values(p.controls))await tx.runAsync(
      'INSERT INTO quest_state(quest_id,status,priority,weekdays,due_on,time_of_day,snoozed_until,estimate_minutes,reminder) VALUES(?,?,?,?,?,?,?,?,?)',
      control.questId,control.status,control.priority,JSON.stringify(control.weekdays),
      control.dueOn,control.timeOfDay,control.snoozedUntil,control.estimateMinutes,control.reminder?1:0);
    for(const d of p.dependencies)await tx.runAsync(
      'INSERT INTO quest_dependencies(quest_id,requires_quest_id) VALUES(?,?)',d.questId,d.requiresQuestId);
    for(const o of Object.values(p.outcomes))await tx.runAsync(
      'INSERT INTO goal_outcomes(goal_id,target,value,unit,deadline) VALUES(?,?,?,?,?)',
      o.goalId,o.target,o.value,o.unit,o.deadline);
    for(const b of p.bosses)await tx.runAsync(
      'INSERT INTO boss_battles(id,title,description,goal_id,quest_id,won_at,created_at) VALUES(?,?,?,?,?,?,?)',
      b.id,b.title,b.description,b.goalId,b.questId,b.wonAt,b.createdAt);
    for(const x of p.focusSessions)await tx.runAsync(
      'INSERT INTO focus_sessions(id,quest_id,minutes,created_at) VALUES(?,?,?,?)',
      x.id,x.questId,x.minutes,x.createdAt);
    for(const r of p.weeklyReviews)await tx.runAsync(
      'INSERT INTO weekly_reviews(week_key,wins,blockers,next_focus,created_at) VALUES(?,?,?,?,?)',
      r.weekKey,r.wins,r.blockers,r.nextFocus,r.createdAt);
    for(const node of p.skillUnlocks)await tx.runAsync(
      'INSERT INTO skill_unlocks(node_id,unlocked_at) VALUES(?,?)',node,new Date().toISOString());
    for(const [key,value] of Object.entries(p.preferences))await tx.runAsync(
      'INSERT OR REPLACE INTO preferences(key,value) VALUES(?,?)',key,String(value));
    await tx.runAsync("INSERT OR REPLACE INTO app_state(key,value) VALUES('starter_seeded','1')");
  });
}
export async function shareBackupFile():Promise<void>{
  const text=await exportFullBackup();
  if(!FileSystem.documentDirectory)throw Error('App documents directory unavailable');
  const filename='ASCEND-backup-'+new Date().toISOString().slice(0,10)+'.json';
  const path=FileSystem.documentDirectory+filename;
  await FileSystem.writeAsStringAsync(path,text,{encoding:FileSystem.EncodingType.UTF8});
  if(!await Sharing.isAvailableAsync())throw Error('File sharing unavailable on this device');
  await Sharing.shareAsync(path,{mimeType:'application/json',dialogTitle:'Save ASCEND backup outside the app'});
}
export async function chooseBackupFile():Promise<string|null>{
  const result=await DocumentPicker.getDocumentAsync({type:'application/json',copyToCacheDirectory:true});
  if(result.canceled)return null;
  const file=result.assets[0];
  if(!file)return null;
  if(file.size!==undefined&&file.size>10_000_000)throw Error('Backup file too large');
  const source=await FileSystem.readAsStringAsync(file.uri);
  // Validate without touching the database.
  let raw:unknown;try{raw=JSON.parse(source);}catch{throw Error('Not valid JSON');}
  if(obj(raw)&&raw.schemaVersion===2)parseFullBackup(source);
  else if(!obj(raw)||raw.format!=='ascend-backup'||raw.schemaVersion!==1)
    throw Error('Not a recognized ASCEND backup');
  return source;
}
