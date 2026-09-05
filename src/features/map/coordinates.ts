import type { Position } from '../../domain/types';
import { CANONICAL_BOUNDS } from '../street-leonida/leonida-coordinates';

export interface MapBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

/** The SVG viewBox is world x*2, y*-2; imageOverlay uses these original GTADB bounds. */
export const BASEMAP_BOUNDS: MapBounds = CANONICAL_BOUNDS;
/** Fits the source's occupied extent, including the Keys and northern community coverage. */
export const INITIAL_BOUNDS: MapBounds = { west: -10000, east: 3300, south: -8000, north: 9200 };
export const MIN_ZOOM = -7;
export const MAX_ZOOM = 3;

/** Leaflet calls the tuple lat/lng; CRS.Simple treats it as raw y/x, without projection. */
export function toMapCoordinate(position: Position): [number, number] {
  return [position.y, position.x];
}

export function fromMapCoordinate(point: { lat: number; lng: number }): Position {
  return { x: point.lng, y: point.lat };
}

export function isValidPosition(position: Position | null | undefined): position is Position {
  return Boolean(
    position &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    position.x >= BASEMAP_BOUNDS.west &&
    position.x <= BASEMAP_BOUNDS.east &&
    position.y >= BASEMAP_BOUNDS.south &&
    position.y <= BASEMAP_BOUNDS.north,
  );
}

export function containsPosition(bounds: MapBounds, position: Position): boolean {
  return (
    position.x >= bounds.west &&
    position.x <= bounds.east &&
    position.y >= bounds.south &&
    position.y <= bounds.north
  );
}

/** Move the camera south so a focused place sits above a mobile bottom details panel. */
export function getFocusCenter(
  position: Position,
  zoom: number,
  viewportHeight: number,
  mobileDetails: boolean,
): Position {
  return mobileDetails
    ? { x: position.x, y: position.y - (viewportHeight * 0.22) / Math.pow(2, zoom) }
    : position;
}
