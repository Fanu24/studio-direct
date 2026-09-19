import {it,expect} from 'vitest';
import {CareerJobSource} from './career';
const job=(id:string)=>'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Engineer '+id,description:'Work on blockchain infrastructure',url:'https://company.com/jobs/'+id})+'</script>';
function source(pages:Record<string,string>){return new CareerJobSource({async getById(){return {id:'company',name:'Company',ats_type:null,ats_slug:null,career_url:'https://company.com/careers'};}},async input=>{const path=new URL(String(input)).pathname;return new Response(pages[path]??'',{status:path==='/robots.txt'?200:path in pages?200:404});});}
it('follows same-origin job detail pages and extracts their structured vacancies',async()=>{
 const result=await source({'/careers':'<a href="/jobs/1">Engineer</a><a href="/jobs/2">Developer</a><a href="https://other.com/jobs/3">External</a>','/jobs/1':job('1'),'/jobs/2':job('2')}).fetch({kind:'career',companyId:'company'});
 expect(result.map(j=>j.title)).toEqual(['Engineer 1','Engineer 2']);
});
it('rejects an incomplete detail snapshot rather than closing the jobs it missed',async()=>{
 await expect(source({'/careers':'<a href="/jobs/1">Engineer</a><a href="/jobs/2">Developer</a>','/jobs/1':job('1'),'/jobs/2':'JavaScript-only vacancy'}).fetch({kind:'career',companyId:'company'})).rejects.toThrow('retain existing');
});
it('honors robots on individual detail pages',async()=>{
 await expect(source({'/robots.txt':'User-agent: *\nDisallow: /jobs/','/careers':'<a href="/jobs/1">Engineer</a>','/jobs/1':job('1')}).fetch({kind:'career',companyId:'company'})).rejects.toThrow('robots');
});
