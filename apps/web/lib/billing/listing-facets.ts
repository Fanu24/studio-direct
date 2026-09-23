import {resolveJobLocations,tagLabel} from '@gaming/shared';
import type {Database,Statement} from '../platform';
import type {ListingInput} from './listing-input';
import {listingTags} from './listing-benefits';
export function listingFacets(db:Database,id:string,input:ListingInput):Statement[]{
 const guard='EXISTS(SELECT 1 FROM jobs WHERE id=?)';
 const statements:Statement[]=[db.prepare('DELETE FROM job_benefits WHERE job_id=?').bind(id),db.prepare('DELETE FROM job_locations WHERE job_id=?').bind(id)];
 for(const slug of listingTags({tags:[],benefits:input.benefits})){
  statements.push(db.prepare('INSERT OR IGNORE INTO benefits(slug,label) VALUES(?,?)').bind(slug,tagLabel(slug)),db.prepare(`INSERT OR IGNORE INTO job_benefits(job_id,benefit_slug) SELECT ?,? WHERE ${guard}`).bind(id,slug,id));
 }
 for(const place of resolveJobLocations(input.location))statements.push(db.prepare('INSERT OR IGNORE INTO locations(slug,kind,label) VALUES(?,?,?)').bind(place.slug,place.kind,tagLabel(place.slug)),db.prepare(`INSERT OR IGNORE INTO job_locations(job_id,location_slug) SELECT ?,? WHERE ${guard}`).bind(id,place.slug,id));
 return statements;
}
