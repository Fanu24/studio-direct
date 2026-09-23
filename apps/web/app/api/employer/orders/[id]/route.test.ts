import {beforeEach,it,expect,vi} from 'vitest';
import {testDatabase} from '../../../../../lib/test-db';
const m=vi.hoisted(()=>({env:{} as any,user:vi.fn()}));
vi.mock('../../../../../lib/platform',()=>({platform:async()=>m.env,currentUser:m.user}));
beforeEach(()=>{
 const state=testDatabase();m.env={DB:state.db};
 state.sql.exec("INSERT INTO users(id,tenant_id,email,created_at) VALUES('owner','tenant:gaming','owner@example.com','2026-01-01'); INSERT INTO employer_orders(id,tenant_id,user_id,kind,payload_json,selection_json,total_cents,created_at) VALUES('order-1','tenant:gaming','owner','bundle','null','{}',100,'2026-01-01')");
 m.user.mockResolvedValue({id:'owner'});
});
it('returns confirmation status only to the owner with caching disabled',async()=>{
 const {GET}=await import('./route');const response=await GET(new Request('http://localhost/api/employer/orders/order-1'),{params:Promise.resolve({id:'order-1'})});
 expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toEqual({id:'order-1',status:'pending'});
});
it('does not disclose another employer order or allow unauthenticated polling',async()=>{
 const {GET}=await import('./route');const request=new Request('http://localhost/api/employer/orders/order-1'),params={params:Promise.resolve({id:'order-1'})};
 m.user.mockResolvedValue({id:'other'});expect((await GET(request,params)).status).toBe(404);
 m.user.mockResolvedValue(null);expect((await GET(request,params)).status).toBe(401);
});
