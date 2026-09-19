import {platform} from '../../lib/platform';
export async function ListingExtras({jobId}:{jobId:string}){
 const env=await platform(),raw=await env.DB.prepare('SELECT input_json FROM listing_details WHERE job_id=?').bind(jobId).first<string>('input_json');if(!raw)return null;
 const input=JSON.parse(raw) as {primarySkill?:string;benefits?:string[];twitterUrl?:string};
 return <section>{input.primarySkill?<p>Main skill: {input.primarySkill}</p>:null}{input.benefits?.length?<><h2>Benefits</h2><ul>{input.benefits.map(b=><li key={b}>{b}</li>)}</ul></>:null}{input.twitterUrl?<a href={input.twitterUrl} rel="noopener noreferrer nofollow">Company on X / Twitter</a>:null}</section>;
}
