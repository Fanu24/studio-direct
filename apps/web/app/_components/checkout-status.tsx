'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
export function CheckoutStatus({orderId}:{orderId:string}) {
  const router=useRouter(),[status,setStatus]=useState('Confirming your payment…');
  useEffect(()=>{
    let stopped=false,attempts=0,timer:ReturnType<typeof setTimeout>;
    async function check(){
      try{
        const response=await fetch('/api/employer/orders/'+encodeURIComponent(orderId),{cache:'no-store'});
        if(!response.ok)throw new Error();
        const order=await response.json() as {status:string};
        if(stopped)return;
        if(order.status==='paid'){
          for(const kind of ['job','bundle'])try{const key='nodework:listing:'+kind;if(JSON.parse(sessionStorage.getItem(key)||'null')?.id===orderId)sessionStorage.removeItem(key);}catch{}
          try{if(JSON.parse(sessionStorage.getItem('nodework:posting:v2')||'null')?.orderId===orderId)sessionStorage.removeItem('nodework:posting:v2');}catch{}
          setStatus('Payment confirmed. Your purchase is available below.');router.refresh();return;
        }
        if(order.status!=='pending'){setStatus('Order status: '+order.status);return;}
      }catch {if(stopped)return;}
      attempts++;
      if(attempts<15)timer=setTimeout(()=>void check(),2000);
      else setStatus('Payment confirmation is still pending. Refresh this page in a moment, or contact support.');
    }
    void check();return()=>{stopped=true;clearTimeout(timer);};
  },[orderId,router]);
  return <p role="status">{status}</p>;
}
