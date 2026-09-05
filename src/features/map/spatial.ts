import type { Place, Position } from '../../domain/types';
import { BASEMAP_BOUNDS, containsPosition, isValidPosition, type MapBounds } from './coordinates';

type PositionedPlace = Place & { position: Position };
export interface SpatialIndex {
  cellSize: number;
  cells: Map<string, PositionedPlace[]>;
}
export interface PlaceCluster {
  id: string;
  position: Position;
  places: PositionedPlace[];
}
export interface ClusterOptions {
  zoom: number;
  enabled: boolean;
  selectedId?: string | null;
  maxMarkers?: number;
}

export function buildSpatialIndex(places: readonly Place[], cellSize = 512): SpatialIndex {
  if (!Number.isFinite(cellSize) || cellSize <= 0)
    throw new Error('Spatial cell size must be positive.');
  const cells = new Map<string, PositionedPlace[]>();
  for (const place of places) {
    if (!isValidPosition(place.position)) continue;
    const key = `${Math.floor(place.position.x / cellSize)}:${Math.floor(place.position.y / cellSize)}`;
    const bucket = cells.get(key) ?? [];
    bucket.push(place as PositionedPlace);
    cells.set(key, bucket);
  }
  return { cellSize, cells };
}

/** Cell lookup avoids scanning the full catalogue for each settled map movement. */
export function querySpatialIndex(index: SpatialIndex, bounds: MapBounds): PositionedPlace[] {
  if (![bounds.west, bounds.east, bounds.south, bounds.north].every(Number.isFinite)) return [];
  const west = Math.max(bounds.west, BASEMAP_BOUNDS.west);
  const east = Math.min(bounds.east, BASEMAP_BOUNDS.east);
  const south = Math.max(bounds.south, BASEMAP_BOUNDS.south);
  const north = Math.min(bounds.north, BASEMAP_BOUNDS.north);
  if (west > east || south > north) return [];
  const result: PositionedPlace[] = [];
  for (
    let column = Math.floor(west / index.cellSize);
    column <= Math.floor(east / index.cellSize);
    column++
  ) {
    for (
      let row = Math.floor(south / index.cellSize);
      row <= Math.floor(north / index.cellSize);
      row++
    ) {
      for (const place of index.cells.get(`${column}:${row}`) ?? []) {
        if (containsPosition(bounds, place.position)) result.push(place);
      }
    }
  }
  return result;
}

/** Screen-sized cells create stable groups. At extreme density grouping is a mandatory DOM budget. */
export function clusterPlaces(places: readonly Place[], options: ClusterOptions): PlaceCluster[] {
  const positioned = places.filter((place): place is PositionedPlace =>
    isValidPosition(place.position),
  );
  const maxMarkers = Math.max(32, options.maxMarkers ?? 360);
  if (!options.enabled && positioned.length <= maxMarkers) {
    return positioned.map((place) => ({ id: place.id, position: place.position, places: [place] }));
  }
  let cellSize = 60 / Math.pow(2, Number.isFinite(options.zoom) ? options.zoom : 0);
  // Keep the small reference-region set legible while reserving a bounded part of the DOM budget.
  const referenceIds = new Set(
    positioned
      .filter((place) => place.layerId === 'regions')
      .slice(0, 12)
      .map((place) => place.id),
  );
  let groups: PlaceCluster[] = [];
  // Doubling cell size converges to at most four spatial quadrants plus the selected place.
  for (let pass = 0; pass < 32; pass++) {
    const buckets = new Map<string, PositionedPlace[]>();
    for (const place of positioned) {
      const key =
        place.id === options.selectedId || referenceIds.has(place.id)
          ? `reference:${place.id}`
          : `grid:${cellSize}:${Math.floor(place.position.x / cellSize)}:${Math.floor(place.position.y / cellSize)}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(place);
      buckets.set(key, bucket);
    }
    groups = [...buckets].map(([id, members]) => ({
      id: members.length === 1 ? members[0]!.id : id,
      position: members.reduce(
        (sum, place) => ({
          x: sum.x + place.position.x / members.length,
          y: sum.y + place.position.y / members.length,
        }),
        { x: 0, y: 0 },
      ),
      places: members,
    }));
    if (groups.length <= maxMarkers) return groups;
    cellSize *= 2;
  }
  return groups;
}
