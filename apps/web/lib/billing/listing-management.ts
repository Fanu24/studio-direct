import {listingFacets} from './listing-facets';
import {listingTags} from './listing-benefits';
import {normalizeCompanyName,slugTitle} from '@gaming/shared';
import type {Database} from '../platform';
import type {ListingInput} from './listing-input';
import type {ListingSelection} from './listing-catalog';

export async function ownedListing(db:Database,userId:string,id:string){
 const row=await db.prepare(`SELECT j.*,c.name company_name,c.domain company_domain,l.apply_mode,l.contact_email,l.logo_url,o.selection_json,d.input_json
 FROM employer_listings l JOIN jobs j ON j.id=l.job_id JOIN companies c ON c.id=j.company_id JOIN employer_orders o ON o.id=l.order_id
 LEFT JOIN listing_details d ON d.job_id=j.id WHERE l.job_id=? AND l.user_id=?`).bind(id,userId).first<Record<string,any>>();
 if(!row)return null;
 if(await db.prepare('SELECT job_id FROM native_listing_details WHERE job_id=?').bind(id).first())throw new Error('Use the current job editor for this listing.');
 const tags=await db.prepare('SELECT tag_slug FROM job_tags WHERE job_id=? ORDER BY tag_slug').bind(id).all<{tag_slug:string}>();
 const saved=row.input_json?JSON.parse(row.input_json):{};
 const input:ListingInput={...saved,title:row.title,descriptionHtml:row.description_html,companyName:row.company_name,
 companyUrl:saved.companyUrl||'https://'+row.company_domain,location:row.location,remote:row.remote,applyMode:row.apply_mode,
 applyUrl:row.apply_mode==='external'?row.apply_url:'',contactEmail:row.contact_email,tags:saved.tags||tags.results.map(t=>t.tag_slug),primarySkill:saved.primarySkill||tags.results[0]?.tag_slug,
 salaryMin:row.salary_min,salaryMax:row.salary_max,logoUrl:row.logo_url||'',invoiceDetails:saved.invoiceDetails||''};
 return {input,selection:JSON.parse(row.selection_json) as ListingSelection,tenantId:row.tenant_id as string,slug:row.slug as string};
}

/** Content edits preserve slug, placement, billing and the purchased expiration. */
export async function editListing(db:Database,userId:string,id:string,input:ListingInput,now=new Date()){
 const owned=await ownedListing(db,userId,id);if(!owned)throw new Error('Listing not found');
 const norm=normalizeCompanyName(input.companyName),companyId=`employer:${owned.tenantId}:${slugTitle(input.companyName)}`;
 const guard='EXISTS(SELECT 1 FROM employer_listings WHERE job_id=? AND user_id=?)';
 await db.batch([
 ...listingFacets(db,id,input),
 db.prepare('INSERT OR IGNORE INTO companies(id,tenant_id,name,name_norm,domain,created_at) VALUES(?,?,?,?,?,?)').bind(companyId,owned.tenantId,input.companyName,norm,new URL(input.companyUrl).hostname,now.toISOString()),
 db.prepare(`UPDATE jobs SET title=?,title_norm=?,description_html=?,company_id=(SELECT id FROM companies WHERE tenant_id=? AND name_norm=?),location=?,remote=?,salary_min=?,salary_max=?,apply_url=?,listing_logo_url=?,updated_at=? WHERE id=? AND ${guard}`)
 .bind(input.title,input.title.toLowerCase(),input.descriptionHtml,owned.tenantId,norm,input.location,input.remote,input.salaryMin,input.salaryMax,input.applyUrl||`/jobs/${owned.slug}/apply`,owned.selection.logo?input.logoUrl:null,now.toISOString(),id,id,userId),
 db.prepare(`UPDATE employer_listings SET apply_mode=?,contact_email=?,logo_url=? WHERE job_id=? AND user_id=?`).bind(input.applyMode,input.contactEmail,owned.selection.logo?input.logoUrl:null,id,userId),
 db.prepare(`DELETE FROM job_tags WHERE job_id=? AND ${guard}`).bind(id,id,userId),
 ...listingTags(input).flatMap(tag=>[db.prepare('INSERT OR IGNORE INTO tags(slug,label) VALUES(?,?)').bind(tag,tag.replaceAll('-',' ')),db.prepare(`INSERT OR IGNORE INTO job_tags(job_id,tag_slug) SELECT ?,? WHERE ${guard}`).bind(id,tag,id,userId)]),
 db.prepare(`INSERT INTO listing_details(job_id,input_json,updated_at) SELECT ?,?,? WHERE ${guard} ON CONFLICT(job_id) DO UPDATE SET input_json=excluded.input_json,updated_at=excluded.updated_at`).bind(id,JSON.stringify(input),now.toISOString(),id,userId),
 ]);
 return owned.slug;
}
