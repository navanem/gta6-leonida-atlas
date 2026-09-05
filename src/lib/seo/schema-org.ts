/**
 * Valid schema.org JSON-LD builders only — no invented Product markup for
 * vehicles, no HowTo unless a guide is genuinely a sequential tutorial.
 * See spec: STRUCTURED DATA.
 */
import { absoluteUrl } from '../urls';

const SITE_NAME = process.env.SITE_NAME ?? 'GTA6State';

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl('/search/')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    // TODO: replace with a real branded raster logo before launch.
    logo: absoluteUrl('/logo.svg'),
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function newsArticleSchema(input: {
  headline: string;
  description: string;
  path: string;
  image: string | null;
  authorName: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: input.headline,
    description: input.description,
    mainEntityOfPage: absoluteUrl(input.path),
    image: input.image ? [input.image] : undefined,
    datePublished: input.publishedAt ?? undefined,
    dateModified: input.updatedAt ?? input.publishedAt ?? undefined,
    author: input.authorName ? { '@type': 'Person', name: input.authorName } : undefined,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/logo.png') },
    },
  };
}

export function itemListSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function articleSchema(input: {
  headline: string;
  description: string;
  path: string;
  image: string | null;
  authorName: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
}) {
  return {
    ...newsArticleSchema(input),
    '@type': 'Article',
  };
}
