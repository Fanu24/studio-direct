'use client';
import {useEffect,useState} from 'react';
import {DEFAULT_JOB_ADDONS,LANGUAGE_LEVELS,SALARY_CURRENCIES,SALARY_PERIODS,UTC_OFFSETS,formatUtcOffset,money,pricing,quoteJob,validatePostingDraft,PostingValidationError,
  type JobAddons,type JobQuoteContext,type PostingDraft,type PostingErrors} from '@gaming/shared';
import {DescriptionEditor} from '../description-editor';
import {ReferencePicker,type ReferenceChoice} from './reference-picker';

type Draft = Omit<PostingDraft,'salaryMin'|'salaryMax'> & {salaryMin:number|'';salaryMax:number|''};
const EMPTY:Draft={title:'',descriptionHtml:'',companyId:null,companyName:'',companyUrl:'',salaryMin:'',salaryMax:'',salaryCurrency:'USD',salaryPeriod:'yearly',cryptoPaymentAvailable:false,
  workArrangement:'remote',cityIds:[],eligibility:{mode:'geo',regionIds:[]},requiredSkillIds:[],preferredSkillIds:[],languages:[],benefitSlugs:[],applyMode:'redirect',applyUrl:'',applicationsEmail:'',companyX:'',companyLinkedin:''};
const PAY_AS_YOU_GO:JobQuoteContext={plan:null,availableCredits:0,postsPublishedInPeriod:0,activePosts:0,firstPost:false,earlyAccessFreeFirstPost:false};
export function JobPostForm({earlyAccessEnabled=false}:{earlyAccessEnabled?:boolean}) {
  const [draft,setDraft]=useState<Draft>(EMPTY),[addons,setAddons]=useState<JobAddons>({...DEFAULT_JOB_ADDONS}),[errors,setErrors]=useState<PostingErrors>({}),[busy,setBusy]=useState(false),[orderId,setOrderId]=useState('');
  const [company,setCompany]=useState<ReferenceChoice[]>([]),[cities,setCities]=useState<ReferenceChoice[]>([]),[regions,setRegions]=useState<ReferenceChoice[]>([]),[requiredSkills,setRequiredSkills]=useState<ReferenceChoice[]>([]),[preferredSkills,setPreferredSkills]=useState<ReferenceChoice[]>([]),[languages,setLanguages]=useState<ReferenceChoice[]>([]),[benefits,setBenefits]=useState<ReferenceChoice[]>([]);
  const quote=quoteJob(addons,PAY_AS_YOU_GO);
  useEffect(()=>{setOrderId('');},[draft,addons]);
  function change<K extends keyof Draft>(key:K,value:Draft[K]){setDraft(current=>({...current,[key]:value}));}
  function validation():PostingErrors {
    const element=document.createElement('div');element.innerHTML=draft.descriptionHtml;
    try{validatePostingDraft(draft,element.textContent??'');return {};}catch(error){return error instanceof PostingValidationError?error.fields:{form:'Check your job details.'};}
  }
  function blur(key:keyof PostingDraft){const result=validation();setErrors(current=>({...current,[key]:result[key]}));}
  function issue(key:keyof PostingDraft){return errors[key]?<p id={`error-${key}`} role="alert">{errors[key]}</p>:null;}
  const required=<span aria-label="required" style={{color:'#bc1c32'}}> *</span>;
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();const issues=validation();setErrors(issues);if(Object.keys(issues).length)return;
    setBusy(true);const id=orderId||crypto.randomUUID();setOrderId(id);
    try{const response=await fetch('/api/product/jobs/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,listing:draft,addons})});
      const data=await response.json();if(data.login){window.location.assign(data.login);return;}if(!response.ok){setErrors(data.fields??{form:data.error??'Checkout unavailable.'});setBusy(false);return;}window.location.assign(data.url);
    }catch{setErrors({form:'Unable to reach checkout. Your fields are still here; please retry.'});setBusy(false);}
  }
  return <form className="commerce-form stack" onSubmit={submit} noValidate><fieldset disabled={busy} className="stack">
    <legend>Job details</legend>
    <label htmlFor="job-title">Job title{required}</label><input id="job-title" value={draft.title} maxLength={120} required onChange={event=>change('title',event.target.value)} onBlur={()=>blur('title')} aria-invalid={!!errors.title} aria-describedby={errors.title?'error-title':undefined}/>{issue('title')}
    <DescriptionEditor value={draft.descriptionHtml} onChange={value=>change('descriptionHtml',value)} minLength={200} headingLevel="h3" required onBlur={()=>blur('descriptionHtml')} error={errors.descriptionHtml}/>
    <ReferencePicker label="Company name" kind="companies" required value={company} allowNewCompany onChange={value=>{setCompany(value);setDraft(current=>({...current,companyId:value[0]&&value[0].id!=='new-company'?String(value[0].id):null,companyName:value[0]?.name??'',companyUrl:value[0]?.domain?`https://${value[0].domain}`:current.companyUrl}));}} error={errors.companyName??errors.companyId}/>
    <label htmlFor="company-website">Company website{required}</label><input id="company-website" type="url" placeholder="https://" required value={draft.companyUrl} onChange={event=>change('companyUrl',event.target.value)} onBlur={()=>blur('companyUrl')} aria-invalid={!!errors.companyUrl}/>{issue('companyUrl')}
    <fieldset><legend>Salary range{required}</legend><label>Minimum<input type="number" min="0" step="0.01" required value={draft.salaryMin} onChange={event=>change('salaryMin',event.target.value===''?'':Number(event.target.value))} onBlur={()=>blur('salaryMin')} aria-invalid={!!errors.salaryMin}/></label>{issue('salaryMin')}
      <label>Maximum<input type="number" min="0" step="0.01" required value={draft.salaryMax} onChange={event=>change('salaryMax',event.target.value===''?'':Number(event.target.value))} onBlur={()=>blur('salaryMax')} aria-invalid={!!errors.salaryMax}/></label>{issue('salaryMax')}
      <label>Currency<select value={draft.salaryCurrency} onChange={event=>change('salaryCurrency',event.target.value as Draft['salaryCurrency'])}>{SALARY_CURRENCIES.map(currency=><option key={currency}>{currency}</option>)}</select></label>
      <label>Period<select value={draft.salaryPeriod} onChange={event=>change('salaryPeriod',event.target.value as Draft['salaryPeriod'])}>{SALARY_PERIODS.map(period=><option key={period} value={period}>{period[0].toUpperCase()+period.slice(1)}</option>)}</select></label>
      <label><input type="checkbox" checked={draft.cryptoPaymentAvailable} onChange={event=>change('cryptoPaymentAvailable',event.target.checked)}/>Salary or fee can be paid in crypto</label>
      <label><input type="checkbox" checked={addons.hideSalary} onChange={event=>setAddons(current=>({...current,hideSalary:event.target.checked}))}/>Hide salary range from the public (+{money(pricing.addons.hideSalary)})</label><p>Hidden salary ranges remain required and can contribute to anonymous salary statistics.</p>
    </fieldset>
    <fieldset><legend>Work arrangement{required}</legend>{(['remote','hybrid','onsite'] as const).map(value=><label key={value}><input type="radio" name="arrangement" checked={draft.workArrangement===value} onChange={()=>change('workArrangement',value)}/>{value==='onsite'?'On-site':value==='remote'?'Remote':'Hybrid'}</label>)}</fieldset>
    {draft.workArrangement!=='remote'?<ReferencePicker label="Location" kind="cities" value={cities} max={5} required onChange={value=>{setCities(value);change('cityIds',value.map(item=>Number(item.id)));}} error={errors.cityIds}/>:<fieldset className="stack"><legend>Candidate eligibility{required}</legend>
      <label><input type="checkbox" checked={draft.eligibility?.mode==='timezone'} onChange={event=>change('eligibility',event.target.checked?{mode:'timezone',utcFrom:-720,utcTo:840}:{mode:'geo',regionIds:regions.map(item=>String(item.id))})}/>Restrict by time zone instead</label>
      {draft.eligibility?.mode==='timezone'?<div>{(['utcFrom','utcTo'] as const).map((key,index)=><label key={key}>{index?'To':'From'}<select value={draft.eligibility?.mode==='timezone'?draft.eligibility[key]:0} onChange={event=>{if(draft.eligibility?.mode==='timezone')change('eligibility',{...draft.eligibility,[key]:Number(event.target.value)});}}>{UTC_OFFSETS.map(offset=><option key={offset} value={offset}>{formatUtcOffset(offset)}</option>)}</select></label>)}<p>A range whose end is earlier than its start wraps across the date line.</p>{issue('eligibility')}</div>:
        <ReferencePicker label="Countries, territories and regions" kind="regions" value={regions} max={280} required onChange={value=>{setRegions(value);change('eligibility',{mode:'geo',regionIds:value.map(item=>String(item.id))});}} error={errors.eligibility}/>}
    </fieldset>}
    <ReferencePicker label="Required skills" kind="skills" value={requiredSkills} max={3} required onChange={value=>{setRequiredSkills(value);change('requiredSkillIds',value.map(item=>String(item.id)));}} error={errors.requiredSkillIds}/>
    <ReferencePicker label="Languages" kind="languages" value={languages} max={3} required onChange={value=>{setLanguages(value);change('languages',value.map(item=>draft.languages.find(language=>language.code===item.id)??{code:String(item.id),level:'C1',kind:'required'}));}} error={errors.languages}/>
    {draft.languages.map(language=><fieldset key={language.code}><legend>{languages.find(item=>item.id===language.code)?.name??language.code}</legend>
      <label>Level<select value={language.level} onChange={event=>change('languages',draft.languages.map(item=>item.code===language.code?{...item,level:event.target.value as typeof item.level}:item))}>{LANGUAGE_LEVELS.map(level=><option key={level}>{level}</option>)}</select></label>
      <label>Requirement<select value={language.kind} onChange={event=>change('languages',draft.languages.map(item=>item.code===language.code?{...item,kind:event.target.value as typeof item.kind}:item))}><option value="required">Required</option><option value="preferred">Preferred</option></select></label></fieldset>)}
    <fieldset><legend>Application method{required}</legend>{(['redirect','email'] as const).map(value=><label key={value}><input type="radio" name="apply-mode" checked={draft.applyMode===value} onChange={()=>change('applyMode',value)}/>{value==='redirect'?'Redirect to a website':'Email'}</label>)}</fieldset>
    {draft.applyMode==='redirect'?<label>Application URL{required}<input type="url" required value={draft.applyUrl} onChange={event=>change('applyUrl',event.target.value)} onBlur={()=>blur('applyUrl')} aria-invalid={!!errors.applyUrl}/>{issue('applyUrl')}</label>:<label>Applications email{required}<input type="email" required value={draft.applicationsEmail} onChange={event=>change('applicationsEmail',event.target.value)} onBlur={()=>blur('applicationsEmail')} aria-invalid={!!errors.applicationsEmail}/>{issue('applicationsEmail')}</label>}
    <ReferencePicker label="Preferred skills" kind="skills" value={preferredSkills} max={12} onChange={value=>{setPreferredSkills(value);change('preferredSkillIds',value.map(item=>String(item.id)));}} error={errors.preferredSkillIds}/>
    <ReferencePicker label="Benefits" kind="benefits" value={benefits} max={40} onChange={value=>{setBenefits(value);change('benefitSlugs',value.map(item=>String(item.id)));}} error={errors.benefitSlugs}/>
    <label>Company X profile<input type="url" value={draft.companyX} onChange={event=>change('companyX',event.target.value)} onBlur={()=>blur('companyX')}/>{issue('companyX')}</label>
    <label>Company LinkedIn profile<input type="url" value={draft.companyLinkedin} onChange={event=>change('companyLinkedin',event.target.value)} onBlur={()=>blur('companyLinkedin')}/>{issue('companyLinkedin')}</label>
    <fieldset><legend>Listing options</legend><label>Pinned placement<select value={addons.pinDays} onChange={event=>setAddons(current=>({...current,pinDays:Number(event.target.value) as JobAddons['pinDays']}))}><option value="0">No pin</option>{Object.entries(pricing.addons.pin).map(([days,amount])=><option key={days} value={days}>{days} {days==='1'?'day':'days'} · {money(amount)}</option>)}</select></label>
      {earlyAccessEnabled?<label><input type="checkbox" checked={addons.earlyAccess} onChange={event=>setAddons(current=>({...current,earlyAccess:event.target.checked}))}/>Early Access ({pricing.addons.earlyAccess.hours}h) +{money(pricing.addons.earlyAccess.price)}</label>:null}</fieldset>
    <section aria-label="Order summary"><h2>Order summary</h2><p>Job post · {quote.durationDays} days. Company page claim included; ownership verification is required.</p>
      <ul>{quote.lines.map(line=><li key={line.code}>{{job:'Job post',hide_salary:'Hide salary range',pin:'Pinned placement',early_access:'Early Access',confidential:'Confidential post'}[line.code]}: {money(line.amountCents)}</li>)}</ul><p><strong>Total: {money(quote.totalCents)}</strong> before coupon discounts and tax. Enter your coupon at Stripe checkout.</p></section>
    {errors.form?<p role="alert">{errors.form}</p>:null}<button type="submit">{busy?'Opening checkout…':`Continue to checkout · ${money(quote.totalCents)}`}</button>
  </fieldset></form>;
}
