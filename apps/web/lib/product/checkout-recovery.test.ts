import {afterEach,expect,it,vi} from 'vitest';
import {recoverProductCheckout} from './checkout-recovery';
const known={id:'cs_known',livemode:false,metadata:{orderId:'order'},status:'open',url:'https://checkout.stripe.com/c/pay/cs_known'};
const recover=()=>recoverProductCheckout('sk_test_fixture','cs_known','order','orderId','/employer/purchase?order=order');
afterEach(()=>vi.unstubAllGlobals());
it('resumes open checkout, routes complete checkout to status, and allows an explicit restart only when expired',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json(known)).mockResolvedValueOnce(Response.json({...known,status:'complete',url:null})).mockResolvedValueOnce(Response.json({...known,status:'expired',url:null}));vi.stubGlobal('fetch',fetcher);
  expect(await recover()).toEqual({expired:false,url:known.url});
  expect(await recover()).toEqual({expired:false,url:'/employer/purchase?order=order'});
  expect(await recover()).toEqual({expired:true});
  for(const [_url,options] of fetcher.mock.calls)expect(options.method).toBeUndefined();
});
it('does not create a second payment when Stripe is unavailable or the stored session identity is inconsistent',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  for(const changed of [{livemode:true},{id:'cs_other'},{metadata:{orderId:'other'}},{status:'unknown'},{url:'https://attacker.example/'}]){
    fetcher.mockResolvedValueOnce(Response.json({...known,...changed}));await expect(recover()).rejects.toThrow();
  }
  fetcher.mockResolvedValueOnce(new Response('',{status:503}));await expect(recover()).rejects.toThrow();
});
