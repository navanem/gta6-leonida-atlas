import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ALL_LOCATION_ANCHORS,
  AMBROSIA_WORLD,
  GRASSRIVERS_WORLD,
  LEONIDA_KEYS_WORLD,
  MOUNT_KALAGA_WORLD,
  PLACE_ENTRY_VIEWS,
  PORT_GELLHORN_WORLD,
  VICE_CITY_WORLD,
} from '../../src/features/street-leonida/walk-geography';
import { addPhotorealWalkVegetation } from '../../src/features/street-leonida/walk-photo-vegetation';

interface Point {
  x: number;
  z: number;
}

const renderer = {
  capabilities: { getMaxAnisotropy: () => 16 },
} as THREE.WebGLRenderer;

function pointsFor(root: THREE.Group, species: string): Point[] {
  const instances = root.getObjectByName(
    `street-leonida/photo-vegetation/${species}`,
  ) as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const points: Point[] = [];

  for (let index = 0; index < instances.count; index += 1) {
    instances.getMatrixAt(index, matrix);
    position.setFromMatrixPosition(matrix);
    points.push({ x: position.x, z: position.z });
  }

  return points;
}

function countInside(
  points: readonly Point[],
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
): number {
  return points.filter(
    ({ x, z }) => x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ,
  ).length;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Street Leonida photoreal vegetation alignment', () => {
  it('loads only species used by the streamed region', () => {
    const load = vi
      .spyOn(THREE.TextureLoader.prototype, 'load')
      .mockReturnValue(new THREE.Texture());

    const vice = addPhotorealWalkVegetation(new THREE.Scene(), renderer, false, {
      regions: ['vice-city'],
    });

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('/assets/street-leonida/vegetation/royal-palm.webp');
    expect(vice.children).toHaveLength(1);
    expect(vice.getObjectByName('street-leonida/photo-vegetation/royal-palm')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(vice.getObjectByName('street-leonida/photo-vegetation/swamp-cypress')).toBeUndefined();
    expect(vice.getObjectByName('street-leonida/photo-vegetation/southern-pine')).toBeUndefined();
    expect(vice.userData.drawCallBudget).toBe(1);
  });

  it('populates the metre-scale Vice coast, Keys, Port, Ambrosia, Grassrivers and Mount biomes', () => {
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(new THREE.Texture());
    const root = addPhotorealWalkVegetation(new THREE.Scene(), renderer, false);
    const palms = pointsFor(root, 'royal-palm');
    const cypresses = pointsFor(root, 'swamp-cypress');
    const pines = pointsFor(root, 'southern-pine');

    expect(
      countInside(palms, {
        minX: VICE_CITY_WORLD.viceBeach.x,
        maxX: VICE_CITY_WORLD.viceBeach.x + 120,
        minZ: VICE_CITY_WORLD.viceBeach.z - 60,
        maxZ: VICE_CITY_WORLD.southBeach.z + 40,
      }),
    ).toBeGreaterThanOrEqual(28);
    expect(
      countInside(palms, {
        minX: LEONIDA_KEYS_WORLD.westernKeys.x,
        maxX: LEONIDA_KEYS_WORLD.watsonBay.x + 400,
        minZ: LEONIDA_KEYS_WORLD.watsonBay.z - 300,
        maxZ: LEONIDA_KEYS_WORLD.westernKeys.z + 400,
      }),
    ).toBeGreaterThanOrEqual(48);
    expect(
      countInside(palms, {
        minX: PORT_GELLHORN_WORLD.coastalStrip.x - 200,
        maxX: PORT_GELLHORN_WORLD.centre.x + 240,
        minZ: PORT_GELLHORN_WORLD.docks.z,
        maxZ: PORT_GELLHORN_WORLD.coastalStrip.z + 140,
      }),
    ).toBeGreaterThanOrEqual(8);
    expect(
      countInside(palms, {
        minX: AMBROSIA_WORLD.town.x,
        maxX: AMBROSIA_WORLD.town.x + 260,
        minZ: AMBROSIA_WORLD.town.z - 240,
        maxZ: AMBROSIA_WORLD.town.z,
      }),
    ).toBeGreaterThanOrEqual(6);

    const cypressMean = cypresses.reduce(
      (mean, point) => ({
        x: mean.x + point.x / cypresses.length,
        z: mean.z + point.z / cypresses.length,
      }),
      { x: 0, z: 0 },
    );
    expect(cypressMean.x).toBeGreaterThan(GRASSRIVERS_WORLD.westernWetlands.x - 30);
    expect(cypressMean.x).toBeLessThan(GRASSRIVERS_WORLD.easternWetlands.x + 10);
    expect(cypressMean.z).toBeGreaterThan(GRASSRIVERS_WORLD.north.z - 10);
    expect(cypressMean.z).toBeLessThan(GRASSRIVERS_WORLD.southernMangroves.z + 10);

    expect(Math.max(...pines.map(({ x }) => x))).toBeLessThanOrEqual(
      MOUNT_KALAGA_WORLD.easternForest.x + 30,
    );
    expect(Math.min(...pines.map(({ z }) => z))).toBeGreaterThanOrEqual(
      Math.min(MOUNT_KALAGA_WORLD.westernWilderness.z - 330, MOUNT_KALAGA_WORLD.highlands.z - 270),
    );
    expect(Math.max(...pines.map(({ z }) => z))).toBeLessThanOrEqual(
      MOUNT_KALAGA_WORLD.southernEntrance.z + 10,
    );
  });

  it('keeps every generated tree outside arrivals and named POIs without inventing road corridors', () => {
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(new THREE.Texture());
    const root = addPhotorealWalkVegetation(new THREE.Scene(), renderer, false);
    const points = [
      ...pointsFor(root, 'royal-palm'),
      ...pointsFor(root, 'swamp-cypress'),
      ...pointsFor(root, 'southern-pine'),
    ];
    const arrivals = Object.values(PLACE_ENTRY_VIEWS).map(({ position }) => position);
    for (const point of points) {
      expect(
        Math.min(
          ...arrivals.map((arrival) => Math.hypot(point.x - arrival.x, point.z - arrival.z)),
        ),
      ).toBeGreaterThanOrEqual(14);
      expect(
        Math.min(
          ...ALL_LOCATION_ANCHORS.map(({ world }) =>
            Math.hypot(point.x - world.x, point.z - world.z),
          ),
        ),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
