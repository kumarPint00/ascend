import {AESEncryptionKey,AESSealedData,aesEncryptAsync,aesDecryptAsync} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const SECURE_KEY='ascend.recovery.aes256.v1';
const FORMAT='ascend-encrypted-backup';
export const ENCRYPTED_BACKUP_FORMAT=FORMAT;
export interface EncryptedBackup {
  format:typeof FORMAT;schemaVersion:1;cipher:'AES-256-GCM';
  exportedAt:string;payload:string;
}
const isObject=(v:unknown):v is Record<string,unknown>=>
  !!v&&typeof v==='object'&&!Array.isArray(v);
const validRecoveryKey=(v:string)=>/^[a-f\d]{64}$/i.test(v.trim());

/**
 * One recoverable 256-bit key, saved through Android Keystore-backed SecureStore.
 * The app cannot regenerate it after an uninstall. Users must keep a paper or
 * password-manager copy to restore on a replacement device.
 */
export async function getOrCreateRecoveryKey():Promise<string>{
  const existing=await SecureStore.getItemAsync(SECURE_KEY);
  if(existing){
    if(!validRecoveryKey(existing))throw Error('Stored recovery key is invalid');
    return existing;
  }
  const key=await AESEncryptionKey.generate();
  const hex=await key.encoded('hex');
  if(!validRecoveryKey(hex))throw Error('Could not create a valid recovery key');
  await SecureStore.setItemAsync(SECURE_KEY,hex);
  return hex;
}
export async function saveRecoveryKey(hex:string):Promise<void>{
  const valid=hex.trim().toLowerCase();
  if(!validRecoveryKey(valid))throw Error('Recovery key must be 64 hexadecimal characters');
  await AESEncryptionKey.import(valid,'hex'); // native validates length
  await SecureStore.setItemAsync(SECURE_KEY,valid);
}
export async function hasRecoveryKey():Promise<boolean>{
  const value=await SecureStore.getItemAsync(SECURE_KEY);
  return !!value&&validRecoveryKey(value);
}
export function isEncryptedBackup(value:string):boolean{
  if(value.length>15_000_000)return false;
  try{
    const data:unknown=JSON.parse(value);
    return isObject(data)&&data.format===FORMAT;
  }catch{return false;}
}
export function parseEncryptedEnvelope(value:string):EncryptedBackup{
  if(value.length>15_000_000)throw Error('Encrypted backup too large');
  let data:unknown;
  try{data=JSON.parse(value);}catch{throw Error('Invalid encrypted backup JSON');}
  if(!isObject(data)||data.format!==FORMAT||data.schemaVersion!==1||
    data.cipher!=='AES-256-GCM'||typeof data.payload!=='string'||
    data.payload.length<32||data.payload.length>14_000_000||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data.payload)||
    typeof data.exportedAt!=='string'||!Number.isFinite(Date.parse(data.exportedAt)))
    throw Error('Unrecognized encrypted backup envelope');
  return data as unknown as EncryptedBackup;
}
export async function encryptBackup(source:string):Promise<string>{
  const hex=await getOrCreateRecoveryKey();
  const key=await AESEncryptionKey.import(hex,'hex');
  const encrypted=await aesEncryptAsync(new TextEncoder().encode(source),key);
  const payload=await encrypted.combined('base64');
  if(typeof payload!=='string')throw Error('AES-GCM result encoding unavailable');
  const document:EncryptedBackup={
    format:FORMAT,schemaVersion:1,cipher:'AES-256-GCM',
    exportedAt:new Date().toISOString(),payload,
  };
  return JSON.stringify(document);
}
export async function decryptBackup(source:string,providedKey?:string):Promise<string>{
  const envelope=parseEncryptedEnvelope(source);
  const hex=providedKey?.trim()||await SecureStore.getItemAsync(SECURE_KEY);
  if(!hex||!validRecoveryKey(hex))
    throw Error('Enter your 64-character recovery key to decrypt this backup');
  try{
    const key=await AESEncryptionKey.import(hex,'hex');
    const bytes=await aesDecryptAsync(AESSealedData.fromCombined(envelope.payload),key,{output:'bytes'});
    if(typeof bytes==='string')throw Error('Native AES output was unexpectedly encoded');
    return new TextDecoder().decode(bytes);
  }catch{
    throw Error('Could not decrypt backup. Verify the recovery key and file integrity');
  }
}
