import {CONTEXT_SOURCES,deduplicateCandidates,inferContextDraft,validateContextCandidate,
  type ContextCandidate,type ContextSource,type ContextDraft} from '@ascend/game-engine';
import {getDb} from './repository';
import {encryptContext,decryptContext,protectContextExport,unprotectContextExport} from '../../modules/ascend-context';

const id=()=>Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,13);
type SourceRow={source:ContextSource;enabled:number;granted_at:string|null;
  last_synced_at:string|null;retention_days:number;config_cipher:string|null};
type ItemRow={id:string;source:ContextSource;external_id:string;kind:ContextCandidate['kind'];
  title_cipher:string;excerpt_cipher:string;occurred_at:string|null;
  origin_cipher:string|null;sensitivity:ContextCandidate['sensitivity'];imported_at:string};
type DecisionRow={source:ContextSource;external_id:string;decision:'accepted'|'dismissed'};
export type SourceState={source:ContextSource;enabled:boolean;grantedAt:string|null;
  lastSyncedAt:string|null;retentionDays:number;count:number};
export type ContextItem=ContextCandidate&{id:string;importedAt:string;
  decision:'accepted'|'dismissed'|null;draft:ContextDraft|null};
const has=(source:ContextSource)=>CONTEXT_SOURCES.includes(source);
export async function listConnectedSources():Promise<SourceState[]>{
  const db=await getDb();
  const rows=await db.getAllAsync<SourceRow&{count:number}>(`
    SELECT s.*, (SELECT COUNT(*) FROM context_items c WHERE c.source=s.source) AS count
    FROM connected_sources s`);
  return CONTEXT_SOURCES.map(source=>{
    const r=rows.find(row=>row.source===source);
    return {source,enabled:r?.enabled===1,grantedAt:r?.granted_at??null,
      lastSyncedAt:r?.last_synced_at??null,retentionDays:r?.retention_days??30,
      count:r?.count??0};
  });
}
export async function setContextSourceEnabled(source:ContextSource,enabled:boolean):Promise<void>{
  if(!has(source))throw Error('Unknown source');
  const db=await getDb(),now=new Date().toISOString();
  await db.withExclusiveTransactionAsync(async tx=>{
    await tx.runAsync(`INSERT INTO connected_sources
      (source,enabled,granted_at,retention_days) VALUES(?,?,?,?)
      ON CONFLICT(source) DO UPDATE SET enabled=excluded.enabled,
      granted_at=CASE WHEN excluded.enabled=1 THEN excluded.granted_at ELSE NULL END`,
      source,enabled?1:0,enabled?now:null,source==='health'?14:90);
    await tx.runAsync('INSERT INTO context_audit(id,source,event,count,occurred_at) VALUES(?,?,?,?,?)',
      id(),source,enabled?'grant':'pause',0,now);
  });
}
export async function setContextRetention(source:ContextSource,days:7|14|30|90|180):Promise<void>{
  if(!has(source)||![7,14,30,90,180].includes(days))throw Error('Invalid retention policy');
  const db=await getDb();
  await db.runAsync('UPDATE connected_sources SET retention_days=? WHERE source=?',days,source);
}
async function requirePermission(source:ContextSource):Promise<void>{
  const db=await getDb();
  const row=await db.getFirstAsync<{enabled:number}>('SELECT enabled FROM connected_sources WHERE source=?',source);
  if(row?.enabled!==1)throw Error('Enable '+source+' in Connections before importing');
}
export async function updateSourceConfig(source:ContextSource,config:Record<string,unknown>):Promise<void>{
  await requirePermission(source);
  const value=JSON.stringify(config);
  if(value.length>9000)throw Error('Connector configuration is too large');
  const encrypted=await encryptContext(value);
  const db=await getDb();await db.runAsync('UPDATE connected_sources SET config_cipher=? WHERE source=? AND enabled=1',
    encrypted,source);
}
export async function readSourceConfig<T extends Record<string,unknown>>(source:ContextSource):Promise<T|null>{
  await requirePermission(source);
  const db=await getDb();
  const row=await db.getFirstAsync<{config_cipher:string|null}>(
    'SELECT config_cipher FROM connected_sources WHERE source=? AND enabled=1',source);
  if(!row?.config_cipher)return null;
  return JSON.parse(await decryptContext(row.config_cipher)) as T;
}
export async function importContextItems(source:ContextSource,items:readonly ContextCandidate[],
  bypassConsent=false):Promise<{added:number;skipped:number}>{
  if(!bypassConsent)await requirePermission(source);
  if(items.length>150)throw Error('Import no more than 150 records per batch');
  const filtered=deduplicateCandidates(items);
  if(filtered.some(x=>x.source!==source))throw Error('Import source mismatch');
  const encrypted=await Promise.all(filtered.map(async v=>({
    v,title:await encryptContext(v.title),
    excerpt:await encryptContext(v.excerpt),
    origin:v.originUrl?await encryptContext(v.originUrl):null,
  })));
  const db=await getDb(),now=new Date().toISOString();
  let added=0;
  await db.withExclusiveTransactionAsync(async tx=>{
    // Recheck permission INSIDE the transaction to prevent races with revocation.
    if(!bypassConsent){
      const sourceRow=await tx.getFirstAsync<{enabled:number}>(
        'SELECT enabled FROM connected_sources WHERE source=?',source);
      if(sourceRow?.enabled!==1)throw Error('Connection permission was revoked');
    }else{
      await tx.runAsync(`INSERT OR IGNORE INTO connected_sources
        (source,enabled,retention_days) VALUES(?,0,90)`,source);
    }
    for(const {v,title,excerpt,origin} of encrypted){
      const result=await tx.runAsync(`INSERT OR IGNORE INTO context_items
        (id,source,external_id,kind,title_cipher,excerpt_cipher,occurred_at,
          origin_cipher,sensitivity,imported_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
        id(),v.source,v.externalId,v.kind,title,excerpt,v.occurredAt,origin,
        v.sensitivity,now);
      added+=result.changes;
    }
    await tx.runAsync('UPDATE connected_sources SET last_synced_at=? WHERE source=?',now,source);
    await tx.runAsync('INSERT INTO context_audit(id,source,event,count,occurred_at) VALUES(?,?,?,?,?)',
      id(),source,'import',added,now);
  });
  return {added,skipped:filtered.length-added};
}
export async function listContextItems(source?:ContextSource,limit=65):Promise<ContextItem[]>{
  const db=await getDb();
  if(!Number.isInteger(limit)||limit<1||limit>150)throw Error('Invalid item limit');
  const rows=source?await db.getAllAsync<ItemRow>(`
    SELECT * FROM context_items WHERE source=? ORDER BY imported_at DESC LIMIT ?`,source,limit)
    :await db.getAllAsync<ItemRow>('SELECT * FROM context_items ORDER BY imported_at DESC LIMIT ?',limit);
  const decisions=await db.getAllAsync<DecisionRow>('SELECT source,external_id,decision FROM context_decisions');
  return Promise.all(rows.map(async x=>{
    const title=await decryptContext(x.title_cipher);
    const excerpt=await decryptContext(x.excerpt_cipher);
    const originUrl=x.origin_cipher?await decryptContext(x.origin_cipher):null;
    const normalized=validateContextCandidate({
      source:x.source,externalId:x.external_id,kind:x.kind,title,excerpt,
      occurredAt:x.occurred_at,originUrl,sensitivity:x.sensitivity
    });
    return {...normalized,id:x.id,importedAt:x.imported_at,
      decision:decisions.find(d=>d.source===x.source&&d.external_id===x.external_id)?.decision??null,
      draft:inferContextDraft(normalized)};
  }));
}
export async function recordContextDecision(source:ContextSource,externalId:string,
  decision:'accepted'|'dismissed'):Promise<void>{
  const db=await getDb();
  await db.runAsync(`INSERT INTO context_decisions(id,source,external_id,decision,decided_at)
    VALUES(?,?,?,?,?) ON CONFLICT(source,external_id)
    DO UPDATE SET decision=excluded.decision,decided_at=excluded.decided_at`,
    id(),source,externalId,decision,new Date().toISOString());
}
export async function deleteContextItem(itemId:string):Promise<void>{
  const db=await getDb();
  await db.withExclusiveTransactionAsync(async tx=>{
    const row=await tx.getFirstAsync<{source:string;external_id:string}>(
      'SELECT source,external_id FROM context_items WHERE id=?',itemId);
    if(!row)return;
    await tx.runAsync('DELETE FROM context_decisions WHERE source=? AND external_id=?',
      row.source,row.external_id);
    await tx.runAsync('DELETE FROM context_items WHERE id=?',itemId);
    await tx.runAsync('INSERT INTO context_audit(id,source,event,count,occurred_at) VALUES(?,?,?,?,?)',
      id(),row.source,'delete',1,new Date().toISOString());
  });
}
export async function disconnectContextSource(source:ContextSource):Promise<void>{
  if(!has(source))throw Error('Invalid source');
  const db=await getDb();
  await db.withExclusiveTransactionAsync(async tx=>{
    await tx.runAsync('DELETE FROM context_decisions WHERE source=?',source);
    await tx.runAsync('DELETE FROM context_items WHERE source=?',source);
    await tx.runAsync('DELETE FROM connected_sources WHERE source=?',source);
    await tx.runAsync('INSERT INTO context_audit(id,source,event,count,occurred_at) VALUES(?,?,?,?,?)',
      id(),source,'disconnect',0,new Date().toISOString());
  });
}
export async function purgeExpiredContext():Promise<number>{
  const db=await getDb();let removed=0;
  await db.withExclusiveTransactionAsync(async tx=>{
    const count=await tx.getFirstAsync<{n:number}>(`
      SELECT COUNT(*) AS n FROM context_items c JOIN connected_sources s
      ON s.source=c.source WHERE julianday(c.imported_at)<
      julianday('now','-' || s.retention_days || ' days')`);
    removed=count?.n??0;
    await tx.runAsync(`DELETE FROM context_decisions WHERE EXISTS(
      SELECT 1 FROM context_items c JOIN connected_sources s ON s.source=c.source
      WHERE c.source=context_decisions.source AND c.external_id=context_decisions.external_id
      AND julianday(c.imported_at)<julianday('now','-' || s.retention_days || ' days'))`);
    await tx.runAsync(`DELETE FROM context_items WHERE id IN (
      SELECT c.id FROM context_items c JOIN connected_sources s ON s.source=c.source
      WHERE julianday(c.imported_at)<julianday('now','-' || s.retention_days || ' days'))`);
  });
  return removed;
}
/** Context is excluded from plaintext ASCEND backups by design. */
export async function exportProtectedContext(passphrase:string):Promise<string>{
  if(passphrase.length<12)throw Error('Use a passphrase with at least 12 characters');
  const db=await getDb();
  const rows=await db.getAllAsync<ItemRow>('SELECT * FROM context_items LIMIT 1000');
  if(rows.length>=1000)throw Error('Too much personal context for one export; purge old records');
  const items=await Promise.all(rows.map(async row=>validateContextCandidate({
    source:row.source,externalId:row.external_id,kind:row.kind,
    title:await decryptContext(row.title_cipher),
    excerpt:await decryptContext(row.excerpt_cipher),
    occurredAt:row.occurred_at,
    originUrl:row.origin_cipher?await decryptContext(row.origin_cipher):null,
    sensitivity:row.sensitivity
  })));
  const payload=JSON.stringify({format:'ascend-context',version:1,
    exportedAt:new Date().toISOString(),items});
  return protectContextExport(payload,passphrase);
}
export async function restoreProtectedContext(blob:string,passphrase:string):Promise<number>{
  if(blob.length>9_000_000)throw Error('Encrypted import too large');
  const json=await unprotectContextExport(blob.trim(),passphrase);
  let parsed:unknown;
  try{parsed=JSON.parse(json);}catch{throw Error('Context backup is corrupt');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid context backup');
  const x=parsed as {format?:unknown;version?:unknown;items?:unknown};
  if(x.format!=='ascend-context'||x.version!==1||!Array.isArray(x.items)||
    x.items.length>1000)throw Error('Unrecognized protected context backup');
  const valid=x.items.map(v=>validateContextCandidate(v as ContextCandidate));
  let added=0;
  for(const source of CONTEXT_SOURCES){
    const subset=valid.filter(v=>v.source===source);
    for(let i=0;i<subset.length;i+=100){
      const result=await importContextItems(source,subset.slice(i,i+100),true);
      added+=result.added;
    }
  }
  // Restored contents are PAUSED; source permissions must be newly authorized.
  return added;
}
