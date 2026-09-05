import type { SeoFields } from '../content/schema';
import { assetUrl } from '../payload/client';
import { absoluteUrl } from '../urls';

const SITE_NAME = process.env.SITE_NAME ?? 'GTA6State';
// TODO: replace with a real branded 1200x630 raster (PNG/JPG) before launch —
// most social crawlers render OG images poorly (or not at all) as SVG.
const DEFAULT_OG_IMAGE = '/og-default.svg';

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
}

interface BuildMetaInput {
  path: string;
  fallbackTitle: string;
  fallbackDescription: string;
  fallbackImage?: string | null;
  seo?: Partial<SeoFields> | null;
  /** Force noindex regardless of CMS flags — e.g. search results, filter combos. */
  forceNoindex?: boolean;
}

/**
 * Resolves final meta from CMS SEO overrides + editorial fallbacks. Every
 * public page must go through this so titles/descriptions are never left
 * empty and noindex rules stay centralized (see spec: SEO INDEXATION).
 */
export function buildPageMeta(input: BuildMetaInput): PageMeta {
  const { path, fallbackTitle, fallbackDescription, fallbackImage, seo, forceNoindex } = input;

  const title = seo?.seo_title || `${fallbackTitle} | ${SITE_NAME}`;
  const description = seo?.seo_description || fallbackDescription;
  const canonical = seo?.canonical_url || absoluteUrl(path);
  const ogImage =
    assetUrl(seo?.og_image as never) || fallbackImage || absoluteUrl(DEFAULT_OG_IMAGE);

  return {
    title,
    description,
    canonical,
    ogTitle: seo?.og_title || fallbackTitle,
    ogDescription: seo?.og_description || description,
    ogImage,
    robotsIndex: forceNoindex ? false : (seo?.robots_index ?? true),
    robotsFollow: forceNoindex ? false : (seo?.robots_follow ?? true),
  };
}
