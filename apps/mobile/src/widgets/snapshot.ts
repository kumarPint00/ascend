import {
  activeMissionList,defaultQuestControl,derivePlayer,localDayKey
} from '@ascend/game-engine';
import type {Snapshot} from '../data/repository';
import type {PhaseTwoSnapshot} from '../data/phase2';

export interface WidgetCard {
  primary:string;secondary:string;tertiary:string;progress:number;
}
export interface WidgetProjection {
  schema:1;day:string;enabled:boolean;
  daily:WidgetCard;hunter:WidgetCard;planner:WidgetCard;progress:WidgetCard;
}
const safeText=(value:string)=>value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,85);
const ratio=(x:number,total:number)=>total<=0?0:Math.max(0,Math.min(100,Math.round(x/total*100)));

/** Only four small presentation cards leave the JS realm. Nothing is awarded,
 * inferred from external content or written into the quests database here.
 * Title visibility is opt-in. Never serialize health, contacts or full descriptions.
 */
export function buildWidgetProjection(
  data:Snapshot,phase:PhaseTwoSnapshot,now:Date,
  enabled:boolean,showTitles:boolean
):WidgetProjection{
  const day=localDayKey(now);
  // Pausing widgets immediately replaces all persisted presentation text.
  if(!enabled){
    const blank:WidgetCard={primary:'Widgets paused',secondary:'Open ASCEND to enable',
      tertiary:'',progress:0};
    return {schema:1,day,enabled:false,daily:blank,hunter:blank,planner:blank,progress:blank};
  }
  const player=derivePlayer(data.xpEvents);
  const visible=data.quests.filter(q=>!q.archived);
  const due=activeMissionList(visible,phase.controls,data.completions,
    phase.dependencies,now,phase.preferences.dailyMissionLimit);
  const finishedToday=data.completions.filter(c=>
    localDayKey(new Date(c.completedAt))===day).length;
  const dayXP=data.xpEvents.filter(e=>e.dayKey===day).reduce((a,e)=>a+e.amount,0);
  const remaining=due.length;
  const denominator=finishedToday+remaining;
  const donePercent=ratio(finishedToday,denominator);
  const next=due[0];
  const schedule=due.map(q=>phase.controls[q.id]?.timeOfDay).filter(
    (time):time is string=>typeof time==='string'&&time.length===5
  ).sort()[0]??null;
  const nextEstimated=next?phase.controls[next.id]?.estimateMinutes??
    defaultQuestControl(next).estimateMinutes:0;
  const nextRank=player.xpForNextLevel-player.currentLevelXP;
  const activeGoals=data.goals.filter(g=>!g.archived).length;
  return {
    schema:1,day,enabled,
    daily:{
      primary:finishedToday+' / '+denominator+' cleared',
      secondary:showTitles&&next?safeText(next.title):
        (remaining===0?'No available missions':remaining+' missions remaining'),
      tertiary:'+'+dayXP+' XP today · Tap to review',
      progress:donePercent
    },
    hunter:{
      primary:'Rank '+player.rank+' · Lv '+player.level,
      secondary:player.totalXP+' lifetime XP',
      tertiary:nextRank+' XP to next level',
      progress:ratio(player.currentLevelXP,player.xpForNextLevel)
    },
    planner:{
      primary:schedule?'Scheduled '+schedule:next?'Ready to focus':'All clear',
      secondary:showTitles&&next?safeText(next.title):
        next?remaining+' available missions':'Open your daily plan',
      tertiary:next?nextEstimated+' min estimated · Open Planner':'Tap to plan tomorrow',
      progress:donePercent
    },
    progress:{
      primary:finishedToday+' cleared today',
      secondary:dayXP+' XP today',
      tertiary:activeGoals+' active goals · '+remaining+' available missions',
      progress:donePercent
    }
  };
}
