"use client";
import {useState} from 'react';
import {UTC_OFFSETS,formatUtcOffset} from '@gaming/shared';
import {ReferencePicker} from './reference-picker';
export function JobSearchFilters({values}:{values:Record<string,string>}){
 const [skills,setSkills]=useState((values.skills??'').split(',').filter(Boolean).map(id=>({id,name:id.replace(/^skill:/,'')})));
 const [countries,setCountries]=useState(values.eligible_country?[{id:values.eligible_country,name:values.eligible_country}]:[]);
 const [languages,setLanguages]=useState(values.language?[{id:values.language,name:values.language}]:[]);
 return <details><summary>More filters</summary><label>Work arrangement<select name="arrangement" defaultValue={values.arrangement??''}><option value="">All arrangements</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option></select></label><ReferencePicker kind="skills" label="Skills (all selected)" value={skills} onChange={v=>setSkills(v.map(s=>({id:String(s.id),name:s.name})))} max={30}/><input type="hidden" name="skills" value={skills.map(s=>s.id).join(',')}/><ReferencePicker kind="languages" label="Job language" value={languages} onChange={v=>setLanguages(v.map(s=>({id:String(s.id),name:s.name})))} max={1}/><input type="hidden" name="language" value={languages[0]?.id??''}/><ReferencePicker kind="countries" label="Remote jobs eligible from" value={countries} onChange={v=>setCountries(v.map(s=>({id:String(s.id),name:s.name})))} max={1}/><input type="hidden" name="eligible_country" value={countries[0]?.id??''}/><label>Remote timezone eligibility<select name="eligible_utc" defaultValue={values.eligible_utc??''}><option value="">Any timezone</option>{UTC_OFFSETS.map(n=><option key={n} value={n}>{formatUtcOffset(n)}</option>)}</select></label><p>Eligibility, language and skill filters show jobs with matching structured requirements.</p><button type="submit">Apply filters</button></details>;
}
