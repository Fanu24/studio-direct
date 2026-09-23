import Link from 'next/link';
import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../lib/platform';
import {listApiKeys} from '../../lib/jobs/api-keys';
import {ApiKeys} from '../_components/api-keys';
export const dynamic='force-dynamic';
export const metadata={title:'API keys',robots:{index:false,follow:false}};
export default async function ApiAccessPage(){const env=await platform(),user=await currentUser(env);if(!user)redirect('/login?next=/api-access');return <main className="container stack"><h1>Jobs API access</h1><p>Signed in as {user.email}</p><Link href="/web3-jobs-api">API documentation</Link><ApiKeys keys={await listApiKeys(env.DB,user.id)}/></main>;}
