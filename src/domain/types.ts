/** Coordinates are GTADB game units, never real-world latitude/longitude. */
export interface Position {
  x: number;
  y: number;
}
export type Category = 'region' | 'landmark' | 'nature' | 'transport' | 'business' | 'personal';
export interface Place {
  id: string;
  title: string;
  description: string;
  category: Category;
  position: Position | null;
  layerId: string;
  tags: string[];
  region: string;
  source: { title: string; url: string; license?: string };
  evidence: 'approximate' | 'uncertain' | 'personal';
}
export interface PersonalMarker {
  id: string;
  title: string;
  description: string;
  category: Category;
  position: Position;
  icon: 'pin' | 'star' | 'flag';
  createdAt: string;
  updatedAt: string;
}
export interface Favorite {
  placeId: string;
  createdAt: string;
}
export interface PlaceNote {
  placeId: string;
  text: string;
  updatedAt: string;
}
export interface Collection {
  id: string;
  name: string;
  placeIds: string[];
  createdAt: string;
  updatedAt: string;
}
export interface Preferences {
  reducedMotion: boolean;
  showLabels: boolean;
  clusterMarkers: boolean;
}
export interface UserData {
  favorites: Favorite[];
  notes: PlaceNote[];
  collections: Collection[];
  markers: PersonalMarker[];
  preferences: Preferences;
}
export interface Backup extends UserData {
  format: 'leonida-atlas';
  version: 2;
  exportedAt: string;
}
export interface LayerDefinition {
  id: string;
  name: string;
  description?: string;
  category: string;
  visible: boolean;
  order: number;
  source: string;
  minZoom?: number;
  maxZoom?: number;
  style: { color: string; radius: number };
  icon?: string;
  interactive: boolean;
  metadata?: Record<string, string>;
}
export interface Filters {
  query: string;
  category: Category | 'all';
  favoritesOnly: boolean;
  personalOnly: boolean;
  evidence: 'all' | 'approximate' | 'uncertain';
  collectionId: string | null;
}
export const DEFAULT_PREFERENCES: Preferences = {
  reducedMotion: false,
  showLabels: true,
  clusterMarkers: true,
};
export const EMPTY_USER_DATA: UserData = {
  favorites: [],
  notes: [],
  collections: [],
  markers: [],
  preferences: DEFAULT_PREFERENCES,
};
