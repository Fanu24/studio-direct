import {LANGUAGE_LEVELS, type Eligibility} from './fields';

export type MatchProfile = {skillIds:string[];languages:{code:string;level:string}[];countryCode:string|null;utcOffset:number|null};
export type MatchJob = {requiredSkillIds:string[];preferredSkillIds:string[];languages:{code:string;level:string;kind:string}[];eligibility:Eligibility|null};
export function eligibleForJob(rule:Eligibility|null,profile:Pick<MatchProfile,'countryCode'|'utcOffset'>):boolean {
  if(!rule)return true;
  if(rule.mode==='geo')return !!profile.countryCode&&rule.countryCodes.includes(profile.countryCode);
  if(profile.utcOffset===null)return false;
  return rule.utcFrom<=rule.utcTo?profile.utcOffset>=rule.utcFrom&&profile.utcOffset<=rule.utcTo:profile.utcOffset>=rule.utcFrom||profile.utcOffset<=rule.utcTo;
}
export function matchScore(job:MatchJob,profile:MatchProfile){
  const level=(value:string)=>(LANGUAGE_LEVELS as readonly string[]).indexOf(value);
  const required=job.requiredSkillIds.filter(id=>profile.skillIds.includes(id)).length;
  const preferred=job.preferredSkillIds.filter(id=>profile.skillIds.includes(id)).length;
  const languageMatches=job.languages.map(item=>({code:item.code,level:item.level,ok:profile.languages.some(p=>p.code===item.code&&level(p.level)>=level(item.level)),kind:item.kind}));
  const eligible=eligibleForJob(job.eligibility,profile);
  const languagePoints=languageMatches.some(l=>l.kind==='required'&&!l.ok)?0:languageMatches.length?20*languageMatches.filter(l=>l.ok).length/languageMatches.length:20;
  const score=Math.round((job.requiredSkillIds.length?50*required/job.requiredSkillIds.length:50)+(job.preferredSkillIds.length?20*preferred/job.preferredSkillIds.length:20)+languagePoints+(eligible?10:0));
  return {score,breakdown:{required,requiredTotal:job.requiredSkillIds.length,preferred,preferredTotal:job.preferredSkillIds.length,languages:languageMatches,eligible}};
}
export function candidateCompleteness(input:{photo?:string|null;headline?:string|null;location?:string|null;skills:number;languages:number;experiences:number;cv?:string|null;links:number}){
  const items=[{key:'photo',points:5,done:!!input.photo},{key:'headline',points:10,done:!!input.headline},{key:'location',points:5,done:!!input.location},{key:'skills',points:25,done:input.skills>=3},{key:'languages',points:15,done:input.languages>0},{key:'experience',points:20,done:input.experiences>0},{key:'CV',points:10,done:!!input.cv},{key:'links',points:10,done:input.links>0}];
  return {score:items.reduce((sum,i)=>sum+(i.done?i.points:0),0),items};
}
// Social/profile links are allowed in dedicated fields; direct contact details are not public.
export function containsDirectContact(value:string){
  return /[\w.+-]+\s*@\s*[\w-]+(?:\.[\w-]+)+|\b(?:mailto:|tel:|wa\.me\/|t\.me\/|discord\.gg\/)|(?:\+\d[\d ().-]{7,}\d)/i.test(value);
}
export function publicCandidateText(value:string|null|undefined){return containsDirectContact(value??'')?'':value??'';}
export function earlyAccessState(input:{until:string|null;premium:boolean;invited:boolean;now?:Date}){
  const remaining=Math.max(0,new Date(input.until??0).getTime()-(input.now??new Date()).getTime());
  return {locked:remaining>0&&!input.premium&&!input.invited,remainingMs:remaining};
}
