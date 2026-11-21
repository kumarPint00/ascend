import { ATTRIBUTES, type Attribute, type Difficulty, type RepeatRule } from './index';

/** Do not commit personal pack JSON to this public repository. */
export const MILESTONE_PREFIX = '◆ ';
export type PackEntryKind = 'quest' | 'milestone';
export interface PackGoal {key:string;title:string;attribute:Attribute;targetCount:number;}
export interface PackQuest {
  key:string;goalKey:string|null;goalTitle?:string;title:string;description:string;attribute:Attribute;
  difficulty:Difficulty;repeatRule:RepeatRule;kind:PackEntryKind;dueOn?:string;
}
export interface QuestPack {
  format:'ascend-quest-pack';schemaVersion:1;packId:string;title:string;
  goals:PackGoal[];quests:PackQuest[];
}
const KEY=/^[a-z0-9][a-z0-9-]{0,49}$/;
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
const obj=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
const text=(x:unknown,max:number):x is string=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=max;
const validDate=(x:string)=>{
  if(!ISO_DATE.test(x))return false;
  const date=new Date(`${x}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===x;
};
/** Parse and validate a declarative, size-bounded file before any database changes. */
export function parseQuestPack(source:string):QuestPack {
  if(source.length<2||source.length>100_000)throw new Error('Quest pack must be under 100 KB');
  let raw:unknown;
  try{raw=JSON.parse(source);}catch{throw new Error('Quest pack is not valid JSON');}
  if(!obj(raw)||raw.format!=='ascend-quest-pack'||raw.schemaVersion!==1||
     !text(raw.packId,50)||!KEY.test(raw.packId)||!text(raw.title,100)||
     !Array.isArray(raw.goals)||!Array.isArray(raw.quests)||
     raw.goals.length<1||raw.goals.length>30||raw.quests.length>180)
    throw new Error('Unsupported or invalid ASCEND quest pack');
  const goalKeys=new Set<string>();
  const goals:PackGoal[]=raw.goals.map((g:unknown)=>{
    if(!obj(g)||!text(g.key,50)||!KEY.test(g.key)||!text(g.title,100)||
       !ATTRIBUTES.includes(g.attribute as Attribute)||!Number.isInteger(g.targetCount)||
       Number(g.targetCount)<1||Number(g.targetCount)>10000||goalKeys.has(g.key))
      throw new Error('Invalid or duplicate goal in quest pack');
    goalKeys.add(g.key);
    return {key:g.key,title:g.title.trim(),attribute:g.attribute as Attribute,targetCount:Number(g.targetCount)};
  });
  const questKeys=new Set<string>();
  const quests:PackQuest[]=raw.quests.map((q:unknown)=>{
    if(!obj(q)||!text(q.key,50)||!KEY.test(q.key)||!text(q.goalKey,50)||
       !goalKeys.has(q.goalKey)||!text(q.title,98)||typeof q.description!=='string'||
       q.description.length>370||!ATTRIBUTES.includes(q.attribute as Attribute)||
       !['easy','medium','hard'].includes(String(q.difficulty))||
       !['daily','weekly','monthly','once'].includes(String(q.repeatRule))||
       !['quest','milestone'].includes(String(q.kind))||questKeys.has(q.key)||
       (q.kind==='milestone'&&q.repeatRule!=='once')||
       (q.dueOn!==undefined&&(typeof q.dueOn!=='string'||!validDate(q.dueOn)))||
       (q.kind==='quest'&&q.dueOn!==undefined))
      throw new Error('Invalid or duplicate quest/milestone in pack');
    questKeys.add(q.key);
    return {key:q.key,goalKey:q.goalKey,title:q.title.trim(),description:q.description.trim(),
      attribute:q.attribute as Attribute,difficulty:q.difficulty as Difficulty,
      repeatRule:q.repeatRule as RepeatRule,kind:q.kind as PackEntryKind,
      ...(q.dueOn?{dueOn:q.dueOn as string}:{})};
  });
  return {format:'ascend-quest-pack',schemaVersion:1,packId:raw.packId,title:raw.title.trim(),goals,quests};
}
export function importGoalId(packId:string,key:string){return `pack:${packId}:g:${key}`;}
export function importQuestId(packId:string,key:string){return `pack:${packId}:q:${key}`;}
export function isMilestoneQuest(q:{title:string;repeatRule:RepeatRule}){
  return q.repeatRule==='once'&&q.title.startsWith(MILESTONE_PREFIX);
}
export function importedQuestTitle(q:PackQuest){
  return q.kind==='milestone'?`${MILESTONE_PREFIX}${q.title}`:q.title;
}
export function importedQuestDescription(q:PackQuest){
  return `${q.dueOn?`Target date: ${q.dueOn}. Review status before marking done. `:''}${q.description}`;
}
