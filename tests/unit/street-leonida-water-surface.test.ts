import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  installWalkWaterSurface,
  sampleWalkWaterSurface,
} from '../../src/features/street-leonida/walk-water-surface';

describe('spatial water surface', () => {
  it('moves through world space while keeping small waves and consistent surface normals', () => {
    const epsilon = 0.0001;
    const heights = new Set<number>();
    for (const time of [0, 1.5, 11.7]) {
      for (const [x, z] of [
        [0, 0],
        [12, -18],
        [-5933, -6773],
        [18000, 14000],
      ]) {
        const surface = sampleWalkWaterSurface(x!, z!, time);
        heights.add(Math.round(surface.height * 10000));
        expect(Math.abs(surface.height)).toBeLessThan(0.16);
        expect(new THREE.Vector3(...surface.normal).length()).toBeCloseTo(1, 6);
        expect(surface.normal[1]).toBeGreaterThan(0.97);
        const dx =
          (sampleWalkWaterSurface(x! + epsilon, z!, time).height -
            sampleWalkWaterSurface(x! - epsilon, z!, time).height) /
          (2 * epsilon);
        const dz =
          (sampleWalkWaterSurface(x!, z! + epsilon, time).height -
            sampleWalkWaterSurface(x!, z! - epsilon, time).height) /
          (2 * epsilon);
        const expected = new THREE.Vector3(-dx, 1, -dz).normalize();
        expect(new THREE.Vector3(...surface.normal).distanceTo(expected)).toBeLessThan(0.00001);
      }
    }
    expect(heights.size).toBeGreaterThan(9);
  });

  it('keeps the existing material hook and restores it on disposal', () => {
    const material = new THREE.MeshPhysicalMaterial({ color: 0x145b68 });
    const original = vi.fn();
    material.onBeforeCompile = original;
    const key = material.customProgramCacheKey;
    const controller = installWalkWaterSurface(material);
    expect(material.onBeforeCompile).not.toBe(original);
    controller.update(12);
    controller.dispose();
    controller.dispose();
    expect(material.onBeforeCompile).toBe(original);
    expect(material.customProgramCacheKey).toBe(key);
    expect(material.color.getHex()).toBe(0x145b68);
  });
});
