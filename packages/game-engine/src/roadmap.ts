/** ASCEND Roadmap Architect: deterministic, untrusted-AI-safe roadmap validation.
 * Model generates objectives, never dates, DB writes, XP or permissions.
 */
import {ATTRIBUTES,type Attribute,localDayKey} from './index';
import type {PartialQuestPack} from './partial-pack';
import type {PackGoal,PackQuest} from './quest-pack';

export type RoadmapDuration=30|60|90;
export type RoadmapDay={day:number;title:string;deliverable:string;minutes:number};
export type RoadmapWeek={week:number;theme:string;achievement:string;days:RoadmapDay[]};
export type RoadmapBlueprint={
  title:string;objective:string;attribute:Attribute;weeklyThemes:{week:number;theme:string;achievement:string}[];
  monthlyAchievements:{month:number;title:string;proof:string}[];
};
export type RoadmapPlan={
  title:string;objective:string;attribute:Attribute;intent:string;
  startDate:string;durationDays:RoadmapDuration;dailyMinutes:number;
  weeks:RoadmapWeek[];monthlyAchievements:RoadmapBlueprint['monthlyAchievements'];
};
export type RoadmapSelection={days?:number[];weeks?:number[];months?:number[]};

const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const text=(x:unknown,max=100):x is string=>typeof x==='string'&&x.trim().length>=4&&x.trim().length<=max;
const integer=(x:unknown,min:number,max:number):x is number=>Number.isInteger(x)&&Number(x)>=min&&Number(x)<=max;
const clean=(x:string,max:number)=>x.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
export const ROADMAP_DURATIONS=[30,60,90] as const;
export const roadmapWeekCount=(duration:RoadmapDuration)=>Math.ceil(duration/7);
export const roadmapMonthCount=(duration:RoadmapDuration)=>Math.ceil(duration/30);
export const roadmapDaysForWeek=(duration:RoadmapDuration,week:number)=>{
  if(!integer(week,1,roadmapWeekCount(duration)))throw Error('Invalid roadmap week');
  return Math.min(7,duration-(week-1)*7);
};
export function roadmapDate(startDate:string,day:number):string{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!integer(day,1,366))throw Error('Invalid roadmap date');
  const base=new Date(startDate+'T12:00:00.000Z');
  if(!Number.isFinite(base.getTime())||base.toISOString().slice(0,10)!==startDate)
    throw Error('Invalid roadmap start date');
  base.setUTCDate(base.getUTCDate()+day-1);
  return base.toISOString().slice(0,10);
}
const parse=(raw:string,max:number):Record<string,unknown>=>{
  if(raw.length<2||raw.length>max)throw Error('AI roadmap output is incomplete or too large');
  const src=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const a=src.indexOf('{'),b=src.lastIndexOf('}');
  if(a<0||b<a)throw Error('AI did not return roadmap JSON');
  let value:unknown;
  try{value=JSON.parse(src.slice(a,b+1));}catch{throw Error('AI roadmap JSON is malformed; try again');}
  if(!record(value))throw Error('AI roadmap must be an object');
  return value;
};
export function parseRoadmapBlueprint(raw:string,duration:RoadmapDuration):RoadmapBlueprint{
  const x=parse(raw,12000);
  if(!text(x.title,90)||!text(x.objective,350)||!ATTRIBUTES.includes(x.attribute as Attribute))
    throw Error('Roadmap needs a real title, goal and attribute');
  const wc=roadmapWeekCount(duration),mc=roadmapMonthCount(duration);
  if(!Array.isArray(x.weeklyThemes)||x.weeklyThemes.length!==wc||
      !Array.isArray(x.monthlyAchievements)||x.monthlyAchievements.length!==mc)
    throw Error('Roadmap omitted required weekly or monthly achievements');
  const weeklyThemes=x.weeklyThemes.map((w:unknown,i:number)=>{
    if(!record(w)||w.week!==i+1||!text(w.theme,90)||!text(w.achievement,210))
      throw Error('Roadmap week '+(i+1)+' is missing a measurable achievement');
    return {week:i+1,theme:clean(w.theme,90),achievement:clean(w.achievement,210)};
  });
  const monthlyAchievements=x.monthlyAchievements.map((m:unknown,i:number)=>{
    if(!record(m)||m.month!==i+1||!text(m.title,90)||!text(m.proof,210))
      throw Error('Roadmap month '+(i+1)+' needs a verifiable milestone');
    return {month:i+1,title:clean(m.title,90),proof:clean(m.proof,210)};
  });
  return {title:clean(x.title,90),objective:clean(x.objective,350),
    attribute:x.attribute as Attribute,weeklyThemes,monthlyAchievements};
}
export function parseRoadmapWeek(raw:string,duration:RoadmapDuration,
  week:number,minutesPerDay:number,theme:{theme:string;achievement:string}):RoadmapWeek{
  const x=parse(raw,14000);
  if(x.week!==week||!Array.isArray(x.days)||
    x.days.length!==roadmapDaysForWeek(duration,week))
    throw Error('AI week '+week+' is incomplete: expected every daily achievement');
  const days=x.days.map((d:unknown,i:number)=>{
    const day=(week-1)*7+i+1;
    if(!record(d)||d.day!==day||!text(d.title,85)||!text(d.deliverable,260)||
       !integer(d.minutes,5,Math.min(240,minutesPerDay)))
      throw Error('Roadmap day '+day+' needs a specific achievable result and duration');
    return {day,title:clean(d.title,85),deliverable:clean(d.deliverable,260),minutes:d.minutes};
  });
  if(new Set(days.map(d=>d.title.toLowerCase())).size!==days.length)
    throw Error('Roadmap week '+week+' has duplicated daily tasks');
  return {week,theme:theme.theme,achievement:theme.achievement,days};
}
export function assembleRoadmap(input:Omit<RoadmapPlan,'weeks'>,weeks:RoadmapWeek[]):RoadmapPlan{
  const total=roadmapWeekCount(input.durationDays);
  if(weeks.length!==total||weeks.some((w,i)=>w.week!==i+1||
    w.days.length!==roadmapDaysForWeek(input.durationDays,w.week)))
    throw Error('All roadmap weeks must be generated before approval');
  if(!text(input.intent,420)||!integer(input.dailyMinutes,5,240))
    throw Error('Invalid goal or available time');
  roadmapDate(input.startDate,input.durationDays);
  if(input.monthlyAchievements.length!==roadmapMonthCount(input.durationDays))
    throw Error('Missing monthly milestones');
  return {...input,weeks};
}
/** Stable, idempotent pack. Dated ONCE quests keep the Daily cadence filter
 * honest, while Due Today and Journey can show their actual achievements.
 * Explicit user approval may activate only these dated roadmap items.
 */
export function compileRoadmapPack(plan:RoadmapPlan,selection:RoadmapSelection={}):PartialQuestPack{
  const allDays=plan.weeks.flatMap(w=>w.days);
  if(allDays.length!==plan.durationDays||new Set(allDays.map(d=>d.day)).size!==allDays.length)
    throw Error('Roadmap is missing days');
  const days=new Set(selection.days??allDays.map(d=>d.day));
  const weeks=new Set(selection.weeks??plan.weeks.map(w=>w.week));
  const months=new Set(selection.months??plan.monthlyAchievements.map(m=>m.month));
  const selectedDay=allDays.filter(d=>days.has(d.day));
  const selectedWeek=plan.weeks.filter(w=>weeks.has(w.week));
  const selectedMonth=plan.monthlyAchievements.filter(m=>months.has(m.month));
  if(!selectedDay.length&&!selectedWeek.length&&!selectedMonth.length)
    throw Error('Select at least one achievement');
  // Hash identifies the same goal/start/duration on repeated imports. Never
  // overwrites or reawards XP. The title can be edited without changing IDs.
  let hash=2166136261;
  for(const c of plan.intent.toLowerCase()+'|'+plan.startDate+'|'+plan.durationDays)
    hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  const packId='roadmap-'+hash.toString(36);
  const goal:PackGoal={key:'learning-goal',title:plan.title.slice(0,100),
    attribute:plan.attribute,targetCount:selectedDay.length+selectedWeek.length+selectedMonth.length};
  const quests:PackQuest[]=[];
  for(const d of selectedDay){
    const week=Math.ceil(d.day/7);
    quests.push({key:'day-'+String(d.day).padStart(3,'0'),goalKey:goal.key,
      title:('Day '+d.day+' · '+d.title).slice(0,98),
      description:('Week '+week+' · '+d.minutes+' min. Proof: '+d.deliverable).slice(0,370),
      attribute:plan.attribute,difficulty:'easy',repeatRule:'once',kind:'quest',
      dueOn:roadmapDate(plan.startDate,d.day)});
  }
  for(const w of selectedWeek){
    const last=Math.min(plan.durationDays,w.week*7);
    quests.push({key:'week-'+String(w.week).padStart(2,'0'),goalKey:goal.key,
      title:('Week '+w.week+' · '+w.theme+' checkpoint').slice(0,98),
      description:('Evidence: '+w.achievement).slice(0,370),
      attribute:plan.attribute,difficulty:'medium',repeatRule:'once',kind:'milestone',
      dueOn:roadmapDate(plan.startDate,last)});
  }
  for(const m of selectedMonth){
    const last=Math.min(plan.durationDays,m.month*30);
    quests.push({key:'month-'+String(m.month).padStart(2,'0'),goalKey:goal.key,
      title:('Month '+m.month+' · '+m.title).slice(0,98),
      description:('Evidence: '+m.proof).slice(0,370),
      attribute:plan.attribute,difficulty:'hard',repeatRule:'once',kind:'milestone',
      dueOn:roadmapDate(plan.startDate,last)});
  }
  return {format:'ascend-partial-pack',schemaVersion:1,packId,title:plan.title.slice(0,100),
    goals:[goal],quests};
}
