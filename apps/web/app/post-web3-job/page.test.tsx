import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
vi.stubGlobal('React',React);
const flags=vi.hoisted(()=>({enabled:false}));
vi.mock('../../lib/platform',()=>({platform:async()=>({DB:{}}),currentUser:vi.fn()}));
vi.mock('../../lib/tenant',()=>({requireTenantId:async()=>'tenant'}));
vi.mock('../../lib/product/flags',()=>({loadProductFlags:async()=>({PRODUCT_POSTING_V2:flags.enabled})}));
it('offers the reference listing options and USD checkout instead of candidate plans',async()=>{const {default:Page}=await import('./page');const html=renderToStaticMarkup(await Page({}));expect(html).toContain('Job details');expect(html).toContain('$695.00');expect(html).toContain('Automatically renew every 30 days');expect(html).toContain('Continue to payment');expect(html).not.toContain('€9');});
it('mounts the new offer for a first-time buyer and does not sell unfinished features',async()=>{
 flags.enabled=true;try{const {default:Page}=await import('./page');const html=renderToStaticMarkup(await Page({}));expect(html).toContain('$129.00');expect(html).toContain('Company page claim included');expect(html).toContain('Candidate eligibility');expect(html).not.toContain('Automatically renew');expect(html).not.toContain('Save with a job bundle');expect(html).not.toContain('Confidential post');expect(html).not.toContain('Early Access');}finally{flags.enabled=false;}
});
