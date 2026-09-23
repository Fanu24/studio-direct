'use client';
import {useState} from 'react';
import {ReferencePicker,type ReferenceChoice} from './reference-picker';
export function TalentSkillFilters({initial}:{initial:ReferenceChoice[]}){const [skills,setSkills]=useState(initial);return <><ReferencePicker kind="skills" label="Skills" max={30} value={skills} onChange={setSkills}/><input type="hidden" name="skills" value={skills.map(s=>s.id).join(',')}/></>;}
