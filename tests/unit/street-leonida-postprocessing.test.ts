import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  getWalkPostprocessSize,
  reconstructViewPosition,
  createWalkPostprocessing,
} from "../../src/features/street-leonida/walk-postprocessing";

describe("depth contact shading", () => {
  it("sizes targets from actual drawing pixels and caps the contact buffer on large displays", () => {
    expect(getWalkPostprocessSize(1280, 800, false)).toEqual({
      width: 1280,
      height: 800,
      contactWidth: 640,
      contactHeight: 400,
    });
    const large = getWalkPostprocessSize(3840, 2160, false);
    expect(large.contactWidth * large.contactHeight).toBeLessThanOrEqual(
      512_000,
    );
    const touch = getWalkPostprocessSize(390, 844, true);
    expect(touch.contactWidth * touch.contactHeight).toBeLessThan(
      (390 * 844) / 3,
    );
    expect(getWalkPostprocessSize(0, Number.NaN, true).height).toBe(1);
  });

  it("reconstructs foreground and distant surface positions using the same perspective depth convention", () => {
    const camera = new THREE.PerspectiveCamera(72, 1.6, 0.08, 1900);
    for (const position of [
      new THREE.Vector3(0.2, -1, -2),
      new THREE.Vector3(20, 11, -400),
    ]) {
      const ndc = position.clone().project(camera);
      const restored = reconstructViewPosition(
        (ndc.x + 1) / 2,
        (ndc.y + 1) / 2,
        (ndc.z + 1) / 2,
        camera.projectionMatrixInverse,
      );
      expect(restored.distanceTo(position)).toBeLessThan(0.00001);
    }
  });

  it("renders the scene once, restores renderer state, resizes and disposes every target once", () => {
    let target: THREE.WebGLRenderTarget | null = null;
    const draws: THREE.Object3D[] = [];
    const previousShaderHandler = () => {};
    const renderer = {
      capabilities: { maxSamples: 4 },
      extensions: { has: () => true },
      debug: { checkShaderErrors: false, onShaderError: previousShaderHandler },
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 0.94,
      info: { autoReset: true, reset() {} },
      getRenderTarget: () => target,
      setRenderTarget: (value: THREE.WebGLRenderTarget | null) => {
        target = value;
      },
      render: (object: THREE.Object3D) => {
        draws.push(object);
      },
    } as unknown as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const pipeline = createWalkPostprocessing(renderer, false);
    pipeline.resize(1280, 800);
    pipeline.render(scene, camera);
    expect(draws.filter((object) => object === scene)).toHaveLength(1);
    expect(draws).toHaveLength(3);
    expect(target).toBeNull();
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.info.autoReset).toBe(true);
    expect(renderer.debug.onShaderError).toBe(previousShaderHandler);
    expect(renderer.debug.checkShaderErrors).toBe(false);
    expect(pipeline.targets[0]!.texture.type).toBe(THREE.HalfFloatType);
    const disposed = pipeline.targets.map((item) => {
      let count = 0;
      item.addEventListener("dispose", () => {
        count += 1;
      });
      return () => count;
    });
    pipeline.dispose();
    pipeline.dispose();
    expect(disposed.map((count) => count())).toEqual([1, 1]);
  });

  it("rejects unsupported HDR targets so the caller can retain direct-rendered highlights", () => {
    const renderer = {
      capabilities: { maxSamples: 4 },
      extensions: { has: () => false },
    } as unknown as THREE.WebGLRenderer;
    expect(() => createWalkPostprocessing(renderer, false)).toThrow(/HDR/);
  });

  it.each(["walk-depth-contact-shading", "walk-contact-output"])(
    "reports %s link failure after renderer cleanup and restores state for direct fallback",
    (failedMaterial) => {
      const previousTarget = new THREE.WebGLRenderTarget(1, 1);
      let target: THREE.WebGLRenderTarget | null = previousTarget;
      const previousShaderHandler = vi.fn();
      const scene = new THREE.Scene();
      let rendererCleanupFinished = false;
      const quadResources = new Set<THREE.BufferGeometry | THREE.Material>();
      const renderer = {
        capabilities: { maxSamples: 4 },
        extensions: { has: () => true },
        debug: {
          checkShaderErrors: false,
          onShaderError: previousShaderHandler,
        },
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.94,
        info: { autoReset: true, reset() {} },
        getRenderTarget: () => target,
        setRenderTarget: (value: THREE.WebGLRenderTarget | null) => {
          target = value;
        },
        render: (object: THREE.Object3D) => {
          if (object === scene) {
            expect(renderer.debug.onShaderError).toBe(previousShaderHandler);
            expect(renderer.debug.checkShaderErrors).toBe(false);
            return;
          }
          const quad = object.children[0] as THREE.Mesh<
            THREE.BufferGeometry,
            THREE.Material
          >;
          quadResources.add(quad.geometry);
          quadResources.add(quad.material);
          if (
            quad.material.name === failedMaterial &&
            renderer.debug.checkShaderErrors
          ) {
            // WebGLProgram reports failed links through this callback, then
            // deletes its shaders before returning to renderer.render().
            renderer.debug.onShaderError?.(
              {} as WebGLRenderingContext,
              {} as THREE.WebGLProgram,
              {} as WebGLShader,
              {} as WebGLShader,
            );
            rendererCleanupFinished = true;
          }
        },
      } as unknown as THREE.WebGLRenderer;
      const pipeline = createWalkPostprocessing(renderer, false);
      expect(() =>
        pipeline.render(scene, new THREE.PerspectiveCamera()),
      ).toThrow(/postprocessing shader/i);
      expect(rendererCleanupFinished).toBe(true);
      expect(target).toBe(previousTarget);
      expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
      expect(renderer.info.autoReset).toBe(true);
      expect(renderer.debug.onShaderError).toBe(previousShaderHandler);
      expect(renderer.debug.checkShaderErrors).toBe(false);
      expect(previousShaderHandler).not.toHaveBeenCalled();
      const disposals = [...pipeline.targets, ...quadResources].map(
        (resource) => vi.spyOn(resource, "dispose"),
      );
      pipeline.dispose();
      pipeline.dispose();
      for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
      previousTarget.dispose();
    },
  );
});
