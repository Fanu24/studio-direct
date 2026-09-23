'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function NativePaymentCheck({orderId}:{orderId:string}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),router=useRouter();
  async function check(){setBusy(true);try{const response=await fetch('/api/product/jobs/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:orderId,action:'reconcile'})});const data=await response.json();setMessage(response.ok?'Order status: '+data.status:data.error);if(response.ok)router.refresh();}catch{setMessage('Unable to check payment. Please retry.');}finally{setBusy(false);}}
  return <div><button type="button" disabled={busy} onClick={check}>{busy?'Checking…':'Check payment now'}</button><p role="status">{message}</p></div>;
}
