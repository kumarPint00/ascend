import {requireOptionalNativeModule} from 'expo-modules-core';
type Status='available'|'downloadable'|'downloading'|'unavailable'|'unsupported';
interface NanoBridge{
  status():Promise<Status>;
  download():Promise<boolean>;
  generate(prompt:string):Promise<string>;
}
const native=requireOptionalNativeModule<NanoBridge>('AscendNano');
export async function nanoStatus():Promise<Status>{
  if(!native)return 'unsupported';
  try{return await native.status();}catch{return 'unavailable';}
}
export async function nanoDownload():Promise<boolean>{
  if(!native)return false;
  return native.download();
}
export async function nanoGenerate(prompt:string):Promise<string>{
  if(!native)throw Error('Gemini Nano native module unavailable');
  return native.generate(prompt);
}
