import type {Quest,Goal,Completion,XPEvent,QuestControl,QuestDependency,GoalOutcome,BossBattle,
  FocusSession,WeeklyReview,SchedulePreferences} from '@ascend/game-engine';
import {defaultQuestControl,validateControl,introducesCycle,DEFAULT_PREFERENCES,isoWeekKey,
  completedGoalCount,localDayKey,SKILL_NODES,canUnlockSkill} from '@ascend/game-engine';
import {getDb,loadSnapshot} from './repository';

export interface PhaseTwoSnapshot {
  controls:Record<string,QuestControl>;dependencies:QuestDependency[];
  outcomes:Record<string,GoalOutcome>;bosses:BossBattle[];
  focusSessions:FocusSession[];weeklyReviews:WeeklyReview[];skillUnlocks:string[];
  preferences:SchedulePreferences;
}
export const EMPTY_PHASE_TWO:PhaseTwoSnapshot={
  controls:{},dependencies:[],outcomes:{},bosses:[],focusSessions:[],weeklyReviews:[],skillUnlocks:[],
  preferences:DEFAULT_PREFERENCES
};
const newId=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
type StateRow={quest_id:string;status:QuestControl['status'];priority:number;weekdays:string;due_on:string|null;
  time_of_day:string|null;snoozed_until:string|null;estimate_minutes:number;reminder:number};
function decodeControl(row:StateRow):QuestControl{
  let weekdays:number[]=[];
  try{const value:unknown=JSON.parse(row.weekdays);if(Array.isArray(value))weekdays=value.filter(x=>typeof x==='number');}catch{}
  return {questId:row.quest_id,status:row.status,priority:row.priority as 1|2|3,
    weekdays,dueOn:row.due_on,timeOfDay:row.time_of_day,snoozedUntil:row.snoozed_until,
    estimateMinutes:row.estimate_minutes,reminder:row.reminder===1};
}
export async function loadPhaseTwoSnapshot():Promise<PhaseTwoSnapshot>{
  const db=await getDb();
  const [states,deps,results,bosses,sessions,reviews,prefs,unlocks]=await Promise.all([
    db.getAllAsync<StateRow>('SELECT * FROM quest_state'),
    db.getAllAsync<{quest_id:string;requires_quest_id:string}>('SELECT * FROM quest_dependencies'),
    db.getAllAsync<{goal_id:string;target:number;value:number;unit:string;deadline:string|null}>('SELECT * FROM goal_outcomes'),
    db.getAllAsync<{id:string;title:string;description:string;goal_id:string|null;quest_id:string|null;won_at:string|null;created_at:string}>('SELECT * FROM boss_battles ORDER BY created_at DESC'),
    db.getAllAsync<{id:string;quest_id:string|null;minutes:number;created_at:string}>('SELECT * FROM focus_sessions ORDER BY created_at DESC LIMIT 1000'),
    db.getAllAsync<{week_key:string;wins:string;blockers:string;next_focus:string;created_at:string}>('SELECT * FROM weekly_reviews ORDER BY week_key DESC LIMIT 100'),
    db.getAllAsync<{key:string;value:string}>('SELECT * FROM preferences'),
    db.getAllAsync<{node_id:string}>('SELECT node_id FROM skill_unlocks'),
  ]);
  const controls:Record<string,QuestControl>={};
  for(const row of states){const c=decodeControl(row);controls[c.questId]=c;}
  const outcomes:Record<string,GoalOutcome>={};
  for(const o of results)outcomes[o.goal_id]={goalId:o.goal_id,target:o.target,value:o.value,unit:o.unit,deadline:o.deadline};
  const preferences={...DEFAULT_PREFERENCES};
  for(const row of prefs){
    if(row.key==='remindersEnabled')preferences.remindersEnabled=row.value==='true';
    if(row.key==='quietStart')preferences.quietStart=row.value;
    if(row.key==='quietEnd')preferences.quietEnd=row.value;
    if(row.key==='dailyMissionLimit')preferences.dailyMissionLimit=Number(row.value)||4;
  }
  return {
    controls,dependencies:deps.map(d=>({questId:d.quest_id,requiresQuestId:d.requires_quest_id})),
    outcomes,bosses:bosses.map(b=>({id:b.id,title:b.title,description:b.description,goalId:b.goal_id,
      questId:b.quest_id,wonAt:b.won_at,createdAt:b.created_at})),
    focusSessions:sessions.map(s=>({id:s.id,questId:s.quest_id,minutes:s.minutes,createdAt:s.created_at})),
    weeklyReviews:reviews.map(r=>({weekKey:r.week_key,wins:r.wins,blockers:r.blockers,
      nextFocus:r.next_focus,createdAt:r.created_at})),
    skillUnlocks:unlocks.map(u=>u.node_id),preferences,
  };
}
export async function updateQuestControl(quest:Quest,patch:Partial<Omit<QuestControl,'questId'>>):Promise<void>{
  const db=await getDb();
  const row=await db.getFirstAsync<StateRow>('SELECT * FROM quest_state WHERE quest_id=?',quest.id);
  const current=row?decodeControl(row):defaultQuestControl(quest);
  const control=validateControl({...current,...patch,questId:quest.id});
  await db.runAsync(`INSERT INTO quest_state
    (quest_id,status,priority,weekdays,due_on,time_of_day,snoozed_until,estimate_minutes,reminder)
    VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(quest_id) DO UPDATE SET status=excluded.status,priority=excluded.priority,
    weekdays=excluded.weekdays,due_on=excluded.due_on,time_of_day=excluded.time_of_day,
    snoozed_until=excluded.snoozed_until,estimate_minutes=excluded.estimate_minutes,
    reminder=excluded.reminder`,
    control.questId,control.status,control.priority,JSON.stringify(control.weekdays),
    control.dueOn,control.timeOfDay,control.snoozedUntil,control.estimateMinutes,
    control.reminder?1:0);
}
export async function addQuestDependency(questId:string,requiresQuestId:string):Promise<void>{
  if(questId===requiresQuestId)throw new Error('Quest cannot depend on itself');
  const db=await getDb(),snapshot=await loadSnapshot();
  if(!snapshot.quests.some(q=>q.id===questId)||!snapshot.quests.some(q=>q.id===requiresQuestId))
    throw Error('Both quests must exist');
  const existing=(await loadPhaseTwoSnapshot()).dependencies;
  if(introducesCycle(existing,{questId,requiresQuestId}))throw Error('Dependency would create a cycle');
  await db.runAsync('INSERT OR IGNORE INTO quest_dependencies(quest_id,requires_quest_id) VALUES(?,?)',
    questId,requiresQuestId);
}
export async function removeQuestDependency(questId:string,requiresQuestId:string):Promise<void>{
  const db=await getDb();await db.runAsync(
    'DELETE FROM quest_dependencies WHERE quest_id=? AND requires_quest_id=?',questId,requiresQuestId);
}
export async function saveGoalOutcome(goalId:string,input:{target:number;value:number;unit:string;deadline:string|null}):Promise<void>{
  const {target,value,unit,deadline}=input;
  if(!Number.isFinite(target)||target<=0||target>1e9||!Number.isFinite(value)||value<0||value>1e9||
     unit.trim().length<1||unit.length>24||
     (deadline!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(deadline)))
    throw Error('Invalid measurable goal values');
  const db=await getDb();
  await db.runAsync(`INSERT INTO goal_outcomes(goal_id,target,value,unit,deadline) VALUES(?,?,?,?,?)
    ON CONFLICT(goal_id) DO UPDATE SET target=excluded.target,value=excluded.value,
    unit=excluded.unit,deadline=excluded.deadline`,goalId,target,value,unit.trim(),deadline);
}
export async function createBoss(input:{title:string;description:string;goalId:string|null;questId:string|null}):Promise<void>{
  const title=input.title.trim(),description=input.description.trim();
  if(!title||title.length>100||description.length>350)throw Error('Boss challenge title or detail too long');
  const db=await getDb();
  await db.runAsync(`INSERT INTO boss_battles(id,title,description,goal_id,quest_id,won_at,created_at)
    VALUES(?,?,?,?,?,NULL,?)`,newId(),title,description,input.goalId,input.questId,new Date().toISOString());
}
export async function winBoss(id:string):Promise<void>{
  const db=await getDb(),base=await loadSnapshot(),p2=await loadPhaseTwoSnapshot();
  const boss=p2.bosses.find(b=>b.id===id);
  if(!boss||boss.wonAt)throw Error('Challenge not available');
  if(!boss.questId&&!boss.goalId)throw Error('Link a quest or goal as verifiable evidence first');
  if(boss.questId&&!base.completions.some(c=>c.questId===boss.questId))
    throw Error('Complete the linked proof quest before claiming victory');
  if(boss.goalId){
    const goal=base.goals.find(g=>g.id===boss.goalId);
    if(!goal)throw Error('Linked goal missing');
    const outcome=p2.outcomes[goal.id];
    if(outcome){
      if(outcome.value<outcome.target)throw Error('Reach the measurable goal target first');
    }else if(completedGoalCount(goal.id,base.quests,base.completions)<goal.targetCount){
      throw Error('Reach the goal completion target first');
    }
  }
  await db.runAsync('UPDATE boss_battles SET won_at=? WHERE id=? AND won_at IS NULL',new Date().toISOString(),id);
}
export async function logFocusSession(questId:string|null,minutes:number):Promise<void>{
  if(!Number.isInteger(minutes)||minutes<1||minutes>480)throw Error('Use 1–480 minutes');
  const db=await getDb();
  await db.runAsync('INSERT INTO focus_sessions(id,quest_id,minutes,created_at) VALUES(?,?,?,?)',
    newId(),questId,minutes,new Date().toISOString());
}
export async function saveWeeklyReview(input:{wins:string;blockers:string;nextFocus:string},date=new Date()):Promise<void>{
  if([input.wins,input.blockers,input.nextFocus].some(x=>x.length>1200))throw Error('Review field is too long');
  const db=await getDb(),week=isoWeekKey(date);
  await db.runAsync(`INSERT INTO weekly_reviews(week_key,wins,blockers,next_focus,created_at)
    VALUES(?,?,?,?,?) ON CONFLICT(week_key) DO UPDATE SET wins=excluded.wins,
    blockers=excluded.blockers,next_focus=excluded.next_focus,created_at=excluded.created_at`,
    week,input.wins.trim(),input.blockers.trim(),input.nextFocus.trim(),new Date().toISOString());
}
export async function savePreferences(p:SchedulePreferences):Promise<void>{
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.quietStart)||
     !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.quietEnd)||
     !Number.isInteger(p.dailyMissionLimit)||p.dailyMissionLimit<1||p.dailyMissionLimit>8)
    throw Error('Invalid reminder settings');
  const db=await getDb();
  await db.withExclusiveTransactionAsync(async tx=>{
    for(const [key,value] of Object.entries(p))
      await tx.runAsync('INSERT OR REPLACE INTO preferences(key,value) VALUES(?,?)',key,String(value));
  });
}

export async function unlockSkill(nodeId:string):Promise<void>{
  const node=SKILL_NODES.find(n=>n.id===nodeId);
  if(!node)throw Error('Unknown skill node');
  const core=await loadSnapshot(),p2=await loadPhaseTwoSnapshot();
  if(!canUnlockSkill(node,core.xpEvents,p2.skillUnlocks))
    throw Error('Earn more attribute XP to unlock this skill');
  const db=await getDb();
  await db.runAsync('INSERT OR IGNORE INTO skill_unlocks(node_id,unlocked_at) VALUES(?,?)',
    nodeId,new Date().toISOString());
}
