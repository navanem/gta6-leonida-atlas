/** Minimal, dependency-free sitemap XML builders — split by content type per spec. */
import { payloadFetch, type PayloadListResponse } from '@lib/payload/client';
import { absoluteUrl } from '@lib/urls';

/** Fetches {slug, updatedAt} for a published collection and maps to sitemap URLs. */
export async function collectionSitemapUrls(
  collection: string,
  toPath: (slug: string) => string,
): Promise<SitemapUrl[]> {
  const res = await payloadFetch<PayloadListResponse<{ slug: string; updatedAt: string | null }>>(
    `/api/${collection}`,
    { 'where[status][equals]': 'published', limit: '0', depth: '0' },
  );
  return res.docs.map((item) => ({
    loc: absoluteUrl(toPath(item.slug)),
    lastmod: item.updatedAt,
  }));
}

export interface SitemapUrl {
  loc: string;
  lastmod?: string | null;
}

export function urlsetXml(urls: SitemapUrl[]): string {
  const entries = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function sitemapIndexXml(sitemaps: Array<{ loc: string }>): string {
  const entries = sitemaps
    .map((s) => `  <sitemap>\n    <loc>${escapeXml(s.loc)}</loc>\n  </sitemap>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
