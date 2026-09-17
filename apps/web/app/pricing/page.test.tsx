import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import Page from './page';
vi.stubGlobal('React',React);
it('keeps candidate search free and sells employer placements',()=>{const html=renderToStaticMarkup(<Page/>);expect(html).toContain('apply for free');expect(html).toContain('$299');expect(html).toContain('/post-web3-job');expect(html).not.toContain('€9');});
