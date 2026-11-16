import {Platform} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {autoBackupFilename,autoBackupPruneCandidates} from '@ascend/game-engine';
import {getDb} from './repository';
import {exportFullBackup,parseFullBackup} from './backup';

export interface AutomaticBackupSettings {
  directoryUri:string;enabled:boolean;intervalHours:12|24|72;retention:number;
  lastBackupAt:string|null;lastVerifiedAt:string|null;lastError:string|null;
  /** Exact document URIs ASCEND created; never prune other files by name alone. */
  managedFiles:string[];
}
const defaults:AutomaticBackupSettings={
  directoryUri:'',enabled:false,intervalHours:24,retention:7,
  lastBackupAt:null,lastVerifiedAt:null,lastError:null,managedFiles:[],
};
type Row={directory_uri:string;enabled:number;interval_hours:number;retention:number;
  last_backup_at:string|null;last_verified_at:string|null;last_error:string|null;
  managed_files:string};
function savedUris(source:string):string[]{
  try{
    const parsed:unknown=JSON.parse(source);
    return Array.isArray(parsed)?parsed.filter((v):v is string=>
      typeof v==='string'&&v.startsWith('content://')&&v.length<2048).slice(-200):[];
  }catch{return [];}
}
export async function readBackupSettings():Promise<AutomaticBackupSettings>{
  const db=await getDb();
  const row=await db.getFirstAsync<Row>('SELECT * FROM backup_settings WHERE id=1');
  return row?{directoryUri:row.directory_uri,enabled:row.enabled===1,
    intervalHours:([12,24,72].includes(row.interval_hours)?row.interval_hours:24) as 12|24|72,
    retention:row.retention,lastBackupAt:row.last_backup_at,lastVerifiedAt:row.last_verified_at,
    lastError:row.last_error,managedFiles:savedUris(row.managed_files??'[]')}:defaults;
}
export async function selectExternalBackupFolder():Promise<AutomaticBackupSettings>{
  if(Platform.OS!=='android')throw Error('Automatic external backups require Android');
  const perms=await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if(!perms.granted)throw Error('Choose a folder to enable automatic backups');
  await FileSystem.StorageAccessFramework.readDirectoryAsync(perms.directoryUri);
  const db=await getDb();
  // The new folder is an independent ownership scope. Do not mark any file
  // there as deletable until this app creates and validates it.
  await db.runAsync(`INSERT INTO backup_settings
    (id,directory_uri,enabled,interval_hours,retention,managed_files)
    VALUES(1,?,1,24,7,'[]') ON CONFLICT(id) DO UPDATE SET
    directory_uri=excluded.directory_uri,managed_files='[]',
    enabled=1,last_backup_at=NULL,last_verified_at=NULL,last_error=NULL`,perms.directoryUri);
  return readBackupSettings();
}
export async function configureAutoBackup(options:{
  enabled:boolean;intervalHours:12|24|72;retention:number
}):Promise<void>{
  if(![12,24,72].includes(options.intervalHours)||
    !Number.isInteger(options.retention)||options.retention<2||options.retention>30)
    throw Error('Choose an interval and retention between 2 and 30');
  const current=await readBackupSettings();
  if(options.enabled&&!current.directoryUri)
    throw Error('Select an external backup folder first');
  const db=await getDb();
  await db.runAsync('UPDATE backup_settings SET enabled=?,interval_hours=?,retention=? WHERE id=1',
    options.enabled?1:0,options.intervalHours,options.retention);
}
function safFilename(uri:string):string{
  try{return decodeURIComponent(uri).split('/').pop()??'';}catch{return '';}
}
function uriEqual(a:string,b:string):boolean{
  if(a===b)return true;
  try{return decodeURIComponent(a)===decodeURIComponent(b);}catch{return false;}
}
let pending:Promise<unknown>=Promise.resolve();
export function runAutomaticBackup(force=false):Promise<{saved:boolean;verified:boolean;message:string}>{
  const next=pending.then(()=>runBackupInner(force));
  pending=next.catch(()=>{});
  return next;
}
async function runBackupInner(force:boolean){
  const settings=await readBackupSettings();
  if(!settings.enabled||!settings.directoryUri)
    return {saved:false,verified:false,message:'Automatic external backup is not enabled'};
  const now=new Date();
  if(!force&&settings.lastBackupAt&&
     now.getTime()-Date.parse(settings.lastBackupAt)<settings.intervalHours*3600_000)
    return {saved:false,verified:true,message:'Last verified backup is still within the interval'};
  const db=await getDb();
  try{
    const text=await exportFullBackup();
    parseFullBackup(text);
    const name=autoBackupFilename(now).replace(/\.json$/,'');
    const uri=await FileSystem.StorageAccessFramework.createFileAsync(
      settings.directoryUri,name,'application/json');
    await FileSystem.writeAsStringAsync(uri,text,{encoding:FileSystem.EncodingType.UTF8});
    const readback=await FileSystem.readAsStringAsync(uri);
    if(readback!==text)throw Error('External backup readback mismatch');
    parseFullBackup(readback);
    // Persist newly created document ownership *before* pruning older copies.
    const registered=[...settings.managedFiles,uri].slice(-200);
    await db.runAsync(`UPDATE backup_settings SET
      managed_files=?,last_backup_at=?,last_verified_at=?,last_error=NULL WHERE id=1`,
      JSON.stringify(registered),now.toISOString(),now.toISOString());
    let retentionIssue:string|null=null;
    try{
      const files=await FileSystem.StorageAccessFramework.readDirectoryAsync(settings.directoryUri);
      const managed=files.map(fileUri=>({uri:fileUri,name:safFilename(fileUri)}))
        .filter(file=>registered.some(owned=>uriEqual(owned,file.uri)));
      const pruned=autoBackupPruneCandidates(managed.map(x=>x.name),settings.retention);
      const toDelete=managed.filter(x=>pruned.includes(x.name)&&!uriEqual(x.uri,uri));
      for(const old of toDelete){
        await FileSystem.deleteAsync(old.uri,{idempotent:true});
      }
      const remaining=registered.filter(u=>!toDelete.some(x=>uriEqual(u,x.uri)));
      await db.runAsync('UPDATE backup_settings SET managed_files=? WHERE id=1',JSON.stringify(remaining));
    }catch(error){
      // A failed retention cleanup cannot invalidate a verified backup.
      retentionIssue=error instanceof Error?error.message:String(error);
      await db.runAsync('UPDATE backup_settings SET last_error=? WHERE id=1',
        ('Old-file cleanup deferred: '+retentionIssue).slice(0,350));
    }
    return {saved:true,verified:true,
      message:retentionIssue?'Backup verified; old-file cleanup will be retried':
        'External backup saved, reread and validated'};
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    await db.runAsync('UPDATE backup_settings SET last_error=? WHERE id=1',message.slice(0,350));
    throw Error('Automatic backup failed: '+message);
  }
}
