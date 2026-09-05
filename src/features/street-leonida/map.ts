import { getStreetLinkLabel } from './links';
import { normalizeAuthorizedEmbedUrl } from './media';
import type {
  PublicStreetImage,
  PublicStreetLink,
  PublicStreetMedia,
  PublicStreetPanBounds,
  PublicStreetPlace,
  PublicStreetPosition,
  PublicStreetSource,
  PublicStreetViewpoint,
  PublicTruthLabel,
  StreetAuthority,
  StreetConfidence,
  StreetDeliveryMode,
  StreetLinkType,
  StreetMediaKind,
  StreetPlaceCategory,
  StreetPrecision,
  StreetRightsDecision,
} from './types';
import { assetUrl, responsiveAssetSources } from '@lib/payload/client';
import { mapMedia } from '@lib/payload/map';

const PUBLIC_STREET_HOSTS = new Set([
  'www.rockstargames.com',
  'rockstargames.com',
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'cms.gta6state.com',
]);

const AUTHORITIES = new Set<StreetAuthority>([
  'ROCKSTAR_OFFICIAL',
  'COMMUNITY_SOURCE',
  'EDITORIAL_INFERENCE',
  'UNKNOWN',
]);
const CONFIDENCES = new Set<StreetConfidence>(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);
const PRECISIONS = new Set<StreetPrecision>([
  'EXACT_AS_SOURCED',
  'APPROXIMATE',
  'REGION_ONLY',
  'UNKNOWN',
]);
const DELIVERY_MODES = new Set<StreetDeliveryMode>([
  'LOCAL_IMAGE',
  'AUTHORIZED_EMBED',
  'CLEARED_FIRST_PARTY_URL',
  'OUTBOUND_LINK',
]);
const RIGHTS_DECISIONS = new Set<StreetRightsDecision>([
  'CLEARED_LOCAL',
  'CLEARED_EMBED',
  'CLEARED_HOTLINK',
  'LINK_ONLY',
  'REJECTED',
  'UNKNOWN',
]);
const MEDIA_KINDS = new Set<StreetMediaKind>(['STILL_IMAGE', 'VIDEO_EXCERPT', 'PANORAMA_360']);
const LINK_TYPES = new Set<StreetLinkType>([
  'VIDEO_TIMELINE_NEXT',
  'SAME_PLACE_JUMP',
  'REGION_JUMP',
  'MANUAL_JUMP',
]);
const PLACE_CATEGORIES = new Set<StreetPlaceCategory>([
  'REGION',
  'CITY',
  'DISTRICT',
  'LANDMARK',
  'BUSINESS',
  'NATURAL_AREA',
  'INFRASTRUCTURE',
  'OTHER',
]);

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeSlug(value: unknown): string | null {
  const slug = text(value);
  return slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

function enumValue<T extends string>(value: unknown, allowed: ReadonlySet<T>, fallback: T): T {
  return allowed.has(value as T) ? (value as T) : fallback;
}

export function safePublicStreetUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !PUBLIC_STREET_HOSTS.has(url.hostname.toLowerCase())
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function mapSource(value: unknown, retrievedAt: unknown = null): PublicStreetSource | null {
  const source = record(value);
  if (!source) return null;
  const title = text(source.title);
  const url = safePublicStreetUrl(source.url);
  if (!title || !url) return null;
  return {
    title,
    publisher: text(source.publisher),
    url,
    publishedAt: text(source.publishedAt),
    retrievedAt: text(retrievedAt),
  };
}

function claims(value: unknown): UnknownRecord[] {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is UnknownRecord => Boolean(item))
    : [];
}

function findClaim(allClaims: UnknownRecord[], claimType: string): UnknownRecord | null {
  return allClaims.find((claim) => claim.claimType === claimType) ?? null;
}

function mapPosition(
  doc: UnknownRecord,
  positionClaim: UnknownRecord | null,
): PublicStreetPosition | null {
  if (!finite(doc.mapX) || !finite(doc.mapY)) return null;
  if (!positionClaim || positionClaim.claimType !== 'POSITION') return null;
  const source = mapSource(positionClaim.source, positionClaim.retrievedAt);
  if (!source) return null;
  const authority = enumValue(positionClaim.authority, AUTHORITIES, 'UNKNOWN');
  const confidence = enumValue(positionClaim.confidence, CONFIDENCES, 'UNKNOWN');
  const precision = enumValue(positionClaim.precision, PRECISIONS, 'UNKNOWN');
  if (authority !== 'COMMUNITY_SOURCE' && precision !== 'APPROXIMATE') return null;
  return {
    x: doc.mapX,
    y: doc.mapY,
    authority,
    confidence,
    precision,
    label: precision === 'APPROXIMATE' ? 'Approximate position' : 'Community-mapped position',
    source,
  };
}

function mapPositionLabels(position: PublicStreetPosition | null): PublicTruthLabel[] {
  if (!position) return [];
  const result: PublicTruthLabel[] = [];
  if (position.authority === 'COMMUNITY_SOURCE') result.push('Community-mapped position');
  if (position.precision === 'APPROXIMATE') result.push('Approximate position');
  return result;
}

function mapAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const aliases = value
    .map((item) => {
      if (typeof item === 'string') return text(item);
      const alias = record(item);
      return text(alias?.alias ?? alias?.name ?? alias?.value);
    })
    .filter((item): item is string => Boolean(item));
  return [...new Set(aliases)];
}

function mapRegion(value: unknown): PublicStreetPlace['region'] {
  const region = record(value);
  if (region?.status !== 'published') return null;
  const name = text(region?.name);
  const slug = safeSlug(region?.slug);
  return name && slug ? { name, slug } : null;
}

function mapImage(value: unknown): PublicStreetImage | null {
  const raw = record(value);
  const media = mapMedia(value);
  if (
    !raw ||
    !media ||
    !finite(media.width) ||
    media.width <= 0 ||
    !finite(media.height) ||
    media.height <= 0
  ) {
    return null;
  }
  const src = safePublicStreetUrl(assetUrl(media));
  const alt = text(raw.alt ?? media.description);
  if (!src || !alt) return null;

  const variantHeights = new Map<number, number>();
  for (const variant of Object.values(media.sizes ?? {})) {
    if (variant) variantHeights.set(variant.width, variant.height);
  }
  variantHeights.set(media.width, media.height);

  const variants = responsiveAssetSources(media)
    .map((variant) => ({
      src: safePublicStreetUrl(variant.url),
      width: variant.width,
      height: variantHeights.get(variant.width),
    }))
    .filter(
      (variant): variant is { src: string; width: number; height: number } =>
        Boolean(variant.src) && finite(variant.height) && variant.height > 0,
    );

  return {
    src,
    width: media.width,
    height: media.height,
    alt,
    caption: text(raw.caption),
    variants,
  };
}

function mapPan(value: unknown): PublicStreetPanBounds | null {
  const pan = record(value);
  if (!pan) return null;
  const { minX, maxX, minY, maxY } = pan;
  if (
    !finite(minX) ||
    !finite(maxX) ||
    !finite(minY) ||
    !finite(maxY) ||
    minX < 0 ||
    maxX > 1 ||
    minY < 0 ||
    maxY > 1 ||
    minX > maxX ||
    minY > maxY
  ) {
    return null;
  }
  return { minX, maxX, minY, maxY };
}

function mapVideo(
  doc: UnknownRecord,
  deliveryMode: StreetDeliveryMode,
): PublicStreetMedia['video'] {
  if (!finite(doc.videoStartSeconds) || !finite(doc.videoEndSeconds)) return null;
  if (doc.videoStartSeconds < 0 || doc.videoStartSeconds >= doc.videoEndSeconds) return null;

  const externalUrl = doc.externalUrl ?? doc.externalMediaUrl ?? doc.videoUrl ?? doc.embedUrl;
  const src = deliveryMode === 'CLEARED_FIRST_PARTY_URL' ? safePublicStreetUrl(externalUrl) : null;
  const embedUrl =
    deliveryMode === 'AUTHORIZED_EMBED' ? normalizeAuthorizedEmbedUrl(externalUrl) : null;
  if (!src && !embedUrl) return null;

  return {
    src,
    embedUrl,
    poster: mapImage(doc.poster),
    start: doc.videoStartSeconds,
    end: doc.videoEndSeconds,
    captionsUrl: safePublicStreetUrl(doc.captionsUrl),
    transcript: text(doc.transcript),
    noVisibleCutObserved: doc.noVisibleCutObserved === true,
  };
}

function emptyMedia(kind: StreetMediaKind, deliveryMode: StreetDeliveryMode): PublicStreetMedia {
  return { kind, deliveryMode, image: null, video: null, outboundUrl: null, pan: null };
}

function mapMediaDelivery(doc: UnknownRecord): PublicStreetMedia {
  const kind = enumValue(doc.mediaKind, MEDIA_KINDS, 'STILL_IMAGE');
  const deliveryMode = enumValue(doc.deliveryMode, DELIVERY_MODES, 'OUTBOUND_LINK');
  const rights = record(doc.rights);
  const decision = enumValue(rights?.decision ?? doc.rightsDecision, RIGHTS_DECISIONS, 'UNKNOWN');
  const result = emptyMedia(kind, deliveryMode);

  if (deliveryMode === 'OUTBOUND_LINK' && decision === 'LINK_ONLY') {
    result.outboundUrl = safePublicStreetUrl(doc.outboundUrl);
    return result;
  }

  if (
    (kind === 'STILL_IMAGE' || kind === 'PANORAMA_360') &&
    deliveryMode === 'LOCAL_IMAGE' &&
    decision === 'CLEARED_LOCAL'
  ) {
    result.image = mapImage(doc.image ?? doc.localMedia ?? doc.media);
    if (result.image && kind === 'STILL_IMAGE') {
      result.pan = mapPan(doc.stillPanBounds ?? doc.panBounds);
    }
    return result;
  }

  if (
    kind === 'VIDEO_EXCERPT' &&
    ((deliveryMode === 'AUTHORIZED_EMBED' && decision === 'CLEARED_EMBED') ||
      (deliveryMode === 'CLEARED_FIRST_PARTY_URL' && decision === 'CLEARED_HOTLINK'))
  ) {
    result.video = mapVideo(doc, deliveryMode);
  }

  return result;
}

export function mapStreetPlace(value: unknown): PublicStreetPlace | null {
  const doc = record(value);
  if (!doc || doc.status !== 'published') return null;
  const name = text(doc.name);
  const slug = safeSlug(doc.slug);
  if (!name || !slug) return null;

  const allClaims = claims(doc.claims);
  const nameClaim = findClaim(allClaims, 'NAME');
  const position = mapPosition(doc, findClaim(allClaims, 'POSITION'));
  const labels: PublicTruthLabel[] = [];
  if (nameClaim?.authority === 'ROCKSTAR_OFFICIAL') labels.push('Official place name');
  labels.push(...mapPositionLabels(position));

  const relatedLocation = record(doc.relatedLocation);
  return {
    name,
    slug,
    aliases: mapAliases(doc.aliases),
    category: enumValue(doc.category, PLACE_CATEGORIES, 'OTHER'),
    description: text(doc.description ?? doc.shortDescription),
    region: mapRegion(doc.region),
    relatedLocationSlug:
      relatedLocation?.status === 'published' ? safeSlug(relatedLocation.slug) : null,
    position,
    labels,
    source: mapSource(nameClaim?.source, nameClaim?.retrievedAt),
  };
}

export function mapStreetPlaces(values: unknown): PublicStreetPlace[] {
  if (!Array.isArray(values)) return [];
  return values.map(mapStreetPlace).filter((item): item is PublicStreetPlace => Boolean(item));
}

export function mapStreetLink(value: unknown): PublicStreetLink | null {
  const doc = record(value);
  if (!doc || doc.status !== 'published') return null;
  const from = record(doc.fromViewpoint);
  const to = record(doc.toViewpoint);
  if (from?.status !== 'published' || to?.status !== 'published') return null;
  const fromSlug = safeSlug(from?.slug);
  const toSlug = safeSlug(to?.slug);
  const type = LINK_TYPES.has(doc.linkType as StreetLinkType)
    ? (doc.linkType as StreetLinkType)
    : null;
  if (!fromSlug || !toSlug || !type || fromSlug === toSlug) return null;

  return {
    fromSlug,
    toSlug,
    type,
    label: getStreetLinkLabel(type),
    note: text(doc.publicNote),
    authority: enumValue(doc.authority, AUTHORITIES, 'UNKNOWN'),
    confidence: enumValue(doc.confidence, CONFIDENCES, 'UNKNOWN'),
    source: mapSource(doc.source),
  };
}

export function mapStreetLinks(values: unknown): PublicStreetLink[] {
  if (!Array.isArray(values)) return [];
  return values.map(mapStreetLink).filter((item): item is PublicStreetLink => Boolean(item));
}

export function mapStreetViewpoint(
  value: unknown,
  rawLinks: unknown = [],
): PublicStreetViewpoint | null {
  const doc = record(value);
  if (!doc || doc.status !== 'published') return null;
  const slug = safeSlug(doc.slug);
  const title = text(doc.title);
  const place = record(doc.place);
  if (place?.status !== 'published') return null;
  const placeSlug = safeSlug(place?.slug);
  const placeName = text(place?.name);
  const source = mapSource(doc.source);
  if (!slug || !title || !placeSlug || !placeName || !source) return null;

  const media = mapMediaDelivery(doc);
  const position = mapPosition(doc, record(doc.positionClaim));
  const links = mapStreetLinks(rawLinks).filter(
    (link) => link.fromSlug === slug || link.toSlug === slug,
  );
  const labels: PublicTruthLabel[] = [];
  if (doc.mediaAuthority === 'ROCKSTAR_OFFICIAL') labels.push('Official media');
  if (media.kind === 'VIDEO_EXCERPT' && source.publisher === 'Rockstar Games') {
    labels.push('Official source video');
  }
  if (media.video?.noVisibleCutObserved) {
    labels.push('Reviewed excerpt: no visible cut observed');
  }
  if (doc.perspective === 'FIRST_PERSON') labels.push('First-person view');
  labels.push('Documented view', ...mapPositionLabels(position));
  if (links.some((link) => link.authority === 'UNKNOWN' || link.confidence === 'UNKNOWN')) {
    labels.push('Connection unverified');
  }

  return {
    slug,
    title,
    place: { name: placeName, slug: placeSlug },
    media,
    source,
    labels: [...new Set(labels)],
    position,
    perspective: text(doc.perspective),
    captureContext: text(doc.captureContext),
    visualDescription: text(doc.visualDescription),
    coverageMessage: text(doc.coverageMessage),
    links,
  };
}

export function mapStreetViewpoints(
  values: unknown,
  rawLinks: unknown = [],
): PublicStreetViewpoint[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => mapStreetViewpoint(value, rawLinks))
    .filter((item): item is PublicStreetViewpoint => Boolean(item));
}
