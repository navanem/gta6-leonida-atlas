import { describe, expect, it } from 'vitest';

import {
  circleIntersectsRectangle,
  clampPlayerToBounds,
  collidesWithBuildings,
  findNearestInteractiveHotspot,
  getYawRelativeMovementDelta,
  normalizeMovementAxes,
} from '@features/street-leonida/walk-engine';

describe('Street Leonida walk engine', () => {
  describe('normalizeMovementAxes', () => {
    it('prevents diagonal WASD input from moving faster than a single direction', () => {
      const axes = normalizeMovementAxes({ right: 1, forward: 1 });

      expect(axes.right).toBeCloseTo(Math.SQRT1_2, 10);
      expect(axes.forward).toBeCloseTo(Math.SQRT1_2, 10);
      expect(Math.hypot(axes.right, axes.forward)).toBeCloseTo(1, 10);
    });

    it('preserves the direction of an over-range touch axis while limiting its magnitude', () => {
      const axes = normalizeMovementAxes({ right: 2, forward: -0.5 });

      expect(axes.right).toBeCloseTo(0.9701425, 7);
      expect(axes.forward).toBeCloseTo(-0.2425356, 7);
      expect(Math.hypot(axes.right, axes.forward)).toBeCloseTo(1, 10);
    });

    it('treats non-finite input as a released axis', () => {
      expect(
        normalizeMovementAxes({ right: Number.NaN, forward: Number.POSITIVE_INFINITY }),
      ).toEqual({ right: 0, forward: 0 });
    });
  });

  describe('getYawRelativeMovementDelta', () => {
    it('moves forward toward negative Z at zero yaw', () => {
      expect(getYawRelativeMovementDelta({ right: 0, forward: 1 }, 0, 5)).toEqual({ x: 0, z: -5 });
    });

    it('rotates forward movement with the player yaw', () => {
      const delta = getYawRelativeMovementDelta({ right: 0, forward: 1 }, Math.PI / 2, 5);

      expect(delta.x).toBeCloseTo(-5, 10);
      expect(delta.z).toBeCloseTo(0, 10);
    });

    it('normalizes combined movement so its total distance stays constant', () => {
      const delta = getYawRelativeMovementDelta({ right: 1, forward: 1 }, 0, 5);

      expect(delta.x).toBeCloseTo(3.5355339, 7);
      expect(delta.z).toBeCloseTo(-3.5355339, 7);
      expect(Math.hypot(delta.x, delta.z)).toBeCloseTo(5, 10);
    });
  });

  describe('clampPlayerToBounds', () => {
    it('keeps the full circular player collider inside the world bounds', () => {
      expect(
        clampPlayerToBounds({ x: 20, z: -20 }, { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, 2),
      ).toEqual({ x: 8, z: -8 });
    });

    it('centers the player when its diameter is wider than the available bounds', () => {
      expect(
        clampPlayerToBounds({ x: 7, z: -7 }, { minX: -5, maxX: 5, minZ: -3, maxZ: 3 }, 8),
      ).toEqual({ x: 0, z: 0 });
    });
  });

  describe('building collisions', () => {
    const building = { minX: 0, maxX: 4, minZ: 0, maxZ: 4 };

    it('detects a player touching a building wall or corner', () => {
      expect(circleIntersectsRectangle({ x: -1, z: 2 }, 1, building)).toBe(true);
      expect(circleIntersectsRectangle({ x: -0.6, z: -0.8 }, 1, building)).toBe(true);
    });

    it('does not collide when the circular player clears the building', () => {
      expect(circleIntersectsRectangle({ x: -1.01, z: 2 }, 1, building)).toBe(false);
    });

    it('checks a proposed player position against every building', () => {
      const buildings = [building, { minX: 10, maxX: 14, minZ: 10, maxZ: 14 }];

      expect(collidesWithBuildings({ x: 9.5, z: 12 }, 0.5, buildings)).toBe(true);
      expect(collidesWithBuildings({ x: 7, z: 7 }, 0.5, buildings)).toBe(false);
    });
  });

  describe('findNearestInteractiveHotspot', () => {
    it('returns the nearest enabled hotspot within interaction range', () => {
      const hotspots = [
        { id: 'disabled-nearby', position: { x: 0.25, z: 0 }, interactive: false },
        { id: 'far', position: { x: 3, z: 0 } },
        { id: 'nearest', position: { x: 1, z: 0 }, label: 'Open scene' },
      ];

      expect(findNearestInteractiveHotspot({ x: 0, z: 0 }, hotspots, 4)).toEqual({
        hotspot: hotspots[2],
        distance: 1,
      });
    });

    it('returns null when every hotspot is outside the global or per-hotspot range', () => {
      const hotspots = [
        { id: 'globally-too-far', position: { x: 5, z: 0 } },
        { id: 'locally-too-far', position: { x: 2, z: 0 }, interactionRadius: 1 },
      ];

      expect(findNearestInteractiveHotspot({ x: 0, z: 0 }, hotspots, 3)).toBeNull();
    });

    it('keeps source order when two eligible hotspots are equally near', () => {
      const hotspots = [
        { id: 'first', position: { x: -1, z: 0 } },
        { id: 'second', position: { x: 1, z: 0 } },
      ];

      expect(findNearestInteractiveHotspot({ x: 0, z: 0 }, hotspots, 2)?.hotspot.id).toBe('first');
    });
  });
});
