/**
 * ASCEND Phase 3: deterministic, auditable, opt-in adaptive difficulty.
 * No cloud service, medical inference, arbitrary XP, or automatic goal creation.
 */
import {type Attribute,type Completion,type Difficulty,type Goal,type Quest,
  type RepeatRule,localDayKey,periodKey} from './index';
import {type QuestControl,type FocusSession,defaultQuestControl,questDueOn} from './phase2';

export type AdaptationKind='ease'|'stretch'|'quest'|'milestone'|'goal';
export type AdaptationDecision='accepted'|'dismissed';
export type EnergyLevel=1|2|3|4|5;
export interface AdaptiveSettings {
  enabled:boolean;
  energy:EnergyLevel;
  dailyBudgetMinutes:number;
  maxDailyMissions:number;
  maxNewQuestsPerWeek:number;
  maxNewGoalsPerMonth:number;
  suggestionsPerDay:number;
  pauseUntil:string|null;
}
export const DEFAULT_ADAPTIVE_SETTINGS:AdaptiveSettings={
  enabled:true,energy:3,dailyBudgetMinutes:90,maxDailyMissions:4,
  maxNewQuestsPerWeek:2,maxNewGoalsPerMonth:1,
  suggestionsPerDay:2,pauseUntil:null
};
export interface AdaptiveDecisionRecord {
  id:string;kind:AdaptationKind;sourceId:string;
  decision:AdaptationDecision;decidedAt:string;
}
export interface AdaptiveEvidence {
  periodDays:number;opportunities:number;completed:number;
  ratio:number;basis:'logged-activity'|'user-preference';
}
export interface AdaptiveProposal {
  id:string;kind:AdaptationKind;sourceId:string;
  title:string;description:string;reason:string;
  attribute:Attribute;goalId:string|null;difficulty:Difficulty;
  repeatRule:RepeatRule;estimateMinutes:number;
  status:'backlog'|'active';evidence:AdaptiveEvidence;
}
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const dateOnly=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);
const dayDiff=(a:Date,b:Date)=>Math.floor((a.getTime()-b.getTime())/86400000);
const parse=(s:string)=>Date.parse(s);
export function validateAdaptiveSettings(v:AdaptiveSettings):AdaptiveSettings{
  if(typeof v.enabled!=='boolean'||![1,2,3,4,5].includes(v.energy)||
    !Number.isInteger(v.dailyBudgetMinutes)||v.dailyBudgetMinutes<10||v.dailyBudgetMinutes>480||
    !Number.isInteger(v.maxDailyMissions)||v.maxDailyMissions<1||v.maxDailyMissions>8||
    !Number.isInteger(v.maxNewQuestsPerWeek)||v.maxNewQuestsPerWeek<0||v.maxNewQuestsPerWeek>3||
    !Number.isInteger(v.maxNewGoalsPerMonth)||v.maxNewGoalsPerMonth<0||v.maxNewGoalsPerMonth>2||
    !Number.isInteger(v.suggestionsPerDay)||v.suggestionsPerDay<1||v.suggestionsPerDay>3||
    (v.pauseUntil!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(v.pauseUntil)||
      !Number.isFinite(Date.parse(v.pauseUntil+'T12:00:00')))))
    throw Error('Invalid adaptive safety settings');
  return {...v};
}
export function liteMinutes(estimated:number):number{
  return clamp(Math.round(Math.max(5,estimated*0.4)/5)*5,5,20);
}
export function liteQuestIsAllowed(quest:Quest):boolean{
  // A one-off/boss proof cannot be fulfilled with a different, easier task.
  return !quest.archived&&quest.repeatRule!=='once';
}
export function liteCompletionDifficulty(_:Difficulty):Difficulty {
  // A lighter alternative can never award more than the easiest XP.
  return 'easy';
}
export function countScheduledOpportunities(
  quest:Quest,control:QuestControl,completions:readonly Completion[],
  now:Date,days=14
):AdaptiveEvidence{
  const end=dateOnly(now),keys=new Set<string>();
  const firstCreated=parse(quest.createdAt);
  for(let offset=days-1;offset>=0;offset--){
    const date=new Date(end.getFullYear(),end.getMonth(),end.getDate()-offset,12);
    if(date.getTime()<firstCreated-86400000)continue;
    if(questDueOn(quest,control,date))keys.add(periodKey(quest.repeatRule,date));
  }
  const completed=new Set(completions.filter(c=>c.questId===quest.id&&
    Number.isFinite(parse(c.completedAt))&&parse(c.completedAt)<=end.getTime()+43200000)
    .map(c=>c.periodKey));
  let matched=0;
  for(const key of keys)if(completed.has(key))matched++;
  return {periodDays:days,opportunities:keys.size,completed:matched,
    ratio:keys.size?matched/keys.size:0,basis:'logged-activity'};
}
function recentRecords(
  history:readonly AdaptiveDecisionRecord[],now:Date,days:number,
  predicate:(entry:AdaptiveDecisionRecord)=>boolean
):AdaptiveDecisionRecord[]{
  const cutoff=now.getTime()-days*86400000;
  return history.filter(h=>predicate(h)&&Number.isFinite(parse(h.decidedAt))&&
    parse(h.decidedAt)>cutoff&&parse(h.decidedAt)<=now.getTime());
}
function canSuggest(kind:AdaptationKind,source:string,records:readonly AdaptiveDecisionRecord[],now:Date):boolean{
  const entries=records.filter(r=>r.kind===kind&&r.sourceId===source);
  if(entries.some(x=>x.decision==='accepted'))return false;
  return !recentRecords(entries,now,21,x=>x.decision==='dismissed').length;
}
export function buildAdaptiveProposals(input:{
  quests:readonly Quest[];goals:readonly Goal[];
  controls:Readonly<Record<string,QuestControl>>;
  completions:readonly Completion[];focusSessions:readonly FocusSession[];
  decisions:readonly AdaptiveDecisionRecord[];
  settings:AdaptiveSettings;
  now:Date;
}):AdaptiveProposal[]{
  const {quests,goals,controls,completions,decisions,settings,now}=input;
  validateAdaptiveSettings(settings);
  if(!settings.enabled||!Number.isFinite(now.getTime())||
    (settings.pauseUntil&&settings.pauseUntil>=localDayKey(now)))return [];
  const today=localDayKey(now);
  if(recentRecords(decisions,now,1,x=>x.decision==='accepted').length>=settings.suggestionsPerDay)
    return [];
  const currentWeekStart=new Date(dateOnly(now).getTime()-6*86400000);
  const createdThisWeek=recentRecords(decisions,now,7,x=>x.decision==='accepted'&&
    (x.kind==='quest'||x.kind==='milestone')).length;
  const createdGoals=recentRecords(decisions,now,30,x=>x.decision==='accepted'&&x.kind==='goal').length;
  const committed=quests.filter(q=>!q.archived&&(controls[q.id]??defaultQuestControl(q)).status==='active');
  const dueNow=committed.filter(q=>questDueOn(q,controls[q.id]??defaultQuestControl(q),now));
  const plannedMinutes=dueNow.reduce((n,q)=>n+(controls[q.id]??defaultQuestControl(q)).estimateMinutes,0);
  const overloaded=dueNow.length>=settings.maxDailyMissions||
    plannedMinutes>=settings.dailyBudgetMinutes;
  const proposals:AdaptiveProposal[]=[];
  const add=(p:AdaptiveProposal)=>{if(canSuggest(p.kind,p.sourceId,decisions,now))proposals.push(p);};
  // The engine treats an absence of logs as "not recorded", not failure or laziness.
  for(const q of committed){
    if(q.repeatRule==='once')continue;
    const c=controls[q.id]??defaultQuestControl(q);
    const evidence=countScheduledOpportunities(q,c,completions,now,14);
    if(evidence.opportunities<5)continue;
    if(evidence.ratio<=0.45||settings.energy<=2){
      if(c.estimateMinutes<=5)continue;
      const mins=liteMinutes(c.estimateMinutes);
      add({id:'ease:'+q.id,kind:'ease',sourceId:q.id,
        title:'Make '+q.title+' easier',
        description:'Try a '+mins+'-minute version instead of '+c.estimateMinutes+' minutes.',
        reason:settings.energy<=2?'You reported low energy. Rest and smaller steps are valid.':
          'The last two weeks show fewer recorded completions than planned; this may simply reflect missing logs.',
        attribute:q.attribute,goalId:q.goalId,difficulty:'easy',repeatRule:q.repeatRule,
        estimateMinutes:mins,status:'active',evidence});
    }else if(evidence.opportunities>=8&&evidence.ratio>=0.85&&
      settings.energy>=4&&!overloaded){
      const mins=Math.min(120,Math.ceil(c.estimateMinutes*1.15/5)*5);
      if(mins>c.estimateMinutes)
        add({id:'stretch:'+q.id,kind:'stretch',sourceId:q.id,
          title:'Optional stretch for '+q.title,
          description:'Increase planned effort slightly to '+mins+' minutes.',
          reason:'Strong recorded consistency and sufficient schedule capacity. No automatic change.',
          attribute:q.attribute,goalId:q.goalId,difficulty:q.difficulty,repeatRule:q.repeatRule,
          estimateMinutes:mins,status:'active',evidence});
    }
  }
  const allowCreation=!overloaded&&settings.energy>=3&&
    createdThisWeek<settings.maxNewQuestsPerWeek;
  if(allowCreation){
    // A meaningful habit can create a draft supporting quest, never a duplicate
    // that receives XP automatically.
    const eligible=committed.filter(q=>q.repeatRule==='daily');
    for(const q of eligible){
      const c=controls[q.id]??defaultQuestControl(q);
      const ev=countScheduledOpportunities(q,c,completions,now,21);
      if(ev.opportunities<10||ev.completed<8||ev.ratio<0.7)continue;
      const source='quest:'+q.id;
      const title='Reflect on '+q.title;
      if(quests.some(x=>!x.archived&&x.title.toLowerCase()===title.toLowerCase()))continue;
      add({id:source,kind:'quest',sourceId:q.id,title,
        description:'Write one thing that worked and one thing to improve. Optional weekly reflection.',
        reason:'You have a recorded pattern worth reflecting on. This is an optional draft.',
        attribute:q.attribute,goalId:q.goalId,difficulty:'easy',repeatRule:'weekly',
        estimateMinutes:10,status:'backlog',evidence:ev});
      break; // One new quest suggestion at most per evaluation.
    }
    for(const goal of goals.filter(g=>!g.archived)){
      const linked=quests.filter(q=>q.goalId===goal.id&&!q.archived);
      const activity=completions.filter(c=>linked.some(q=>q.id===c.questId)&&
        parse(c.completedAt)>now.getTime()-28*86400000).length;
      if(activity<5||linked.some(q=>q.repeatRule==='once'&&!q.archived))continue;
      const source='milestone:'+goal.id;
      const title='Review progress: '+goal.title;
      if(quests.some(q=>q.title.toLowerCase()===title.toLowerCase()))continue;
      add({id:source,kind:'milestone',sourceId:goal.id,title,
        description:'Review your measured progress and decide the next practical step.',
        reason:'Linked work has progressed, but there is no active milestone for review.',
        attribute:goal.attribute,goalId:goal.id,difficulty:'easy',repeatRule:'once',
        estimateMinutes:20,status:'backlog',
        evidence:{periodDays:28,opportunities:activity,completed:activity,ratio:1,basis:'logged-activity'}});
      break;
    }
  }
  // Creating a new goal is deliberately rarer than suggesting adjustments.
  if(!overloaded&&settings.energy>=4&&createdGoals<settings.maxNewGoalsPerMonth){
    for(const attr of ['strength','intelligence','discipline','finance','relationships','recovery'] as Attribute[]){
      if(goals.some(g=>!g.archived&&g.attribute===attr))continue;
      const activity=completions.filter(c=>quests.some(q=>q.id===c.questId&&q.attribute===attr)&&
        parse(c.completedAt)>now.getTime()-28*86400000).length;
      if(activity<12)continue;
      const title='Build consistency in '+attr;
      add({id:'goal:'+attr,kind:'goal',sourceId:attr,title,
        description:'Draft goal based on repeated logged activity. Choose your own target before accepting.',
        reason:'Consistent activity without an existing active goal in this area. Requires your explicit approval.',
        attribute:attr,goalId:null,difficulty:'easy',repeatRule:'once',
        estimateMinutes:15,status:'backlog',
        evidence:{periodDays:28,opportunities:activity,completed:activity,ratio:1,basis:'logged-activity'}});
      break;
    }
  }
  // Safety: easing can still be offered when overloaded, creation/stretch cannot.
  const weighted:Record<AdaptationKind,number>={ease:0,stretch:1,quest:2,milestone:3,goal:4};
  return proposals.sort((a,b)=>weighted[a.kind]-weighted[b.kind]||
    a.sourceId.localeCompare(b.sourceId))
    .slice(0,Math.min(3,settings.suggestionsPerDay));
}
