import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {testDatabase} from '../../../../lib/test-db';
const mocks=vi.hoisted(()=>({env:{},session:null as any,remove:vi.fn(),cancel:vi.fn(async()=>{})}));
vi.mock('@opennextjs/cloudflare',()=>({getCloudflareContext:async()=>({env:mocks.env})}));
vi.mock('../../../../lib/auth/index',()=>({createAuth:()=>({api:{getSession:async()=>mocks.session}})}));
vi.mock('../../../../lib/billing/reversals',()=>({prepareCommerceDeletion:mocks.cancel}));
import {POST} from './route';
let state:ReturnType<typeof testDatabase>;
beforeEach(()=>{state=testDatabase();vi.clearAllMocks();state.sql.exec("INSERT INTO users(id,tenant_id,email,created_at) VALUES('owner','tenant:gaming','owner@example.test','2020-01-01'),('other','tenant:gaming','other@example.test','2020-01-01');INSERT INTO profiles(user_id,cv_r2_key) VALUES('owner','cv/owner/fixture.pdf');INSERT INTO support_tickets(id,tenant_id,user_id,subject,body,created_at,updated_at) VALUES('ticket','tenant:gaming','owner','Personal support','Private support body','2020','2020')");mocks.session={user:{id:'owner'}};mocks.env={DB:state.db,FILES:{delete:mocks.remove}};});
afterEach(()=>state.sql.close());
function request(confirm='DELETE'){return new Request('http://localhost/api/account/delete',{method:'POST',headers:{origin:'http://localhost'},body:new URLSearchParams({confirm})});}
it('requires login before deleting anything',async()=>{mocks.session=null;expect((await POST(request())).status).toBe(401);expect(mocks.remove).not.toHaveBeenCalled();});
it('requires the explicit deletion phrase',async()=>{expect((await POST(request(''))).status).toBe(400);expect(mocks.cancel).not.toHaveBeenCalled();});
it('removes private files and support data, retaining the other account',async()=>{const response=await POST(request());expect(response.status).toBe(303);expect(mocks.cancel).toHaveBeenCalled();expect(mocks.remove).toHaveBeenCalledWith('cv/owner/fixture.pdf');expect(mocks.remove).toHaveBeenCalledWith('profile-photos/owner');expect(state.sql.prepare('SELECT id FROM users').all()).toEqual([{id:'other'}]);expect(state.sql.prepare('SELECT COUNT(*) n FROM support_tickets').get().n).toBe(0);});
