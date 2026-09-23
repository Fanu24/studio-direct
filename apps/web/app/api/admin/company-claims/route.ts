import {platform,sameOrigin} from '../../../../lib/platform';
import {adminUser} from '../../../../lib/admin';
import {requireTenantId} from '../../../../lib/tenant';
import {approveCompanyClaim} from '../../../../lib/product/company-claims';

export async function POST(request:Request) {
  if(!sameOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
  const env=await platform(),admin=await adminUser(env,request);
  if(!admin)return Response.json({error:'Admin access required.'},{status:403});
  const form=await request.formData(),claimId=form.get('claimId'),reason=form.get('reason');
  if(typeof claimId!=='string'||typeof reason!=='string')return Response.json({error:'Record the ownership verification.'},{status:400});
  try{await approveCompanyClaim(env.DB,{claimId,reason,tenantId:await requireTenantId(env.DB),adminId:admin.id});}
  catch(error){return Response.json({error:error instanceof Error?error.message:'Unable to approve claim.'},{status:409});}
  return Response.redirect(new URL('/admin/company-claims',request.url),303);
}
