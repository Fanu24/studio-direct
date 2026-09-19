import Link from 'next/link';
import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../lib/platform';
export const dynamic='force-dynamic';
export const metadata={title:'Notifications',robots:{index:false,follow:false}};
export default async function Notifications(){const env=await platform(),user=await currentUser(env);if(!user)redirect('/login?next=/notifications');
 const rows=await env.DB.prepare('SELECT id,subject,body,destination_path,read_at,created_at FROM notification_outbox WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all<{id:string;subject:string;body:string;destination_path:string;read_at:string|null;created_at:string}>();
 return <main className="container stack"><h1>Notifications</h1><Link href="/dashboard">Dashboard</Link>{!rows.results.length?<p>No notifications yet.</p>:rows.results.map(n=><article key={n.id} className="panel"><h2>{n.subject}</h2><p>{n.body}</p><Link href={n.destination_path}>Open</Link>{!n.read_at?<form method="post" action="/api/notifications"><input type="hidden" name="id" value={n.id}/><button>Mark as read</button></form>:null}<p>{n.created_at.slice(0,10)}</p></article>)}</main>;
}
