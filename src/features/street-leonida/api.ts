import type {
  StreetBoundingBox,
  StreetListSort,
  StreetPlaceCategoryFilter,
  StreetPlaceQuery,
} from './types';

export type StreetParseResult<T> = { ok: true; value: T } | { ok: false; status: 400 };

const SEARCH_KEYS = new Set(['q', 'page', 'limit', 'sort', 'region', 'category']);
const PLACES_KEYS = new Set([
  'page',
  'limit',
  'sort',
  'region',
  'category',
  'minX',
  'maxX',
  'minY',
  'maxY',
]);
const SORTS = new Set<StreetListSort>(['name-asc', 'name-desc', 'updated-desc']);
const CATEGORIES = new Set<StreetPlaceCategoryFilter>([
  'region',
  'city',
  'district',
  'landmark',
  'business',
  'natural-area',
  'infrastructure',
  'other',
]);
const COORDINATE_LIMIT = 1_000_000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function invalid<T>(): StreetParseResult<T> {
  return { ok: false, status: 400 };
}

function hasOnlyKnownSingleParams(params: URLSearchParams, allowed: ReadonlySet<string>): boolean {
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) return false;
  }
  return true;
}

function parseInteger(value: string | null, fallback: number, maximum: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

function parseToken(value: string | null): string | null | undefined {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized || [...normalized].length > 80 || !SLUG_PATTERN.test(normalized)) return null;
  return normalized;
}

function parseSort(value: string | null): StreetListSort | null {
  if (value === null) return 'name-asc';
  return SORTS.has(value as StreetListSort) ? (value as StreetListSort) : null;
}

function parseCategory(value: string | null): StreetPlaceCategoryFilter | null | undefined {
  const category = parseToken(value);
  if (category === null || category === undefined) return category;
  return CATEGORIES.has(category as StreetPlaceCategoryFilter)
    ? (category as StreetPlaceCategoryFilter)
    : null;
}

function parseCommon(params: URLSearchParams): StreetPlaceQuery | null {
  const page = parseInteger(params.get('page'), 1, 50);
  const limit = parseInteger(params.get('limit'), 20, 50);
  const sort = parseSort(params.get('sort'));
  const region = parseToken(params.get('region'));
  const category = parseCategory(params.get('category'));
  if (page === null || limit === null || sort === null || region === null || category === null) {
    return null;
  }
  return {
    page,
    limit,
    sort,
    ...(region ? { region } : {}),
    ...(category ? { category } : {}),
  };
}

function parseCoordinate(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= COORDINATE_LIMIT ? parsed : null;
}

function parseBbox(params: URLSearchParams): StreetBoundingBox | null | undefined {
  const keys = ['minX', 'maxX', 'minY', 'maxY'] as const;
  const present = keys.filter((key) => params.has(key));
  if (present.length === 0) return undefined;
  if (present.length !== keys.length) return null;
  const parsed = Object.fromEntries(
    keys.map((key) => [key, parseCoordinate(params.get(key) as string)]),
  ) as Record<(typeof keys)[number], number | null>;
  if (keys.some((key) => parsed[key] === null)) return null;
  const bbox = parsed as StreetBoundingBox;
  return bbox.minX <= bbox.maxX && bbox.minY <= bbox.maxY ? bbox : null;
}

export function parseStreetSearchRequest(url: URL): StreetParseResult<StreetPlaceQuery> {
  const params = url.searchParams;
  if (!hasOnlyKnownSingleParams(params, SEARCH_KEYS)) return invalid();
  const common = parseCommon(params);
  const rawQuery = params.get('q');
  if (!common || rawQuery === null) return invalid();
  const query = rawQuery.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!query || [...query].length > 80) return invalid();
  return { ok: true, value: { query, ...common } };
}

export function parseStreetPlacesRequest(url: URL): StreetParseResult<StreetPlaceQuery> {
  const params = url.searchParams;
  if (!hasOnlyKnownSingleParams(params, PLACES_KEYS)) return invalid();
  const common = parseCommon(params);
  const bbox = parseBbox(params);
  if (!common || bbox === null) return invalid();
  return { ok: true, value: { ...common, ...(bbox ? { bbox } : {}) } };
}

export function parseStreetSlug(value: unknown): StreetParseResult<string> {
  if (typeof value !== 'string' || [...value].length > 80 || !SLUG_PATTERN.test(value)) {
    return invalid();
  }
  return { ok: true, value };
}

const PUBLIC_HEADERS = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

export function streetJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: PUBLIC_HEADERS });
}

export function streetError(status: 400 | 404 | 502): Response {
  const message =
    status === 404
      ? 'Not found.'
      : status === 502
        ? 'Data temporarily unavailable.'
        : 'Invalid request.';
  const response = streetJson({ error: message }, status);
  response.headers.set(
    'Cache-Control',
    status === 404 ? PUBLIC_HEADERS['Cache-Control'] : 'no-store',
  );
  return response;
}
