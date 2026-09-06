import { describe, expect, it } from 'vitest';
import {
  classifyRoadBoundary,
  findRoadFacingSide,
} from '../../src/features/street-leonida/walk-road-geometry';

describe('Source-supported road context', () => {
  const edge = { x: 0, y: 0, length: 50, rotation: 0 };
  it('distinguishes paved curbs from natural verges using the sampled side outside the road', () => {
    expect(classifyRoadBoundary(edge, (_x, y) => (y < 0 ? 'road' : 'pavement'))).toMatchObject({
      kind: 'urban',
      outwardX: 0,
      outwardY: 1,
    });
    expect(classifyRoadBoundary(edge, (_x, y) => (y < 0 ? 'road' : 'vegetation'))).toMatchObject({
      kind: 'rural',
      outwardY: 1,
    });
    expect(classifyRoadBoundary(edge, (_x, y) => (y > 0 ? 'road' : 'water'))).toMatchObject({
      kind: 'water',
      outwardY: -1,
    });
  });
  it('rejects tile-border closures and ambiguous edges instead of adding invented curbs', () => {
    expect(classifyRoadBoundary(edge, (_x, y) => (y < 0 ? 'road' : 'unknown')).kind).toBe(
      'unknown',
    );
    expect(classifyRoadBoundary(edge, () => 'road').kind).toBe('unknown');
  });
  it('faces entrances toward the closest source road after rotating the footprint', () => {
    const road = [{ x: 0, y: 20, length: 100, rotation: 0 }];
    expect(findRoadFacingSide({ x: 0, y: 0 }, 0, road)).toBe(0);
    expect(findRoadFacingSide({ x: 0, y: 0 }, Math.PI / 2, road)).toBe(3);
    expect(findRoadFacingSide({ x: 0, y: 0 }, 0, [{ ...road[0]!, y: -20 }])).toBe(1);
  });
});
