import {isJobTag} from '@gaming/shared';
/** New reference skills have searchable jobs before they have dedicated SEO landing pages. */
export function jobTagHref(tag:string){return isJobTag(tag)?`/${tag}-jobs`:'/jobs?tag='+encodeURIComponent(tag);}
