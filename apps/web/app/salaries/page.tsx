import Link from 'next/link';
import {platform} from '../../lib/platform';
export const dynamic='force-dynamic';
export const metadata={title:'Web3 salary insights',description:'Salary ranges from external Web3 vacancies, with reliable samples and observed history.',alternates:{canonical:'/salaries'}};
export default async function Page(){const env=await platform(),rows=await env.DB.prepare('SELECT slug,name FROM job_roles ORDER BY name').bind().all<{slug:string;name:string}>();return <main className="container stack"><h1>Web3 salary insights</h1><p>External salary data, normalized to annual USD. Each published estimate requires at least five reliable vacancies.</p><ul>{rows.results.map(r=><li key={r.slug}><Link href={'/salaries/'+r.slug}>{r.name}</Link></li>)}</ul></main>;}
