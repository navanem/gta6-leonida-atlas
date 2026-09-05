export type StreetAuthority =
  'ROCKSTAR_OFFICIAL' | 'COMMUNITY_SOURCE' | 'EDITORIAL_INFERENCE' | 'UNKNOWN';

export type StreetConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type StreetPrecision = 'EXACT_AS_SOURCED' | 'APPROXIMATE' | 'REGION_ONLY' | 'UNKNOWN';
export type StreetRightsDecision =
  'CLEARED_LOCAL' | 'CLEARED_EMBED' | 'CLEARED_HOTLINK' | 'LINK_ONLY' | 'REJECTED' | 'UNKNOWN';
export type StreetDeliveryMode =
  'LOCAL_IMAGE' | 'AUTHORIZED_EMBED' | 'CLEARED_FIRST_PARTY_URL' | 'OUTBOUND_LINK';
export type StreetMediaKind = 'STILL_IMAGE' | 'VIDEO_EXCERPT' | 'PANORAMA_360';
export type StreetLinkType =
  'VIDEO_TIMELINE_NEXT' | 'SAME_PLACE_JUMP' | 'REGION_JUMP' | 'MANUAL_JUMP';
export type StreetPlaceCategory =
  | 'REGION'
  | 'CITY'
  | 'DISTRICT'
  | 'LANDMARK'
  | 'BUSINESS'
  | 'NATURAL_AREA'
  | 'INFRASTRUCTURE'
  | 'OTHER';
export type StreetPlaceCategoryFilter =
  | 'region'
  | 'city'
  | 'district'
  | 'landmark'
  | 'business'
  | 'natural-area'
  | 'infrastructure'
  | 'other';

export type PublicTruthLabel =
  | 'Official media'
  | 'Official place name'
  | 'Community-mapped position'
  | 'Approximate position'
  | 'Official source video'
  | 'Reviewed excerpt: no visible cut observed'
  | 'First-person view'
  | 'Documented view'
  | 'Connection unverified'
  | 'Coverage ends here';

export interface PublicStreetSource {
  title: string;
  publisher: string | null;
  url: string;
  publishedAt: string | null;
  retrievedAt: string | null;
}

export interface PublicStreetPosition {
  x: number;
  y: number;
  authority: StreetAuthority;
  confidence: StreetConfidence;
  precision: StreetPrecision;
  label: 'Community-mapped position' | 'Approximate position';
  source: PublicStreetSource;
}

export interface PublicStreetImageVariant {
  src: string;
  width: number;
  height: number;
}

export interface PublicStreetImage {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  variants: PublicStreetImageVariant[];
}

export interface PublicStreetVideo {
  src: string | null;
  embedUrl: string | null;
  poster: PublicStreetImage | null;
  start: number;
  end: number;
  captionsUrl: string | null;
  transcript: string | null;
  noVisibleCutObserved: boolean;
}

export interface PublicStreetPanBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PublicStreetMedia {
  kind: StreetMediaKind;
  deliveryMode: StreetDeliveryMode;
  image: PublicStreetImage | null;
  video: PublicStreetVideo | null;
  outboundUrl: string | null;
  pan: PublicStreetPanBounds | null;
}

export interface PublicStreetLink {
  fromSlug: string;
  toSlug: string;
  type: StreetLinkType;
  label: 'Next moment' | 'Jump to scene';
  note: string | null;
  authority: StreetAuthority;
  confidence: StreetConfidence;
  source: PublicStreetSource | null;
}

export interface PublicStreetPlace {
  name: string;
  slug: string;
  aliases: string[];
  category: StreetPlaceCategory;
  description: string | null;
  region: { name: string; slug: string } | null;
  relatedLocationSlug: string | null;
  position: PublicStreetPosition | null;
  labels: PublicTruthLabel[];
  source: PublicStreetSource | null;
}

export interface PublicStreetViewpoint {
  slug: string;
  title: string;
  place: { name: string; slug: string };
  media: PublicStreetMedia;
  source: PublicStreetSource;
  labels: PublicTruthLabel[];
  position: PublicStreetPosition | null;
  perspective: string | null;
  captureContext: string | null;
  visualDescription: string | null;
  coverageMessage: string | null;
  links: PublicStreetLink[];
}

export interface PublicStreetList<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export type StreetListSort = 'name-asc' | 'name-desc' | 'updated-desc';

export interface StreetBoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface StreetPlaceQuery {
  query?: string;
  page?: number;
  limit?: number;
  sort?: StreetListSort;
  region?: string;
  category?: StreetPlaceCategoryFilter;
  bbox?: StreetBoundingBox;
}

export interface StreetViewpointQuery {
  page?: number;
  limit?: number;
  placeSlug?: string;
}
