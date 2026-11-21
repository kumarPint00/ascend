import {parseRoadmapBlueprint,parseRoadmapWeek,roadmapWeekCount,
  type RoadmapBlueprint,type RoadmapWeek,type RoadmapDuration} from '@ascend/game-engine';
import {getDb} from '../data/repository';
import type {RoadmapRequest} from './roadmap-generator';

/** Never persist API credentials; checkpoints store only the explicitly typed
 * goal and model-drafted curriculum. Quests and XP are not touched.
 */
export function roadmapRequestId(request:RoadmapRequest):string{
  const key=JSON.stringify(request);
  let hash=2166136261;
  for(const char of key)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  return 'draft-'+hash.toString(36);
}
export interface RoadmapCheckpoint{
  id:string;request:RoadmapRequest;blueprint:RoadmapBlueprint|null;weeks:RoadmapWeek[];
}
export async function loadRoadmapCheckpoint(request:RoadmapRequest):Promise<RoadmapCheckpoint>{
  const db=await getDb(),id=roadmapRequestId(request);
  const row=await db.getFirstAsync<{request_json:string;blueprint_json:string|null}>(
    'SELECT request_json,blueprint_json FROM ai_roadmap_sessions WHERE id=?',id);
  let blueprint:RoadmapBlueprint|null=null;
  if(row&&row.request_json===JSON.stringify(request)&&row.blueprint_json){
    blueprint=parseRoadmapBlueprint(row.blueprint_json,request.duration);
  }
  const stages=await db.getAllAsync<{week:number;payload_json:string}>(
    'SELECT week,payload_json FROM ai_roadmap_stages WHERE session_id=? ORDER BY week',id);
  const weeks=blueprint?stages.map(stage=>{
    if(stage.week<1||stage.week>roadmapWeekCount(request.duration))
      throw Error('Invalid saved roadmap stage');
    return parseRoadmapWeek(stage.payload_json,request.duration,stage.week,
      request.dailyMinutes,blueprint!.weeklyThemes[stage.week-1]);
  }):[];
  return {id,request,blueprint,weeks};
}
export async function storeRoadmapBlueprint(request:RoadmapRequest,
  blueprint:RoadmapBlueprint):Promise<void>{
  // Validate round-trip before any persistent write.
  parseRoadmapBlueprint(JSON.stringify(blueprint),request.duration);
  const db=await getDb(),id=roadmapRequestId(request);
  await db.withExclusiveTransactionAsync(async tx=>{
    await tx.runAsync(`INSERT INTO ai_roadmap_sessions(id,request_json,blueprint_json,updated_at)
      VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      request_json=excluded.request_json,blueprint_json=excluded.blueprint_json,
      updated_at=excluded.updated_at`,
      id,JSON.stringify(request),JSON.stringify(blueprint),new Date().toISOString());
  });
}
export async function storeRoadmapWeek(request:RoadmapRequest,blueprint:RoadmapBlueprint,
  week:RoadmapWeek):Promise<void>{
  parseRoadmapWeek(JSON.stringify(week),request.duration,week.week,
    request.dailyMinutes,blueprint.weeklyThemes[week.week-1]);
  const db=await getDb(),id=roadmapRequestId(request);
  await db.runAsync(`INSERT INTO ai_roadmap_stages(session_id,week,payload_json)
    VALUES(?,?,?) ON CONFLICT(session_id,week) DO UPDATE SET
    payload_json=excluded.payload_json`,id,week.week,JSON.stringify(week));
}
export async function clearRoadmapCheckpoint(request:RoadmapRequest):Promise<void>{
  const db=await getDb();
  await db.runAsync('DELETE FROM ai_roadmap_sessions WHERE id=?',roadmapRequestId(request));
}
/** Strict ChatGPT Plus manual transfer. The JSON must match the same
 * curriculum, daily schedule and evidence schema as generated cloud output.
 */
export function parseChatGPTRoadmap(source:string):{
  request:RoadmapRequest;
  blueprint:RoadmapBlueprint;
  weeks:RoadmapWeek[];
}{
  if(source.length>65000)throw Error('Roadmap JSON exceeds 65 KB');
  let value:unknown;
  try{value=JSON.parse(source);}catch{throw Error('Paste a valid JSON object from ChatGPT');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid roadmap object');
  const x=value as Record<string,unknown>;
  if(x.format!=='ascend-ai-roadmap'||x.schemaVersion!==1)
    throw Error('Expected format ascend-ai-roadmap v1');
  const request=x.request as RoadmapRequest;
  if(!request||![30,60,90].includes(request.duration)||
    !Number.isInteger(request.dailyMinutes)||request.dailyMinutes<5||
    request.dailyMinutes>240||!['beginner','intermediate','advanced'].includes(request.startingLevel)||
    typeof request.intent!=='string'||request.intent.length<4||request.intent.length>420||
    typeof request.startDate!=='string')
    throw Error('Invalid roadmap request');
  const blueprint=parseRoadmapBlueprint(JSON.stringify(x.blueprint),request.duration);
  if(!Array.isArray(x.weeks)||x.weeks.length!==roadmapWeekCount(request.duration))
    throw Error('Imported roadmap must contain all weeks');
  const weeks=x.weeks.map((week:unknown,i:number)=>
    parseRoadmapWeek(JSON.stringify(week),request.duration,i+1,request.dailyMinutes,
      blueprint.weeklyThemes[i]));
  return {request,blueprint,weeks};
}
export function exportChatGPTRoadmap(request:RoadmapRequest,blueprint:RoadmapBlueprint,
  weeks:RoadmapWeek[]):string{
  if(weeks.length!==roadmapWeekCount(request.duration))throw Error('Roadmap is incomplete');
  return JSON.stringify({format:'ascend-ai-roadmap',schemaVersion:1,request,blueprint,weeks},null,2);
}
