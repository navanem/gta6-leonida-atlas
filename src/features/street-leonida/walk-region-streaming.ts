import type { WalkPoint } from './walk-engine';
import { gtadbToWorld } from './leonida-coordinates';
import { REVIEWED_GTADB_ANCHORS } from './leonida-evidence';
import { AMBROSIA_WORLD, REGION_WORLD } from './walk-geography';

export type WalkRenderRegion =
  'mount-kalaga' | 'port-gellhorn' | 'ambrosia' | 'grassrivers' | 'vice-city' | 'leonida-keys';

export type WalkRegionState = 'active' | 'near';

export interface WalkRegionDistanceState {
  region: WalkRenderRegion;
  state: WalkRegionState;
  distance: number;
}

/** Regional detail starts loading within 1.8 km of its evidence anchor. */
export const WALK_REGION_LOAD_RADIUS = 1_800;

/** Loaded detail remains for another 600 m to avoid churn at a cell boundary. */
export const WALK_REGION_UNLOAD_RADIUS = 2_400;

export const WALK_REGION_RENDER_RADIUS = WALK_REGION_LOAD_RADIUS;

export const WALK_REGION_RENDER_ANCHORS: Readonly<Record<WalkRenderRegion, WalkPoint>> = {
  'mount-kalaga': REGION_WORLD.mountKalaga,
  'port-gellhorn': REGION_WORLD.portGellhorn,
  ambrosia: AMBROSIA_WORLD.town,
  grassrivers: REGION_WORLD.grassrivers,
  'vice-city': REGION_WORLD.viceCity,
  'leonida-keys': REGION_WORLD.leonidaKeys,
};

/**
 * A region can contain several far-apart reviewed evidence points. Streaming uses
 * the closest point in each set while retaining the public primary anchor above
 * for arrival framing and backwards-compatible consumers.
 */
export const WALK_REGION_RENDER_ANCHOR_SETS: Readonly<
  Record<WalkRenderRegion, readonly WalkPoint[]>
> = {
  'mount-kalaga': [REGION_WORLD.mountKalaga],
  'port-gellhorn': [
    REGION_WORLD.portGellhorn,
    gtadbToWorld(REVIEWED_GTADB_ANCHORS.L304.gtadb),
    gtadbToWorld(REVIEWED_GTADB_ANCHORS.L307.gtadb),
    gtadbToWorld(REVIEWED_GTADB_ANCHORS.L629.gtadb),
  ],
  ambrosia: [
    AMBROSIA_WORLD.town,
    AMBROSIA_WORLD.xeroStation,
    AMBROSIA_WORLD.unknownUtilityL594,
    AMBROSIA_WORLD.radioTower,
    AMBROSIA_WORLD.sugarFields,
  ],
  grassrivers: [REGION_WORLD.grassrivers],
  'vice-city': [
    REGION_WORLD.viceCity,
    gtadbToWorld(REVIEWED_GTADB_ANCHORS.L32.gtadb),
    gtadbToWorld(REVIEWED_GTADB_ANCHORS.L187.gtadb),
  ],
  'leonida-keys': [
    REGION_WORLD.leonidaKeys,
    gtadbToWorld(REVIEWED_GTADB_ANCHORS.L271.gtadb),
    gtadbToWorld(REVIEWED_GTADB_ANCHORS.L272.gtadb),
    gtadbToWorld(REVIEWED_GTADB_ANCHORS.L325.gtadb),
  ],
};

function regionDistances(position: WalkPoint): WalkRegionDistanceState[] {
  return Object.entries(WALK_REGION_RENDER_ANCHOR_SETS)
    .map(([region, anchors]) => ({
      region: region as WalkRenderRegion,
      state: 'near' as const,
      distance: Math.min(
        ...anchors.map((anchor) => Math.hypot(position.x - anchor.x, position.z - anchor.z)),
      ),
    }))
    .sort((left, right) => left.distance - right.distance);
}

/**
 * Selects the closest region as the active continuity cell and adds nearby
 * detail cells. Previously loaded cells use the wider unload radius.
 */
export function getWalkRegionStates(
  position: WalkPoint,
  previouslyLoaded: readonly WalkRenderRegion[] = [],
): WalkRegionDistanceState[] {
  const distances = regionDistances(position);
  const closest = distances[0];
  if (!closest) return [];
  const retained = new Set(previouslyLoaded);

  return distances
    .filter(
      ({ region, distance }, index) =>
        index === 0 ||
        distance <= WALK_REGION_LOAD_RADIUS ||
        (retained.has(region) && distance <= WALK_REGION_UNLOAD_RADIUS),
    )
    .map((entry, index) => ({ ...entry, state: index === 0 ? 'active' : 'near' }));
}

export function getVisibleWalkRegions(
  position: WalkPoint,
  previouslyLoaded: readonly WalkRenderRegion[] = [],
): WalkRenderRegion[] {
  return getWalkRegionStates(position, previouslyLoaded).map(({ region }) => region);
}

export interface WalkRegionStreamAdapter<Resource> {
  create(region: WalkRenderRegion): Resource;
  setVisible(resource: Resource, visible: boolean, region: WalkRenderRegion): void;
  dispose(resource: Resource, region: WalkRenderRegion): void;
}

export interface WalkRegionStreamManager<Resource> {
  sync(position: WalkPoint): readonly WalkRegionDistanceState[];
  loadedRegions(): WalkRenderRegion[];
  get(region: WalkRenderRegion): Resource | undefined;
  dispose(): void;
}

export function createWalkRegionStreamManager<Resource>(
  adapter: WalkRegionStreamAdapter<Resource>,
): WalkRegionStreamManager<Resource> {
  const resources = new Map<WalkRenderRegion, Resource>();

  return {
    sync(position) {
      const states = getWalkRegionStates(position, [...resources.keys()]);
      const desired = new Set(states.map(({ region }) => region));

      for (const { region } of states) {
        let resource = resources.get(region);
        if (resource === undefined) {
          resource = adapter.create(region);
          resources.set(region, resource);
        }
        adapter.setVisible(resource, true, region);
      }

      for (const [region, resource] of [...resources]) {
        if (desired.has(region)) continue;
        adapter.setVisible(resource, false, region);
        adapter.dispose(resource, region);
        resources.delete(region);
      }

      return states;
    },
    loadedRegions() {
      return [...resources.keys()];
    },
    get(region) {
      return resources.get(region);
    },
    dispose() {
      for (const [region, resource] of resources) {
        adapter.setVisible(resource, false, region);
        adapter.dispose(resource, region);
      }
      resources.clear();
    },
  };
}
