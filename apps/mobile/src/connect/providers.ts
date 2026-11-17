import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {type ContextCandidate,type ContextSource,validateContextCandidate} from '@ascend/game-engine';
import {updateSourceConfig,readSourceConfig,importContextItems} from '../data/context';
import {healthStatus,readHealthSummary,requestHealthPermissions} from '../../modules/ascend-context';

WebBrowser.maybeCompleteAuthSession();
type GoogleSource='calendar'|'gmail'|'drive';
type GoogleConfig={clientId:string;accessToken:string;refreshToken?:string;expiresAt?:number};
const discovery={
  authorizationEndpoint:'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:'https://oauth2.googleapis.com/token',
  revocationEndpoint:'https://oauth2.googleapis.com/revoke',
};
const scopes:Record<GoogleSource,string[]>={
  calendar:['https://www.googleapis.com/auth/calendar.readonly'],
  gmail:['https://www.googleapis.com/auth/gmail.readonly'],
  drive:['https://www.googleapis.com/auth/drive.metadata.readonly'],
};
const known=(source:ContextSource):source is GoogleSource=>
  source==='calendar'||source==='gmail'||source==='drive';
function checkClientId(clientId:string):string{
  const trimmed=clientId.trim();
  if(!/^[\w.-]{15,170}\.apps\.googleusercontent\.com$/.test(trimmed))
    throw Error('Enter a valid Google OAuth installed-app client ID');
  return trimmed;
}
export async function connectGoogle(source:GoogleSource,clientId:string):Promise<void>{
  const id=checkClientId(clientId);
  const redirectUri=AuthSession.makeRedirectUri({scheme:'ascendrpg',path:'oauth'});
  const request=new AuthSession.AuthRequest({
    clientId:id,redirectUri,responseType:AuthSession.ResponseType.Code,
    scopes:scopes[source],usePKCE:true,
    extraParams:{access_type:'offline',prompt:'consent'}
  });
  await request.makeAuthUrlAsync(discovery);
  const response=await request.promptAsync(discovery);
  if(response.type!=='success'||!response.params.code)throw Error('Google authorization was cancelled or denied');
  if(!request.codeVerifier)throw Error('OAuth PKCE verifier missing');
  const tokens=await AuthSession.exchangeCodeAsync({
    clientId:id,code:response.params.code,redirectUri,
    extraParams:{code_verifier:request.codeVerifier}
  },discovery);
  if(!tokens.accessToken)throw Error('Google did not return an access token');
  await updateSourceConfig(source,{
    clientId:id,accessToken:tokens.accessToken,refreshToken:tokens.refreshToken,
    expiresAt:tokens.expiresIn?Date.now()+tokens.expiresIn*1000:undefined
  });
}
async function googleToken(source:GoogleSource):Promise<string>{
  const config=await readSourceConfig<GoogleConfig>(source);
  if(!config?.accessToken)throw Error('Connect your Google account before syncing '+source);
  if((config.expiresAt??0)>Date.now()+90_000)return config.accessToken;
  if(!config.refreshToken)throw Error('Google authorization expired. Disconnect and reconnect.');
  const refreshed=await AuthSession.refreshAsync({
    clientId:config.clientId,refreshToken:config.refreshToken
  },discovery);
  if(!refreshed.accessToken)throw Error('Google authorization expired');
  await updateSourceConfig(source,{
    ...config,accessToken:refreshed.accessToken,
    refreshToken:refreshed.refreshToken??config.refreshToken,
    expiresAt:refreshed.expiresIn?Date.now()+refreshed.expiresIn*1000:undefined
  });
  return refreshed.accessToken;
}
async function googleGet<T>(source:GoogleSource,url:string):Promise<T>{
  const token=await googleToken(source);
  const res=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  if(res.status===401||res.status===403)throw Error('Google access was denied. Check permissions and reconnect.');
  if(!res.ok)throw Error('Google '+source+' request failed (HTTP '+res.status+')');
  return res.json() as Promise<T>;
}
const short=(s:unknown,max=200)=>typeof s==='string'?s.replace(/[\x00-\x1F]/g,' ').trim().slice(0,max):'';
const now=()=>new Date().toISOString();
const iso=(s:unknown):string|null=>{
  if(typeof s!=='string')return null;
  const date=new Date(s);return Number.isFinite(date.getTime())?date.toISOString():null;
};
export async function syncCalendar():Promise<{added:number;skipped:number}>{
  const from=new Date(Date.now()-7*86400_000).toISOString(),to=new Date(Date.now()+45*86400_000).toISOString();
  const url='https://www.googleapis.com/calendar/v3/calendars/primary/events?'+
    new URLSearchParams({singleEvents:'true',orderBy:'startTime',maxResults:'80',
      timeMin:from,timeMax:to}).toString();
  type Event={id:string;summary?:string;description?:string;htmlLink?:string;
    start?:{dateTime?:string;date?:string}};
  const payload=await googleGet<{items?:Event[]}>('calendar',url);
  const items=(payload.items??[]).filter(e=>!!e.id).map(e=>validateContextCandidate({
    source:'calendar' as const,kind:'event' as const,externalId:e.id,
    title:short(e.summary,140)||'Calendar event',
    excerpt:short(e.description,1400)||'Calendar event. Confirm details in Google Calendar.',
    occurredAt:iso(e.start?.dateTime??e.start?.date),sensitivity:'private' as const,
    originUrl:e.htmlLink?.startsWith('https://')?e.htmlLink:null
  }));
  return importContextItems('calendar',items);
}
export async function syncGmail():Promise<{added:number;skipped:number}>{
  const params=new URLSearchParams({maxResults:'18',q:'newer_than:14d -category:promotions'});
  const list=await googleGet<{messages?:{id:string}[]}>(
    'gmail','https://gmail.googleapis.com/gmail/v1/users/me/messages?'+params.toString());
  const msgs=await Promise.all((list.messages??[]).slice(0,18).map(async item=>{
    type Header={name:string;value:string};
    return googleGet<{id:string;snippet?:string;internalDate?:string;payload?:{headers?:Header[]}}>(
      'gmail','https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(item.id)+
      '?format=metadata&metadataHeaders=Subject&metadataHeaders=Date');
  }));
  const items=msgs.map(x=>{
    const title=x.payload?.headers?.find(h=>h.name.toLowerCase()==='subject')?.value;
    return validateContextCandidate({
      source:'gmail' as const,kind:'message' as const,externalId:x.id,
      title:short(title,140)||'Email (no subject)',
      excerpt:short(x.snippet,800)||'Email metadata (no preview)',
      occurredAt:iso(x.internalDate?new Date(Number(x.internalDate)).toISOString():null),
      sensitivity:'private' as const,originUrl:null
    });
  });
  return importContextItems('gmail',items);
}
export async function syncDrive():Promise<{added:number;skipped:number}>{
  const q=new URLSearchParams({page_size:'50',fields:'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,description)',
    orderBy:'modifiedTime desc',q:'trashed=false'});
  const value=await googleGet<{files?:{id:string;name?:string;description?:string;
    modifiedTime?:string;webViewLink?:string}[]}>(
    'drive','https://www.googleapis.com/drive/v3/files?'+q.toString());
  const items=(value.files??[]).map(f=>validateContextCandidate({
    source:'drive' as const,kind:'document' as const,externalId:f.id,
    title:short(f.name,140)||'Google Drive file',
    excerpt:short(f.description,1200)||'File metadata only; no file contents imported.',
    occurredAt:iso(f.modifiedTime),sensitivity:'private' as const,
    originUrl:f.webViewLink?.startsWith('https://')?f.webViewLink:null
  }));
  return importContextItems('drive',items);
}
export async function connectGitHubToken(token:string):Promise<void>{
  if(!/^github_pat_[\w]{20,}$|^gh[pousr]_[\w]{20,}$/.test(token.trim()))
    throw Error('Enter a valid fine-grained read-only GitHub token');
  // Verify token before persisting it. Never log/store as plain text.
  const r=await fetch('https://api.github.com/user',{headers:{
    Authorization:'Bearer '+token.trim(),Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28'
  }});
  if(!r.ok)throw Error('GitHub token validation failed (HTTP '+r.status+')');
  await updateSourceConfig('github',{token:token.trim()});
}
export async function syncGitHub():Promise<{added:number;skipped:number}>{
  const config=await readSourceConfig<{token:string}>('github');
  if(!config?.token)throw Error('Connect GitHub with a read-only token first');
  const res=await fetch('https://api.github.com/issues?filter=assigned&state=open&per_page=40',{
    headers:{Authorization:'Bearer '+config.token,Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'}});
  if(!res.ok)throw Error('GitHub issues request failed (HTTP '+res.status+')');
  const issues=await res.json() as {id:number;title:string;body?:string;html_url?:string;
    updated_at?:string;repository?:{full_name?:string}}[];
  const items=issues.map(issue=>validateContextCandidate({
    source:'github' as const,kind:'issue' as const,externalId:String(issue.id),
    title:short(issue.title,140)||'GitHub issue',
    excerpt:short(issue.body,1000)||'Issue assigned to you',
    occurredAt:iso(issue.updated_at),sensitivity:'private' as const,
    originUrl:issue.html_url?.startsWith('https://github.com/')?issue.html_url:null
  }));
  return importContextItems('github',items);
}
export {healthStatus,requestHealthPermissions};
export async function syncHealth(days=7):Promise<{added:number;skipped:number}>{
  const status=await healthStatus();
  if(!status.available)throw Error('Health Connect is unavailable on this Android device');
  if(!status.granted.length)throw Error('Grant Health Connect read permissions first');
  const result=await readHealthSummary(days);
  const date=new Date().toISOString().slice(0,10);
  const details=[
    result.steps!==null?`Steps: ${result.steps}`:null,
    result.sleepMinutes!==null?`Recorded sleep: ${result.sleepMinutes} minutes`:null,
    result.exerciseSessions!==null?`Exercise sessions: ${result.exerciseSessions}`:null,
    result.meanHeartRate!==null?`Mean recorded heart rate: ${Math.round(result.meanHeartRate)} bpm`:null
  ].filter(Boolean).join('; ');
  if(!details)throw Error('No authorized health records available yet');
  return importContextItems('health',[validateContextCandidate({
    source:'health',kind:'health_summary',externalId:date+':'+days,
    title:'Personal health summary · '+days+' days',excerpt:details,
    occurredAt:now(),sensitivity:'health',originUrl:null
  })]);
}
export async function revokeGoogle(source:GoogleSource):Promise<void>{
  const config=await readSourceConfig<GoogleConfig>(source);
  if(config?.accessToken){
    // Best-effort token revocation. Local deletion must succeed even while offline.
    try{await fetch(discovery.revocationEndpoint,{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:'token='+encodeURIComponent(config.refreshToken??config.accessToken)
    });}catch{}
  }
}
