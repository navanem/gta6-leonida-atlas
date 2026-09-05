/** A positioned point in the pinned GTADB reconstruction. */
export interface GtadbPoint {
  readonly x: number;
  readonly y: number;
}

export interface CanonicalPoint {
  readonly east: number;
  readonly north: number;
}

export interface WorldPoint {
  readonly x: number;
  readonly z: number;
}

/** SVG map Y is deliberately the same value as Three.js world Z. */
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export type GtadbPointInput = GtadbPoint | readonly [x: number, y: number];

/** Rounded community-data calibration; it is not an official measurement. */
export const WORLD_METRES_PER_GTADB_UNIT = 2 as const;

export const CANONICAL_BOUNDS = Object.freeze({
  west: -16000,
  east: 4000,
  south: -8000,
  north: 12000,
});

export function gtadbToCanonical(point: GtadbPointInput): CanonicalPoint {
  if ('x' in point) return { east: point.x, north: point.y };
  return { east: point[0], north: point[1] };
}

export function canonicalToWorld(point: CanonicalPoint): WorldPoint {
  return {
    x: point.east * WORLD_METRES_PER_GTADB_UNIT,
    z: point.north * -WORLD_METRES_PER_GTADB_UNIT,
  };
}

export function gtadbToWorld(point: GtadbPointInput): WorldPoint {
  return canonicalToWorld(gtadbToCanonical(point));
}

export function worldToGtadb(point: WorldPoint): GtadbPoint {
  return {
    x: point.x / WORLD_METRES_PER_GTADB_UNIT,
    y: point.z / -WORLD_METRES_PER_GTADB_UNIT,
  };
}

export function worldToMap(point: WorldPoint): MapPoint {
  return { x: point.x, y: point.z };
}

export function mapToWorld(point: MapPoint): WorldPoint {
  return { x: point.x, z: point.y };
}

export function gtadbDistance(first: GtadbPointInput, second: GtadbPointInput): number {
  const a = gtadbToCanonical(first);
  const b = gtadbToCanonical(second);
  return Math.hypot(b.east - a.east, b.north - a.north);
}

export function gtadbDistanceToWorldMetres(
  first: GtadbPointInput,
  second: GtadbPointInput,
): number {
  return gtadbDistance(first, second) * WORLD_METRES_PER_GTADB_UNIT;
}

export function worldDistance(first: WorldPoint, second: WorldPoint): number {
  return Math.hypot(second.x - first.x, second.z - first.z);
}

const northWestWorld = canonicalToWorld({
  east: CANONICAL_BOUNDS.west,
  north: CANONICAL_BOUNDS.north,
});
const southEastWorld = canonicalToWorld({
  east: CANONICAL_BOUNDS.east,
  north: CANONICAL_BOUNDS.south,
});

export const WORLD_BOUNDS = Object.freeze({
  minX: northWestWorld.x,
  maxX: southEastWorld.x,
  minZ: northWestWorld.z,
  maxZ: southEastWorld.z,
  width: southEastWorld.x - northWestWorld.x,
  height: southEastWorld.z - northWestWorld.z,
});

export const MAP_BOUNDS = Object.freeze({
  minX: WORLD_BOUNDS.minX,
  maxX: WORLD_BOUNDS.maxX,
  minY: WORLD_BOUNDS.minZ,
  maxY: WORLD_BOUNDS.maxZ,
  width: WORLD_BOUNDS.width,
  height: WORLD_BOUNDS.height,
});

export const STATE_CANONICAL_BOUNDS = CANONICAL_BOUNDS;
export const STATE_WORLD_BOUNDS = WORLD_BOUNDS;
export const STATE_MAP_BOUNDS = MAP_BOUNDS;
