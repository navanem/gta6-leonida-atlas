import { describe, expect, it } from 'vitest';

import {
  parseWalkMapTravelDetail,
  resolveMapTravelApproach,
  resolveMapTravelYaw,
} from '../../src/features/street-leonida/walk-world';

describe('Street Leonida map travel contract', () => {
  it('faces a collision-adjusted arrival back toward its documented GTADB destination', () => {
    expect(resolveMapTravelYaw({ x: 12, z: 16 }, { x: 0, z: 0 }, -0.6)).toBeCloseTo(
      Math.atan2(12, 16),
      8,
    );
  });

  it('preserves the current heading when no local arrival adjustment was needed', () => {
    expect(resolveMapTravelYaw({ x: 8, z: -3 }, { x: 8, z: -3 }, 1.25)).toBe(1.25);
  });

  it('uses a documented, local viewing standoff for modeled GTADB venue anchors', () => {
    const documentedTarget = { x: -4543.14, z: 10513.826 };
    const approach = resolveMapTravelApproach({
      ...documentedTarget,
      label: 'The Rusty Anchor, Key Lento',
      id: 'L325',
      source: 'gtadb',
    });

    expect(
      Math.hypot(approach.x - documentedTarget.x, approach.z - documentedTarget.z),
    ).toBeCloseTo(22, 8);
    expect(approach).not.toEqual(documentedTarget);

    const arenaTarget = { x: -605.934670326028, z: -859.8548661295554 };
    const arenaApproach = resolveMapTravelApproach({
      ...arenaTarget,
      label: 'Sahara Arena, Catalan Blvd, Downtown, Vice City',
      id: 'L187',
      source: 'gtadb',
    });
    expect(
      Math.hypot(arenaApproach.x - arenaTarget.x, arenaApproach.z - arenaTarget.z),
    ).toBeCloseTo(22, 8);
  });

  it('does not offset unmodeled GTADB records or region buttons', () => {
    const base = { x: 40, z: -80, label: 'Map point' };
    expect(resolveMapTravelApproach({ ...base, id: 'L999', source: 'gtadb' })).toEqual({
      x: 40,
      z: -80,
    });
    expect(resolveMapTravelApproach({ ...base, id: 'L325', source: 'region' })).toEqual({
      x: 40,
      z: -80,
    });
    expect(resolveMapTravelApproach({ ...base, id: 'L325', source: 'map' })).toEqual({
      x: 40,
      z: -80,
    });
  });

  it.each([
    { x: -32000, z: -24000 },
    { x: 8000, z: 16000 },
  ])('accepts an inclusive canonical boundary point: %j', ({ x, z }) => {
    expect(
      parseWalkMapTravelDetail({
        x,
        z,
        label: 'Canonical boundary',
        id: 'map-boundary',
        source: 'map',
      }),
    ).toMatchObject({ x, z, source: 'map' });
  });

  it.each(['gtadb', 'region', 'map'] as const)(
    'accepts full-precision finite %s destinations',
    (source) => {
      expect(
        parseWalkMapTravelDetail({
          x: -6033.021408764449,
          z: -6693.324710969762,
          label: ' Allied Crystal Sugar Mill ',
          id: ' L399 ',
          source,
        }),
      ).toEqual({
        x: -6033.021408764449,
        z: -6693.324710969762,
        label: 'Allied Crystal Sugar Mill',
        id: 'L399',
        source,
      });
    },
  );

  it.each([
    null,
    {},
    { x: Number.POSITIVE_INFINITY, z: 0, label: 'Bad', id: 'L1', source: 'gtadb' },
    { x: 0, z: 0, label: '', id: 'L1', source: 'gtadb' },
    { x: 0, z: 0, label: 'Bad', id: '', source: 'gtadb' },
    { x: 0, z: 0, label: 'Bad', id: 'L1', source: 'community' },
    { x: 0, z: 0, label: 'Bad', id: 'L1', source: 'canonical' },
    { x: 0, z: 0, label: 'Bad', id: 'L1', source: 'official' },
    { x: -32000.01, z: 0, label: 'Outside west', id: 'map-point', source: 'map' },
    { x: 8000.01, z: 0, label: 'Outside east', id: 'map-point', source: 'map' },
    { x: 0, z: -24000.01, label: 'Outside north', id: 'map-point', source: 'map' },
    { x: 0, z: 16000.01, label: 'Outside south', id: 'map-point', source: 'map' },
  ])('rejects an invalid or superseded destination: %j', (detail) => {
    expect(parseWalkMapTravelDetail(detail)).toBeNull();
  });
});
