'use client';
import {useEffect,useState} from 'react';
export function SaveJob({jobId}:{jobId:string}){
 const [saved,setSaved]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;setBusy(true);fetch('/api/saved-jobs').then(r=>{if(!r.ok)throw new Error();return r.json();}).then((j:{ids:string[]})=>{if(active)setSaved(j.ids.includes(jobId));}).catch(()=>{if(active)setError('Unable to load saved jobs');}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[jobId]);
 async function toggle(){setBusy(true);setError('');try{const r=await fetch('/api/saved-jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jobId,saved:!saved})});if(r.status===401){window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname+window.location.search)}`);return;}if(!r.ok)throw new Error();setSaved(!saved);}catch{setError('Unable to save. Please try again.');}finally{setBusy(false);}}
 return <span><button type="button" aria-pressed={saved} disabled={busy} onClick={()=>void toggle()}>{saved?'Saved':'Save job'}</button>{error?<span role="alert">{error}</span>:null}</span>;
}
