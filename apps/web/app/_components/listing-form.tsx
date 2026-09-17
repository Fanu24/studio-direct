"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {JOB_TAGS} from '@gaming/shared';
import {DEFAULT_SELECTION,STICKY_CENTS,BUNDLE_LADDER,quoteListing,parseSelection,formatUsd,type ListingSelection} from '../../lib/billing/listing-catalog';
export function ListingForm({kind='job',creditId,creditSelection}:{kind?:'job'|'bundle';creditId?:string;creditSelection?:ListingSelection}) {
 const [selection,setSelection]=useState<ListingSelection>(creditSelection??{...DEFAULT_SELECTION,quantity:kind==='bundle'?24:1,autoRenew:kind==='job'});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[logoUrl,setLogoUrl]=useState(''),[external,setExternal]=useState(false);
 const submission=useRef<string|null>(null);const quote=quoteListing(selection);
 const formRef=useRef<HTMLFormElement>(null),draftKey='nodework:listing:'+kind+(creditId?':'+creditId:'');
 const restoredApplyUrl=useRef('');
 const [loginUrl,setLoginUrl]=useState('/employer/login?next='+encodeURIComponent(kind==='bundle'?'/post-web3-job/bundle':'/post-web3-job'));
 useEffect(()=>{try{
  const saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');
  if(!saved||Date.now()-saved.at>86400000||!Array.isArray(saved.fields))return;
  if(!creditId)setSelection(parseSelection(saved.selection,kind));
  restoredApplyUrl.current=saved.fields.find((entry:string[])=>entry[0]==='applyUrl')?.[1]??'';
  setExternal(saved.external===true);setLogoUrl(typeof saved.logoUrl==='string'?saved.logoUrl:'');
  submission.current=typeof saved.id==='string'?saved.id:null;
  for(const element of Array.from(formRef.current?.elements??[])){
   if(element instanceof HTMLInputElement&&element.type!=='file'&&element.type!=='radio'&&element.type!=='checkbox'||element instanceof HTMLTextAreaElement){
    const value=saved.fields.find((entry:string[])=>entry[0]===element.name)?.[1];if(typeof value==='string')element.value=value;
   }else if(element instanceof HTMLSelectElement&&element.name){
    const values=saved.fields.filter((entry:string[])=>entry[0]===element.name).map((entry:string[])=>entry[1]);
    for(const option of Array.from(element.options))option.selected=values.includes(option.value);
   }
  }
 }catch{sessionStorage.removeItem(draftKey);}},[draftKey,kind,creditId]);
 function rememberDraft(){try{if(formRef.current)sessionStorage.setItem(draftKey,JSON.stringify({id:submission.current,at:Date.now(),fields:[...new FormData(formRef.current)].filter(([,value])=>typeof value==='string'),selection,logoUrl,external}));}catch{}}
 function choose(patch:Partial<ListingSelection>){setSelection({...selection,...patch});submission.current=null;}
 async function upload(file:File|undefined){if(!file)return;setBusy(true);setError('');try{const body=new FormData();body.set('logo',file);const r=await fetch('/api/employer/logo',{method:'POST',body});const j=await r.json() as {url?:string;error?:string};if(!r.ok||!j.url)throw new Error(j.error||'Logo upload failed. Sign in and try again.');setLogoUrl(j.url);}catch(e){setError(e instanceof Error?e.message:'Upload failed');}finally{setBusy(false);}}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const f=new FormData(e.currentTarget);const value=(name:string)=>String(f.get(name)||'');
  const listing=kind==='bundle'?null:{title:value('title'),descriptionHtml:value('descriptionHtml'),companyName:value('companyName'),companyUrl:value('companyUrl'),location:value('location'),remote:value('remote'),applyMode:external?'external':'internal',applyUrl:value('applyUrl'),tags:f.getAll('tags'),salaryMin:value('salaryMin')?Number(value('salaryMin')):null,salaryMax:value('salaryMax')?Number(value('salaryMax')):null,logoUrl,invoiceDetails:value('invoiceDetails')};
  submission.current??=crypto.randomUUID();
  rememberDraft();
  try{const r=await fetch(creditId?'/api/employer/redeem':'/api/employer/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:submission.current,kind,listing,selection,creditId})});const j=await r.json() as {url?:string;error?:string;login?:string};if(j.login?.startsWith('/')&&!j.login.startsWith('//'))setLoginUrl(j.login);if(!r.ok||!j.url)throw new Error(j.error||'Checkout unavailable. Please sign in and try again.');if(creditId)sessionStorage.removeItem(draftKey);window.location.assign(j.url);}catch(e){setError(e instanceof Error?e.message:'Submission failed');setBusy(false);}
 }
 return <form ref={formRef} className="commerce-form" onSubmit={submit} onChange={()=>{submission.current=null;}}>
 {kind==='job'?<fieldset disabled={busy}><legend>Job details</legend>
 <label>Job title<input name="title" required minLength={3} maxLength={150}/></label>
 <label>Job description<textarea name="descriptionHtml" rows={14} required minLength={80} maxLength={50000} placeholder="Responsibilities, requirements and what you offer. Basic HTML formatting is supported."/></label>
 <div className="commerce-grid"><label>Company name<input name="companyName" required minLength={2} maxLength={160}/></label><label>Company website<input name="companyUrl" type="url" required/></label>
 <label>Location<input name="location" required maxLength={160} placeholder="Worldwide, Europe or a city"/></label><label>Work arrangement<select name="remote"><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
 <label>Annual salary minimum (USD)<input name="salaryMin" type="number" min={0} max={10000000}/></label><label>Annual salary maximum (USD)<input name="salaryMax" type="number" min={0} max={10000000}/></label></div>
 <label>Main skill and other skills (up to 12)<select name="tags" multiple required size={8}>{JOB_TAGS.map(tag=><option key={tag} value={tag}>{tag}</option>)}</select></label>
 <label className="commerce-check"><input type="radio" name="applyMode" checked={!external} onChange={()=>setExternal(false)}/>Receive applications in the employer dashboard</label>
 <label className="commerce-check"><input type="radio" name="applyMode" checked={external} onChange={()=>setExternal(true)}/>Send candidates to your application website</label>
 {external?<label>Application URL<input name="applyUrl" type="url" required defaultValue={restoredApplyUrl.current}/></label>:null}
 <label>Invoice details (optional)<textarea name="invoiceDetails" rows={3} maxLength={2000}/></label>
 </fieldset>:<p>Buy credits now and publish each job when you are ready. Unused credits expire 24 months after purchase.</p>}
 {!creditId?<fieldset disabled={busy}><legend>Placement options</legend>
 {kind==='bundle'?<label>Number of posts<select value={selection.quantity} onChange={e=>choose({quantity:Number(e.target.value)})}>{BUNDLE_LADDER.map(([n,p])=><option key={n} value={n}>{n} posts — {p}% discount</option>)}</select></label>:null}
 <label className="commerce-check"><input type="checkbox" checked={selection.support} onChange={e=>choose({support:e.target.checked})}/>Premium support (+$99 per post)</label>
 <label>Pin to the top<select value={selection.stickyDays} onChange={e=>choose({stickyDays:Number(e.target.value) as ListingSelection['stickyDays']})}>{Object.entries(STICKY_CENTS).map(([days,cents])=><option key={days} value={days}>{days==='0'?'No pin':`${days} day${days==='1'?'':'s'}`} · {formatUsd(cents)}</option>)}</select></label>
 <label className="commerce-check"><input type="checkbox" checked={selection.logo} onChange={e=>choose({logo:e.target.checked})}/>Show company logo (+$49 per post)</label>
 <label>Highlight<select value={selection.highlight} onChange={e=>choose({highlight:e.target.value as ListingSelection['highlight']})}><option value="none">No highlight</option><option value="standard">Standard highlight (+$99)</option><option value="custom">Custom color (+$149)</option></select></label>
 {selection.highlight==='custom'?<label>Highlight color<input type="color" value={selection.color} onChange={e=>choose({color:e.target.value})}/></label>:null}
 {kind==='job'?<label className="commerce-check"><input type="checkbox" checked={selection.autoRenew} onChange={e=>choose({autoRenew:e.target.checked})}/>Automatically renew every 30 days at {formatUsd(quote.totalCents)}. Cancel from Manage billing.</label>:null}
 </fieldset>:<p>Your purchased placement options apply to this job.</p>}
 {kind==='job'&&selection.logo?<label>Company logo (PNG, JPEG or WebP, maximum 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} required={!logoUrl} onChange={e=>void upload(e.target.files?.[0])}/>{logoUrl?<span>Logo uploaded</span>:null}</label>:null}
 <div className="panel"><p>Base listing: $299 per post · Active for 30 days</p>{quote.percent?<p>Bundle discount: {quote.percent}% ({formatUsd(quote.discountCents)})</p>:null}<strong>{creditId?'Use 1 purchased credit':`Total: ${formatUsd(quote.totalCents)}`}</strong><p>{creditId?'No additional payment.':'Any applicable taxes and coupon discounts are shown at checkout.'}</p>
 <button className="button button--primary" type="submit" disabled={busy}>{busy?'Please wait…':creditId?'Publish job':'Continue to payment'}</button></div>
 {error?<p role="alert">{error} <a href={loginUrl} onClick={rememberDraft}>Sign in or complete your employer account</a></p>:null}
 </form>;
}
