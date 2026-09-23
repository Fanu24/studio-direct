"use client";
import {useEffect,useRef,useId} from 'react';
import {sanitizeJobDescriptionHtml} from '../../lib/jobs/sanitize-description';
export function DescriptionEditor({value,onChange,disabled,minLength=80,headingLevel='h2',required=false,onBlur,error}:{value:string;onChange:(html:string)=>void;disabled?:boolean;minLength?:number;headingLevel?:'h2'|'h3';required?:boolean;onBlur?:()=>void;error?:string}){
 const editor=useRef<HTMLDivElement>(null),last=useRef<string|null>(null),id=useId();
 useEffect(()=>{if(editor.current&&last.current!==value){editor.current.innerHTML=sanitizeJobDescriptionHtml(value);last.current=value;}},[value]);
 function save(){const html=sanitizeJobDescriptionHtml(editor.current?.innerHTML||'');last.current=html;onChange(html);}
 function format(command:string,argument?:string){editor.current?.focus();document.execCommand(command,false,argument);save();}
 return <div><label id={`${id}-label`}>Job description{required?<span aria-label="required" style={{color:'#bc1c32'}}> *</span>:null}</label><div role="toolbar" aria-label="Description formatting">
 {([['Bold','bold'],['Italic','italic'],['Bullets','insertUnorderedList'],['Numbered list','insertOrderedList']] as const).map(([label,command])=><button key={command} type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>format(command)}>{label}</button>)}
 <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>format('formatBlock',headingLevel)}>Heading</button>
 <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>{const value=window.prompt('Enter the link URL (https://)');if(!value)return;try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password)format('createLink',url.href);}catch{}}}>Link</button>
 <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>format('formatBlock','p')}>Paragraph</button>
 <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>format('undo')}>Undo</button>
 </div><div ref={editor} role="textbox" aria-labelledby={`${id}-label`} aria-required={required} aria-invalid={!!error} aria-describedby={error?`${id}-error`:`${id}-help`} aria-multiline="true" contentEditable={!disabled} suppressContentEditableWarning className="field__input" style={{minHeight:240,whiteSpace:'pre-wrap'}} onBlur={onBlur} onInput={save} onPaste={e=>{e.preventDefault();format('insertText',e.clipboardData.getData('text/plain'));}}/>
 <input type="hidden" name="descriptionHtml" value={value}/><small id={`${id}-help`}>Include responsibilities, requirements and what you offer (at least {minLength} characters).</small>{error?<p id={`${id}-error`} role="alert">{error}</p>:null}</div>;
}
