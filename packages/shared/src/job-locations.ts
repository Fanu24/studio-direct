import {slugifyTag,isCitySlug,isCountrySlug,isRegionSlug,countryForCity,regionForCountry} from './taxonomy.ts';
export type JobLocationLevel={slug:string;kind:'city'|'country'|'region'};
/** Resolve explicit place names and known geography, never arbitrary substrings. */
export function resolveJobLocations(location:string|null|undefined):JobLocationLevel[]{
 const aliases:Record<string,string>={us:'united-states',usa:'united-states',uk:'united-kingdom'};
 const parts=(location??'').split(/[,;|/]/).map(p=>slugifyTag(p.trim().replace(/^remote\s*[-:]\s*/i,''))).filter(Boolean).map(p=>aliases[p]??p);
 const countries=parts.filter(isCountrySlug),levels=new Map<string,JobLocationLevel>();
 const add=(slug:string,kind:JobLocationLevel['kind'])=>levels.set(slug,{slug,kind});
 for(const part of parts){
  if(isCountrySlug(part)){add(part,'country');add(regionForCountry(part),'region');}
  else if(isRegionSlug(part))add(part,'region');
  else if(isCitySlug(part)){
   const country=countryForCity(part);
   if(country&&countries.length&&!countries.includes(country))continue;
   add(part,'city');if(country){add(country,'country');add(regionForCountry(country),'region');}
  }
 }
 return [...levels.values()];
}
