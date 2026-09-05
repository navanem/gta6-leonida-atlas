import { describe, expect, it } from 'vitest';

import {
  CANONICAL_BOUNDS,
  MAP_BOUNDS,
  WORLD_BOUNDS,
  WORLD_METRES_PER_GTADB_UNIT,
  canonicalToWorld,
  gtadbDistance,
  gtadbDistanceToWorldMetres,
  gtadbToCanonical,
  gtadbToWorld,
  mapToWorld,
  worldDistance,
  worldToGtadb,
  worldToMap,
} from '../../src/features/street-leonida/leonida-coordinates';

describe('Street Leonida coordinate contract', () => {
  it('keeps the GTADB origin as the world origin', () => {
    expect(gtadbToCanonical({ x: 0, y: 0 })).toEqual({ east: 0, north: 0 });
    expect(canonicalToWorld({ east: 0, north: 0 })).toEqual({ x: 0, z: -0 });
    expect(gtadbToWorld({ x: 0, y: 0 })).toEqual({ x: 0, z: -0 });
  });

  it('maps east to positive world X and north to negative world Z', () => {
    expect(gtadbToWorld({ x: 1, y: 0 })).toEqual({ x: 2, z: -0 });
    expect(gtadbToWorld({ x: 0, y: 1 })).toEqual({ x: 0, z: -2 });
  });

  it('round-trips arbitrary coordinates through the exact inverse', () => {
    const gtadb = { x: -3421.9823036223092, y: 6368.146163637521 };
    expect(worldToGtadb(gtadbToWorld(gtadb))).toEqual(gtadb);
  });

  it.each([
    ['L32', { x: 1973.5, y: 737 }, { x: 3947, z: -1474 }],
    [
      'L399',
      { x: -3016.5107043822245, y: 3346.662355484881 },
      { x: -6033.021408764449, z: -6693.324710969762 },
    ],
    [
      'L530',
      { x: -3421.9823036223092, y: 6368.146163637521 },
      { x: -6843.9646072446185, z: -12736.292327275041 },
    ],
    [
      'L1458',
      { x: -3498.9734553066246, y: -3552.623227653312 },
      { x: -6997.946910613249, z: 7105.246455306624 },
    ],
  ])('places %s without recentering, clamping, or regional scaling', (_id, gtadb, world) => {
    expect(gtadbToWorld(gtadb)).toEqual(world);
  });

  it('uses one isotropic two-metre scale for pairwise distances', () => {
    const first = { x: 0, y: 0 };
    const second = { x: 3, y: 4 };
    expect(WORLD_METRES_PER_GTADB_UNIT).toBe(2);
    expect(gtadbDistance(first, second)).toBe(5);
    expect(gtadbDistanceToWorldMetres(first, second)).toBe(10);
    expect(worldDistance(gtadbToWorld(first), gtadbToWorld(second))).toBe(10);
  });

  it('publishes the stable full-state canonical, world, and map bounds', () => {
    expect(CANONICAL_BOUNDS).toEqual({ west: -16000, east: 4000, south: -8000, north: 12000 });
    expect(WORLD_BOUNDS).toEqual({
      minX: -32000,
      maxX: 8000,
      minZ: -24000,
      maxZ: 16000,
      width: 40000,
      height: 40000,
    });
    expect(MAP_BOUNDS).toEqual({
      minX: -32000,
      maxX: 8000,
      minY: -24000,
      maxY: 16000,
      width: 40000,
      height: 40000,
    });
  });

  it('uses identical world coordinates for map projection and travel', () => {
    const world = { x: -6033.021408764449, z: -6693.324710969762 };
    expect(worldToMap(world)).toEqual({ x: -6033.021408764449, y: -6693.324710969762 });
    expect(mapToWorld(worldToMap(world))).toEqual(world);
  });
});
