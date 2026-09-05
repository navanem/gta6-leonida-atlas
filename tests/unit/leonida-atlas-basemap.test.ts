import { describe, expect, it } from 'vitest';
import * as atlas from '../../scripts/lib/leonida-atlas-basemap.mjs';

describe('atlas source registration', () => {
  it('places tile pixels in canonical world coordinates without mirroring north', () => {
    expect(atlas.tilePixelToWorld?.(0, 21, 0, 0)).toEqual({ x: -32768, y: -22016 });
    expect(atlas.tilePixelToWorld?.(64, 64, 128, 128)).toEqual({ x: 256, y: 256 });
    expect(atlas.tilePixelToWorld?.(21, 50, 8, 0)).toEqual({ x: -22000, y: -7168 });
  });
  it('excludes source legend pixels and uncovered rows from geographic evidence', () => {
    expect(atlas.isGeographicPixel?.(21, 50, 7, 128)).toBe(false);
    expect(atlas.isGeographicPixel?.(21, 50, 8, 128)).toBe(true);
    expect(atlas.isGeographicPixel?.(50, 20, 128, 128)).toBe(false);
  });
});

describe('atlas source interpretation', () => {
  it('separates source ocean, terrain, sand, roads and building fills', () => {
    for (const [rgb, expected] of [
      [[47, 104, 160], 'water'],
      [[49, 146, 190], 'water'],
      [[195, 210, 132], 'vegetation'],
      [[235, 222, 145], 'sand'],
      [[85, 85, 85], 'road'],
      [[182, 182, 182], 'building'],
      [[219, 219, 219], 'ground'],
      [[244, 49, 37], 'annotation'],
    ] as const)
      expect(atlas.classifyPixel?.(...rgb)).toBe(expected);
  });
  it('suppresses colored annotation using the surrounding source terrain', () => {
    const input = Uint8Array.from([
      195, 210, 132, 195, 210, 132, 195, 210, 132, 195, 210, 132, 244, 49, 37, 195, 210, 132, 195,
      210, 132, 195, 210, 132, 195, 210, 132,
    ]);
    const output = atlas.stylizeRaster?.(input, 3, 3);
    expect(output).toBeInstanceOf(Uint8Array);
    expect(Array.from(output?.slice(12, 15) ?? [])).toEqual(Array.from(output?.slice(0, 3) ?? []));
  });
  it('leaves unsupported isolated annotation unknown instead of inventing land', () => {
    const output = atlas.stylizeRaster?.(Uint8Array.of(244, 49, 37), 1, 1);
    expect(Array.from(output ?? [])).toEqual([23, 59, 73]);
  });
  it('removes source water texture seams before applying a coast-derived halo', () => {
    const input = Uint8Array.of(47, 104, 160, 49, 146, 190);
    const output = atlas.stylizeRaster(input, 2, 1);
    expect(Array.from(output.slice(0, 3))).toEqual(Array.from(output.slice(3, 6)));
  });
  it('tints only water according to nearby source land without coloring unknown margins', () => {
    const rgb = Uint8Array.of(59, 104, 125, 59, 104, 125, 225, 220, 201, 23, 59, 73);
    atlas.applyCoastHalo?.(rgb, Uint8Array.of(0, 128, 255, 255));
    expect(Array.from(rgb.slice(0, 3))).toEqual([59, 104, 125]);
    expect(rgb[3]).toBeGreaterThan(59);
    expect(rgb[4]).toBeGreaterThan(104);
    expect(Array.from(rgb.slice(6))).toEqual([225, 220, 201, 23, 59, 73]);
  });
});
