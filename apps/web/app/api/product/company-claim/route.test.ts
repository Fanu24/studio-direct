import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createHmac} from 'node:crypto';
import {pricing} from '@gaming/shared';
import {testDatabase} from '../../../../lib/test-db';
import {companyAccountActive,companyIsClaimed} from '../../../../lib/product/company-claims';
const runtime = vi.hoisted(()=>({env:{} as Record<string,any>, user:null as {id:string;email:string;emailVerified:boolean}|null}));
vi.mock('../../../../lib/platform',()=>({platform:async()=>runtime.env,currentUser:async()=>runtime.user,
  sameOrigin:(request:Request)=>request.headers.get('origin')===new URL(request.url).origin,appOrigin:()=>runtime.env.SITE_URL}));
vi.mock('@opennextjs/cloudflare',()=>({getCloudflareContext:async()=>({env:runtime.env})}));
import {POST as claimCheckout} from './route';
import {POST as webhook} from '../../stripe/webhook/route';
import {POST as approveClaim} from '../../admin/company-claims/route';
let state:ReturnType<typeof testDatabase>;
const origin='https://nodework.example.com', id='12345678-1234-1234-1234-123456789abc';
const secret='whsec_unit_test_only';
function request(body:unknown) {return new Request(origin+'/api/product/company-claim',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
function signed(type:string,object:unknown) {
  const payload=JSON.stringify({id:'evt_'+type,created:Math.floor(Date.now()/1000),type,data:{object}}),timestamp=Math.floor(Date.now()/1000);
  const signature=createHmac('sha256',secret).update(`${timestamp}.${payload}`).digest('hex');
  return new Request(origin+'/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body:payload});
}
beforeEach(()=>{
  state=testDatabase();
  state.sql.exec(`INSERT INTO users(id,tenant_id,email,email_verified,name,created_at) VALUES('buyer','tenant:gaming','buyer@example.com',1,'Buyer','2026-01-01'),('admin','tenant:gaming','admin@example.com',1,'Admin','2026-01-01');
    INSERT INTO companies(id,tenant_id,name,name_norm,domain,created_at) VALUES('company','tenant:gaming','Example','example','example.com','2026-01-01');`);
  runtime.env={DB:state.db,SITE_URL:origin,STRIPE_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_fixture_only',STRIPE_WEBHOOK_SECRET:secret,
    ADMIN_EMAILS:'admin@example.com',PRODUCT_POSTING_V2:'true',PRODUCT_COMPANY_CLAIMS:'true'};
  runtime.user={id:'buyer',email:'buyer@example.com',emailVerified:true};
});
afterEach(()=>{state.sql.close();vi.unstubAllGlobals();});
describe('company claim HTTP purchase journey',()=>{
  it('reuses the bound claim checkout and releases its reservation after confirmed expiry',async()=>{
    let status='open',creates=0;
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
      if(url.endsWith('/checkout/sessions')){creates++;return Response.json({id:'cs_claim',url:'https://checkout.stripe.com/c/pay/cs_claim',livemode:false});}
      return Response.json({id:'cs_claim',url:'https://checkout.stripe.com/c/pay/cs_claim',livemode:false,metadata:{claimOrderId:id},status});
    }));
    const body={id,companyId:'company',companyUrl:'https://example.com'};
    expect((await claimCheckout(request(body))).status).toBe(200);expect((await claimCheckout(request(body))).status).toBe(200);expect(creates).toBe(1);
    status='expired';const expired=await claimCheckout(request(body));expect(expired.status).toBe(409);expect((await expired.json()).restart).toBe(true);
    expect(state.sql.prepare('SELECT status FROM company_claim_orders').get().status).toBe('expired');expect(await companyAccountActive(state.db,'tenant:gaming','buyer')).toBe(false);
    // A fresh submission can reserve this company again without altering the old payment record.
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'cs_new_claim',url:'https://checkout.stripe.com/c/pay/cs_new_claim',livemode:false})));
    expect((await claimCheckout(request({...body,id:'12345678-1234-1234-1234-123456789def'}))).status).toBe(200);
    expect(state.sql.prepare('SELECT COUNT(*) n FROM company_claim_orders').get().n).toBe(2);
  });
  it('uses the configured price, activates only from a signed paid event, verifies ownership and revokes on refund',async()=>{
    const stripe=vi.fn(async(_url:string,init:RequestInit)=>{
      const body=init.body as URLSearchParams;
      expect(body.get('line_items[0][price_data][unit_amount]')).toBe(String(pricing.companyClaim));
      expect(body.get('allow_promotion_codes')).toBe('true');
      expect(body.get('metadata[claimOrderId]')).toBe(id);
      return Response.json({id:'cs_claim',url:'https://checkout.stripe.com/c/pay/cs_claim',livemode:false});
    });vi.stubGlobal('fetch',stripe);
    const checkout=await claimCheckout(request({id,companyId:'company',companyUrl:'https://example.com',total_cents:1}));
    expect(checkout.status).toBe(200);expect(await companyAccountActive(state.db,'tenant:gaming','buyer')).toBe(false);
    const session={id:'cs_claim',metadata:{claimOrderId:id},payment_status:'paid',currency:'usd',amount_subtotal:pricing.companyClaim,amount_total:pricing.companyClaim,payment_intent:'pi_claim'};
    expect((await webhook(signed('checkout.session.completed',session))).status).toBe(200);
    expect(await companyAccountActive(state.db,'tenant:gaming','buyer')).toBe(true);
    expect(await companyIsClaimed(state.db,'tenant:gaming','company')).toBe(false);
    const form=new URLSearchParams({claimId:`claim:purchase:claim:${id}`,reason:'Ownership independently verified by the administrator.'});
    const adminRequest=()=>new Request(origin+'/api/admin/company-claims',{method:'POST',headers:{origin},body:form});
    expect((await approveClaim(adminRequest())).status).toBe(403);
    runtime.user={id:'admin',email:'admin@example.com',emailVerified:true};
    expect((await approveClaim(adminRequest())).status).toBe(303);
    expect(await companyIsClaimed(state.db,'tenant:gaming','company')).toBe(true);
    expect(state.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n).toBe(0);
    expect((await webhook(signed('charge.refunded',{refunded:true,payment_intent:'pi_claim'}))).status).toBe(200);
    expect(await companyAccountActive(state.db,'tenant:gaming','buyer')).toBe(false);
    expect(await companyIsClaimed(state.db,'tenant:gaming','company')).toBe(false);
  });
  it('rejects untrusted origins, anonymous purchases, a disabled flag and live-mode checkout',async()=>{
    const body={id,companyId:'company',companyUrl:'https://example.com'};
    expect((await claimCheckout(new Request(origin+'/api/product/company-claim',{method:'POST',body:JSON.stringify(body)}))).status).toBe(403);
    runtime.user=null;expect((await claimCheckout(request(body))).status).toBe(401);
    runtime.user={id:'buyer',email:'buyer@example.com',emailVerified:true};runtime.env.PRODUCT_COMPANY_CLAIMS='false';
    expect((await claimCheckout(request(body))).status).toBe(404);
    runtime.env.PRODUCT_COMPANY_CLAIMS='true';runtime.env.STRIPE_SECRET_KEY='sk_live_fixture_only';
    expect((await claimCheckout(request(body))).status).toBe(503);
  });
  it('does not accept a forged payment webhook',async()=>{
    const response=await webhook(new Request(origin+'/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'t=1,v1=invalid'},body:JSON.stringify({type:'checkout.session.completed',data:{object:{metadata:{claimOrderId:id}}}})}));
    expect(response.status).toBe(400);expect(await companyAccountActive(state.db,'tenant:gaming','buyer')).toBe(false);
  });
  it('can reconcile a previously purchased claim after new claim sales are disabled',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
      if(url.endsWith('/checkout/sessions'))return Response.json({id:'cs_claim',url:'https://checkout.stripe.com/c/pay/cs_claim',livemode:false});
      if(url.includes('payment_intents'))return Response.json({id:'pi_claim',latest_charge:{refunded:false}});
      return Response.json({id:'cs_claim',livemode:false,metadata:{claimOrderId:id},payment_status:'paid',currency:'usd',amount_subtotal:pricing.companyClaim,amount_total:pricing.companyClaim,payment_intent:'pi_claim'});
    }));
    expect((await claimCheckout(request({id,companyId:'company',companyUrl:'https://example.com'}))).status).toBe(200);
    runtime.env.PRODUCT_COMPANY_CLAIMS='false';
    expect((await claimCheckout(request({id,companyId:'company',companyUrl:'https://example.com'}))).status).toBe(404);
    const reconciled=await claimCheckout(request({id,action:'reconcile'}));expect(reconciled.status).toBe(200);expect(await reconciled.json()).toEqual({status:'paid'});
    expect(await companyAccountActive(state.db,'tenant:gaming','buyer')).toBe(true);
  });
});
