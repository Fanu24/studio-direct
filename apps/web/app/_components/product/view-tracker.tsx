'use client';
import {useEffect} from 'react';
function session(){try{const key='nodework:view-session',existing=sessionStorage.getItem(key);if(existing)return existing;const id=crypto.randomUUID();sessionStorage.setItem(key,id);return id;}catch{return null;}}
function useTrack(kind:string,id:string){useEffect(()=>{const token=session();if(!token)return;fetch('/api/product/views',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id,session:token,referrer:document.referrer,source:new URLSearchParams(location.search).get('utm_source')}),keepalive:true}).catch(()=>{});},[kind,id]);}
export function JobViewTracker({jobId}:{jobId:string}){useTrack('job',jobId);return null;}
export function ProfileViewTracker({candidateId}:{candidateId:string}){useTrack('profile',candidateId);return null;}
