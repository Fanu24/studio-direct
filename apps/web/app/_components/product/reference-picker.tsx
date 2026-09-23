'use client';
import {useEffect,useId,useRef,useState} from 'react';

export type ReferenceChoice = {id:string|number;name:string;domain?:string|null;region?:string;country_name?:string;native_name?:string};
type Kind = 'countries'|'companies'|'cities'|'regions'|'skills'|'benefits'|'languages';
export function ReferencePicker({label,kind,value,onChange,max=1,required=false,error,allowNewCompany=false,onBlur}:{label:string;kind:Kind;value:ReferenceChoice[];onChange:(value:ReferenceChoice[])=>void;max?:number;required?:boolean;error?:string;allowNewCompany?:boolean;onBlur?:()=>void}) {
  const id = useId(), [query,setQuery] = useState(''), [items,setItems] = useState<ReferenceChoice[]>([]), [open,setOpen] = useState(false), [active,setActive] = useState(0), [loading,setLoading] = useState(false), [failure,setFailure] = useState('');
  const input = useRef<HTMLInputElement>(null), selected = new Set(value.map(item=>String(item.id)));
  const choices = items.filter(item=>!selected.has(String(item.id)));
  const caption = (item:ReferenceChoice) => kind==='cities' ? `${item.name}, ${item.region}, ${item.country_name}` : kind==='languages'&&item.native_name!==item.name ? `${item.name} — ${item.native_name}` : item.name;
  useEffect(()=>{
    if (!open || (kind==='cities'&&query.trim().length<2)) {setItems([]);setLoading(false);return;}
    const controller = new AbortController(); setLoading(true);setFailure('');
    const timer = setTimeout(async()=>{
      try {const response=await fetch(`/api/product/reference?kind=${kind}&q=${encodeURIComponent(query)}`,{signal:controller.signal});if(!response.ok)throw Error('Suggestions are unavailable. Please retry.');const data=await response.json();setItems(data.items);setActive(0);}
      catch(error){if(!controller.signal.aborted)setFailure(error instanceof Error?error.message:'Suggestions unavailable.');}
      finally{if(!controller.signal.aborted)setLoading(false);}
    },150);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[query,kind,open]);
  function choose(item:ReferenceChoice) {if(value.length>=max)return;onChange([...value,item]);setQuery('');setOpen(false);input.current?.focus();}
  return <div className="stack" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null)){setOpen(false);onBlur?.();}}}>
    <label htmlFor={id}>{label}{required?<span aria-label="required" style={{color:'#bc1c32'}}> *</span>:null}</label>
    {value.length?<ul>{value.map(item=><li key={item.id}>{caption(item)} <button type="button" aria-label={`Remove ${item.name}`} onClick={()=>onChange(value.filter(entry=>entry.id!==item.id))}>Remove</button></li>)}</ul>:null}
    {value.length<max?<input ref={input} id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open&&choices[active]?`${id}-option-${active}`:undefined}
      aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} value={query} maxLength={100} placeholder={kind==='cities'?'Type at least 2 characters':'Search'} onFocus={()=>setOpen(true)} onChange={event=>{setQuery(event.target.value);setOpen(true);setActive(0);}}
      onKeyDown={event=>{if(event.key==='Escape'){setOpen(false);return;}if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);setActive(index=>Math.min(index+1,choices.length-1));}if(event.key==='ArrowUp'){event.preventDefault();setActive(index=>Math.max(0,index-1));}if(event.key==='Enter'&&open&&choices[active]){event.preventDefault();choose(choices[active]);}}}/>:null}
    {open&&value.length<max?<div><span role="status">{loading?'Loading suggestions…':failure||(!choices.length?'No matching suggestions.':'')}</span><ul role="listbox" id={`${id}-options`} aria-label={`${label} suggestions`}>
      {choices.map((item,index)=><li role="option" aria-selected={index===active} id={`${id}-option-${index}`} key={item.id} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(item)}>{caption(item)}</li>)}
    </ul></div>:null}
    {open&&allowNewCompany&&query.trim().length>=2&&!loading&&!failure&&!items.some(item=>item.name.toLowerCase()===query.trim().toLowerCase())?<button type="button" onClick={()=>choose({id:'new-company',name:query.trim()})}>Use “{query.trim()}” as a new company</button>:null}
    {kind==='skills'&&open&&query.trim().length>=2&&!loading&&!choices.length?<button type="button" onClick={async()=>{try{const response=await fetch('/api/product/skills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:query.trim()})});const result=await response.json();setFailure(result.message??result.error);}catch{setFailure('Could not submit the suggestion.');}}}>Suggest “{query.trim()}” for moderation</button>:null}
    {error?<p id={`${id}-error`} role="alert">{error}</p>:null}
  </div>;
}
