import {platform} from '../../../../lib/platform';
import {requireTenantId} from '../../../../lib/tenant';
import {loadProductFlags} from '../../../../lib/product/flags';
import {REFERENCE_KINDS, searchReference, type ReferenceKind} from '../../../../lib/product/reference';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams, kind = params.get('kind'), q = params.get('q') ?? '';
  if (!REFERENCE_KINDS.includes(kind as ReferenceKind) || q.length > 100) return Response.json({error: 'Choose a valid catalogue and search.'}, {status: 400});
  const env = await platform(), tenant = await requireTenantId(env.DB);
  const flags = await loadProductFlags(env.DB, tenant, env);
  if (!flags.PRODUCT_POSTING_V2 && !flags.PRODUCT_PROFILES_V2) return Response.json({error: 'Not found.'}, {status: 404});
  const items = await searchReference(env.DB, tenant, kind as ReferenceKind, q);
  return Response.json({items}, {headers: {'Cache-Control': 'public, max-age=300'}});
}
