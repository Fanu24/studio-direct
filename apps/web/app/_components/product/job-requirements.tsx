import {tagLabel,formatUtcOffset} from '@gaming/shared';
import type {JobDetail} from '../../../lib/jobs/queries';
const languageNames=new Intl.DisplayNames(['en'],{type:'language'});
export function JobRequirements({job}:{job:JobDetail}){
  const requirements=job.requirements;if(!requirements)return null;
  const skills=(ids:string[])=>ids.map(id=>tagLabel(id.replace(/^skill:/,''))).join(', ');
  return <section aria-label="Job requirements"><h3>Requirements and benefits</h3><dl>
    <dt>Required skills</dt><dd>{skills(requirements.requiredSkills)}</dd>
    {requirements.preferredSkills.length?<><dt>Preferred skills</dt><dd>{skills(requirements.preferredSkills)}</dd></>:null}
    <dt>Languages</dt><dd>{requirements.languages.map(language=>`${languageNames.of(language.code)??language.code} · ${language.level} (${language.kind})`).join(', ')}</dd>
    {requirements.benefits.length?<><dt>Benefits</dt><dd>{requirements.benefits.map(tagLabel).join(', ')}</dd></>:null}
    {requirements.eligibility?<><dt>Eligibility</dt><dd>{requirements.eligibility.mode==='timezone'?formatUtcOffset(requirements.eligibility.utcFrom)+' to '+formatUtcOffset(requirements.eligibility.utcTo):requirements.eligibility.countryCodes.map(code=>new Intl.DisplayNames(['en'],{type:'region'}).of(code)??code).join(', ')}</dd></>:null}
  </dl></section>;
}
