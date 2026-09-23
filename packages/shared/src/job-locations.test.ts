import {it,expect} from 'vitest';
import {resolveJobLocations} from './job-locations';
it('indexes comma-separated city and country with their region',()=>{expect(resolveJobLocations('New York, United States').map(v=>v.slug)).toEqual(['new-york','united-states','north-america']);});
it('preserves explicit remote geographic restrictions',()=>{expect(resolveJobLocations('Remote - Europe')).toEqual([{slug:'europe',kind:'region'}]);expect(resolveJobLocations('Worldwide')).toEqual([]);});
it('does not infer a conflicting country from an ambiguous city name',()=>{const result=resolveJobLocations('London, Ontario, Canada');expect(result.map(v=>v.slug)).toContain('canada');expect(result.map(v=>v.slug)).not.toContain('united-kingdom');});
