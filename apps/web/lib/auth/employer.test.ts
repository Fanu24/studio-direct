import {beforeEach,expect,it} from 'vitest';
import {testDatabase} from '../test-db';
import {employerAccessResponse,saveEmployer,loadEmployer} from './employer';
import {loginDestinations} from './portals';
let state:ReturnType<typeof testDatabase>;
beforeEach(()=>{state=testDatabase();state.sql.exec("INSERT INTO users(id,tenant_id,email,created_at) VALUES('one','tenant:gaming','one@example.com','2026-01-01'),('two','tenant:gaming','two@example.com','2026-01-01')");});
it('has separate candidate and employer onboarding destinations for both login methods',()=>{
 expect(loginDestinations('candidate')).toMatchObject({callbackURL:'/dashboard',newUserCallbackURL:'/onboarding?next=%2Fdashboard'});
 expect(loginDestinations('employer')).toMatchObject({callbackURL:'/employer',newUserCallbackURL:'/employer/onboarding?next=%2Femployer'});
 expect(loginDestinations('employer','/post-web3-job/bundle').callbackURL).toBe('/post-web3-job/bundle');
});
it.each(['https://evil.com','//evil.com','/\\evil.com','/\nevil.com'])('does not redirect authentication outside the app: %s',url=>expect(loginDestinations('employer',url).callbackURL).toBe('/employer'));
it('requires a separate company account and keeps it isolated from other users',async()=>{
 expect((await employerAccessResponse(state.db,'one'))?.status).toBe(403);
 await saveEmployer(state.db,'one',{companyName:'Company',companyUrl:'https://company.com',contactName:'Tester'});
 expect(await employerAccessResponse(state.db,'one')).toBeNull();
 expect(await loadEmployer(state.db,'one')).toMatchObject({company_name:'Company'});
 expect(await loadEmployer(state.db,'two')).toBeNull();
 await expect(saveEmployer(state.db,'two',{companyName:'Company',companyUrl:'javascript:alert(1)',contactName:'Tester'})).rejects.toThrow();
});
