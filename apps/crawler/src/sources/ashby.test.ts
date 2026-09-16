import {expect,it} from 'vitest';
import {parseAshbyPostings} from './ashby';
it('imports listed vacancies with explicit work arrangements and apply destinations',()=>{const draft={title:'Engineer',jobUrl:'https://jobs.ashbyhq.com/example/1',applyUrl:'https://jobs.ashbyhq.com/example/1/apply',isListed:true,workplaceType:'Hybrid',descriptionHtml:'<p>Build</p>'};const jobs=parseAshbyPostings(JSON.stringify({jobs:[draft,{...draft,isListed:false}]}),'Example');expect(jobs).toHaveLength(1);expect(jobs[0].remote).toBe('hybrid');expect(jobs[0].applyUrl).toBe(draft.applyUrl);});
it('treats malformed payloads as failures, not empty boards',()=>{expect(()=>parseAshbyPostings('{"error":"denied"}','Example')).toThrow();expect(parseAshbyPostings('{"jobs":[]}','Example')).toEqual([]);});
