import {platform} from '../../../lib/platform';
import type {SponsorInput} from '../../../lib/billing/marketplace';
export async function GET(){const env=await platform();const rows=await env.DB.prepare(`SELECT s.slot,o.id,o.payload_json FROM sponsor_slots s JOIN marketplace_orders o ON o.id=s.order_id WHERE o.status='paid' AND o.expires_at>?`).bind(new Date().toISOString()).all<{slot:number;id:string;payload_json:string}>();return Response.json({sponsors:rows.results.map(r=>({id:r.id,...JSON.parse(r.payload_json) as SponsorInput}))},{headers:{'Cache-Control':'public, max-age=30'}});}
