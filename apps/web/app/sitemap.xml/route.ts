import sitemap, { resolveSitemapOrigin } from '../_sitemap';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const entries = await sitemap();
  const origin = resolveSitemapOrigin() ?? new URL(request.url).origin;
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(entry => `<sitemap><loc>${escape(new URL(entry.url, origin).href)}</loc></sitemap>`).join('\n')}
</sitemapindex>`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
