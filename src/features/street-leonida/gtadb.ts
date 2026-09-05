/** Immutable provenance for the GTADB community-reconstruction input. */
export const GTADB_SOURCE = 'https://github.com/rolux/gtadb.org' as const;
export const GTADB_REVISION = '7c3f8c295d64254e6b6d269b77c6f84fc4339f9c' as const;
export const GTADB_LICENSE = 'CC BY 4.0' as const;
export const GTADB_PREFERRED_SOURCE = 'https://map.gtadb.org' as const;
export const GTADB_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/' as const;
export const GTADB_PINNED_DATA_URL =
  `https://github.com/rolux/gtadb.org/blob/${GTADB_REVISION}/map/data/6/landmarks.json` as const;
export const GTADB_PRESENTATION_NOTICE =
  'transformed presentation · deterministic, pixel-aligned transform · community placement APPROXIMATE · approximate visualization scale' as const;
export const GTADB_ATTRIBUTION =
  `GTADB / Map GTA community reconstruction · preferred source ${GTADB_PREFERRED_SOURCE} · ${GTADB_LICENSE} ${GTADB_LICENSE_URL} · pinned revision ${GTADB_REVISION} · ${GTADB_PRESENTATION_NOTICE} · not an official Rockstar map` as const;
export const GTADB_SNAPSHOT_SHA256 =
  'dd70b15592ee1ef6c3bbd0ccfea0fe8eef3cb033284f89670be419172e26ab65' as const;

export type GtadbCoordinate = readonly [number, number];
export type GtadbPhotoSize = readonly [number, number];
export type GtadbEditedAt = readonly [number, number, number];

/**
 * The ordered tuple supplied by `map/data/6/landmarks.json` at the pinned revision.
 * Empty coordinate and photo-size arrays deliberately remain valid upstream values.
 */
export type GtadbLandmarkTuple = readonly [
  inGameAddress: string,
  inGameCoordinates: readonly number[],
  inGamePhotoSize: readonly number[],
  realWorldAddress: string,
  realWorldCoordinates: readonly number[],
  realWorldPhotoSize: readonly number[],
  tags: readonly string[],
  color: string,
  editedAt: readonly number[],
];

export type GtadbConfidence = 'SUPPORTED' | 'UNKNOWN';
export type GtadbNameEvidence = 'KNOWN' | 'UNKNOWN';
export type GtadbPlacementEvidence = 'APPROXIMATE' | 'UNPOSITIONED';
export type GtadbLevelTag = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export type GtadbUncertaintyReason =
  | 'unknown-name'
  | 'unconfirmed'
  | 'may-not-exist'
  | 'cancelled'
  | 'fictional'
  | 'demolished'
  | 'duplicate';

export interface GtadbEvidenceFacets {
  /** Whether the community record supplies a non-empty name without a question mark. */
  readonly name: GtadbNameEvidence;
  /** Community placement is approximate even when a source coordinate pair is present. */
  readonly placement: GtadbPlacementEvidence;
  /** Literal upstream tag signals; these are not a shared confidence scale. */
  readonly tagSignals: {
    readonly levelTags: readonly GtadbLevelTag[];
    readonly unconfirmed: boolean;
    readonly demolished: boolean;
  };
}

export interface GtadbLandmark {
  readonly id: string;
  readonly inGameAddress: string;
  /** The only GTADB coordinate pair eligible for Leonida placement. */
  readonly inGameCoordinates: GtadbCoordinate | null;
  /** Image dimensions, not a geographic position. */
  readonly inGamePhotoSize: GtadbPhotoSize | null;
  /** Analogue provenance only; it must never be transformed into the Leonida world. */
  readonly realWorldAddress: string;
  readonly realWorldCoordinates: GtadbCoordinate | null;
  /** Image dimensions, not a geographic position. */
  readonly realWorldPhotoSize: GtadbPhotoSize | null;
  readonly tags: readonly string[];
  readonly color: string;
  readonly editedAt: GtadbEditedAt;
  /** Compatibility name bucket; spatial and tag evidence live in separate facets below. */
  readonly confidence: GtadbConfidence;
  readonly evidence: GtadbEvidenceFacets;
}

export interface GtadbCatalogueStats {
  readonly recordCount: number;
  readonly positionedCount: number;
  readonly unpositionedCount: number;
  readonly knownNameCount: number;
  readonly unknownNameCount: number;
}

const UNKNOWN_NAME = /\?/;
const GTADB_LEVEL_TAG = /^l([1-5])$/i;
const UNCONFIRMED_TAG = /^un(?:confirmed|comfirmed)$/i;
const DEMOLISHED_TAG = /^demolished$/i;
const UNCERTAINTY_SIGNALS: ReadonlyArray<{
  readonly reason: Exclude<GtadbUncertaintyReason, 'unknown-name'>;
  readonly pattern: RegExp;
}> = [
  { reason: 'unconfirmed', pattern: /\bun(?:confirmed|comfirmed)\b/i },
  { reason: 'may-not-exist', pattern: /\bmay(?:-not-|not\s+)exist\b/i },
  { reason: 'cancelled', pattern: /\bcancelled\b/i },
  { reason: 'fictional', pattern: /\bfictional\b/i },
  { reason: 'demolished', pattern: /\bdemolished\b/i },
  { reason: 'duplicate', pattern: /\bduplicate\b/i },
];

function invalidLandmark(id: string, message: string): never {
  throw new Error(`Invalid GTADB landmark ${id}: ${message}`);
}

function hasUnknownName(inGameAddress: string): boolean {
  return inGameAddress.trim().length === 0 || UNKNOWN_NAME.test(inGameAddress);
}

function normalizePair(id: string, slot: string, value: unknown): GtadbCoordinate | null {
  if (!Array.isArray(value)) invalidLandmark(id, `${slot} must be an array`);
  if (value.length === 0) return null;
  if (
    value.length !== 2 ||
    !value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
  ) {
    invalidLandmark(id, `${slot} must be empty or contain two finite numbers`);
  }
  return [value[0]!, value[1]!];
}

function normalizeEditedAt(id: string, value: unknown): GtadbEditedAt {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every((timestamp) => typeof timestamp === 'number' && Number.isFinite(timestamp))
  ) {
    invalidLandmark(id, 'editedAt must contain three finite timestamps');
  }
  return [value[0]!, value[1]!, value[2]!];
}

/**
 * Derives every independent uncertainty signal from immutable source fields. Keeping this facet
 * computed allows the pinned snapshot to remain byte-for-byte reproducible while preserving name
 * evidence as its own dimension.
 */
export function classifyGtadbUncertaintyReasons(
  inGameAddress: string,
  tags: readonly string[],
): readonly GtadbUncertaintyReason[] {
  const sourceValues = [inGameAddress, ...tags];
  const reasons: GtadbUncertaintyReason[] = [];
  if (hasUnknownName(inGameAddress)) reasons.push('unknown-name');
  for (const { reason, pattern } of UNCERTAINTY_SIGNALS) {
    if (sourceValues.some((value) => pattern.test(value))) reasons.push(reason);
  }
  return reasons;
}

/**
 * Separates name status, placement status, and heterogeneous source tags. A positioned GTADB
 * record is still community-estimated geography; level, unconfirmed, and demolished tags do not
 * alter whether its supplied name is known.
 */
export function classifyGtadbEvidence(
  inGameAddress: string,
  inGameCoordinates: GtadbCoordinate | null,
  tags: readonly string[],
): GtadbEvidenceFacets {
  const levelTags = tags.flatMap((tag): GtadbLevelTag[] => {
    const match = GTADB_LEVEL_TAG.exec(tag);
    return match ? [`L${match[1]}` as GtadbLevelTag] : [];
  });

  return {
    name: hasUnknownName(inGameAddress) ? 'UNKNOWN' : 'KNOWN',
    placement: inGameCoordinates === null ? 'UNPOSITIONED' : 'APPROXIMATE',
    tagSignals: {
      levelTags: [...new Set(levelTags)],
      unconfirmed: tags.some((tag) => UNCONFIRMED_TAG.test(tag)),
      demolished: tags.some((tag) => DEMOLISHED_TAG.test(tag)),
    },
  };
}

/**
 * Legacy display bucket for existing catalogue consumers. It describes name status only, never
 * official identity, coordinate accuracy, or a combined interpretation of unrelated GTADB tags.
 */
export function classifyGtadbConfidence(
  inGameAddress: string,
  tags: readonly string[],
): GtadbConfidence {
  void tags;
  return hasUnknownName(inGameAddress) ? 'UNKNOWN' : 'SUPPORTED';
}

/** Parses every upstream landmark tuple without inventing defaults or dropping records. */
export function normalizeGtadbCatalogue(
  source: Readonly<Record<string, unknown>>,
): readonly GtadbLandmark[] {
  return Object.entries(source).map(([id, value]) => {
    if (!/^L\d+$/.test(id)) invalidLandmark(id, 'identifier must match L<number>');
    if (!Array.isArray(value) || value.length !== 9) {
      invalidLandmark(id, 'expected a nine-slot tuple');
    }

    const [
      inGameAddress,
      inGameCoordinates,
      inGamePhotoSize,
      realWorldAddress,
      realWorldCoordinates,
      realWorldPhotoSize,
      tags,
      color,
      editedAt,
    ] = value;

    if (typeof inGameAddress !== 'string') invalidLandmark(id, 'inGameAddress must be a string');
    if (typeof realWorldAddress !== 'string')
      invalidLandmark(id, 'realWorldAddress must be a string');
    if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
      invalidLandmark(id, 'tags must be an array of strings');
    }
    if (typeof color !== 'string') invalidLandmark(id, 'color must be a string');

    const normalizedInGameCoordinates = normalizePair(id, 'inGameCoordinates', inGameCoordinates);
    const normalizedTags = [...tags];
    const evidence = classifyGtadbEvidence(
      inGameAddress,
      normalizedInGameCoordinates,
      normalizedTags,
    );
    return {
      id,
      inGameAddress,
      inGameCoordinates: normalizedInGameCoordinates,
      inGamePhotoSize: normalizePair(id, 'inGamePhotoSize', inGamePhotoSize),
      realWorldAddress,
      realWorldCoordinates: normalizePair(id, 'realWorldCoordinates', realWorldCoordinates),
      realWorldPhotoSize: normalizePair(id, 'realWorldPhotoSize', realWorldPhotoSize),
      tags: normalizedTags,
      color,
      editedAt: normalizeEditedAt(id, editedAt),
      confidence: evidence.name === 'UNKNOWN' ? 'UNKNOWN' : 'SUPPORTED',
      evidence,
    };
  });
}

export function isPositionedGtadbLandmark(
  landmark: Pick<GtadbLandmark, 'inGameCoordinates'>,
): landmark is GtadbLandmark & { readonly inGameCoordinates: GtadbCoordinate } {
  return landmark.inGameCoordinates !== null;
}

export function getGtadbCatalogueStats(catalogue: readonly GtadbLandmark[]): GtadbCatalogueStats {
  const positionedCount = catalogue.filter(isPositionedGtadbLandmark).length;
  const unknownNameCount = catalogue.filter(({ evidence }) => evidence.name === 'UNKNOWN').length;
  return {
    recordCount: catalogue.length,
    positionedCount,
    unpositionedCount: catalogue.length - positionedCount,
    knownNameCount: catalogue.length - unknownNameCount,
    unknownNameCount,
  };
}
