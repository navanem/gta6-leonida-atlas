/**
 * Server-only Payload REST client. Replaces src/lib/directus/client.ts —
 * see docs/no-cloudflare.md and README "Migrating off Directus" for why.
 * Every feature's queries.ts maps Payload's (camelCase) response shape onto
 * the exact same internal interfaces `@lib/content/schema` already
 * declared, so no template changed when the backend did.
 */
const PAYLOAD_URL = process.env.PAYLOAD_URL ?? 'http://localhost:3000';

export interface PayloadListResponse<T> {
  docs: T[];
  totalDocs: number;
  page: number;
  totalPages: number;
}

export interface PayloadFetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Public reads only — this client never sends an auth token, matching the
 * read-only "Public Website" static-token pattern the old Directus client
 * used. Write operations (seeding, admin edits) go through the Payload
 * admin panel or the seed script's Local API instead. */
export async function payloadFetch<T>(
  path: string,
  searchParams?: Record<string, string>,
  options: PayloadFetchOptions = {},
): Promise<T> {
  const url = new URL(path, PAYLOAD_URL);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? 5_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) {
    throw new Error(`Payload request failed: ${res.status} ${url.pathname}${url.search}`);
  }
  return res.json() as Promise<T>;
}

const PAYLOAD_PUBLIC_URL = process.env.PAYLOAD_PUBLIC_URL ?? PAYLOAD_URL;

/** Accepts whatever `@lib/payload/map`'s mapMedia() produced — a
 * DirectusFileRef-shaped object carrying `.url`. Payload media docs already
 * carry a root-relative `url`; this just makes it absolute against the
 * CMS's public origin. Payload has no by-ID transform endpoint here (unlike
 * Directus's /assets/:id?width=), so a requested width selects the smallest
 * generated imageSize that is wide enough and otherwise falls back to the
 * untouched original. Height, quality, and format remain compatibility-only. */
export function assetUrl(
  file:
    | {
        url?: string | null;
        width?: number | null;
        height?: number | null;
        sizes?: Record<
          string,
          { url?: string | null; width?: number | null; height?: number | null }
        >;
      }
    | string
    | null
    | undefined,
  params?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'auto';
  },
): string | null {
  if (!file || typeof file !== 'object' || !file.url) return null;

  let selectedUrl = file.url;
  const requestedWidth = params?.width;
  if (typeof requestedWidth === 'number' && Number.isFinite(requestedWidth) && requestedWidth > 0) {
    const candidate = Object.values(file.sizes ?? {})
      .filter(
        (variant): variant is { url: string; width: number; height?: number | null } =>
          typeof variant?.url === 'string' &&
          Boolean(variant.url) &&
          typeof variant.width === 'number' &&
          Number.isFinite(variant.width) &&
          variant.width >= requestedWidth,
      )
      .sort((left, right) => left.width - right.width)[0];
    if (candidate) selectedUrl = candidate.url;
  }

  return resolvePayloadAssetUrl(selectedUrl);
}

function resolvePayloadAssetUrl(value: string): string | null {
  try {
    const url = new URL(value, `${PAYLOAD_PUBLIC_URL.replace(/\/$/, '')}/`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function responsiveAssetSources(
  file:
    | {
        url?: string | null;
        width?: number | null;
        sizes?: Record<string, { url?: string | null; width?: number | null }>;
      }
    | string
    | null
    | undefined,
): Array<{ url: string; width: number }> {
  if (!file || typeof file !== 'object') return [];
  const candidates = [...Object.values(file.sizes ?? {}), { url: file.url, width: file.width }];
  const distinct = new Map<string, { url: string; width: number }>();
  for (const candidate of candidates) {
    if (
      typeof candidate?.url !== 'string' ||
      !candidate.url ||
      typeof candidate.width !== 'number' ||
      !Number.isFinite(candidate.width) ||
      candidate.width <= 0
    ) {
      continue;
    }
    const url = resolvePayloadAssetUrl(candidate.url);
    if (url && !distinct.has(`${candidate.width}:${url}`)) {
      distinct.set(`${candidate.width}:${url}`, { url, width: candidate.width });
    }
  }
  return [...distinct.values()].sort((left, right) => left.width - right.width);
}

export function defaultResponsiveSizes(width: number): string {
  return Number.isFinite(width) && width > 0
    ? `(max-width: ${Math.round(width)}px) 100vw, ${Math.round(width)}px`
    : '100vw';
}
