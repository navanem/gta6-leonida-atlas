/**
 * Typed shape of the Directus schema, used with `createDirectus<GtaSchema>()`.
 * Mirrors directus/schema/collections.ts — the two must be kept in sync by hand
 * (Directus has no first-class TS codegen for a hand-authored schema config).
 */

export type InformationStatus = 'confirmed' | 'likely' | 'rumor' | 'disproven';
export type VerificationStatus = 'official' | 'verified-in-game' | 'reported' | 'rumor' | 'unknown';
export type VerificationSourceType =
  'official' | 'platform-holder' | 'press' | 'community' | 'other';
export type SpoilerLevel = 'none' | 'minor' | 'major';

export interface Verification {
  status: VerificationStatus;
  source_name: string | null;
  source_url: string | null;
  source_type: VerificationSourceType | null;
  platform: string | null;
  game_version: string | null;
  verified_at: string | null;
  verified_by: string | null;
  spoiler_level: SpoilerLevel;
  editorial_note: string | null;
}

export interface DirectusFileRef {
  id: string;
  filename_download: string;
  width: number | null;
  height: number | null;
  description: string | null;
  /** Backend-served URL, absolute or root-relative. Directus-era code never
   * set this (assetUrl() built the URL from `id`); the Payload mapper does,
   * since Payload's media docs already carry it and there's no by-ID
   * transform endpoint to reconstruct it from. */
  url?: string | null;
  sizes?: Partial<Record<DirectusImageSizeName, DirectusImageVariant>>;
}

export type DirectusImageSizeName = 'thumbnail' | 'card' | 'hero';

export interface DirectusImageVariant {
  url: string;
  width: number;
  height: number;
}

export interface SeoFields {
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: DirectusFileRef | string | null;
  robots_index: boolean;
  robots_follow: boolean;
}

export interface Source {
  id: string;
  title: string;
  publisher: string | null;
  url: string;
  source_type: VerificationSourceType;
  published_at: string | null;
  notes: string | null;
}

export interface Author {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatar: DirectusFileRef | string | null;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Region {
  id: string;
  status: 'draft' | 'published' | 'archived';
  name: string;
  slug: string;
  description: string | null;
  featured_image: DirectusFileRef | string | null;
  map_image: DirectusFileRef | string | null;
}

interface BaseEntity extends SeoFields {
  id: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  slug: string;
  featured_image: DirectusFileRef | string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  verification: Verification;
}

export interface VehicleManufacturer {
  id: string;
  name: string;
  slug: string;
  logo: DirectusFileRef | string | null;
  description: string | null;
}

export interface VehicleClass {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface News extends BaseEntity {
  title: string;
  excerpt: string;
  body: string;
  category: string | null;
  featured_image_caption: string | null;
  information_status: InformationStatus;
  author: Author | string | null;
  sources: Array<{ sources_id: Source }> | Source[];
  related_characters: Array<{ characters_id: Character }> | Character[];
  related_locations: Array<{ locations_id: Location }> | Location[];
  related_vehicles: Array<{ vehicles_id: Vehicle }> | Vehicle[];
}

export interface Guide extends BaseEntity {
  title: string;
  excerpt: string;
  body: string;
  author: Author | string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  estimated_time: string | null;
  guide_type: string | null;
  toc_enabled: boolean;
  related_vehicles: Array<{ vehicles_id: Vehicle }> | Vehicle[];
  related_locations: Array<{ locations_id: Location }> | Location[];
}

export interface Vehicle extends BaseEntity {
  name: string;
  manufacturer: VehicleManufacturer | string | null;
  vehicle_class: VehicleClass | string | null;
  description: string;
  short_description: string | null;
  gallery: Array<{ directus_files_id: DirectusFileRef }>;
  price: number | null;
  currency: string;
  top_speed: number | null;
  acceleration: number | null;
  braking: number | null;
  handling: number | null;
  traction: number | null;
  seats: number | null;
  drivetrain: 'FWD' | 'RWD' | 'AWD' | null;
  weight: number | null;
  how_to_obtain: string | null;
  location_notes: string | null;
  information_status: InformationStatus;
  sources: Array<{ sources_id: Source }> | Source[];
  related_locations: Array<{ locations_id: Location }> | Location[];
}

export interface Character extends BaseEntity {
  name: string;
  role: string | null;
  short_description: string;
  biography: string;
  gallery: Array<{ directus_files_id: DirectusFileRef }>;
  affiliations: string | null;
  information_status: InformationStatus;
  sources: Array<{ sources_id: Source }> | Source[];
  related_locations: Array<{ locations_id: Location }> | Location[];
}

export interface Location extends BaseEntity {
  name: string;
  region: Region | string | null;
  location_type: string | null;
  short_description: string;
  description: string;
  gallery: Array<{ directus_files_id: DirectusFileRef }>;
  population: number | null;
  size_km2: number | null;
  latitude: number | null;
  longitude: number | null;
  information_status: InformationStatus;
  sources: Array<{ sources_id: Source }> | Source[];
}

export interface GtaSchema {
  news: News[];
  guides: Guide[];
  vehicles: Vehicle[];
  vehicle_manufacturers: VehicleManufacturer[];
  vehicle_classes: VehicleClass[];
  characters: Character[];
  locations: Location[];
  regions: Region[];
  tags: Tag[];
  authors: Author[];
  sources: Source[];
}
