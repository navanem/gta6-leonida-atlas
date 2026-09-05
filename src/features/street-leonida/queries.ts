import { mapStreetPlace, mapStreetPlaces, mapStreetViewpoint, mapStreetViewpoints } from './map';
import type {
  PublicStreetList,
  PublicStreetPlace,
  PublicStreetViewpoint,
  StreetPlaceCategoryFilter,
  StreetListSort,
  StreetPlaceQuery,
  StreetViewpointQuery,
} from './types';
import {
  payloadFetch,
  type PayloadFetchOptions,
  type PayloadListResponse,
} from '@lib/payload/client';

const MAX_PUBLIC_PAGE_SIZE = 50;
const LINK_LIMIT = 500;
const CATALOG_PAGE_SIZE = 50;
const MAX_CATALOG_PAGES = 200;
const PAYLOAD_PLACE_CATEGORIES: Record<StreetPlaceCategoryFilter, string> = {
  region: 'REGION',
  city: 'CITY',
  district: 'DISTRICT',
  landmark: 'LANDMARK',
  business: 'BUSINESS',
  'natural-area': 'NATURAL_AREA',
  infrastructure: 'INFRASTRUCTURE',
  other: 'OTHER',
};

const PLACE_PUBLIC_SELECT = {
  'select[status]': 'true',
  'select[name]': 'true',
  'select[slug]': 'true',
  'select[description]': 'true',
  'select[aliases][name]': 'true',
  'select[category]': 'true',
  'select[region]': 'true',
  'select[relatedLocation]': 'true',
  'select[mapX]': 'true',
  'select[mapY]': 'true',
  'select[claims][claimType]': 'true',
  'select[claims][source]': 'true',
  'select[claims][retrievedAt]': 'true',
  'select[claims][authority]': 'true',
  'select[claims][confidence]': 'true',
  'select[claims][precision]': 'true',
  'populate[regions][name]': 'true',
  'populate[regions][slug]': 'true',
  'populate[regions][status]': 'true',
  'populate[locations][name]': 'true',
  'populate[locations][slug]': 'true',
  'populate[locations][status]': 'true',
  'populate[sources][title]': 'true',
  'populate[sources][publisher]': 'true',
  'populate[sources][url]': 'true',
  'populate[sources][publishedAt]': 'true',
} as const;

const VIEWPOINT_PUBLIC_SELECT = {
  'select[status]': 'true',
  'select[title]': 'true',
  'select[slug]': 'true',
  'select[place]': 'true',
  'select[mediaKind]': 'true',
  'select[deliveryMode]': 'true',
  'select[image]': 'true',
  'select[poster]': 'true',
  'select[externalUrl]': 'true',
  'select[outboundUrl]': 'true',
  'select[source]': 'true',
  'select[mediaAuthority]': 'true',
  'select[rights][decision]': 'true',
  'select[videoStartSeconds]': 'true',
  'select[videoEndSeconds]': 'true',
  'select[noVisibleCutObserved]': 'true',
  'select[captionsUrl]': 'true',
  'select[transcript]': 'true',
  'select[visualDescription]': 'true',
  'select[perspective]': 'true',
  'select[panBounds][minX]': 'true',
  'select[panBounds][maxX]': 'true',
  'select[panBounds][minY]': 'true',
  'select[panBounds][maxY]': 'true',
  'select[mapX]': 'true',
  'select[mapY]': 'true',
  'select[positionClaim][claimType]': 'true',
  'select[positionClaim][source]': 'true',
  'select[positionClaim][retrievedAt]': 'true',
  'select[positionClaim][authority]': 'true',
  'select[positionClaim][confidence]': 'true',
  'select[positionClaim][precision]': 'true',
  'select[captureContext]': 'true',
  'select[coverageMessage]': 'true',
  'populate[leonida-places][status]': 'true',
  'populate[leonida-places][name]': 'true',
  'populate[leonida-places][slug]': 'true',
  'populate[media][url]': 'true',
  'populate[media][filename]': 'true',
  'populate[media][width]': 'true',
  'populate[media][height]': 'true',
  'populate[media][alt]': 'true',
  'populate[media][caption]': 'true',
  'populate[media][sizes]': 'true',
  'populate[sources][title]': 'true',
  'populate[sources][publisher]': 'true',
  'populate[sources][url]': 'true',
  'populate[sources][publishedAt]': 'true',
} as const;

const LINK_PUBLIC_SELECT = {
  'select[status]': 'true',
  'select[fromViewpoint]': 'true',
  'select[toViewpoint]': 'true',
  'select[linkType]': 'true',
  'select[source]': 'true',
  'select[authority]': 'true',
  'select[confidence]': 'true',
  'select[publicNote]': 'true',
  'populate[leonida-viewpoints][status]': 'true',
  'populate[leonida-viewpoints][slug]': 'true',
  'populate[sources][title]': 'true',
  'populate[sources][publisher]': 'true',
  'populate[sources][url]': 'true',
  'populate[sources][publishedAt]': 'true',
} as const;

const PLACE_BASE_PARAMS = {
  'where[status][equals]': 'published',
  depth: '2',
  ...PLACE_PUBLIC_SELECT,
} as const;

const VIEWPOINT_BASE_PARAMS = {
  'where[status][equals]': 'published',
  depth: '2',
  ...VIEWPOINT_PUBLIC_SELECT,
} as const;

const LINK_BASE_PARAMS = {
  'where[status][equals]': 'published',
  sort: 'fromViewpoint',
  limit: String(LINK_LIMIT),
  depth: '2',
  ...LINK_PUBLIC_SELECT,
} as const;

function integerInRange(value: number | undefined, fallback: number, max: number): number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max
    ? (value as number)
    : fallback;
}

function token(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : null;
}

function payloadSort(value: StreetListSort | undefined): string {
  if (value === 'name-desc') return '-name';
  if (value === 'updated-desc') return '-updatedAt';
  return 'name';
}

async function getAllPayloadPages<T>(
  path: string,
  baseParams: Record<string, string>,
  options: PayloadFetchOptions,
  pageSize = CATALOG_PAGE_SIZE,
): Promise<T[]> {
  const docs: T[] = [];
  for (let page = 1; page <= MAX_CATALOG_PAGES; page += 1) {
    const response = await payloadFetch<PayloadListResponse<T>>(
      path,
      { ...baseParams, limit: String(pageSize), page: String(page) },
      options,
    );
    if (
      !Number.isSafeInteger(response.totalPages) ||
      response.totalPages < 0 ||
      response.totalPages > MAX_CATALOG_PAGES ||
      !Array.isArray(response.docs)
    ) {
      throw new Error('Street Leonida catalog pagination exceeded its safe boundary.');
    }
    docs.push(...response.docs);
    if (response.totalPages === 0 || page >= response.totalPages) return docs;
  }
  throw new Error('Street Leonida catalog pagination did not terminate.');
}

function uniqueBySlug<T extends { slug: string }>(items: readonly T[]): T[] {
  return [...new Map(items.map((item) => [item.slug, item])).values()];
}

async function getRelevantLinks(
  slug?: string,
  options: PayloadFetchOptions = {},
): Promise<unknown[]> {
  const params: Record<string, string> = { ...LINK_BASE_PARAMS };
  const safeSlug = token(slug);
  if (safeSlug) {
    params['where[or][0][fromViewpoint.slug][equals]'] = safeSlug;
    params['where[or][1][toViewpoint.slug][equals]'] = safeSlug;
  }
  const response = await payloadFetch<PayloadListResponse<unknown>>(
    '/api/leonida-viewpoint-links',
    params,
    options,
  );
  return response.docs;
}

export async function getStreetPlaces(
  query: StreetPlaceQuery = {},
  options: PayloadFetchOptions = {},
): Promise<PublicStreetList<PublicStreetPlace>> {
  const page = integerInRange(query.page, 1, 50);
  const limit = integerInRange(query.limit, 20, MAX_PUBLIC_PAGE_SIZE);
  const params: Record<string, string> = {
    ...PLACE_BASE_PARAMS,
    sort: payloadSort(query.sort),
    limit: String(limit),
    page: String(page),
  };
  const search = query.query?.trim();
  if (search) {
    const safeSearch = [...search].slice(0, 80).join('');
    params['where[or][0][name][like]'] = safeSearch;
    params['where[or][1][aliases.name][like]'] = safeSearch;
  }
  const region = token(query.region);
  if (region) params['where[region.slug][equals]'] = region;
  const category = query.category ? PAYLOAD_PLACE_CATEGORIES[query.category] : undefined;
  if (category) params['where[category][equals]'] = category;
  if (query.bbox) {
    params['where[mapX][greater_than_equal]'] = String(query.bbox.minX);
    params['where[mapX][less_than_equal]'] = String(query.bbox.maxX);
    params['where[mapY][greater_than_equal]'] = String(query.bbox.minY);
    params['where[mapY][less_than_equal]'] = String(query.bbox.maxY);
  }

  const response = await payloadFetch<PayloadListResponse<unknown>>(
    '/api/leonida-places',
    params,
    options,
  );
  return {
    items: mapStreetPlaces(response.docs),
    total: response.totalDocs,
    page: response.page,
    totalPages: response.totalPages,
  };
}

export async function getStreetViewpoints(
  query: StreetViewpointQuery = {},
  options: PayloadFetchOptions = {},
): Promise<PublicStreetList<PublicStreetViewpoint>> {
  const page = integerInRange(query.page, 1, 50);
  const limit = integerInRange(query.limit, 20, MAX_PUBLIC_PAGE_SIZE);
  const params: Record<string, string> = {
    ...VIEWPOINT_BASE_PARAMS,
    sort: 'title',
    limit: String(limit),
    page: String(page),
  };
  const placeSlug = token(query.placeSlug);
  if (placeSlug) params['where[place.slug][equals]'] = placeSlug;

  const [response, links] = await Promise.all([
    payloadFetch<PayloadListResponse<unknown>>('/api/leonida-viewpoints', params, options),
    getRelevantLinks(undefined, options),
  ]);
  return {
    items: mapStreetViewpoints(response.docs, links),
    total: response.totalDocs,
    page: response.page,
    totalPages: response.totalPages,
  };
}

export async function getAllStreetPlaces(
  options: PayloadFetchOptions = {},
): Promise<PublicStreetList<PublicStreetPlace>> {
  const docs = await getAllPayloadPages<unknown>(
    '/api/leonida-places',
    { ...PLACE_BASE_PARAMS, sort: 'name' },
    options,
  );
  const items = uniqueBySlug(mapStreetPlaces(docs));
  return { items, total: items.length, page: 1, totalPages: items.length > 0 ? 1 : 0 };
}

export async function getAllStreetViewpoints(
  options: PayloadFetchOptions = {},
): Promise<PublicStreetList<PublicStreetViewpoint>> {
  const [docs, links] = await Promise.all([
    getAllPayloadPages<unknown>(
      '/api/leonida-viewpoints',
      { ...VIEWPOINT_BASE_PARAMS, sort: 'title' },
      options,
    ),
    getAllPayloadPages<unknown>(
      '/api/leonida-viewpoint-links',
      { ...LINK_BASE_PARAMS },
      options,
      LINK_LIMIT,
    ),
  ]);
  const items = uniqueBySlug(mapStreetViewpoints(docs, links));
  return { items, total: items.length, page: 1, totalPages: items.length > 0 ? 1 : 0 };
}

export async function getStreetPlaceBySlug(
  slug: string,
  options: PayloadFetchOptions = {},
): Promise<PublicStreetPlace | null> {
  const safeSlug = token(slug);
  if (!safeSlug) return null;
  const response = await payloadFetch<PayloadListResponse<unknown>>(
    '/api/leonida-places',
    {
      ...PLACE_BASE_PARAMS,
      'where[slug][equals]': safeSlug,
      limit: '1',
    },
    options,
  );
  return mapStreetPlace(response.docs[0]);
}

export async function getStreetViewpointBySlug(
  slug: string,
  options: PayloadFetchOptions = {},
): Promise<PublicStreetViewpoint | null> {
  const safeSlug = token(slug);
  if (!safeSlug) return null;
  const [response, links] = await Promise.all([
    payloadFetch<PayloadListResponse<unknown>>(
      '/api/leonida-viewpoints',
      {
        ...VIEWPOINT_BASE_PARAMS,
        'where[slug][equals]': safeSlug,
        limit: '1',
      },
      options,
    ),
    getRelevantLinks(safeSlug, options),
  ]);
  return mapStreetViewpoint(response.docs[0], links);
}

export async function getAllStreetPlaceSlugs(
  options: PayloadFetchOptions = {},
): Promise<Array<{ slug: string }>> {
  const docs = await getAllPayloadPages<{ slug?: unknown }>(
    '/api/leonida-places',
    {
      'where[status][equals]': 'published',
      'select[slug]': 'true',
      sort: 'slug',
      depth: '0',
    },
    options,
  );
  return docs
    .map((doc) => token(typeof doc.slug === 'string' ? doc.slug : undefined))
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug }));
}

export async function getAllStreetViewpointSlugs(
  options: PayloadFetchOptions = {},
): Promise<Array<{ slug: string }>> {
  const docs = await getAllPayloadPages<{ slug?: unknown }>(
    '/api/leonida-viewpoints',
    {
      'where[status][equals]': 'published',
      'select[slug]': 'true',
      sort: 'slug',
      depth: '0',
    },
    options,
  );
  return docs
    .map((doc) => token(typeof doc.slug === 'string' ? doc.slug : undefined))
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug }));
}
