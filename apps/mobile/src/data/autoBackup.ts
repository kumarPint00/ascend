import {Platform} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {autoBackupFilename,autoBackupPruneCandidates} from '@ascend/game-engine';
import {getDb} from './repository';
import {exportFullBackup,parseFullBackup} from './backup';
import {encryptBackup,decryptBackup,hasRecoveryKey} from './backupCrypto';

export interface AutomaticBackupSettings {
  directoryUri:string;enabled:boolean;intervalHours:12|24|72;retention:number;
  lastBackupAt:string|null;lastVerifiedAt:string|null;lastError:string|null;
  recoveryConfirmed:boolean;
}
const defaults:AutomaticBackupSettings={
  directoryUri:'',enabled:false,intervalHours:24,retention:7,
  lastBackupAt:null,lastVerifiedAt:null,lastError:null,recoveryConfirmed:false,
};
type Row={directory_uri:string;enabled:number;interval_hours:number;retention:number;
  last_backup_at:string|null;last_verified_at:string|null;last_error:string|null;recovery_confirmed:number};
export async function readBackupSettings():Promise<AutomaticBackupSettings>{
  const db=await getDb();
  const row=await db.getFirstAsync<Row>('SELECT * FROM backup_settings WHERE id=1');
  return row?{directoryUri:row.directory_uri,enabled:row.enabled===1,
    intervalHours:([12,24,72].includes(row.interval_hours)?row.interval_hours:24) as 12|24|72,
    retention:row.retention,lastBackupAt:row.last_backup_at,lastVerifiedAt:row.last_verified_at,
    lastError:row.last_error,recoveryConfirmed:row.recovery_confirmed===1}:defaults;
}
export async function selectExternalBackupFolder():Promise<AutomaticBackupSettings>{
  if(Platform.OS!=='android')throw Error('Automatic external backups currently require Android');
  const perms=await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if(!perms.granted)throw Error('Choose a folder to enable automatic backups');
  // Validate access to chosen directory before persisting the URI.
  await FileSystem.StorageAccessFramework.readDirectoryAsync(perms.directoryUri);
  const db=await getDb();
  await db.runAsync(`INSERT INTO backup_settings(id,directory_uri,enabled,interval_hours,retention)
    VALUES(1,?,0,24,7) ON CONFLICT(id) DO UPDATE SET directory_uri=excluded.directory_uri,
    enabled=0,last_error=NULL,last_backup_at=NULL,last_verified_at=NULL`,perms.directoryUri);
  return readBackupSettings();
}
export async function configureAutoBackup(options:{enabled:boolean;intervalHours:12|24|72;retention:number}):Promise<void>{
  if(![12,24,72].includes(options.intervalHours)||
    !Number.isInteger(options.retention)||options.retention<2||options.retention>30)
    throw Error('Choose a valid backup interval and retention (2–30)');
  const current=await readBackupSettings();
  if(options.enabled&&!current.directoryUri)
    throw Error('Select an external backup folder first');
  if(options.enabled&&(!current.recoveryConfirmed||!await hasRecoveryKey()))
    throw Error('Save and acknowledge the recovery key before enabling encrypted backups');
  const db=await getDb();
  await db.runAsync('UPDATE backup_settings SET enabled=?,interval_hours=?,retention=? WHERE id=1',
    options.enabled?1:0,options.intervalHours,options.retention);
}
export async function confirmRecoveryKeySaved():Promise<void>{
  if(!await hasRecoveryKey())throw Error('Generate a recovery key first');
  const db=await getDb();
  await db.runAsync('UPDATE backup_settings SET recovery_confirmed=1 WHERE id=1');
}
function safFilename(uri:string):string{
  try{return decodeURIComponent(uri).split('/').pop()??'';}catch{return '';}
}
let pending:Promise<unknown>=Promise.resolve();
export function runAutomaticBackup(force=false):Promise<{saved:boolean;verified:boolean;message:string}> {
  const next=pending.then(()=>runBackupInner(force));
  pending=next.catch(()=>{});
  return next;
}
async function runBackupInner(force:boolean){
  const settings=await readBackupSettings();
  if(!settings.enabled||!settings.directoryUri)
    return {saved:false,verified:false,message:'Automatic external backup is not configured'};
  const now=new Date();
  if(!force&&settings.lastBackupAt&&
     now.getTime()-Date.parse(settings.lastBackupAt)<settings.intervalHours*3600_000)
    return {saved:false,verified:true,message:'Last backup is still within the selected interval'};
  const db=await getDb();
  try{
    if(!settings.recoveryConfirmed||!await hasRecoveryKey())
      throw Error('Save and confirm your recovery key before automatic backups can run');
    // Files outside the app sandbox survive uninstall, and their contents are
    // authenticated AES-256-GCM ciphertext rather than plaintext private data.
    const text=await exportFullBackup();
    parseFullBackup(text);
    const sealed=await encryptBackup(text);
    const name=autoBackupFilename(now).replace(/\.json$/,'');
    const uri=await FileSystem.StorageAccessFramework.createFileAsync(
      settings.directoryUri,name,'application/json');
    await FileSystem.writeAsStringAsync(uri,sealed,{encoding:FileSystem.EncodingType.UTF8});
    const readback=await FileSystem.readAsStringAsync(uri);
    if(readback!==sealed)throw Error('Encrypted backup readback mismatch');
    const decrypted=await decryptBackup(readback);
    if(decrypted!==text)throw Error('Decrypted readback mismatch');
    parseFullBackup(decrypted); // includes referential and format validation
    const files=await FileSystem.StorageAccessFramework.readDirectoryAsync(settings.directoryUri);
    const managed=files.map(uri=>({uri,name:safFilename(uri)}));
    const prune=autoBackupPruneCandidates(managed.map(x=>x.name),settings.retention);
    // Retention deletes *only* confidently recognized ASCEND-AUTO files.
    for(const old of managed.filter(x=>prune.includes(x.name))){
      if(old.uri!==uri)await FileSystem.deleteAsync(old.uri,{idempotent:true});
    }
    await db.runAsync('UPDATE backup_settings SET last_backup_at=?,last_verified_at=?,last_error=NULL WHERE id=1',
      now.toISOString(),now.toISOString());
    return {saved:true,verified:true,message:'AES-256-GCM encrypted backup saved, decrypted and validated'};
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    await db.runAsync('UPDATE backup_settings SET last_error=? WHERE id=1',message.slice(0,350));
    throw Error('Automatic backup failed: '+message);
  }
}
