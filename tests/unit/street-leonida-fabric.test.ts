import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  extractGtadbBuildingFootprints,
  getGtadbFootprintWorldBounds,
} from '../../src/features/street-leonida/walk-cartography';
import {
  createBuildingFabricKit,
  describeRegionalBuilding,
} from '../../src/features/street-leonida/walk-building-fabric';
import {
  simplifyRoadEdges,
  sampleRoadFixtures,
} from '../../src/features/street-leonida/walk-road-geometry';

function raster(width: number, height: number, fill: (x: number, y: number) => boolean) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      pixels.set(fill(x, y) ? [176, 176, 176, 255] : [216, 216, 216, 255], (y * width + x) * 4);
    }
  return pixels;
}

describe('Source-led regional building fabric', () => {
  it('retains the diagonal of a rotated source building and encloses its rendered corners', () => {
    const pixels = raster(64, 64, (x, y) => {
      const u = (x + 0.5 - 32) * Math.cos(Math.PI / 6) + (y + 0.5 - 32) * 0.5;
      const v = -(x + 0.5 - 32) * 0.5 + (y + 0.5 - 32) * Math.cos(Math.PI / 6);
      return Math.abs(u) < 17 && Math.abs(v) < 6;
    });
    const [footprint] = extractGtadbBuildingFootprints(pixels, 64, 64);
    expect(footprint?.oriented?.rotation).toBeCloseTo(-Math.PI / 6, 1);
    expect(footprint?.oriented?.width).toBeGreaterThan(30);
    expect(footprint?.oriented?.depth).toBeLessThan(15);
    const bounds = getGtadbFootprintWorldBounds({ z: 5, x: 64, y: 64 }, footprint!);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        if (pixels[(y * 64 + x) * 4] !== 176) continue;
        expect((x + 0.5) * 2).toBeGreaterThanOrEqual(bounds.minX);
        expect((x + 0.5) * 2).toBeLessThanOrEqual(bounds.maxX);
        expect((y + 0.5) * 2).toBeGreaterThanOrEqual(bounds.minZ);
        expect((y + 0.5) * 2).toBeLessThanOrEqual(bounds.maxZ);
      }
  });

  it('retains supported parts of a large L-shaped industrial footprint without filling its courtyard', () => {
    const pixels = raster(
      160,
      160,
      (x, y) => x >= 8 && x < 146 && y >= 8 && y < 146 && (x < 32 || y < 32),
    );
    const footprints = extractGtadbBuildingFootprints(pixels, 160, 160);
    expect(footprints.length).toBeGreaterThan(1);
    expect(footprints.length).toBeLessThanOrEqual(16);
    expect(
      footprints.some((p) => 90 >= p.x && 90 < p.x + p.width && 90 >= p.y && 90 < p.y + p.height),
    ).toBe(false);
  });

  it('uses human-scale floors and distinct low-rise and industrial roof families', () => {
    const keys = describeRegionalBuilding('Leonida Keys', 16, 22, 0.72);
    const industrial = describeRegionalBuilding('Ambrosia', 90, 52, 0.4);
    const city = describeRegionalBuilding('Vice City', 24, 28, 0.96);
    expect(keys.floors).toBeLessThanOrEqual(3);
    expect(keys.height / keys.floors).toBeGreaterThanOrEqual(3);
    expect(keys.roof).toBe('hip');
    expect(industrial.roof).toBe('gable');
    expect(city.height).toBeGreaterThan(60);
    expect(city.height / city.floors).toBeLessThan(4.2);
  });

  it('does not turn tiny raster fragments into needle skyscrapers', () => {
    expect(describeRegionalBuilding('Vice City', 8, 14, 0.97).height).toBeLessThan(25);
    expect(describeRegionalBuilding('Vice City', 24, 28, 0.97).height).toBeGreaterThan(60);
  });

  it('keeps complete base occupancy while distant facade detail is hidden', () => {
    const kit = createBuildingFabricKit();
    const fabric = kit.create(
      [
        {
          x: 20,
          z: 10,
          width: 18,
          depth: 24,
          rotation: -0.4,
          seed: 0.7,
          region: 'Leonida Keys',
        },
        {
          x: 80,
          z: 10,
          width: 24,
          depth: 28,
          rotation: 0,
          seed: 0.97,
          region: 'Vice City',
        },
      ],
      'test-fabric',
      'desktop',
    );
    expect(fabric.buildingCount).toBe(2);
    const base = new THREE.Box3().setFromObject(fabric.root);
    fabric.setDetail(true);
    expect(fabric.detailCount).toBeGreaterThan(80);
    expect(fabric.root.getObjectByName('test-fabric-detail')?.visible).toBe(true);
    fabric.setDetail(false);
    expect(fabric.root.getObjectByName('test-fabric-detail')?.visible).toBe(false);
    expect(base.max.y).toBeGreaterThan(60);
    expect(fabric.buildingCount).toBe(2);
    fabric.dispose();
    kit.dispose();
  });

  it('joins a stepped raster edge into a source-tolerant diagonal with metric fixture spacing', () => {
    const steps = Array.from({ length: 20 }, (_, i) => [
      { x: i + 0.5, y: i, length: 1, rotation: 0 },
      { x: i + 1, y: i + 0.5, length: 1, rotation: Math.PI / 2 },
    ]).flat();
    const smooth = simplifyRoadEdges(steps, 0.8);
    expect(smooth.length).toBeLessThan(5);
    expect(Math.abs(smooth[0]!.rotation)).toBeCloseTo(Math.PI / 4, 1);
    const fixtures = sampleRoadFixtures(smooth, 12, 2);
    expect(fixtures.length).toBeGreaterThan(3);
    for (let i = 1; i < fixtures.length; i++) {
      expect(
        Math.hypot(fixtures[i]!.x - fixtures[i - 1]!.x, fixtures[i]!.y - fixtures[i - 1]!.y) * 2,
      ).toBeCloseTo(12, 1);
    }
  });
});
