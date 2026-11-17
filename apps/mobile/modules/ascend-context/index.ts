import {requireOptionalNativeModule} from 'expo-modules-core';

export interface HealthSummary {
  days:number;steps:number|null;sleepMinutes:number|null;
  exerciseSessions:number|null;meanHeartRate:number|null;
  from:string;to:string;
}
export interface HealthAccess {available:boolean;granted:string[]}
interface ContextBridge{
  pollShare():Promise<string>;
  encryptLocal(text:string):Promise<string>;
  decryptLocal(value:string):Promise<string>;
  protectExport(text:string,password:string):Promise<string>;
  unprotectExport(value:string,password:string):Promise<string>;
  healthStatus():Promise<HealthAccess>;
  requestHealthPermissions():Promise<void>;
  readHealth(days:number):Promise<HealthSummary>;
  addListener(name:string,callback:(data:unknown)=>void):{remove():void};
}
const native=requireOptionalNativeModule<ContextBridge>('AscendContext');
const moduleOrError=():ContextBridge=>{
  if(!native)throw Error('ASCEND Connect Android native module unavailable');
  return native;
};
export const contextAvailable=()=>!!native;
export const pollIncomingShare=()=>native?.pollShare()??Promise.resolve('');
export const encryptContext=(value:string)=>moduleOrError().encryptLocal(value);
export const decryptContext=(value:string)=>moduleOrError().decryptLocal(value);
export const protectContextExport=(value:string,password:string)=>moduleOrError().protectExport(value,password);
export const unprotectContextExport=(value:string,password:string)=>moduleOrError().unprotectExport(value,password);
export const healthStatus=()=>native?.healthStatus()??Promise.resolve({available:false,granted:[]});
export const requestHealthPermissions=()=>moduleOrError().requestHealthPermissions();
export const readHealthSummary=(days=7)=>moduleOrError().readHealth(days);

export function listenToIncomingShares(listener:(text:string)=>void):{remove():void}{
  if(!native)return {remove:()=>{}};
  return native.addListener('onShare',(event:unknown)=>{
    if(event&&typeof event==='object'&&'text' in event){
      const text=(event as {text?:unknown}).text;
      if(typeof text==='string'&&text.trim())listener(text);
    }
  });
}
