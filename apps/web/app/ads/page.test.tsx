import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
vi.stubGlobal('React',React);
vi.mock('../../lib/platform',()=>({platform:async()=>({DB:{prepare:()=>({bind(){return this},run:async()=>({}),all:async()=>({results:[{slot:3}]})})}})}));
it('offers only available slots at the observed advertising price',async()=>{const {default:Page}=await import('./page');const html=renderToStaticMarkup(await Page());expect(html).toContain('$2,999.00');expect(html).toContain('value="3"');expect(html).not.toContain('value="1"');});
