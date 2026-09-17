import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
vi.stubGlobal('React',React);
vi.mock('../../lib/platform',()=>({platform:vi.fn(),currentUser:vi.fn()}));
it('offers the reference listing options and USD checkout instead of candidate plans',async()=>{const {default:Page}=await import('./page');const html=renderToStaticMarkup(await Page({}));expect(html).toContain('Job details');expect(html).toContain('$695.00');expect(html).toContain('Automatically renew every 30 days');expect(html).toContain('Continue to payment');expect(html).not.toContain('€9');});
