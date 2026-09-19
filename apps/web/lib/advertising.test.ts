import {it,expect} from 'vitest';
import {canRequestAds,parseAdvertising} from './advertising';
it('does not request ads on unknown consent, rejected purposes or global privacy control',()=>{
 expect(canRequestAds({})).toBe(false);expect(canRequestAds({gdprApplies:false,eventStatus:'tcloaded'},true)).toBe(false);
 expect(canRequestAds({gdprApplies:true,eventStatus:'useractioncomplete',vendor:{consents:{755:true}},purpose:{consents:{1:true,3:false,4:true}}})).toBe(false);
 expect(canRequestAds({gdprApplies:true,eventStatus:'useractioncomplete',vendor:{consents:{755:true}},purpose:{consents:{1:true,3:true,4:true}}})).toBe(true);
});
it('rejects untrusted scripts and malformed publisher identifiers',()=>{
 expect(()=>parseAdvertising({mode:'live',publisher:'bad'})).toThrow();
 expect(()=>parseAdvertising({mode:'live',publisher:'ca-pub-1234567890123456',slot:'1234567890',cmpUrl:'https://evil.example/script.js'})).toThrow();
 expect(parseAdvertising({mode:'off'}).mode).toBe('off');
});
