import {expect,it,vi} from 'vitest';
import {parseAdditionalUserInputFromProviderProfile,parseUserInput} from 'better-auth/db';
import {createAuth,type AuthEnv} from './index';
import {testDatabase} from '../test-db';
// Exercise Better Auth's real provider parser and our hook, without starting its D1 adapter in Node.
vi.mock('better-auth',()=>({betterAuth:(options:unknown)=>({options})}));

it('accepts a Google profile without internal tenant data and assigns the tenant on the server',async()=>{
 const {db}=testDatabase();
 const auth=createAuth({DB:db,EMAIL:{send:async()=>{}},EMAIL_FROM:'test@example.com',BETTER_AUTH_URL:'http://localhost:3000',BETTER_AUTH_SECRET:'test-only-secret-for-google-tenant-regression',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test'} as AuthEnv);
 expect(()=>parseAdditionalUserInputFromProviderProfile(auth.options,{name:'Tester',email:'candidate@example.com'},'create')).not.toThrow();
 // Client input cannot set the tenant; provider input is overwritten by the hook.
 expect(()=>parseUserInput(auth.options,{tenantId:'attacker-tenant'},'create')).toThrow();
 const before=auth.options.databaseHooks!.user!.create!.before!;
 const result=await before({id:'candidate',name:'Tester',email:'candidate@example.com',emailVerified:true,createdAt:new Date(),updatedAt:new Date(),tenantId:'attacker-tenant'} as never);
 expect(result).toMatchObject({data:{tenantId:'tenant:gaming'}});
});
