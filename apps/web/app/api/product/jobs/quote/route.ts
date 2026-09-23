import {platform,currentUser} from '../../../../../lib/platform';
import {companyQuoteContext} from '../../../../../lib/product/company-plans';
import {loadProductFlags} from '../../../../../lib/product/flags';
import {requireTenantId} from '../../../../../lib/tenant';
export async function GET(request:Request){const env=await platform(),user=await currentUser(env,request);if(!user)return Response.json({context:null});const flags=await loadProductFlags(env.DB,await requireTenantId(env.DB),env);if(!flags.PRODUCT_COMPANY_PLANS)return Response.json({context:null});const id=new URL(request.url).searchParams.get('company')??'';return Response.json(await companyQuoteContext(env.DB,user.id,id,flags.EARLY_ACCESS_FREE_FIRST_POST),{headers:{'Cache-Control':'private, no-store'}});}
