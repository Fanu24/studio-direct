import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import Page from './page';
vi.stubGlobal('React',React);
it('offers discounted credits with the observed 24-month window and default total',()=>{const html=renderToStaticMarkup(<Page/>);expect(html).toContain('24 months');expect(html).toContain('$10,175.00');expect(html).toContain('Continue to payment');expect(html).not.toContain('Automatically renew');});
