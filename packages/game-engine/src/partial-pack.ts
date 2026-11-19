import {ATTRIBUTES,type Attribute,type Difficulty,type RepeatRule} from './index';
import {parseQuestPack,type QuestPack,type PackGoal,type PackQuest} from './quest-pack';

/** A lightweight, additive import format. Unspecified categories are empty.
 * Users may create multiple files with the SAME packId to import in stages.
 * Never commit personal packs into the public ASCEND repository.
 */
export interface PartialQuestPack {
  format:'ascend-partial-pack';schemaVersion:1;packId:string;title:string;
  goals:PackGoal[];quests:PackQuest[];
}
export type ImportableQuestPack=QuestPack|PartialQuestPack;
export interface ImportSelection {
  goals:boolean;quests:boolean;milestones:boolean;
}
const id=/^[a-z0-9][a-z0-9-]{0,49}$/;
const asObject=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
const optional=(v:unknown)=>v===null||v===undefined;
const field=(v:unknown,max:number):v is string=>
  typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
const dateOK=(s:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(s+'T00:00:00.000Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
};
const hash=(value:string)=>{
  let state=2166136261;
  for(const c of value)state=Math.imul(state^c.codePointAt(0)!,16777619)>>>0;
  return state.toString(36);
};
const keyFor=(title:string)=>{
  const slug=title.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'').slice(0,37).replace(/-$/,'')||'item';
  return (slug+'-'+hash(title)).slice(0,50);
};
const itemKey=(o:Record<string,unknown>,title:string,label:string):string=>{
  const key=optional(o.key)?keyFor(title):o.key;
  if(!field(key,50)||!id.test(key))
    throw new Error(label+' key must contain lowercase a-z, 0-9 or hyphens');
  return key;
};
const attr=(v:unknown,defaultValue:Attribute):Attribute=>{
  if(optional(v))return defaultValue;
  if(!ATTRIBUTES.includes(v as Attribute))
    throw new Error('Unknown attribute; expected strength, intelligence, discipline, finance, relationships or recovery');
  return v as Attribute;
};
const difficulty=(v:unknown):Difficulty=>{
  if(optional(v))return 'medium';
  if(!['easy','medium','hard'].includes(String(v)))throw new Error('Invalid quest difficulty');
  return v as Difficulty;
};
const recurrence=(v:unknown,kind:'quest'|'milestone'):RepeatRule=>{
  if(optional(v))return 'once'; // Safe default: one-off items start in backlog.
  if(!['once','daily','weekly'].includes(String(v)))throw new Error('Invalid quest repeatRule');
  if(kind==='milestone'&&v!=='once')throw new Error('Milestones must use repeatRule "once"');
  return v as RepeatRule;
};
function parseJson(source:string):unknown {
  if(typeof source!=='string'||source.length<2||source.length>100_000)
    throw new Error('JSON import must be between 2 bytes and 100 KB');
  try{return JSON.parse(source);}catch{throw new Error('Import file is not valid JSON');}
}
export function parsePartialQuestPack(source:string):PartialQuestPack{
  const raw=parseJson(source);
  if(!asObject(raw))throw new Error('JSON root must be an object with goals, quests or milestones arrays');
  if(!optional(raw.format)&&raw.format!=='ascend-partial-pack')
    throw new Error('Use "ascend-partial-pack" format or omit format for partial JSON');
  if(!optional(raw.schemaVersion)&&raw.schemaVersion!==1)
    throw new Error('Unsupported partial JSON schemaVersion');
  const packId=optional(raw.packId)?'personal':raw.packId;
  if(!field(packId,50)||!id.test(packId))
    throw new Error('packId must contain lowercase letters, digits or hyphens (max 50)');
  const title=optional(raw.title)?'Personal partial import':raw.title;
  if(!field(title,100))throw new Error('Import title must contain 1–100 characters');
  for(const fieldName of ['goals','quests','milestones']){
    const value=raw[fieldName];
    if(!optional(value)&&!Array.isArray(value))
      throw new Error(fieldName+' must be an array');
  }
  const rawGoals=(raw.goals??[]) as unknown[];
  const rawQuests=(raw.quests??[]) as unknown[];
  const rawMilestones=(raw.milestones??[]) as unknown[];
  if(rawGoals.length>30||rawQuests.length+rawMilestones.length>180)
    throw new Error('Maximum 30 goals and 180 combined quests/milestones per import');
  if(!rawGoals.length&&!rawQuests.length&&!rawMilestones.length)
    throw new Error('Include at least one goal, quest or milestone');
  const goalKeys=new Set<string>();
  const goals:PackGoal[]=rawGoals.map((item,index)=>{
    if(!asObject(item)||!field(item.title,100))
      throw new Error('Goal '+(index+1)+' needs a title (max 100 characters)');
    const key=itemKey(item,item.title.trim(),'Goal');
    if(goalKeys.has(key))throw new Error('Duplicate goal key: '+key);
    goalKeys.add(key);
    const target=optional(item.targetCount)?10:item.targetCount;
    if(!Number.isInteger(target)||Number(target)<1||Number(target)>10000)
      throw new Error('Goal '+key+' targetCount must be an integer from 1 to 10000');
    return {key,title:item.title.trim(),attribute:attr(item.attribute,'discipline'),targetCount:Number(target)};
  });
  const goalAttributes=new Map(goals.map(goal=>[goal.key,goal.attribute] as const));
  const questKeys=new Set<string>();
  const readQuest=(item:unknown,index:number,arrayKind:'quest'|'milestone'):PackQuest=>{
    if(!asObject(item)||!field(item.title,98))
      throw new Error(arrayKind+' '+(index+1)+' needs a title (max 98 characters)');
    const title=item.title.trim();
    const key=itemKey(item,title,arrayKind);
    if(questKeys.has(key))throw new Error('Duplicate quest or milestone key: '+key);
    questKeys.add(key);
    if(arrayKind==='quest'&&!optional(item.kind)&&!['quest','milestone'].includes(String(item.kind)))
      throw new Error('Invalid kind in quests array');
    if(arrayKind==='milestone'&&!optional(item.kind)&&item.kind!=='milestone')
      throw new Error('milestones array entries must be milestones');
    const kind=item.kind==='milestone'||arrayKind==='milestone'?'milestone':'quest';
    const goalKey=optional(item.goalKey)?null:item.goalKey;
    if(goalKey!==null&&(!field(goalKey,50)||!id.test(goalKey)))
      throw new Error('Invalid goalKey for '+key);
    const goalTitle=optional(item.goalTitle)?undefined:item.goalTitle;
    if(goalTitle!==undefined&&!field(goalTitle,100))
      throw new Error('Invalid goalTitle for '+key);
    if(goalTitle!==undefined&&goalKey!==null)
      throw new Error('Choose either goalKey or goalTitle for '+key);
    const description=optional(item.description)?'':item.description;
    if(typeof description!=='string'||description.length>370)
      throw new Error('Description for '+key+' must be at most 370 characters');
    const dueOn=optional(item.dueOn)?undefined:item.dueOn;
    if(dueOn!==undefined&&(typeof dueOn!=='string'||!dateOK(dueOn)))
      throw new Error('Invalid YYYY-MM-DD dueOn for '+key);
    const repeatRule=recurrence(item.repeatRule,kind);
    return {key,goalKey:goalKey as string|null,...(goalTitle?{goalTitle:goalTitle.trim()}:{}),
      title,description:description.trim(),
      attribute:attr(item.attribute,goalKey?goalAttributes.get(goalKey)??'discipline':'discipline'),
      difficulty:difficulty(item.difficulty),repeatRule,kind,
      ...(dueOn?{dueOn}:{})};
  };
  const quests=[
    ...rawQuests.map((q,i)=>readQuest(q,i,'quest')),
    ...rawMilestones.map((q,i)=>readQuest(q,i,'milestone'))
  ];
  return {format:'ascend-partial-pack',schemaVersion:1,packId,title:title.trim(),goals,quests};
}
/** Keeps legacy strict packs working, while accepting independent partial JSON. */
export function parseImportableQuestPack(source:string):ImportableQuestPack{
  const parsed=parseJson(source);
  if(asObject(parsed)&&parsed.format==='ascend-quest-pack')return parseQuestPack(source);
  return parsePartialQuestPack(source);
}
export function filterImportItems(pack:ImportableQuestPack,selection:ImportSelection):ImportableQuestPack{
  return {...pack,goals:selection.goals?pack.goals:[],
    quests:pack.quests.filter(q=>q.kind==='milestone'?selection.milestones:selection.quests)};
}
