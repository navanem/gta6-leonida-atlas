import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  parseStreetPlacesRequest,
  parseStreetSearchRequest,
  parseStreetSlug,
  streetJson,
} from '@features/street-leonida/api';
import { payloadFetch } from '@lib/payload/client';
import { getStreetPlaces, getStreetViewpointBySlug } from '@features/street-leonida/queries';
import * as streetQueries from '@features/street-leonida/queries';
import {
  GET as searchStreetLeonida,
  prerender as searchPrerender,
} from '../../src/pages/api/street-leonida/search.json';
import { prerender as placesPrerender } from '../../src/pages/api/street-leonida/places.json';
import {
  GET as streetPlace,
  prerender as placePrerender,
} from '../../src/pages/api/street-leonida/places/[slug].json';
import { prerender as viewpointPrerender } from '../../src/pages/api/street-leonida/viewpoints/[slug].json';

describe('Street Leonida public API boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts normalized searches of at most 80 Unicode code points', () => {
    expect(
      parseStreetSearchRequest(new URL(`https://gta6state.com/api?q=${'a'.repeat(80)}`)),
    ).toEqual({
      ok: true,
      value: { query: 'a'.repeat(80), page: 1, limit: 20, sort: 'name-asc' },
    });
    expect(
      parseStreetSearchRequest(new URL(`https://gta6state.com/api?q=${'😀'.repeat(81)}`)),
    ).toEqual({
      ok: false,
      status: 400,
    });
  });

  it('keeps every Street Leonida JSON endpoint on demand', () => {
    expect([searchPrerender, placesPrerender, placePrerender, viewpointPrerender]).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('returns a bounded error without echoing invalid search input', async () => {
    const invalid = 'private-search-value';
    const url = new URL(
      `https://gta6state.com/api/street-leonida/search.json?q=${invalid}&where[id]=1`,
    );
    const response = await searchStreetLeonida({ url, request: new Request(url) } as never);
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('{"error":"Invalid request."}');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('rejects a malformed detail slug before any CMS request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const url = new URL('https://gta6state.com/api/street-leonida/places/private.json');
    const response = await streetPlace({
      url,
      request: new Request(url),
      params: { slug: '../private' },
    } as never);
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ error: 'Invalid request.' });
  });

  it('enforces integer page and limit bounds 1 through 50', () => {
    expect(
      parseStreetSearchRequest(new URL('https://gta6state.com/api?q=vice&page=2&limit=50')),
    ).toMatchObject({ ok: true, value: { page: 2, limit: 50 } });
    expect(parseStreetSearchRequest(new URL('https://gta6state.com/api?q=vice&page=0'))).toEqual({
      ok: false,
      status: 400,
    });
    expect(parseStreetSearchRequest(new URL('https://gta6state.com/api?q=vice&page=51'))).toEqual({
      ok: false,
      status: 400,
    });
    expect(parseStreetSearchRequest(new URL('https://gta6state.com/api?q=vice&limit=51'))).toEqual({
      ok: false,
      status: 400,
    });
  });

  it('accepts only fixed sort and filter keys', () => {
    expect(
      parseStreetSearchRequest(
        new URL('https://gta6state.com/api?q=vice&sort=updated-desc&region=leonida&category=city'),
      ),
    ).toMatchObject({
      ok: true,
      value: { sort: 'updated-desc', region: 'leonida', category: 'city' },
    });
    expect(
      parseStreetSearchRequest(new URL('https://gta6state.com/api?q=vice&sort=drop-table')),
    ).toEqual({ ok: false, status: 400 });
    expect(
      parseStreetSearchRequest(new URL('https://gta6state.com/api?q=vice&category=unreviewed')),
    ).toEqual({ ok: false, status: 400 });
    expect(
      parseStreetSearchRequest(new URL('https://gta6state.com/api?q=vice&where[id]=1')),
    ).toEqual({ ok: false, status: 400 });
  });

  it('requires a complete, ordered, finite, bounded bbox', () => {
    expect(
      parseStreetPlacesRequest(
        new URL('https://gta6state.com/api?minX=-100&maxX=100&minY=20&maxY=300'),
      ),
    ).toMatchObject({
      ok: true,
      value: { bbox: { minX: -100, maxX: 100, minY: 20, maxY: 300 } },
    });
    for (const search of [
      '?minX=1&maxX=2&minY=3',
      '?minX=2&maxX=1&minY=3&maxY=4',
      '?minX=-1000001&maxX=2&minY=3&maxY=4',
      '?minX=NaN&maxX=2&minY=3&maxY=4',
    ]) {
      expect(parseStreetPlacesRequest(new URL(`https://gta6state.com/api${search}`))).toEqual({
        ok: false,
        status: 400,
      });
    }
  });

  it('validates a canonical public slug without echoing an invalid value', () => {
    expect(parseStreetSlug('vice-city-waterfront')).toEqual({
      ok: true,
      value: 'vice-city-waterfront',
    });
    expect(parseStreetSlug('../private?id=4')).toEqual({ ok: false, status: 400 });
  });

  it('sets fixed safe JSON and cache headers', async () => {
    const response = streetJson({ items: [] });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=60, stale-while-revalidate=300',
    );
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.json()).toEqual({ items: [] });
  });

  it('adds a five-second abort boundary while preserving a caller abort signal', async () => {
    let receivedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: URL, init?: RequestInit) => {
        receivedSignal = init?.signal as AbortSignal;
        return new Response(JSON.stringify({ docs: [], totalDocs: 0, page: 1, totalPages: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const controller = new AbortController();
    await payloadFetch('/api/leonida-places', undefined, { signal: controller.signal });
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    controller.abort();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('translates typed place filters into fixed Payload parameters', async () => {
    const requestedUrls: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        requestedUrls.push(new URL(String(input)));
        return new Response(JSON.stringify({ docs: [], totalDocs: 0, page: 2, totalPages: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    await getStreetPlaces({
      query: 'Vice',
      page: 2,
      limit: 25,
      sort: 'updated-desc',
      region: 'leonida',
      category: 'city',
      bbox: { minX: -10, maxX: 10, minY: 20, maxY: 40 },
    });

    expect(requestedUrls[0]?.pathname).toBe('/api/leonida-places');
    expect(Object.fromEntries(requestedUrls[0]?.searchParams ?? [])).toMatchObject({
      'where[status][equals]': 'published',
      'where[or][0][name][like]': 'Vice',
      'where[or][1][aliases.name][like]': 'Vice',
      'where[region.slug][equals]': 'leonida',
      'where[category][equals]': 'CITY',
      'where[mapX][greater_than_equal]': '-10',
      'where[mapX][less_than_equal]': '10',
      'where[mapY][greater_than_equal]': '20',
      'where[mapY][less_than_equal]': '40',
      sort: '-updatedAt',
      limit: '25',
      page: '2',
      depth: '2',
      'select[status]': 'true',
      'select[name]': 'true',
      'select[slug]': 'true',
      'select[description]': 'true',
      'select[claims][claimType]': 'true',
      'select[claims][source]': 'true',
      'populate[regions][status]': 'true',
      'populate[locations][status]': 'true',
    });
    expect(requestedUrls[0]?.searchParams.has('select[importFingerprint]')).toBe(false);
    expect(requestedUrls[0]?.searchParams.has('select[claims][privateNote]')).toBe(false);
  });

  it('selects only required viewpoint/link fields from Payload', async () => {
    const requestedUrls: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        requestedUrls.push(new URL(String(input)));
        return new Response(JSON.stringify({ docs: [], totalDocs: 0, page: 1, totalPages: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    await getStreetViewpointBySlug('vice-city-waterfront-daytime');
    const viewpointUrl = requestedUrls.find((url) => url.pathname === '/api/leonida-viewpoints');
    const linksUrl = requestedUrls.find((url) => url.pathname === '/api/leonida-viewpoint-links');
    expect(Object.fromEntries(viewpointUrl?.searchParams ?? [])).toMatchObject({
      depth: '2',
      'select[status]': 'true',
      'select[slug]': 'true',
      'select[externalUrl]': 'true',
      'select[rights][decision]': 'true',
      'select[positionClaim][claimType]': 'true',
      'select[positionClaim][source]': 'true',
    });
    expect(viewpointUrl?.searchParams.has('select[rights][privateNote]')).toBe(false);
    expect(viewpointUrl?.searchParams.has('select[reviewerNote]')).toBe(false);
    expect(Object.fromEntries(linksUrl?.searchParams ?? [])).toMatchObject({
      depth: '2',
      'select[status]': 'true',
      'select[fromViewpoint]': 'true',
      'select[toViewpoint]': 'true',
      'select[publicNote]': 'true',
    });
  });

  it('collects every published place and viewpoint through bounded pagination', async () => {
    const queries = streetQueries as typeof streetQueries & {
      getAllStreetPlaces?: () => Promise<{ items: Array<{ slug: string }> }>;
      getAllStreetViewpoints?: () => Promise<{ items: Array<{ slug: string }> }>;
    };
    expect(typeof queries.getAllStreetPlaces).toBe('function');
    expect(typeof queries.getAllStreetViewpoints).toBe('function');

    const source = {
      title: 'Official media',
      publisher: 'Rockstar Games',
      url: 'https://www.rockstargames.com/VI/media',
    };
    const makePlace = (index: number) => ({
      status: 'published',
      name: `Place ${index}`,
      slug: `place-${index}`,
      category: 'OTHER',
      claims: [],
    });
    const makeViewpoint = (index: number) => ({
      status: 'published',
      title: `Viewpoint ${index}`,
      slug: `viewpoint-${index}`,
      place: makePlace(index),
      source,
      mediaKind: 'STILL_IMAGE',
      deliveryMode: 'OUTBOUND_LINK',
      outboundUrl: source.url,
      rights: { decision: 'LINK_ONLY' },
    });
    const requested: Array<{ path: string; page: number; limit: number }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(String(input));
        const page = Number(url.searchParams.get('page') ?? 1);
        const limit = Number(url.searchParams.get('limit') ?? 50);
        requested.push({ path: url.pathname, page, limit });
        if (url.pathname === '/api/leonida-viewpoint-links') {
          return new Response(JSON.stringify({ docs: [], totalDocs: 0, page: 1, totalPages: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const records = Array.from({ length: 51 }, (_, index) =>
          url.pathname === '/api/leonida-places' ? makePlace(index + 1) : makeViewpoint(index + 1),
        );
        const start = (page - 1) * limit;
        return new Response(
          JSON.stringify({
            docs: records.slice(start, start + limit),
            totalDocs: records.length,
            page,
            totalPages: Math.ceil(records.length / limit),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const allPlaces = await queries.getAllStreetPlaces?.();
    const allViewpoints = await queries.getAllStreetViewpoints?.();
    expect(allPlaces?.items).toHaveLength(51);
    expect(allPlaces?.items.at(-1)?.slug).toBe('place-51');
    expect(allViewpoints?.items).toHaveLength(51);
    expect(allViewpoints?.items.at(-1)?.slug).toBe('viewpoint-51');
    expect(requested).toEqual(
      expect.arrayContaining([
        { path: '/api/leonida-places', page: 1, limit: 50 },
        { path: '/api/leonida-places', page: 2, limit: 50 },
        { path: '/api/leonida-viewpoints', page: 1, limit: 50 },
        { path: '/api/leonida-viewpoints', page: 2, limit: 50 },
      ]),
    );
  });

  it('fails closed when catalog pagination exceeds the build boundary', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ docs: [], totalDocs: 10_001, page: 1, totalPages: 201 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetch);

    await expect(streetQueries.getAllStreetPlaces()).rejects.toThrow(
      'Street Leonida catalog pagination exceeded its safe boundary.',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
