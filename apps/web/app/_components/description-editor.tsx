"use client";
import {useEffect,useRef} from 'react';
import {sanitizeJobDescriptionHtml} from '../../lib/jobs/sanitize-description';
export function DescriptionEditor({value,onChange,disabled}:{value:string;onChange:(html:string)=>void;disabled?:boolean}){
 const editor=useRef<HTMLDivElement>(null),last=useRef<string|null>(null);
 useEffect(()=>{if(editor.current&&last.current!==value){editor.current.innerHTML=sanitizeJobDescriptionHtml(value);last.current=value;}},[value]);
 function save(){const html=sanitizeJobDescriptionHtml(editor.current?.innerHTML||'');last.current=html;onChange(html);}
 function format(command:string,argument?:string){editor.current?.focus();document.execCommand(command,false,argument);save();}
 return <div><label id="description-label">Job description</label><div role="toolbar" aria-label="Description formatting">
 {([['Bold','bold'],['Italic','italic'],['Bullets','insertUnorderedList'],['Numbered list','insertOrderedList']] as const).map(([label,command])=><button key={command} type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>format(command)}>{label}</button>)}
 <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>format('formatBlock','h2')}>Heading</button>
 <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>format('formatBlock','p')}>Paragraph</button>
 <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>format('undo')}>Undo</button>
 </div><div ref={editor} role="textbox" aria-labelledby="description-label" aria-multiline="true" contentEditable={!disabled} suppressContentEditableWarning className="field__input" style={{minHeight:240,whiteSpace:'pre-wrap'}} onInput={save} onPaste={e=>{e.preventDefault();format('insertText',e.clipboardData.getData('text/plain'));}}/>
 <input type="hidden" name="descriptionHtml" value={value}/><small>Include responsibilities, requirements and what you offer (at least 80 characters).</small></div>;
}
