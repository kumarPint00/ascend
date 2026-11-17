/**
 * ASCEND Connect: platform-independent, local-only processing.
 * Untrusted external data is never an instruction to the model/application.
 * No automatic task creation, XP, or sensitive inference.
 */
export type ContextSource='share'|'chatgpt'|'health'|'calendar'|'gmail'|'github'|'drive'|'file';
export type ContextKind='message'|'conversation'|'event'|'health_summary'|'issue'|'document'|'note';
export type ContextSensitivity='general'|'private'|'health'|'financial';
export interface ContextCandidate {
  source:ContextSource;externalId:string;kind:ContextKind;
  title:string;excerpt:string;occurredAt:string|null;
  sensitivity:ContextSensitivity;originUrl:string|null;
}
export interface ChatGPTConversation {
  id:string;title:string;createdAt:string|null;messages:number;preview:string;
}
export interface ContextDraft {
  title:string;description:string;estimatedMinutes:number;
  reason:string;source:ContextSource;externalId:string;
}
export const CONTEXT_SOURCES:readonly ContextSource[]=[
  'share','chatgpt','health','calendar','gmail','github','drive','file'];
export const MAX_CONTEXT_CHARS=3500;
const isRecord=(x:unknown):x is Record<string,unknown>=>
  !!x&&typeof x==='object'&&!Array.isArray(x);
const str=(x:unknown)=>typeof x==='string'?x:'';
const cleaned=(x:string,limit:number)=>x.replace(/[\x00-\x1F\x7F]/g,' ').replace(/\s+/g,' ').trim().slice(0,limit);
const stamp=(x:unknown):string|null=>{
  if(typeof x==='number'&&Number.isFinite(x)){
    const date=new Date(x<1e11?x*1000:x);return Number.isFinite(date.getTime())?date.toISOString():null;
  }
  if(typeof x==='string'&&Number.isFinite(Date.parse(x)))return new Date(x).toISOString();
  return null;
};
export const contextKey=(source:ContextSource,externalId:string)=>
  source+':'+externalId.trim().slice(0,300);
export function validateContextCandidate(v:ContextCandidate):ContextCandidate{
  if(!CONTEXT_SOURCES.includes(v.source)||!['message','conversation','event','health_summary','issue','document','note'].includes(v.kind)
    ||!['general','private','health','financial'].includes(v.sensitivity)
    ||!v.externalId||v.externalId.length>300||!v.title||v.title.length>170
    ||v.excerpt.length>MAX_CONTEXT_CHARS||
    (v.occurredAt!==null&&!Number.isFinite(Date.parse(v.occurredAt)))||
    (v.originUrl!==null&&(!/^https:\/\//.test(v.originUrl)||v.originUrl.length>900)))
    throw Error('Invalid imported context item');
  return {...v};
}
export function fromSharedText(text:string,originId:string):ContextCandidate{
  const excerpt=cleaned(text,MAX_CONTEXT_CHARS);
  if(excerpt.length<3)throw Error('Shared text is empty');
  if(excerpt.length>MAX_CONTEXT_CHARS)throw Error('Shared text is too large');
  return validateContextCandidate({
    source:'share',externalId:originId,kind:'message',
    title:cleaned(excerpt.split(/[.!?\n]/,1)[0],105)||'Shared message',
    excerpt,occurredAt:null,sensitivity:'private',originUrl:null,
  });
}
function userText(parts:unknown):string{
  if(typeof parts==='string')return parts;
  if(!Array.isArray(parts))return '';
  return parts.filter((p):p is string=>typeof p==='string').join(' ');
}
function extractMessages(raw:Record<string,unknown>):string[]{
  const mapping=raw.mapping;
  if(!isRecord(mapping))return [];
  const entries=Object.values(mapping).slice(0,15000);
  const msgs=entries.flatMap(node=>{
    if(!isRecord(node)||!isRecord(node.message))return [];
    const message=node.message,author=message.author;
    if(!isRecord(author)||author.role!=='user'||!isRecord(message.content))return [];
    const content=userText(message.content.parts);
    const clean=cleaned(content,750);
    return clean?[{text:clean,created:typeof message.create_time==='number'?message.create_time:0}]:[];
  });
  return msgs.sort((a,b)=>a.created-b.created).map(x=>x.text).slice(-80);
}
export function parseChatGPTConversations(json:string):ChatGPTConversation[]{
  if(json.length>25_000_000)throw Error('ChatGPT export exceeds 25MB. Extract a smaller conversations.json subset.');
  let value:unknown;
  try{value=JSON.parse(json);}catch{throw Error('ChatGPT conversations.json is invalid');}
  const list=Array.isArray(value)?value:
    isRecord(value)&&Array.isArray(value.conversations)?value.conversations:null;
  if(!list)throw Error('Select the conversations.json file from your ChatGPT export');
  if(list.length>10000)throw Error('Select a smaller ChatGPT export');
  return list.filter(isRecord).map((entry,i)=>{
    const id=cleaned(str(entry.id)||str(entry.conversation_id)||String(i),180);
    const lines=extractMessages(entry);
    return {id,title:cleaned(str(entry.title)||'Untitled conversation',140),
      createdAt:stamp(entry.create_time),messages:lines.length,
      preview:cleaned(lines.slice(-2).join(' · '),350)};
  });
}
export function extractChatGPTSelection(json:string,ids:readonly string[]):ContextCandidate[]{
  if(ids.length>100)throw Error('Select at most 100 conversations per import');
  const wanted=new Set(ids);
  if(wanted.size!==ids.length)throw Error('Duplicate selected conversation');
  if(json.length>25_000_000)throw Error('ChatGPT export exceeds 25MB');
  let value:unknown;try{value=JSON.parse(json);}catch{throw Error('Invalid ChatGPT export');}
  const list=Array.isArray(value)?value:
    isRecord(value)&&Array.isArray(value.conversations)?value.conversations:[];
  const candidates:ContextCandidate[]=[];
  for(const [i,c] of list.entries()){
    if(!isRecord(c))continue;
    const id=cleaned(str(c.id)||str(c.conversation_id)||String(i),180);
    if(!wanted.has(id))continue;
    // User utterances only: never ingest assistant speculation as verified facts.
    const userMessages=extractMessages(c);
    if(!userMessages.length)continue;
    candidates.push(validateContextCandidate({
      source:'chatgpt',externalId:id,kind:'conversation',
      title:cleaned(str(c.title)||'Imported conversation',140),
      excerpt:cleaned(userMessages.slice(-8).join('\n'),MAX_CONTEXT_CHARS),
      occurredAt:stamp(c.create_time),sensitivity:'private',originUrl:null,
    }));
  }
  return candidates;
}
export function inferContextDraft(input:ContextCandidate):ContextDraft|null{
  validateContextCandidate(input);
  if(input.sensitivity==='health')return null; // never infer fitness obligations
  const excerpt=input.excerpt;
  const hasAction=/\b(need to|please|follow up|remind|deadline|due|submit|review|prepare|complete|book|schedule|finish|must|should|todo|action item)\b/i.test(excerpt)||
    /(करना है|करना होगा|याद दिलाना|भेजना है|जमा करना|तैयार करना)/.test(excerpt);
  if(!hasAction)return null;
  const clean=cleaned(input.title,82);
  if(!clean)return null;
  return {source:input.source,externalId:input.externalId,
    title:'Review: '+clean.slice(0,85),
    description:cleaned('Review the source and decide whether action is needed. Context: '+excerpt,480),
    estimatedMinutes:15,reason:'Possible commitment detected in user-selected source. Verify before approving.'};
}
export function deduplicateCandidates(items:readonly ContextCandidate[]):ContextCandidate[]{
  const seen=new Set<string>(),result:ContextCandidate[]=[];
  for(const item of items){
    const v=validateContextCandidate(item),key=contextKey(v.source,v.externalId);
    if(seen.has(key))continue;
    seen.add(key);result.push(v);
  }
  return result;
}
