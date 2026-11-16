import {DEFAULT_ADAPTIVE_SETTINGS,validateAdaptiveSettings,buildAdaptiveProposals,
  type AdaptiveSettings,type AdaptiveDecisionRecord,type AdaptiveProposal,type AdaptationDecision,
  type Quest,type Goal,type Completion,type QuestControl,type FocusSession,MILESTONE_PREFIX
} from '@ascend/game-engine';
import {getDb} from './repository';

export interface AdaptiveState {
  settings:AdaptiveSettings;
  decisions:AdaptiveDecisionRecord[];
  completionModes:{completionId:string;mode:'standard'|'lite'}[];
}
const newId=()=>Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);
function validateDecision(input:AdaptiveDecisionRecord):void{
  if(!input.id||input.id.length>180||
    !['ease','stretch','quest','milestone','goal'].includes(input.kind)||
    !input.sourceId||input.sourceId.length>140||
    !['accepted','dismissed'].includes(input.decision)||
    !Number.isFinite(Date.parse(input.decidedAt)))
    throw Error('Invalid adaptive feedback');
}
export async function loadAdaptiveState():Promise<AdaptiveState>{
  const db=await getDb();
  const [setting,decisions,modes]=await Promise.all([
    db.getFirstAsync<{payload:string}>('SELECT payload FROM adaptive_settings WHERE id=1'),
    db.getAllAsync<{id:string;kind:AdaptiveDecisionRecord['kind'];source_id:string;
      decision:AdaptationDecision;decided_at:string}>(
      'SELECT * FROM adaptive_decisions ORDER BY decided_at DESC LIMIT 2000'),
    db.getAllAsync<{completion_id:string;mode:'lite'|'standard'}>(
      'SELECT completion_id,mode FROM completion_modes LIMIT 100000'),
  ]);
  let parsed:AdaptiveSettings=DEFAULT_ADAPTIVE_SETTINGS;
  if(setting?.payload){
    try{parsed=validateAdaptiveSettings(JSON.parse(setting.payload) as AdaptiveSettings);}
    catch{parsed=DEFAULT_ADAPTIVE_SETTINGS;}
  }
  return {settings:parsed,
    decisions:decisions.map(x=>({id:x.id,kind:x.kind,sourceId:x.source_id,
      decision:x.decision,decidedAt:x.decided_at})),
    completionModes:modes.map(x=>({completionId:x.completion_id,mode:x.mode}))};
}
export async function saveAdaptiveSettings(settings:AdaptiveSettings):Promise<void>{
  const db=await getDb(),safe=validateAdaptiveSettings(settings);
  await db.runAsync('INSERT INTO adaptive_settings(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
    JSON.stringify(safe));
}
export function proposeFromPersonalHistory(input:{
  quests:readonly Quest[];goals:readonly Goal[];
  controls:Readonly<Record<string,QuestControl>>;
  completions:readonly Completion[];
  focusSessions:readonly FocusSession[];
  state:AdaptiveState;now:Date;
}):AdaptiveProposal[]{
  return buildAdaptiveProposals({...input,settings:input.state.settings,
    decisions:input.state.decisions});
}
/**
 * User action only. Entire acceptance is transactional, so a failed write
 * cannot consume a suggestion or leave an unlinked new quest/goal behind.
 */
export async function decideAdaptiveProposal(
  proposal:AdaptiveProposal,decision:AdaptationDecision,
  edited?:{title?:string;minutes?:number;goalTargetCount?:number},now=new Date()
):Promise<void>{
  if(!['accepted','dismissed'].includes(decision)||!Number.isFinite(now.getTime()))
    throw Error('Invalid feedback');
  if(!proposal.id||proposal.id.length>180||!proposal.sourceId||
    !['ease','stretch','quest','milestone','goal'].includes(proposal.kind))
    throw Error('Invalid proposal');
  const title=(edited?.title??proposal.title).trim();
  const minutes=edited?.minutes??proposal.estimateMinutes;
  const goalTargetCount=edited?.goalTargetCount??4;
  if(!title||title.length>100||!Number.isInteger(minutes)||minutes<5||minutes>480||
    !Number.isInteger(goalTargetCount)||goalTargetCount<1||goalTargetCount>10000)
    throw Error('Use a title under 100 characters and effort between 5 and 480 minutes');
  const db=await getDb();
  await db.withExclusiveTransactionAsync(async tx=>{
    const r=await tx.getFirstAsync<{payload:string}>('SELECT payload FROM adaptive_settings WHERE id=1');
    const settings=validateAdaptiveSettings(r?JSON.parse(r.payload):DEFAULT_ADAPTIVE_SETTINGS);
    if(!settings.enabled||(settings.pauseUntil&&settings.pauseUntil>=now.toISOString().slice(0,10)))
      throw Error('Adaptive suggestions are paused');
    const prior=await tx.getFirstAsync<{decision:string;decided_at:string}>(
      'SELECT decision,decided_at FROM adaptive_decisions WHERE id=?',proposal.id);
    if(prior?.decision==='accepted'&&
      !['ease','stretch'].includes(proposal.kind))
      throw Error('Already accepted; no duplicate goal or quest created');
    if(prior&&now.getTime()-Date.parse(prior.decided_at)<21*86400000)
      throw Error('Suggestion is in its cooldown period');
    if(decision==='accepted'){
      const totalToday=await tx.getFirstAsync<{n:number}>(
        "SELECT COUNT(*) AS n FROM adaptive_decisions WHERE decision='accepted' AND decided_at>=?",
        new Date(now.getTime()-86400000).toISOString());
      if((totalToday?.n??0)>=settings.suggestionsPerDay)
        throw Error('Daily acceptance limit reached; try tomorrow');
      if(proposal.kind==='ease'||proposal.kind==='stretch'){
        const quest=await tx.getFirstAsync<{estimate_minutes:number;status:string}>(
          'SELECT estimate_minutes,status FROM quest_state WHERE quest_id=?',proposal.sourceId);
        const valid=await tx.getFirstAsync<{id:string;archived:number;repeat_rule:string}>(
          'SELECT id,archived,repeat_rule FROM quests WHERE id=?',proposal.sourceId);
        if(!quest||!valid||valid.archived||valid.repeat_rule==='once')
          throw Error('Source quest is not eligible for adaptive effort');
        if(proposal.kind==='ease'&&minutes>=quest.estimate_minutes)
          throw Error('Easier option must reduce planned effort');
        if(proposal.kind==='stretch'&&(minutes<=quest.estimate_minutes||
          minutes>Math.ceil(quest.estimate_minutes*1.25)))
          throw Error('Stretch effort must increase by no more than 25%');
        if(proposal.kind==='stretch'){
          const workload=await tx.getFirstAsync<{total:number;missions:number}>(`
            SELECT COALESCE(SUM(s.estimate_minutes),0) total,COUNT(*) missions
            FROM quest_state s JOIN quests q ON q.id=s.quest_id
            WHERE s.status='active' AND q.archived=0`);
          if((workload?.total??0)+minutes-quest.estimate_minutes>settings.dailyBudgetMinutes||
            (workload?.missions??0)>settings.maxDailyMissions)
            throw Error('Stretch exceeds your active workload safety limit');
        }
        await tx.runAsync('UPDATE quest_state SET estimate_minutes=? WHERE quest_id=?',minutes,proposal.sourceId);
      }else{
        const weekly=await tx.getFirstAsync<{n:number}>(`
          SELECT COUNT(*) AS n FROM adaptive_decisions
          WHERE decision='accepted' AND kind IN ('quest','milestone')
          AND decided_at>=?`,new Date(now.getTime()-7*86400000).toISOString());
        const monthly=await tx.getFirstAsync<{n:number}>(`
          SELECT COUNT(*) AS n FROM adaptive_decisions
          WHERE decision='accepted' AND kind='goal'
          AND decided_at>=?`,new Date(now.getTime()-30*86400000).toISOString());
        if(proposal.kind==='goal'&&(monthly?.n??0)>=settings.maxNewGoalsPerMonth)
          throw Error('Monthly new-goal limit reached');
        if(proposal.kind!=='goal'&&(weekly?.n??0)>=settings.maxNewQuestsPerWeek)
          throw Error('Weekly new-quest limit reached');
        if(settings.energy<=2)throw Error('New goals are paused while energy is low');
        if(proposal.kind==='goal'){
          const existing=await tx.getFirstAsync<{id:string}>(
            'SELECT id FROM goals WHERE archived=0 AND attribute=? LIMIT 1',proposal.attribute);
          if(existing)throw Error('A goal for this attribute already exists; review it instead');
          await tx.runAsync('INSERT INTO goals(id,title,attribute,target_count,created_at,archived) VALUES(?,?,?,?,?,0)',
            newId(),title,proposal.attribute,goalTargetCount,now.toISOString());
        }else{
          const duplicate=await tx.getFirstAsync<{id:string}>(
            'SELECT id FROM quests WHERE archived=0 AND lower(title)=lower(?) LIMIT 1',
            proposal.kind==='milestone'?MILESTONE_PREFIX+title:title);
          if(duplicate)throw Error('A quest with that title already exists');
          if(proposal.goalId){
            const goal=await tx.getFirstAsync<{id:string}>('SELECT id FROM goals WHERE id=? AND archived=0',proposal.goalId);
            if(!goal)throw Error('Linked goal is no longer active');
          }
          const id=newId(),isMilestone=proposal.kind==='milestone';
          await tx.runAsync(`INSERT INTO quests
            (id,title,description,attribute,difficulty,repeat_rule,goal_id,created_at,archived)
            VALUES(?,?,?,?,?,?,?,?,0)`,id,
            isMilestone?MILESTONE_PREFIX+title:title,proposal.description.slice(0,500),
            proposal.attribute,isMilestone?'easy':proposal.difficulty,
            isMilestone?'once':proposal.repeatRule,proposal.goalId,now.toISOString());
          // New AI-suggested quests start BACKLOGGED. Only the user may activate them.
          await tx.runAsync(`INSERT INTO quest_state
            (quest_id,status,priority,weekdays,due_on,time_of_day,snoozed_until,estimate_minutes,reminder)
            VALUES(?,'backlog',2,'[]',NULL,NULL,NULL,?,0)`,id,minutes);
        }
      }
    }
    const record:AdaptiveDecisionRecord={id:proposal.id,kind:proposal.kind,
      sourceId:proposal.sourceId,decision,decidedAt:now.toISOString()};
    validateDecision(record);
    await tx.runAsync(`INSERT INTO adaptive_decisions(id,kind,source_id,decision,decided_at)
      VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET decision=excluded.decision,
      decided_at=excluded.decided_at`,record.id,record.kind,record.sourceId,
      record.decision,record.decidedAt);
  });
}
