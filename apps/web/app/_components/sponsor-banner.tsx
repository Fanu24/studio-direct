'use client';
import {useEffect,useRef,useState} from 'react';
type Banner={id:string;slot:number;title:string;subtitle:string;color:string};
let pending:Promise<{sponsors:Banner[]}>|undefined,loadedAt=0;
export function SponsorBanner({slot}:{slot:number}){const [banner,setBanner]=useState<Banner>();const ref=useRef<HTMLAnchorElement>(null);
 useEffect(()=>{let active=true;if(!pending||Date.now()-loadedAt>30000){loadedAt=Date.now();pending=fetch('/api/sponsors').then(r=>{if(!r.ok)throw new Error();return r.json();});}pending.then(j=>{if(active)setBanner(j.sponsors.find(s=>s.slot===slot));}).catch(()=>{pending=undefined;});return()=>{active=false;};},[slot]);
 useEffect(()=>{const element=ref.current;if(!element||!banner)return;let timer:ReturnType<typeof setTimeout>|undefined;const observer=new IntersectionObserver(entries=>{if(entries[0]?.intersectionRatio>=.5){timer=setTimeout(()=>{navigator.sendBeacon('/api/sponsors/view',banner.id);observer.disconnect();},1000);}else if(timer)clearTimeout(timer);},{threshold:.5});observer.observe(element);return()=>{observer.disconnect();if(timer)clearTimeout(timer);};},[banner]);
 if(!banner)return null;return <a ref={ref} className="sponsor-banner" style={{borderColor:/^#[0-9a-f]{6}$/i.test(banner.color)?banner.color:undefined}} href={`/api/sponsors/click?id=${encodeURIComponent(banner.id)}`} rel="sponsored noopener" target="_blank"><small>Sponsored</small><strong>{banner.title}</strong><span>{banner.subtitle}</span></a>;}
