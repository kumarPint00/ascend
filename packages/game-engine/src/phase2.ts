import {type Attribute,type Quest,type Completion,type XPEvent,localDayKey,isCompleted,isoWeekKey} from './index';

export type QuestLifecycle='active'|'backlog'|'paused';
export interface QuestControl {
  questId:string;status:QuestLifecycle;priority:1|2|3;weekdays:number[];
  dueOn:string|null;timeOfDay:string|null;snoozedUntil:string|null;
  estimateMinutes:number;reminder:boolean;
}
export interface GoalOutcome {
  goalId:string;target:number;value:number;unit:string;deadline:string|null;
}
export interface QuestDependency {questId:string;requiresQuestId:string}
export interface WeeklyReview {weekKey:string;wins:string;blockers:string;nextFocus:string;createdAt:string}
export interface FocusSession {id:string;questId:string|null;minutes:number;createdAt:string}
export interface BossBattle {id:string;title:string;description:string;goalId:string|null;questId:string|null;wonAt:string|null;createdAt:string}
export interface SchedulePreferences {
  remindersEnabled:boolean;quietStart:string;quietEnd:string;dailyMissionLimit:number;
}
export const DEFAULT_PREFERENCES:SchedulePreferences={
  remindersEnabled:false,quietStart:'22:00',quietEnd:'07:00',dailyMissionLimit:4
};
const validDay=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00'));
export const validTime=(v:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export function defaultQuestControl(q:Pick<Quest,'id'|'repeatRule'>):QuestControl {
  return {questId:q.id,status:q.repeatRule==='once'?'backlog':'active',
    priority:2,weekdays:[],dueOn:null,timeOfDay:null,snoozedUntil:null,
    estimateMinutes:25,reminder:false};
}
export function validateControl(control:QuestControl):QuestControl {
  if(!['active','backlog','paused'].includes(control.status))throw Error('Invalid status');
  if(![1,2,3].includes(control.priority))throw Error('Priority must be 1–3');
  if(!Array.isArray(control.weekdays)||control.weekdays.length>7||
    control.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)||
    new Set(control.weekdays).size!==control.weekdays.length)
    throw Error('Weekdays must be unique 0–6');
  if(control.dueOn!==null&&!validDay(control.dueOn))throw Error('Invalid due date');
  if(control.snoozedUntil!==null&&!validDay(control.snoozedUntil))throw Error('Invalid snooze date');
  if(control.timeOfDay!==null&&!validTime(control.timeOfDay))throw Error('Invalid reminder time');
  if(!Number.isInteger(control.estimateMinutes)||control.estimateMinutes<0||control.estimateMinutes>480)throw Error('Duration must be 0–480 minutes');
  return control;
}
export function isQuietTime(time:string,start:string,end:string):boolean {
  if(!validTime(time)||!validTime(start)||!validTime(end))return false;
  if(start===end)return false;
  return start<end?time>=start&&time<end:time>=start||time<end;
}
export function questDueOn(q:Quest,control:QuestControl,date:Date):boolean {
  if(q.archived||control.status!=='active')return false;
  const key=localDayKey(date);
  if(control.snoozedUntil&&key<control.snoozedUntil)return false;
  if(q.repeatRule==='once')return !control.dueOn||key>=control.dueOn;
  if(control.weekdays.length>0&&!control.weekdays.includes(date.getDay()))return false;
  if(control.dueOn&&key<control.dueOn)return false;
  return true;
}
export function blockedByDependencies(q:Quest,deps:readonly QuestDependency[],completions:readonly Completion[]):boolean {
  return deps.some(d=>d.questId===q.id&&!completions.some(c=>c.questId===d.requiresQuestId));
}
export function introducesCycle(deps:readonly QuestDependency[],edge:QuestDependency):boolean {
  if(edge.questId===edge.requiresQuestId)return true;
  const all=[...deps.filter(x=>x.questId!==edge.questId),edge];
  const walk=(id:string,seen:Set<string>):boolean=>{
    if(id===edge.questId)return true;
    if(seen.has(id))return false;
    seen.add(id);
    return all.filter(x=>x.questId===id).some(x=>walk(x.requiresQuestId,seen));
  };
  return walk(edge.requiresQuestId,new Set());
}
export function activeMissionList(quests:readonly Quest[],controls:Readonly<Record<string,QuestControl>>,
  completions:readonly Completion[],deps:readonly QuestDependency[],date:Date,limit=4):Quest[] {
  const ranked=quests.filter(q=>{
    const c=controls[q.id]??defaultQuestControl(q);
    return questDueOn(q,c,date)&&!isCompleted(q,completions,date)&&!blockedByDependencies(q,deps,completions);
  });
  return ranked.sort((a,b)=>{
    const ca=controls[a.id]??defaultQuestControl(a),cb=controls[b.id]??defaultQuestControl(b);
    const score=(q:Quest,c:QuestControl)=>(4-c.priority)*100+(c.dueOn&&c.dueOn<=localDayKey(date)?70:0)+
      (q.repeatRule==='daily'?40:q.repeatRule==='weekly'?20:10);
    return score(b,cb)-score(a,ca)||a.createdAt.localeCompare(b.createdAt);
  }).slice(0,Math.max(1,Math.min(8,Math.floor(limit))));
}
export function occurrencesForDays(quests:readonly Quest[],controls:Readonly<Record<string,QuestControl>>,
  completions:readonly Completion[],deps:readonly QuestDependency[],start:Date,days=14):
  {date:string;quests:Quest[]}[] {
  return Array.from({length:Math.min(31,Math.max(1,days))},(_,i)=>{
    const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i,12);
    const eligible=quests.filter(q=>questDueOn(q,controls[q.id]??defaultQuestControl(q),date)
      &&!isCompleted(q,completions,date)&&!blockedByDependencies(q,deps,completions));
    return {date:localDayKey(date),quests:eligible};
  });
}
export function skillLevel(xp:number):number{return 1+Math.floor(Math.sqrt(Math.max(0,xp)/75));}
export function derivedSkills(xpEvents:readonly XPEvent[]):Record<Attribute,{xp:number;level:number}> {
  const names:Attribute[]=['strength','intelligence','discipline','finance','relationships','recovery'];
  return Object.fromEntries(names.map(a=>{const xp=xpEvents.filter(e=>e.attribute===a).reduce((n,e)=>n+e.amount,0);
    return [a,{xp,level:skillLevel(xp)}];})) as Record<Attribute,{xp:number;level:number}>;
}
export function derivedAchievements(quests:readonly Quest[],completions:readonly Completion[],
  events:readonly XPEvent[],bosses:readonly BossBattle[]):{id:string;title:string;description:string;unlocked:boolean}[] {
  const uniqueDays=new Set(completions.map(c=>localDayKey(new Date(c.completedAt)))).size;
  const milestones=quests.filter(q=>q.title.startsWith('◆ '));
  const doneSet=new Set(completions.map(c=>c.questId));
  const milestonesWon=milestones.filter(q=>doneSet.has(q.id)).length;
  const totalXP=events.reduce((n,e)=>n+e.amount,0);
  const wins=bosses.filter(b=>!!b.wonAt).length;
  return [
    {id:'awakening',title:'The Awakening',description:'Complete your first quest',unlocked:completions.length>=1},
    {id:'pathfinder',title:'Pathfinder',description:'Complete ten quest instances',unlocked:completions.length>=10},
    {id:'consistency',title:'Steady Momentum',description:'Act on seven distinct days',unlocked:uniqueDays>=7},
    {id:'milestone',title:'Gate Cleared',description:'Complete a major milestone',unlocked:milestonesWon>=1},
    {id:'architect',title:'The Architect',description:'Earn 1,000 lifetime XP',unlocked:totalXP>=1000},
    {id:'boss',title:'Boss Slayer',description:'Win a verified boss battle',unlocked:wins>=1},
  ];
}
export function outcomeProgress(outcome:GoalOutcome|null|undefined):number {
  return outcome&&outcome.target>0?Math.min(1,Math.max(0,outcome.value/outcome.target)):0;
}
export function xpTrend(events:readonly XPEvent[],end:Date,days=7):{day:string;xp:number}[]{
  return Array.from({length:Math.max(1,Math.min(31,days))},(_,i)=>{
    const when=new Date(end.getFullYear(),end.getMonth(),end.getDate()-(days-i-1),12);
    const day=localDayKey(when);
    return {day,xp:events.filter(e=>e.dayKey===day).reduce((n,e)=>n+e.amount,0)};
  });
}
export function focusMinutesForWeek(sessions:readonly FocusSession[],date:Date):number {
  const key=isoWeekKey(date);
  return sessions.filter(s=>isoWeekKey(new Date(s.createdAt))===key).reduce((n,s)=>n+s.minutes,0);
}
