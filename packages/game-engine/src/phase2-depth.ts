/** Phase 2 depth: offline, deterministic prioritization, meaningful measurement and safe backup retention. */
import {type Quest,type Completion, type Attribute, isCompleted,localDayKey} from './index';
import {type QuestControl,type QuestDependency,defaultQuestControl,questDueOn,blockedByDependencies} from './phase2';

export interface MeasurementPoint {id:string;goalId:string;value:number;unit:string;recordedAt:string;}
export interface MeasurementForecast {
  direction:'increase'|'decrease';current:number;target:number;
  changePerWeek:number;estimatedWeeks:number;estimatedDate:string;sampleCount:number;
  caveat:string;
}
export function metricForecast(
  history:readonly MeasurementPoint[],target:number,now:Date=new Date(),
):MeasurementForecast|null {
  const sorted=history.filter(p=>Number.isFinite(p.value)&&Number.isFinite(Date.parse(p.recordedAt)))
    .slice().sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt));
  if(!Number.isFinite(target)||sorted.length<3)return null;
  const recent=sorted.filter(p=>new Date(p.recordedAt).getTime()>=now.getTime()-90*86400000);
  if(recent.length<3)return null;
  const first=recent[0],last=recent[recent.length-1],span=
    (Date.parse(last.recordedAt)-Date.parse(first.recordedAt))/86400000;
  if(span<7)return null;
  const diff=last.value-first.value;
  const outstanding=target-last.value;
  if(Math.abs(outstanding)<1e-8)return {direction:'increase',current:last.value,target,
    changePerWeek:0,estimatedWeeks:0,estimatedDate:localDayKey(now),sampleCount:recent.length,
    caveat:'Target reached in the latest self-reported measurement'};
  if(diff*outstanding<=0||Math.abs(diff)<1e-8)return null;
  const perWeek=diff/span*7,needed=Math.abs(outstanding/perWeek);
  if(!Number.isFinite(needed)||needed>52||needed<=0)return null;
  const weeks=Math.max(1,Math.ceil(needed));
  const eta=new Date(now.getFullYear(),now.getMonth(),now.getDate()+weeks*7,12);
  return {direction:perWeek>0?'increase':'decrease',current:last.value,target,
    changePerWeek:perWeek,estimatedWeeks:weeks,estimatedDate:localDayKey(eta),
    sampleCount:recent.length,caveat:'Exploratory linear trend from self-reported measurements, not a guarantee'};
}
export function milestoneHistoryStatus(points:readonly MeasurementPoint[],goalId:string) {
  return points.filter(p=>p.goalId===goalId).slice().sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt));
}
export interface SuggestedMission {
  quest:Quest;score:number;reason:string;minutes:number;
}
export function adaptiveMissionRecommendations(
  quests:readonly Quest[],controls:Readonly<Record<string,QuestControl>>,
  completions:readonly Completion[],dependencies:readonly QuestDependency[],
  date:Date,availableMinutes:number,limit=4,
):SuggestedMission[]{
  const today=localDayKey(date),minutes=Math.max(10,Math.min(480,Math.floor(availableMinutes)));
  const lastCompletion=new Map<string,number>();
  const activeByAttr=new Map<Attribute,number>();
  for(const c of completions) {
    const t=Date.parse(c.completedAt);
    if(Number.isFinite(t))lastCompletion.set(c.questId,Math.max(t,lastCompletion.get(c.questId)??0));
  }
  const choices=quests.filter(q=> {
    const c=controls[q.id]??defaultQuestControl(q);
    return questDueOn(q,c,date)&&!isCompleted(q,completions,date)&&
      !blockedByDependencies(q,dependencies,completions);
  }).map(q=>{
    const c=controls[q.id]??defaultQuestControl(q);
    const elapsed=lastCompletion.has(q.id)
      ?(date.getTime()-lastCompletion.get(q.id)!)/86400000:30;
    const priority=(4-c.priority)*38;
    const overdue=c.dueOn?Math.max(0,Math.min(14,
      Math.floor((Date.parse(today+'T00:00:00')-Date.parse(c.dueOn+'T00:00:00'))/86400000))):0;
    const urgency=c.dueOn?(c.dueOn<=today?55+overdue*2:0):0;
    const cadence=q.repeatRule==='daily'?28:q.repeatRule==='weekly'?21:11;
    const freshness=Math.min(24,Math.max(0,elapsed)*2);
    const cost=c.estimateMinutes>minutes?45:0;
    const score=priority+urgency+cadence+freshness-cost;
    const reason=c.dueOn&&c.dueOn<=today?'Target date reached':
      c.priority===1?'High priority':elapsed>=7?'Not completed recently':
      q.repeatRule==='daily'?'Daily habit':'Scheduled work';
    return {quest:q,score,reason,minutes:c.estimateMinutes};
  }).sort((a,b)=>b.score-a.score||a.quest.id.localeCompare(b.quest.id));
  const result:SuggestedMission[]=[];
  let remaining=minutes;
  for(const item of choices){
    if(result.length>=Math.max(1,Math.min(8,limit)))break;
    if(item.minutes>remaining&&result.length>0)continue;
    const repeats=activeByAttr.get(item.quest.attribute)??0;
    if(repeats>=2&&choices.some(x=>x.quest.attribute!==item.quest.attribute&&
      !result.some(y=>y.quest.id===x.quest.id)))continue;
    result.push({...item,reason:item.reason+(item.minutes>remaining?' · may exceed time budget':'')});
    activeByAttr.set(item.quest.attribute,repeats+1);
    remaining=Math.max(0,remaining-item.minutes);
  }
  return result;
}
/** Safe retention policy, only matching ASCEND-managed backup files are candidates. */
export const AUTOMATIC_BACKUP_PREFIX='ASCEND-AUTO-';
export function autoBackupFilename(date:Date):string {
  return AUTOMATIC_BACKUP_PREFIX+date.toISOString().replace(/[:.]/g,'-')+'.json';
}
export function autoBackupPruneCandidates(fileNames:readonly string[],keep:number):string[]{
  const safe=Math.max(2,Math.min(30,Math.floor(keep)));
  const re=/^ASCEND-AUTO-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/;
  const sorted=fileNames.filter(n=>re.test(n)).slice().sort().reverse();
  return sorted.slice(safe);
}
