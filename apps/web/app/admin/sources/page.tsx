import Link from 'next/link';
import {notFound} from 'next/navigation';
import {platform} from '../../../lib/platform';
import {adminUser} from '../../../lib/admin';
export const dynamic='force-dynamic';
export const metadata={title:'Source coverage',robots:{index:false,follow:false}};
export default async function SourcesPage() {
  const env=await platform();if(!await adminUser(env))notFound();
  const [sources,state,health]=await Promise.all([
    env.DB.prepare(`SELECT s.*,c.last_crawled_at,c.last_crawl_error FROM source_catalog s LEFT JOIN companies c ON c.id=s.company_id
      WHERE s.active=1 ORDER BY s.origin,s.market_rank,s.name`).bind().all<{id:string;name:string;origin:string;market_rank:number|null;website:string;career_url:string|null;status:string;checked_at:string|null;error:string|null;last_crawled_at:string|null;last_crawl_error:string|null}>(),
    env.DB.prepare("SELECT completed_at,error FROM discovery_state WHERE id='catalog'").bind().first<{completed_at:string|null;error:string|null}>(),
    env.DB.prepare(`SELECT COUNT(*) monitored,SUM(CASE WHEN last_crawled_at>? THEN 1 ELSE 0 END) fresh
      FROM companies WHERE listed=1 AND career_url IS NOT NULL`).bind(new Date(Date.now()-86400000).toISOString()).first<{monitored:number;fresh:number}>(),
  ]);
  const counts=sources.results.reduce((map,s)=>(map[s.status]=(map[s.status]??0)+1,map),{} as Record<string,number>);
  return <main className="container stack"><h1>Source coverage</h1><Link href="/admin">Administration</Link>
    <p>Careers are scheduled every six hours. The crypto catalog combines DefiLlama projects and exchanges, the a16z crypto portfolio and additional Web3 employers, refreshed daily.</p>
    <p>Last catalog refresh: {state?.completed_at??'Not run'} · {health?.fresh??0} of {health?.monitored??0} monitored companies fetched successfully in the last 24 hours.</p>
    {state?.error?<p role="alert">Catalog refresh failed: {state.error}</p>:null}
    <p>{Object.entries(counts).map(([status,count])=>status+': '+count).join(' · ')}</p>
    <p>Token projects are discovery candidates. A missing Careers page is not proof that a company has no vacancies. Blocked sites and unsupported pages remain visible for review.</p>
    <div style={{overflowX:'auto'}}><table><thead><tr><th>Company / asset</th><th>Catalog</th><th>Discovery</th><th>Careers</th><th>Last successful crawl</th><th>Error</th></tr></thead>
      <tbody>{sources.results.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.origin}{s.market_rank?' #'+s.market_rank:''}</td><td>{s.status}</td>
        <td>{s.career_url?<a href={s.career_url} target="_blank" rel="noopener">Careers</a>:s.website?<a href={s.website} target="_blank" rel="noopener">Website</a>:'No website'}</td>
        <td>{s.last_crawled_at??'Not fetched'}</td><td>{s.last_crawl_error??s.error??''}</td></tr>)}</tbody></table></div></main>;
}
