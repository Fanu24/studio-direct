import {expect,it,vi} from 'vitest';
import {POST} from './route';
it('cannot sell the retired prototype candidate plans',async()=>{const network=vi.spyOn(globalThis,'fetch');const r=await POST(new Request('https://example.com/api/stripe/checkout',{method:'POST'}));expect(r.status).toBe(410);expect(network).not.toHaveBeenCalled();network.mockRestore();});
