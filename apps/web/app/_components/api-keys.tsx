"use client";
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import type {ApiKeySummary} from '../../lib/jobs/api-keys';
export function ApiKeys({keys}:{keys:ApiKeySummary[]}){
 const router=useRouter(),[issued,setIssued]=useState<{id:string;token:string}|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function submit(body:Record<string,string>){setBusy(true);setMessage('');try{const r=await fetch('/api/account/api-keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),result=await r.json();if(!r.ok)throw Error(result.error||'Request failed');if(result.token)setIssued(result);else if(body.id===issued?.id)setIssued(null);router.refresh();}catch(error){setMessage(error instanceof Error?error.message:'Request failed');}finally{setBusy(false);}}
 function create(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);void submit({website:String(form.get('website')||'')});}
 return <section><h2>Your API keys</h2><p>Free read access to public job listings. Up to five active keys; 60 requests per minute per key. Keep keys on your server.</p><form onSubmit={create}><label>Website where you will use the API<input name="website" type="url" placeholder="https://your-site.com" required maxLength={500}/></label><button disabled={busy}>Generate API key</button></form>{issued?<div role="status"><p>Copy this key now. It is shown only here and cannot be retrieved after leaving this page.</p><label>New API key<input value={issued.token} readOnly autoComplete="off" onFocus={e=>e.currentTarget.select()}/></label></div>:null}{message?<p role="alert">{message}</p>:null}<ul>{keys.map(key=><li key={key.id}><code>{key.prefix}…</code> — {key.website} — {key.revoked_at?'Revoked':<button disabled={busy} onClick={()=>void submit({action:'revoke',id:key.id})}>Revoke key</button>}</li>)}</ul></section>;
}
