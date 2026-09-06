import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createGtadbGroundTileStream,
  createGtadbBuildingFacadeTexture,
  createGtadbBuildingEmissiveTexture,
  classifyGtadbSurfacePixel,
  extractGtadbBuildingFootprints,
  extractGtadbRoadEdgeSegments,
  getGtadbBuildingDetailLevels,
  getGtadbFootprintWorldBounds,
  getGtadbTileAddressFromWorld,
  getGtadbTileWorldBounds,
  getGtadbTileWorldCenter,
  getGtadbTileWorldSize,
  getGtadbTileUrl,
  listGtadbGroundTiles,
  doesGtadbFootprintOverlapArrivalCorridor,
  doesGtadbFootprintOverlapProtectedArrival,
  restyleGtadbGroundPixels,
} from '../../src/features/street-leonida/walk-cartography';
import { gtadbToWorld } from '../../src/features/street-leonida/leonida-coordinates';

describe('Street Leonida GTADB ground cartography', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('selects the exact level-5 source tile for reviewed Vice City coordinates', () => {
    expect(getGtadbTileAddressFromWorld(gtadbToWorld({ x: -471.907, y: -297.61 }))).toEqual({
      z: 5,
      x: 62,
      y: 65,
    });
    expect(getGtadbTileAddressFromWorld(gtadbToWorld({ x: 1973.5, y: 737 }))).toEqual({
      z: 5,
      x: 71,
      y: 61,
    });
  });

  it('maps each 256 px source tile to the sole two-metres-per-unit world transform', () => {
    expect(getGtadbTileWorldSize()).toBe(512);
    expect(getGtadbTileWorldCenter({ z: 5, x: 62, y: 65 })).toEqual({ x: -768, z: 768 });
    expect(getGtadbTileWorldBounds({ z: 5, x: 62, y: 65 })).toEqual({
      minX: -1024,
      maxX: -512,
      minZ: 512,
      maxZ: 1024,
    });
  });

  it('serves a bounded local neighborhood from the pinned self-hosted tile set', () => {
    const tiles = listGtadbGroundTiles(gtadbToWorld({ x: -471.907, y: -297.61 }), 3);
    expect(tiles).toHaveLength(49);
    expect(tiles).toContainEqual({ z: 5, x: 62, y: 65 });
    expect(getGtadbTileUrl({ z: 5, x: 62, y: 65 })).toBe(
      '/assets/street-leonida/maps/gtadb-yanis-16-z5/5,65,62.jpg',
    );
  });

  it('streams one shared-geometry tile grid and disposes tiles that leave the neighborhood', () => {
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(() => new THREE.Texture());
    const stream = createGtadbGroundTileStream({ radius: 1, anisotropy: 2 });

    stream.sync(gtadbToWorld({ x: -471.907, y: -297.61 }));
    expect(stream.root.children).toHaveLength(9);
    expect((stream.root.children[0] as THREE.Mesh).position.y).toBeGreaterThan(0.03);
    expect(
      ((stream.root.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex(),
    ).toBe(0x8e928d);
    expect(stream.root.userData.source).toBe('GTADB yanis,16');
    expect(stream.root.userData.evidence).toBe('APPROXIMATE');

    const departedMaterial = (stream.root.children[0] as THREE.Mesh).material as THREE.Material;
    const dispose = vi.spyOn(departedMaterial, 'dispose');
    stream.sync(gtadbToWorld({ x: 1973.5, y: 737 }));
    expect(stream.root.children).toHaveLength(9);
    expect(dispose).toHaveBeenCalledOnce();

    stream.dispose();
    expect(stream.root.children).toHaveLength(0);
  });

  it('releases GPU instance buffers when the cartography stream is destroyed', () => {
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(() => new THREE.Texture());
    const stream = createGtadbGroundTileStream({ radius: 0, anisotropy: 1 });
    const instances = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      2,
    );
    const disposeInstances = vi.spyOn(instances, 'dispose');
    stream.root.add(instances);

    stream.dispose();

    expect(disposeInstances).toHaveBeenCalledOnce();
  });

  it('extracts building fill without mistaking roads, grass, or map labels for footprints', () => {
    const width = 12;
    const height = 10;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      pixels.set([216, 216, 216, 255], pixel * 4);
    }
    for (let y = 2; y < 8; y += 1) {
      for (let x = 3; x < 9; x += 1) pixels.set([176, 176, 176, 255], (y * width + x) * 4);
    }
    for (let x = 0; x < width; x += 1) pixels.set([80, 80, 80, 255], x * 4);
    pixels.set([192, 216, 128, 255], (9 * width + 11) * 4);

    expect(extractGtadbBuildingFootprints(pixels, width, height, 4)).toEqual([
      { x: 3, y: 2, width: 6, height: 6 },
    ]);
  });

  it('projects extracted footprints over their exact map pixels', () => {
    expect(
      getGtadbFootprintWorldBounds({ z: 5, x: 62, y: 65 }, { x: 0, y: 0, width: 10, height: 20 }),
    ).toEqual({ minX: -1024, maxX: -1004, minZ: 512, maxZ: 552 });
  });

  it('keeps authored arrival roads clear of approximate raster-extracted buildings', () => {
    const entry = gtadbToWorld({ x: -6240.705097588648, y: 4560.714992493181 });
    expect(
      doesGtadbFootprintOverlapArrivalCorridor({
        minX: entry.x - 20,
        maxX: entry.x + 20,
        minZ: entry.z - 20,
        maxZ: entry.z + 20,
      }),
    ).toBe(true);
    expect(
      doesGtadbFootprintOverlapArrivalCorridor({
        minX: entry.x + 180,
        maxX: entry.x + 200,
        minZ: entry.z - 20,
        maxZ: entry.z + 20,
      }),
    ).toBe(false);
  });

  it('keeps an arbitrary selected arrival clear beyond the authored regional anchors', () => {
    const footprint = { minX: 6_000, maxX: 6_012, minZ: 15_000, maxZ: 15_010 };
    expect(doesGtadbFootprintOverlapProtectedArrival(footprint, { x: 6_014.9, z: 15_005 })).toBe(
      true,
    );
    expect(doesGtadbFootprintOverlapProtectedArrival(footprint, { x: 6_015.1, z: 15_005 })).toBe(
      false,
    );
    expect(doesGtadbFootprintOverlapProtectedArrival(footprint, null)).toBe(false);
  });

  it('rebuilds loaded footprints and protects a selected arrival before async tiles resolve', () => {
    const width = 256;
    const height = 256;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      pixels.set([216, 216, 216, 255], pixel * 4);
    }
    for (let y = 124; y < 132; y += 1) {
      for (let x = 124; x < 132; x += 1) {
        pixels.set([176, 176, 176, 255], (y * width + x) * 4);
      }
    }
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => undefined,
          getImageData: () => ({ data: pixels, width, height }),
        }),
      }),
    });

    let completeLoad: (() => void) | undefined;
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
      const texture = new THREE.Texture<HTMLImageElement>();
      texture.image = {} as HTMLImageElement;
      completeLoad = () => onLoad?.(texture);
      return texture;
    });

    const destination = getGtadbTileWorldCenter({ z: 5, x: 10, y: 30 });
    const stream = createGtadbGroundTileStream({ radius: 0, anisotropy: 1 });
    stream.sync(destination);
    stream.setProtectedArrival(destination);
    completeLoad?.();
    expect(stream.collisions).toHaveLength(0);

    stream.setProtectedArrival(null);
    expect(stream.collisions).toHaveLength(1);

    stream.setProtectedArrival(destination);
    expect(stream.collisions).toHaveLength(0);
    stream.dispose();
  });

  it('rejects ambiguous map fills that are too large to be a reliable building footprint', () => {
    const width = 110;
    const height = 12;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      pixels.set([176, 176, 176, 255], pixel * 4);
    }
    expect(extractGtadbBuildingFootprints(pixels, width, height, 4)).toEqual([]);
  });

  it.each(['desktop', 'mobile'] as const)(
    'retains every nearby source building at radius one on %s',
    (detail) => {
      const pixels = new Uint8ClampedArray(256 * 256 * 4).fill(216);
      for (const startX of [40, 110, 180])
        for (let y = 120; y < 128; y++)
          for (let x = startX; x < startX + 8; x++) {
            pixels.set([176, 176, 176, 255], (y * 256 + x) * 4);
          }
      vi.stubGlobal('document', {
        createElement: () => ({
          getContext: () => ({
            drawImage() {},
            getImageData: () => ({ data: pixels, width: 256, height: 256 }),
          }),
        }),
      });
      const loads: Array<() => void> = [];
      vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
        const texture = new THREE.Texture<HTMLImageElement>();
        texture.image = {} as HTMLImageElement;
        loads.push(() => onLoad?.(texture));
        return texture;
      });
      const stream = createGtadbGroundTileStream({
        radius: 1,
        anisotropy: 1,
        detail,
      });
      stream.sync(getGtadbTileWorldCenter({ z: 5, x: 10, y: 30 }));
      loads.forEach((complete) => complete());
      expect(stream.collisions).toHaveLength(27);
      stream.dispose();
    },
  );

  it('uses a generated window-and-frame texture instead of blank procedural walls', () => {
    const texture = createGtadbBuildingFacadeTexture();
    const emissive = createGtadbBuildingEmissiveTexture();
    expect(texture).toBeInstanceOf(THREE.DataTexture);
    const data = texture.image.data as Uint8Array;
    const colors = Array.from({ length: data.length / 4 }, (_, index) =>
      data.slice(index * 4, index * 4 + 3),
    );
    expect(colors.some(([red = 0, _green = 0, blue = 0]) => blue > red + 18)).toBe(true);
    expect(colors.some(([red = 0, green = 0, blue = 0]) => red > green + 35 && green > blue)).toBe(
      true,
    );
    expect(new Set(emissive.image.data as Uint8Array)).toContain(0);
    expect(new Set(emissive.image.data as Uint8Array)).toContain(255);
    texture.dispose();
    emissive.dispose();
  });

  it('ignores a late tile generation after traveling away and back to the same address', () => {
    const pixels = new Uint8ClampedArray(256 * 256 * 4).fill(216);
    for (let y = 60; y < 68; y++)
      for (let x = 60; x < 68; x++) {
        pixels.set([176, 176, 176, 255], (y * 256 + x) * 4);
      }
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({
          drawImage() {},
          getImageData: () => ({ data: pixels, width: 256, height: 256 }),
        }),
      }),
    });
    const loads: Array<{ texture: THREE.Texture<HTMLImageElement>; complete: () => void }> = [];
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
      const texture = new THREE.Texture<HTMLImageElement>();
      texture.image = {} as HTMLImageElement;
      loads.push({ texture, complete: () => onLoad?.(texture) });
      return texture;
    });
    const stream = createGtadbGroundTileStream({ radius: 0, anisotropy: 1 });
    const original = getGtadbTileWorldCenter({ z: 5, x: 10, y: 30 });
    stream.sync(original);
    stream.sync(getGtadbTileWorldCenter({ z: 5, x: 20, y: 40 }));
    stream.sync(original);
    const active = stream.root.children[0] as THREE.Mesh;
    const activeMap = (active.material as THREE.MeshStandardMaterial).map;
    loads[0]!.complete();
    expect((active.material as THREE.MeshStandardMaterial).map).toBe(activeMap);
    expect(activeMap).toBe(loads[2]!.texture);
    expect(stream.collisions).toHaveLength(0);
    stream.dispose();
    loads[2]!.complete();
    expect(stream.root.children).toHaveLength(0);
  });

  it('adds repeated architectural floor lines only to buildings tall enough to carry them', () => {
    expect(getGtadbBuildingDetailLevels(12)).toEqual([]);
    expect(getGtadbBuildingDetailLevels(42)).toEqual([8, 12.5, 17, 21.5, 26, 30.5, 35, 39.5]);
  });

  it('converts stark black-and-white map ink into a restrained ground-material palette', () => {
    const source = new Uint8ClampedArray([
      0, 0, 0, 255, 216, 216, 216, 255, 176, 176, 176, 255, 192, 216, 128, 255,
    ]);
    expect([...restyleGtadbGroundPixels(source, 4)]).toEqual([
      35, 38, 42, 255, 105, 105, 98, 255, 120, 119, 115, 255, 55, 82, 48, 255,
    ]);
  });

  it('classifies the pinned GTADB palette into renderable ground surfaces', () => {
    expect(classifyGtadbSurfacePixel(83, 83, 83)).toBe('road');
    expect(classifyGtadbSurfacePixel(114, 114, 114)).toBe('pavement');
    expect(classifyGtadbSurfacePixel(176, 176, 176)).toBe('building');
    expect(classifyGtadbSurfacePixel(217, 217, 217)).toBe('ground');
    expect(classifyGtadbSurfacePixel(194, 216, 131)).toBe('vegetation');
    expect(classifyGtadbSurfacePixel(49, 150, 202)).toBe('water');
    expect(classifyGtadbSurfacePixel(255, 255, 255)).toBe('marking');
  });

  it('extracts exact road boundaries for raised curbs without treating nearby land as road', () => {
    const width = 4;
    const height = 4;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const road = x === 1 || x === 2;
        pixels.set(road ? [83, 83, 83, 255] : [194, 216, 131, 255], (y * width + x) * 4);
      }
    }

    const edges = extractGtadbRoadEdgeSegments(pixels, width, height, 4, 1);
    expect(edges).toHaveLength(12);
    expect(edges).toContainEqual({ x: 1, y: 0.5, length: 1, rotation: Math.PI / 2 });
    expect(edges).toContainEqual({ x: 3, y: 0.5, length: 1, rotation: Math.PI / 2 });
    expect(edges).toContainEqual({ x: 1.5, y: 0, length: 1, rotation: 0 });
    expect(edges).toContainEqual({ x: 1.5, y: 4, length: 1, rotation: 0 });
  });
});
