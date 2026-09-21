'use client';
import {searchHref, type SearchState} from '../../lib/jobs/search-state';
import {useEffect,useId,useState} from 'react';
type Suggestion={label:string;kind:'tag'|'company';value:string};
export function SearchInput({defaultQuery='',remoteActive=false,filters={}}:{defaultQuery?:string;remoteActive?:boolean;filters?:SearchState}){
 const [query,setQuery]=useState(defaultQuery),[items,setItems]=useState<Suggestion[]>([]),[open,setOpen]=useState(false),[active,setActive]=useState(-1);const id=useId();
 useEffect(()=>{const ctrl=new AbortController();const timer=setTimeout(()=>{if(query.trim().length<2){setItems([]);return;}fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`,{signal:ctrl.signal}).then(r=>r.json()).then((j:{suggestions:Suggestion[]})=>{setItems(j.suggestions);setActive(-1);}).catch(()=>{});},180);return()=>{clearTimeout(timer);ctrl.abort();};},[query]);
 useEffect(()=>{setQuery(defaultQuery);},[defaultQuery]);
 function href(item:Suggestion){return searchHref({...filters,...(remoteActive?{remote:'1'}:{})},{q:undefined,[item.kind]:item.value,...(item.kind==='tag'?{tags:undefined}:{})});}
 return <span style={{position:'relative',display:'block',width:'100%'}}><input name="q" type="search" role="combobox" aria-label="Search jobs, skills or companies" aria-autocomplete="list" aria-expanded={open&&items.length>0} aria-controls={id} aria-activedescendant={active>=0?`${id}-${active}`:undefined} placeholder="Search" value={query} onChange={e=>{setQuery(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),150)} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);setActive(-1);}else if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(Math.min(active+1,items.length-1));}else if(e.key==='ArrowUp'){e.preventDefault();setActive(Math.max(active-1,0));}else if(e.key==='Enter'&&open&&items[active]){e.preventDefault();window.location.assign(href(items[active]));}}}/>
 {open&&items.length?<ul id={id} role="listbox" className="search-suggestions">{items.map((item,i)=><li role="option" aria-selected={i===active} id={`${id}-${i}`} key={`${item.kind}:${item.value}`}><a href={href(item)} tabIndex={-1}>{item.label} <small>{item.kind}</small></a></li>)}</ul>:null}</span>;
}
