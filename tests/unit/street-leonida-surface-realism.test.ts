import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AxisAlignedRectangle } from '../../src/features/street-leonida/walk-engine';
import { LEGACY_REGION_TRANSLATIONS } from '../../src/features/street-leonida/walk-geography';
import { addScreenshotGroundedLandmarks } from '../../src/features/street-leonida/walk-landmarks';
import { createWalkMaterialLibrary } from '../../src/features/street-leonida/walk-materials';
import { setupWalkAtmosphere } from '../../src/features/street-leonida/walk-atmosphere';
import { WALK_ATMOSPHERE_REGION_PRESETS } from '../../src/features/street-leonida/walk-atmosphere';

interface MemoryCanvas {
  width: number;
  height: number;
  lastImageData?: ImageData;
  getContext: () => {
    createImageData: (width: number, height: number) => ImageData;
    putImageData: (imageData: ImageData) => void;
  };
}

const PORT_TRANSLATION = LEGACY_REGION_TRANSLATIONS.portGellhorn;
const ROAD_RECTS = [
  ...[-76, -56, -40].map((z) => ({
    minX: PORT_TRANSLATION.x - 136,
    maxX: PORT_TRANSLATION.x - 64,
    minZ: PORT_TRANSLATION.z + z - 4,
    maxZ: PORT_TRANSLATION.z + z + 4,
  })),
  ...[-120, -100, -80].map((x) => ({
    minX: PORT_TRANSLATION.x + x - 4,
    maxX: PORT_TRANSLATION.x + x + 4,
    minZ: PORT_TRANSLATION.z - 80,
    maxZ: PORT_TRANSLATION.z - 36,
  })),
] as const;
const PORT_RIBBON_POINTS = [
  new THREE.Vector2(PORT_TRANSLATION.x - 140, PORT_TRANSLATION.z - 60),
  new THREE.Vector2(PORT_TRANSLATION.x - 100, PORT_TRANSLATION.z - 60),
  new THREE.Vector2(PORT_TRANSLATION.x - 64, PORT_TRANSLATION.z - 52),
  new THREE.Vector2(PORT_TRANSLATION.x - 20, PORT_TRANSLATION.z - 44),
] as const;

function rectanglesOverlap(left: AxisAlignedRectangle, right: AxisAlignedRectangle): boolean {
  return (
    left.minX < right.maxX &&
    left.maxX > right.minX &&
    left.minZ < right.maxZ &&
    left.maxZ > right.minZ
  );
}

function distanceToSegment(point: THREE.Vector2, start: THREE.Vector2, end: THREE.Vector2): number {
  const segment = end.clone().sub(start);
  const progress = THREE.MathUtils.clamp(
    point.clone().sub(start).dot(segment) / segment.lengthSq(),
    0,
    1,
  );
  return point.distanceTo(start.clone().add(segment.multiplyScalar(progress)));
}

describe('Street Leonida surface materials', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: () => {
        const canvas: MemoryCanvas = {
          width: 0,
          height: 0,
          getContext: () => ({
            createImageData: (width: number, height: number) =>
              ({
                data: new Uint8ClampedArray(width * height * 4),
                width,
                height,
                colorSpace: 'srgb',
              }) as ImageData,
            putImageData: (imageData: ImageData) => {
              canvas.lastImageData = imageData;
            },
          }),
        };
        return canvas;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lights every walkable ground surface with deterministic tangent-space detail', () => {
    const library = createWalkMaterialLibrary({ textureSize: 32, seed: 814 });
    const keys = [
      'asphalt',
      'concrete',
      'stucco',
      'grass',
      'marsh',
      'sand',
      'weatheredWood',
      'metal',
      'facade',
    ] as const;

    for (const key of keys) {
      const material = library.materials[key];
      expect(material.normalMap, `${key} normal map`).toBeInstanceOf(THREE.CanvasTexture);
      expect(material.normalMap?.colorSpace, `${key} normal color space`).toBe(THREE.NoColorSpace);
      expect(material.normalScale.length(), `${key} normal strength`).toBeGreaterThan(0.08);
    }

    const originalNormal = library.materials.asphalt.normalMap;
    const road = library.createMaterial('asphalt', { repeat: [9, 3] });
    expect(road.normalMap).not.toBe(originalNormal);
    expect(road.normalMap?.repeat.toArray()).toEqual([9, 3]);
    library.dispose();
  });
});

describe('Street Leonida landmark road clearance', () => {
  it('keeps Port Gellhorn building collisions out of every driving lane', () => {
    const scene = new THREE.Scene();
    const collisions: AxisAlignedRectangle[] = [];
    addScreenshotGroundedLandmarks(scene, collisions, false, {
      viceCity: false,
      ambrosia: false,
    });
    const portCollisions = collisions.filter(
      (collision) =>
        collision.minX >= PORT_TRANSLATION.x - 220 &&
        collision.maxX <= PORT_TRANSLATION.x + 40 &&
        collision.minZ >= PORT_TRANSLATION.z - 130 &&
        collision.maxZ <= PORT_TRANSLATION.z + 40,
    );

    expect(portCollisions.length).toBeGreaterThan(0);
    for (const collision of portCollisions) {
      expect(
        ROAD_RECTS.some((road) => rectanglesOverlap(collision, road)),
        JSON.stringify(collision),
      ).toBe(false);
      const center = new THREE.Vector2(
        (collision.minX + collision.maxX) / 2,
        (collision.minZ + collision.maxZ) / 2,
      );
      const halfDiagonal =
        Math.hypot(collision.maxX - collision.minX, collision.maxZ - collision.minZ) / 2;
      const ribbonDistance = Math.min(
        ...PORT_RIBBON_POINTS.slice(0, -1).map((start, index) =>
          distanceToSegment(center, start, PORT_RIBBON_POINTS[index + 1]!),
        ),
      );
      expect(ribbonDistance, `cross-state road vs ${JSON.stringify(collision)}`).toBeGreaterThan(
        halfDiagonal + 5,
      );
    }
  });

  it('adds readable, instanced road furniture and safety details within the mobile budget', () => {
    const desktopScene = new THREE.Scene();
    const mobileScene = new THREE.Scene();
    addScreenshotGroundedLandmarks(desktopScene, [], false, {
      viceCity: false,
      ambrosia: false,
    });
    addScreenshotGroundedLandmarks(mobileScene, [], true, {
      viceCity: false,
      ambrosia: false,
    });

    const desktopProps = desktopScene.getObjectByName('port-gellhorn-roadside-details');
    const mobileProps = mobileScene.getObjectByName('port-gellhorn-roadside-details');
    const causewayMarkings = desktopScene.getObjectByName('keys-causeway-road-markings');
    const causewayGuardrails = desktopScene.getObjectByName('keys-causeway-guardrails');
    const countInstances = (root: THREE.Object3D | undefined): number => {
      let count = 0;
      root?.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) count += object.count;
      });
      return count;
    };

    expect(desktopProps).toBeDefined();
    expect(countInstances(desktopProps)).toBeGreaterThan(countInstances(mobileProps));
    expect(countInstances(mobileProps)).toBeGreaterThanOrEqual(12);
    expect(causewayMarkings).toBeInstanceOf(THREE.InstancedMesh);
    expect(causewayGuardrails).toBeInstanceOf(THREE.InstancedMesh);
  });
});

describe('Street Leonida humid atmosphere', () => {
  it('adds depth-cued aerosols with a smaller mobile particle budget', () => {
    const desktopScene = new THREE.Scene();
    const mobileScene = new THREE.Scene();
    const desktop = setupWalkAtmosphere(desktopScene, { reducedQuality: false });
    const mobile = setupWalkAtmosphere(mobileScene, { reducedQuality: true });
    const desktopAerosols = desktop.root.getObjectByName('walk-atmosphere-aerosols');
    const mobileAerosols = mobile.root.getObjectByName('walk-atmosphere-aerosols');

    expect(desktopAerosols).toBeInstanceOf(THREE.Points);
    expect(mobileAerosols).toBeInstanceOf(THREE.Points);
    expect(
      (desktopAerosols as THREE.Points).geometry.getAttribute('position').count,
    ).toBeGreaterThan((mobileAerosols as THREE.Points).geometry.getAttribute('position').count);

    desktop.dispose();
    mobile.dispose();
  });

  it('keeps directional sunlight dominant over flat ambient illumination', () => {
    const scene = new THREE.Scene();
    const atmosphere = setupWalkAtmosphere(scene);
    const flatLight = atmosphere.hemisphereLight.intensity + atmosphere.ambientLight.intensity;

    expect(atmosphere.sunLight.intensity / flatLight).toBeGreaterThan(2.4);
    expect(atmosphere.ambientLight.intensity).toBeGreaterThanOrEqual(0.22);
    expect(atmosphere.fillLight.intensity).toBeLessThan(0.5);
    atmosphere.dispose();
  });

  it('uses a warm lower-angle Vice City key without washing out facade relief', () => {
    const preset = WALK_ATMOSPHERE_REGION_PRESETS['vice-city'];
    const flatLight = preset.hemisphereIntensity + preset.ambientIntensity;

    expect(preset.sunElevation).toBeGreaterThanOrEqual(24);
    expect(preset.sunElevation).toBeLessThanOrEqual(32);
    expect(preset.sunIntensity / flatLight).toBeGreaterThan(3.2);
    expect(preset.cloudOpacity).toBeGreaterThanOrEqual(0.1);
    expect(preset.cloudOpacity).toBeLessThanOrEqual(0.15);
    expect(preset.fogDensity).toBeGreaterThanOrEqual(0.0011);
    expect(preset.fogDensity).toBeLessThanOrEqual(0.0015);
  });

  it('uses region-specific neutral bounce light so shadowed asphalt does not turn cyan', () => {
    const scene = new THREE.Scene();
    const atmosphere = setupWalkAtmosphere(scene);
    const vice = WALK_ATMOSPHERE_REGION_PRESETS['vice-city'];

    atmosphere.setRegion('vice-city');
    expect(atmosphere.hemisphereLight.color.getHex()).toBe(vice.hemisphereSky);
    expect(atmosphere.hemisphereLight.groundColor.getHex()).toBe(vice.hemisphereGround);
    expect(atmosphere.ambientLight.color.getHex()).toBe(vice.ambient);
    expect(atmosphere.fillLight.color.getHex()).toBe(vice.fill);
    expect(atmosphere.hemisphereLight.color.getHSL({ h: 0, s: 0, l: 0 }).s).toBeLessThan(0.12);
    expect(atmosphere.hemisphereLight.groundColor.getHSL({ h: 0, s: 0, l: 0 }).s).toBeLessThan(
      0.12,
    );

    atmosphere.setRegion('leonida-keys');
    expect(atmosphere.ambientLight.color.getHex()).not.toBe(vice.ambient);
    atmosphere.dispose();
  });

  it('uses a bright sky with neutral upright cloud layers instead of dark ceiling smears', () => {
    const scene = new THREE.Scene();
    const atmosphere = setupWalkAtmosphere(scene);
    const upperSky = atmosphere.sky.material.uniforms.uUpperSky!.value as THREE.Color;
    const cloudColor = atmosphere.clouds.material.color;
    const cloudTexture = atmosphere.clouds.material.map as THREE.DataTexture;
    const cloudPixels = cloudTexture.image.data as Uint8Array;
    const cloudMatrix = new THREE.Matrix4();
    const cloudInstanceColor = new THREE.Color();
    atmosphere.clouds.getMatrixAt(0, cloudMatrix);
    atmosphere.clouds.getColorAt(0, cloudInstanceColor);
    const cloudNormal = new THREE.Vector3(0, 0, 1).transformDirection(cloudMatrix);
    const cloudPosition = new THREE.Vector3();

    expect(upperSky.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(0.5);
    expect(Math.max(cloudColor.r, cloudColor.g, cloudColor.b)).toBeGreaterThan(0.92);
    expect(Math.abs(cloudColor.r - cloudColor.b)).toBeLessThan(0.08);
    expect(atmosphere.clouds.material.blending).toBe(THREE.AdditiveBlending);
    expect(cloudInstanceColor.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(0.93);
    expect(Math.min(...cloudPixels.filter((_, index) => index % 4 !== 3))).toBeGreaterThanOrEqual(
      246,
    );
    expect(Math.abs(cloudNormal.y)).toBeLessThan(0.25);
    expect(atmosphere.clouds.count).toBeLessThanOrEqual(10);
    for (let index = 0; index < atmosphere.clouds.count; index += 1) {
      atmosphere.clouds.getMatrixAt(index, cloudMatrix);
      cloudPosition.setFromMatrixPosition(cloudMatrix);
      expect(Math.hypot(cloudPosition.x, cloudPosition.z)).toBeGreaterThanOrEqual(240);
      expect(cloudPosition.y).toBeGreaterThanOrEqual(70);
    }
    atmosphere.dispose();
  });
});
