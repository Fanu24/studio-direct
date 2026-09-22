'use client';
import {useState} from 'react';
import {money,pricing} from '@gaming/shared';
import {ReferencePicker,type ReferenceChoice} from './reference-picker';

export function CompanyClaimForm() {
  const [company,setCompany] = useState<ReferenceChoice[]>([]), [error,setError] = useState(''), [busy,setBusy] = useState(false), [id,setId] = useState('');
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!company[0]?.domain){setError('Select a company with a verified website in the directory.');return;}
    setBusy(true);setError('');const requestId=id||crypto.randomUUID();setId(requestId);
    try {
      const response=await fetch('/api/product/company-claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId,companyId:company[0].id,companyUrl:`https://${company[0].domain}`})});
      const result=await response.json();if(result.login){window.location.assign(result.login);return;}if(!response.ok)throw Error(result.error||'Checkout unavailable.');window.location.assign(result.url);
    } catch(error) {setError(error instanceof Error?error.message:'Checkout unavailable.');setBusy(false);}
  }
  return <form className="stack" onSubmit={submit}>
    <ReferencePicker label="Company" kind="companies" value={company} onChange={value=>{setCompany(value);setId('');}} required error={!company.length?error:undefined}/>
    {company[0]?.domain?<p>Company website: https://{company[0].domain}</p>:null}
    <p>One-time company page claim: <strong>{money(pricing.companyClaim)}</strong>. No job posts are included. Coupons can be entered at checkout.</p>
    <p>Your company account activates after confirmed payment. To control this company page and reply to its reviews, we must first verify that you are authorized to represent it. Payment alone does not establish ownership.</p>
    <p>A company claim is included when you purchase a job post or an annual company plan.</p>
    {error&&company.length?<p role="alert">{error}</p>:null}
    <button type="submit" disabled={busy||!company.length}>{busy?'Opening test checkout…':`Continue to test checkout · ${money(pricing.companyClaim)}`}</button>
  </form>;
}
export function ClaimPaymentCheck({orderId}:{orderId:string}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function check() {setBusy(true);try{const response=await fetch('/api/product/company-claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:orderId,action:'reconcile'})});const result=await response.json();if(!response.ok)throw Error(result.error);window.location.reload();}catch(error){setMessage(error instanceof Error?error.message:'Unable to check payment.');setBusy(false);}}
  return <div><button type="button" disabled={busy} onClick={check}>{busy?'Checking Stripe…':'Check payment status'}</button><p role="status">{message}</p></div>;
}
