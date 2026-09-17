import {describe,it,expect,vi} from 'vitest';
import {atsBoard,boardMatchesCompany,createSiteReader,defiLlamaSeeds,discoverCompany,extractLinks,publicHttps,robotsAllowed} from './source-discovery';

describe('career discovery',()=>{
 it('keeps the full Ashby slug and recognizes embedded Greenhouse boards',()=>{
  expect(atsBoard('https://jobs.ashbyhq.com/kraken.com/position')).toEqual({ats_type:'ashby',ats_slug:'kraken.com',career_url:'https://jobs.ashbyhq.com/kraken.com'});
  expect(atsBoard('https://boards.greenhouse.io/embed/job_board?for=company')).toMatchObject({ats_type:'greenhouse',ats_slug:'company'});
  expect(atsBoard('https://jobs.ashbyhq.com.evil.com/company')).toBeNull();
  expect(extractLinks('<script>"https:\\/\\/jobs.ashbyhq.com\\/acme"</script>','https://company.com')).toEqual([{url:'https://jobs.ashbyhq.com/acme',label:'ATS board'}]);
 });
 it.each(['http://company.com','https://127.0.0.1','https://[::1]','https://company.internal','https://u:p@company.com','https://company.com:1234'])('rejects non-public discovery URL %s',url=>expect(()=>publicHttps(url)).toThrow());
 it('uses the most specific robots group, longest rule and Allow tie break',()=>{
  const rules='User-agent: *\nDisallow: /\nUser-agent: NodeworkBot\nDisallow: /private\nAllow: /private/jobs\nDisallow: /*?secret=*\nAllow: /careers';
  expect(robotsAllowed(rules,'https://company.com/careers')).toBe(true);
  expect(robotsAllowed(rules,'https://company.com/private/data')).toBe(false);
  expect(robotsAllowed(rules,'https://company.com/private/jobs')).toBe(true);
  expect(robotsAllowed('User-agent: *\nDisallow: /a\nAllow: /a','https://company.com/a')).toBe(true);
 });
 it('checks robots again before fetching a redirect destination',async()=>{
  const fetcher=vi.fn(async(url:any)=>String(url)==='https://company.com/robots.txt'?new Response(''):String(url)==='https://company.com/careers'?new Response(null,{status:302,headers:{location:'https://other.com/jobs'}}):new Response('User-agent: *\nDisallow: /jobs'));
  await expect(createSiteReader(fetcher).read('https://company.com/careers')).rejects.toThrow('robots');
  expect(fetcher.mock.calls.map(c=>c[0])).toEqual(['https://company.com/robots.txt','https://company.com/careers','https://other.com/robots.txt']);
 });
 it('finds the official careers board through the company homepage',async()=>{
  const fetcher=vi.fn(async(url:any)=>new Response(String(url).endsWith('/robots.txt')?'':String(url)==='https://company.com/'?'<a href="/careers">Careers</a>':'<iframe src="https://jobs.ashbyhq.com/acme"></iframe>'));
  expect(await discoverCompany({id:'test',name:'Acme',origin:'curated',website:'https://company.com'},fetcher)).toMatchObject({status:'ats_found',ats_slug:'acme',ats_type:'ashby'});
 });
 it('does not attach portfolio or ecosystem vacancies to the wrong employer',()=>{
  expect(boardMatchesCompany({id:'a',name:'a16z crypto',origin:'curated',website:'https://a16zcrypto.com'},'bettermoney')).toBe(false);
  expect(boardMatchesCompany({id:'s',name:'Solana',origin:'curated',website:'https://solana.com'},'AkashNetwork')).toBe(false);
 });
 it('does not interpret blocking or missing adapters as a successfully empty board',async()=>{
  const seed={id:'test',name:'Company',origin:'curated' as const,website:'https://company.com',career_url:'https://company.com/careers'};
  expect(await discoverCompany(seed,async()=>new Response('',{status:403}))).toMatchObject({status:'blocked'});
  expect(await discoverCompany(seed,async()=>new Response('<div id="app"></div>'))).toMatchObject({status:'needs_adapter'});
 });
 it('deduplicates protocol websites and excludes invalid URLs without requiring a token',async()=>{
  const seeds=await defiLlamaSeeds({fetcher:async()=>Response.json([{id:'1',name:'A',url:'https://www.acme.com',tvl:50},{id:'2',name:'A v2',url:'https://acme.com/v2',tvl:20},{id:'3',name:'Private',url:'https://127.0.0.1',tvl:60},{id:'4',name:'B',url:'https://b.com',tvl:1}])});
  expect(seeds.map(s=>s.name)).toEqual(['A','B']);expect(seeds[0]).not.toHaveProperty('rank');
 });
});
