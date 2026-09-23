import {platform,currentUser,sameOrigin} from '../../../../lib/platform';
import {exportTalent} from '../../../../lib/talent';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Forbidden',{status:403});const env=await platform(),user=await currentUser(env,request);if(!user)return new Response('Sign in first',{status:401});
 const form=await request.formData();if(form.get('acknowledge')!=='1')return new Response('Confirm the permitted recruiting use',{status:400});
 try{const result=await exportTalent(env.DB,user.id,{query:String(form.get('q')||''),skill:String(form.get('skill')||''),location:String(form.get('location')||''),language:String(form.get('language')||'')},String(form.get('after')||''));return new Response('\uFEFF'+result.csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="recruiter-candidates.csv"','Cache-Control':'private, no-store',...(result.after?{'X-Next-Cursor':result.after}:{}),'X-Exported-Count':String(result.count)}});}
 catch{return new Response('Active verified recruiter access required',{status:403});}
}
