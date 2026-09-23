import {describe,expect,it} from 'vitest';
import {matchScore,earlyAccessState,candidateCompleteness,containsDirectContact,type MatchJob,type MatchProfile} from './candidates';
const job:MatchJob={requiredSkillIds:['rust','sql'],preferredSkillIds:['react'],languages:[{code:'en',level:'C1',kind:'required'}],eligibility:{mode:'geo',regionIds:['IT'],countryCodes:['IT']}};
const candidate:MatchProfile={skillIds:['rust','sql','react'],languages:[{code:'en',level:'C2'}],countryCode:'IT',utcOffset:60};
describe('matching boundaries',()=>{
 it.each([
  [{},100],[{skillIds:['rust','react']},75],[{skillIds:['react']},50],[{skillIds:['rust','sql']},80],
  [{languages:[]},80],[{languages:[{code:'en',level:'B2'}]},80],[{countryCode:'US'},90],
  [{skillIds:[],languages:[],countryCode:null},0],[{languages:[{code:'en',level:'Native'}]},100],
  [{skillIds:['rust','sql','react','extra']},100],
 ] as [Partial<MatchProfile>,number][])('uses skills, language level and eligibility', (change,score)=>expect(matchScore(job,{...candidate,...change}).score).toBe(score));
 it('wraps UTC eligibility across the date line',()=>{const midnight={...job,eligibility:{mode:'timezone' as const,utcFrom:720,utcTo:-600}};expect(matchScore(midnight,{...candidate,utcOffset:-660}).breakdown.eligible).toBe(true);expect(matchScore(midnight,candidate).breakdown.eligible).toBe(false);});
});
it('opens exactly at the deadline and allows premium/invited candidates before it',()=>{const until='2026-09-23T12:00:00Z',now=new Date('2026-09-23T11:59:59Z');expect(earlyAccessState({until,now,premium:false,invited:false}).locked).toBe(true);expect(earlyAccessState({until,now,premium:true,invited:false}).locked).toBe(false);expect(earlyAccessState({until,now,premium:false,invited:true}).locked).toBe(false);expect(earlyAccessState({until,now:new Date(until),premium:false,invited:false}).locked).toBe(false);});
it('requires a meaningful skills section and rejects public direct contacts',()=>{expect(candidateCompleteness({skills:2,languages:0,experiences:0,links:0}).score).toBe(0);expect(containsDirectContact('hello@example.com')).toBe(true);expect(containsDirectContact('https://github.com/candidate')).toBe(false);});
