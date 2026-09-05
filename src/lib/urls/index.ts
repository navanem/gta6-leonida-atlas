/** Centralized URL/slug generation. Lowercase, hyphenated, no dates in paths. */

const SITE_URL = (process.env.SITE_URL ?? 'https://gta6state.com').replace(/\/$/, '');

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const urls = {
  home: () => '/',
  news: () => '/news/',
  newsArticle: (slug: string) => `/news/${slug}/`,
  guides: () => '/guides/',
  guide: (slug: string) => `/guides/${slug}/`,
  vehicles: () => '/vehicles/',
  vehicle: (slug: string) => `/vehicles/${slug}/`,
  characters: () => '/characters/',
  character: (slug: string) => `/characters/${slug}/`,
  locations: () => '/locations/',
  location: (slug: string) => `/locations/${slug}/`,
  database: () => '/database/',
  search: () => '/search/',
  about: () => '/about/',
  privacy: () => '/privacy/',
  tools: () => '/tools/',
  launchChecklist: () => '/tools/gta-6-launch-checklist/',
  wallpaper: (slug: string) => `/tools/wallpapers/${slug}/`,
  streetLeonida: () => '/tools/street-leonida/',
  streetLeonidaPlace: (slug: string) => `/tools/street-leonida/place/${slug}/`,
  streetLeonidaViewpoint: (slug: string) => `/tools/street-leonida/viewpoint/${slug}/`,
  leonidaAtlas: () => '/gta6-leonida-atlas',
  leonidaAtlasApp: () => '/gta6-leonida-atlas/app',
  leonidaAtlasPlace: (slug: string) => `/gta6-leonida-atlas/app/place/${slug}`,
  leonidaAtlasViewpoint: (slug: string) => `/gta6-leonida-atlas/app/viewpoint/${slug}`,
  leonidaAtlasAbout: () => '/gta6-leonida-atlas/about',
  leonidaAtlasCredits: () => '/gta6-leonida-atlas/credits',
  leonidaAtlasDocumentation: () => '/gta6-leonida-atlas/documentation',
  leonidaAtlasContributing: () => '/gta6-leonida-atlas/contributing',
  leonidaAtlasChangelog: () => '/gta6-leonida-atlas/changelog',
  leonidaAtlasLicenses: () => '/gta6-leonida-atlas/licenses',
  launchHub: () => '/gta-6-launch/',
};

/**
 * A conservative slugify used only for demo-seed content — editorial slugs
 * should be reviewed by hand in Directus, not auto-generated at read time.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
