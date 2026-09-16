import {expect,it,vi} from 'vitest';
const view=vi.hoisted(()=>vi.fn(async (props)=>props));
vi.mock('../../_components/talent-directory',()=>({TalentDirectory:view}));
it('routes to the candidate directory',async()=>{const {default:Page}=await import('./page');await Page({params:Promise.resolve({skill:'solidity'})});expect(view).toHaveBeenCalled();});
