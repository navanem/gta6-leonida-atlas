import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createWalkSurfaceLibrary } from "../../src/features/street-leonida/walk-surface-assets";
import { createCanyonRelief } from "../../src/features/street-leonida/walk-canyon-relief";

const picture = { width: 1024, height: 1024 } as HTMLImageElement;

describe("locally served photographic surfaces", () => {
  it.each([false, true])('keeps authored trail parcels out of the canyon surface (coarse=%s)', (coarse) => {
    const parcels = [
      { x: -30, z: 33, width: 27, depth: 24 },
      { x: 26, z: -101, width: 18, depth: 20 },
    ];
    const canyon = createCanyonRelief(coarse, undefined, parcels);
    const terrain = canyon.children.find((child) => child instanceof THREE.Mesh)!;
    terrain.updateMatrixWorld(true);
    for (const parcel of parcels) for (const sx of [-0.48, 0, 0.48]) for (const sz of [-0.48, 0, 0.48]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(parcel.x + sx * parcel.width, 100, parcel.z + sz * parcel.depth), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(terrain, false)[0];
      expect(hit?.point.y ?? 0).toBeLessThanOrEqual(0.06);
    }
  });

  it('provides continuous metric UVs on the visible canyon slopes for photographed rock', () => {
    const canyon = createCanyonRelief(false);
    const mesh = canyon.children.find((child) => child instanceof THREE.Mesh) as THREE.Mesh;
    const positions = mesh.geometry.getAttribute('position');
    const uv = mesh.geometry.getAttribute('uv');
    expect(uv).toBeDefined();
    expect(uv.count).toBe(positions.count);
    for (let index = 0; index < uv.count; index += 1) {
      expect(Number.isFinite(uv.getX(index))).toBe(true);
      expect(uv.getY(index)).toBeCloseTo(positions.getZ(index) / 6, 5);
    }
  });

  it("keeps the fallback until the whole PBR set loads, then applies linear data and independent UVs", async () => {
    const requests: Array<{ resolve: (image: HTMLImageElement) => void }> = [];
    const library = createWalkSurfaceLibrary({
      loadImage: () => new Promise((resolve) => requests.push({ resolve })),
      anisotropy: 8,
    });
    const fallback = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: fallback });
    library.apply(material, "concrete", { repeat: [3, 7] });
    expect(material.map).toBe(fallback);
    requests[0]!.resolve(picture);
    await Promise.resolve();
    expect(material.map).toBe(fallback);
    requests.slice(1).forEach((request) => request.resolve(picture));
    await library.whenReady();
    expect(material.map?.image).toBe(picture);
    expect(material.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(material.normalMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(material.roughnessMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(material.map?.repeat.toArray()).toEqual([3, 7]);
    expect(material.normalMap?.repeat.toArray()).toEqual([3, 7]);
    expect(material.normalMap?.anisotropy).toBe(8);
    library.dispose();
  });

  it("shares source images while preserving independently repeated material views", async () => {
    const loadImage = vi.fn(async () => picture);
    const library = createWalkSurfaceLibrary({ loadImage });
    const first = new THREE.MeshStandardMaterial();
    const second = new THREE.MeshStandardMaterial();
    library.apply(first, "wood", { repeat: [2, 3] });
    library.apply(second, "wood", { repeat: [9, 1] });
    await library.whenReady();
    expect(loadImage).toHaveBeenCalledTimes(3);
    expect(first.map).not.toBe(second.map);
    expect(first.map?.source).toBe(second.map?.source);
    expect(first.map?.image).toBe(second.map?.image);
    expect(first.map?.repeat.toArray()).toEqual([2, 3]);
    expect(second.map?.repeat.toArray()).toEqual([9, 1]);
    const dispose = vi.spyOn(first.map!, "dispose");
    library.dispose();
    library.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("chains existing road shader hooks and isolates metre uniforms while sharing the compiled program", async () => {
    const library = createWalkSurfaceLibrary({ loadImage: async () => picture });
    const first = new THREE.MeshStandardMaterial();
    const second = new THREE.MeshStandardMaterial();
    first.name = "first-road";
    second.name = "second-road";
    const previousCompile: THREE.MeshStandardMaterial["onBeforeCompile"] = function (
      this: THREE.MeshStandardMaterial,
      shader,
    ) {
      shader.uniforms.existingRoadName = { value: this.name };
    };
    for (const material of [first, second]) {
      material.onBeforeCompile = previousCompile;
      material.customProgramCacheKey = () => "existing-road-shading";
    }
    library.apply(first, "asphalt", { groundTileMetres: 2.1, roughnessFloor: 0.8 });
    library.apply(second, "asphalt", { groundTileMetres: 4.2 });
    // Generated fallback shading must remain intact while the images load.
    expect(first.onBeforeCompile).toBe(previousCompile);
    expect(first.customProgramCacheKey()).toBe("existing-road-shading");
    await library.whenReady();

    const compile = (material: THREE.MeshStandardMaterial) => {
      const shader = {
        vertexShader: THREE.ShaderLib.standard.vertexShader,
        fragmentShader: THREE.ShaderLib.standard.fragmentShader,
        uniforms: {},
      } as THREE.WebGLProgramParametersWithUniforms;
      material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      return shader.uniforms;
    };
    const firstUniforms = compile(first);
    const secondUniforms = compile(second);
    expect(firstUniforms.existingRoadName?.value).toBe("first-road");
    expect(secondUniforms.existingRoadName?.value).toBe("second-road");
    expect(firstUniforms.atlasGroundTileMetres?.value).toBe(2.1);
    expect(secondUniforms.atlasGroundTileMetres?.value).toBe(4.2);
    expect(firstUniforms.atlasGroundRoughnessFloor?.value).toBe(0.8);
    expect(secondUniforms.atlasGroundRoughnessFloor?.value).toBe(0);
    firstUniforms.atlasGroundTileMetres!.value = 8.4;
    firstUniforms.atlasGroundRoughnessFloor!.value = 0.2;
    expect(secondUniforms.atlasGroundTileMetres?.value).toBe(4.2);
    expect(secondUniforms.atlasGroundRoughnessFloor?.value).toBe(0);
    expect(first.customProgramCacheKey()).not.toBe("existing-road-shading");
    expect(first.customProgramCacheKey()).toBe(second.customProgramCacheKey());
    library.dispose();
    first.dispose();
    second.dispose();
  });

  it('retries local images after an offline region is reopened', async () => {
    let offline = true;
    let requests = 0;
    class LocalImage {
      decoding = 'async';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        requests += 1;
        queueMicrotask(() => offline ? this.onerror?.() : this.onload?.());
      }
    }
    vi.stubGlobal('Image', LocalImage);
    try {
      const first = createWalkSurfaceLibrary();
      first.apply(new THREE.MeshStandardMaterial(), 'gravel');
      await first.whenReady();
      first.dispose();
      offline = false;
      const material = new THREE.MeshStandardMaterial();
      const second = createWalkSurfaceLibrary();
      second.apply(material, 'gravel');
      await second.whenReady();
      expect(requests).toBe(6);
      expect(material.map).toBeInstanceOf(THREE.Texture);
      second.dispose();
    } finally { vi.unstubAllGlobals(); }
  });

  it("retains generated material on load failure and never attaches late textures after unload", async () => {
    const fallback = new THREE.Texture();
    const failedMaterial = new THREE.MeshStandardMaterial({ map: fallback });
    const failing = createWalkSurfaceLibrary({
      loadImage: async () => {
        throw new Error("offline");
      },
    });
    failing.apply(failedMaterial, "asphalt");
    await failing.whenReady();
    expect(failedMaterial.map).toBe(fallback);
    failing.dispose();

    const requests: Array<(image: HTMLImageElement) => void> = [];
    const late = createWalkSurfaceLibrary({
      loadImage: () => new Promise((resolve) => requests.push(resolve)),
    });
    const disposedMaterial = new THREE.MeshStandardMaterial({ map: fallback });
    late.apply(disposedMaterial, "rock");
    late.dispose();
    requests.forEach((resolve) => resolve(picture));
    await late.whenReady();
    expect(disposedMaterial.map).toBe(fallback);
    expect(disposedMaterial.normalMap).toBeNull();
  });
});
