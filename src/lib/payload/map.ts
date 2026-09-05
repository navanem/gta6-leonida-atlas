/**
 * Transforms Payload's (camelCase, flat-relationship) API responses into the
 * exact shape src/lib/directus/schema.ts's interfaces describe — the shape
 * every Astro template already consumes. This is the one file that knows
 * both shapes; nothing else should.
 */
import type {
  DirectusFileRef,
  DirectusImageSizeName,
  DirectusImageVariant,
  InformationStatus,
  SpoilerLevel,
  Verification,
  VerificationSourceType,
  VerificationStatus,
} from '@lib/content/schema';

interface PayloadMediaDoc {
  id: number;
  url?: string;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
  sizes?: Record<string, { url?: string | null; width?: number | null; height?: number | null }>;
}

const PAYLOAD_IMAGE_SIZE_NAMES = ['thumbnail', 'card', 'hero'] as const;

function mapImageVariant(value: unknown): DirectusImageVariant | null {
  if (!value || typeof value !== 'object') return null;
  const variant = value as { url?: unknown; width?: unknown; height?: unknown };
  if (
    typeof variant.url !== 'string' ||
    !variant.url.trim() ||
    typeof variant.width !== 'number' ||
    !Number.isFinite(variant.width) ||
    variant.width <= 0 ||
    typeof variant.height !== 'number' ||
    !Number.isFinite(variant.height) ||
    variant.height <= 0
  ) {
    return null;
  }
  return { url: variant.url, width: variant.width, height: variant.height };
}

export function mapMedia(m: unknown): DirectusFileRef | null {
  if (!m || typeof m !== 'object') return null;
  const media = m as PayloadMediaDoc;
  const sizes: Partial<Record<DirectusImageSizeName, DirectusImageVariant>> = {};
  for (const name of PAYLOAD_IMAGE_SIZE_NAMES) {
    const variant = mapImageVariant(media.sizes?.[name]);
    if (variant) sizes[name] = variant;
  }
  return {
    id: String(media.id),
    filename_download: media.url ?? '',
    width: media.width ?? null,
    height: media.height ?? null,
    description: media.alt ?? media.caption ?? null,
    url: media.url ?? null,
    sizes: Object.keys(sizes).length > 0 ? sizes : undefined,
  };
}

/** hasMany relationship array -> Directus-style junction shape, e.g.
 * `sources: [{a,b}]` becomes `[{ sources_id: {a,b} }]`. */
export function mapRelList<T extends Record<string, unknown>>(
  arr: unknown,
  key: string,
): Array<Record<string, T>> {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => ({ [key]: item as T }));
}

export function mapBase(doc: Record<string, unknown>) {
  return {
    id: String(doc.id),
    status: doc.status,
    published_at: doc.publishedAt ?? null,
    updated_at: doc.updatedAt ?? null,
    created_at: doc.createdAt ?? null,
    seo_title: doc.seoTitle ?? null,
    seo_description: doc.seoDescription ?? null,
    canonical_url: doc.canonicalUrl ?? null,
    og_image: mapMedia(doc.ogImage),
    robots_index: doc.robotsIndex ?? true,
    robots_follow: doc.robotsFollow ?? true,
    verification: mapVerification(doc.verification),
  };
}

const verificationStatuses = new Set<VerificationStatus>([
  'official',
  'verified-in-game',
  'reported',
  'rumor',
  'unknown',
]);
const sourceTypes = new Set<VerificationSourceType>([
  'official',
  'platform-holder',
  'press',
  'community',
  'other',
]);
const spoilerLevels = new Set<SpoilerLevel>(['none', 'minor', 'major']);

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeHttpsUrl(value: unknown): string | null {
  const candidate = optionalString(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export function mapVerification(value: unknown): Verification {
  const group = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    status: verificationStatuses.has(group.status as VerificationStatus)
      ? (group.status as VerificationStatus)
      : 'unknown',
    source_name: optionalString(group.sourceName),
    source_url: safeHttpsUrl(group.sourceUrl),
    source_type: sourceTypes.has(group.sourceType as VerificationSourceType)
      ? (group.sourceType as VerificationSourceType)
      : null,
    platform: optionalString(group.platform),
    game_version: optionalString(group.gameVersion),
    verified_at: optionalString(group.verifiedAt),
    verified_by: optionalString(group.verifiedBy),
    spoiler_level: spoilerLevels.has(group.spoilerLevel as SpoilerLevel)
      ? (group.spoilerLevel as SpoilerLevel)
      : 'none',
    editorial_note: optionalString(group.editorialNote),
  };
}

export function mapInformationStatus(doc: Record<string, unknown>): InformationStatus {
  return (doc.informationStatus as InformationStatus) ?? 'rumor';
}
