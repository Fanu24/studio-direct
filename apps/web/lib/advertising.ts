import type {Database} from './platform';
export type AdvertisingConfig={mode:'off'|'test'|'live';publisher:string;slot:string;cmpUrl:string};
export const AD_DEFAULTS:AdvertisingConfig={mode:'off',publisher:'',slot:'',cmpUrl:''};
export function parseAdvertising(raw:Record<string,unknown>):AdvertisingConfig{
 const mode=raw.mode;if(!['off','test','live'].includes(String(mode)))throw new Error('Choose an advertising mode');
 const publisher=String(raw.publisher||'').trim(),slot=String(raw.slot||'').trim(),cmpUrl=String(raw.cmpUrl||'').trim();
 if(mode!=='off'){
  if(!/^ca-pub-\d{16}$/.test(publisher)||!/^\d{6,20}$/.test(slot))throw new Error('Use your AdSense publisher and ad-unit IDs');
  const cmp=new URL(cmpUrl);if(cmp.protocol!=='https:'||cmp.hostname!=='fundingchoicesmessages.google.com'||cmp.username||cmp.password)throw new Error('Use the Google Privacy & messaging script URL from your account');
 }
 return {mode:mode as AdvertisingConfig['mode'],publisher,slot,cmpUrl};
}
export async function advertisingConfig(db:Database){const raw=await db.prepare("SELECT value FROM marketplace_settings WHERE key='advertising'").bind().first<string>('value');try{return raw?parseAdvertising(JSON.parse(raw)):AD_DEFAULTS;}catch{return AD_DEFAULTS;}}
export type TcfConsent={gdprApplies?:boolean;eventStatus?:string;purpose?:{consents?:Record<number,boolean>};vendor?:{consents?:Record<number,boolean>}};
export function canRequestAds(data:TcfConsent,globalPrivacyControl=false){
 if(globalPrivacyControl||!['tcloaded','useractioncomplete'].includes(data.eventStatus||''))return false;
 if(data.gdprApplies===false)return true;
 return data.gdprApplies===true&&data.vendor?.consents?.[755]===true&&[1,3,4].every(p=>data.purpose?.consents?.[p]===true);
}
