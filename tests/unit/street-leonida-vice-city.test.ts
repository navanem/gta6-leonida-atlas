import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  collidesWithBuildings,
  type AxisAlignedRectangle,
} from '../../src/features/street-leonida/walk-engine';
import {
  PLACE_ENTRY_VIEWS,
  VICE_CITY_POI_WORLD,
  VICE_CITY_WORLD,
} from '../../src/features/street-leonida/walk-geography';
import { createViceCityDistrict } from '../../src/features/street-leonida/walk-vice-city';

function horizontalIntersectionArea(first: THREE.Box3, second: THREE.Box3): number {
  const width = Math.max(
    0,
    Math.min(first.max.x, second.max.x) - Math.max(first.min.x, second.min.x),
  );
  const depth = Math.max(
    0,
    Math.min(first.max.z, second.max.z) - Math.max(first.min.z, second.min.z),
  );
  return width * depth;
}

describe('Street Leonida Vice City district', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not upload image textures before TextureLoader has image data', () => {
    const pendingTextures: THREE.Texture<HTMLImageElement>[] = [];
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    });
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(() => {
      const texture = new THREE.Texture<HTMLImageElement>();
      pendingTextures.push(texture);
      return texture;
    });

    createViceCityDistrict(new THREE.Scene(), [], false);

    expect(pendingTextures).toHaveLength(3);
    expect(pendingTextures.map((texture) => texture.version)).toEqual([0, 0, 0]);
  });

  it('exposes every planned Vice City landmark as a concrete scene object', () => {
    const scene = new THREE.Scene();
    const collisions: AxisAlignedRectangle[] = [];
    const district = createViceCityDistrict(scene, collisions, false);
    const world = scene.getObjectByName('vice-city-district');
    expect(world).toBeDefined();
    if (!world) throw new Error('Vice City district was not attached to the scene');
    const expectedFeatures = [
      'vice-city-rounded-waterfront-towers',
      'vice-city-megamundo-tower',
      'vice-city-art-deco-strip',
      'vice-city-beach-promenade',
      'vice-city-hotel-waterfront',
      'vice-city-sports-court',
      'vice-city-mural-underpass',
      'vice-city-arena',
      'vice-city-ferris-wheel',
      'vice-city-curated-palm-line',
      'vice-city-catalan-boulevard',
    ];

    const exposedFeatures = expectedFeatures.filter((featureName) => {
      const feature = world.getObjectByName(featureName);
      let hasRenderableGeometry = false;
      feature?.traverse((object) => {
        if (object instanceof THREE.Mesh) hasRenderableGeometry = true;
      });
      return hasRenderableGeometry;
    });

    expect(exposedFeatures).toEqual(expectedFeatures);
    expect(district.featureIds).toEqual(expectedFeatures);
    expect(collisions.length).toBeGreaterThan(4);

    const underpass = world?.getObjectByName('vice-city-mural-underpass');
    expect(underpass?.position.x).toBe(VICE_CITY_WORLD.laPerle.x);
    expect(underpass?.position.z).toBe(VICE_CITY_WORLD.laPerle.z);
  });

  it('builds the mapped Catalan Boulevard as a legible street-level corridor', () => {
    const scene = new THREE.Scene();
    createViceCityDistrict(scene, [], false);
    const boulevard = scene.getObjectByName('vice-city-catalan-boulevard');
    if (!boulevard) throw new Error('Catalan Boulevard missing');
    const bounds = new THREE.Box3().setFromObject(boulevard);
    const lanes = boulevard.getObjectByName('catalan-boulevard-lane-dashes');
    const lights = boulevard.getObjectByName('catalan-boulevard-streetlights');
    const palms = boulevard.getObjectByName('catalan-boulevard-palms');
    const frontage = boulevard.getObjectByName('catalan-boulevard-frontage');
    const windows = boulevard.getObjectByName('catalan-boulevard-window-bays');
    const photoFacades = boulevard.getObjectByName('catalan-boulevard-photo-facades');
    const asphalt = boulevard.getObjectByName('catalan-boulevard-asphalt') as THREE.Mesh;
    const planters = boulevard.getObjectByName('catalan-boulevard-planters');
    const roundedBands = boulevard.getObjectByName('catalan-boulevard-rounded-glass-bands');
    let practicalLights = 0;
    boulevard.traverse((object) => {
      if (object instanceof THREE.PointLight) practicalLights += 1;
    });

    expect(bounds.getSize(new THREE.Vector3()).z).toBeGreaterThanOrEqual(220);
    expect(lanes).toBeInstanceOf(THREE.InstancedMesh);
    expect((lanes as THREE.InstancedMesh).count).toBeGreaterThanOrEqual(30);
    expect(lights).toBeInstanceOf(THREE.InstancedMesh);
    expect((lights as THREE.InstancedMesh).count).toBeGreaterThanOrEqual(16);
    expect(palms).toBeInstanceOf(THREE.InstancedMesh);
    expect((palms as THREE.InstancedMesh).count).toBeGreaterThanOrEqual(10);
    expect(frontage).toBeDefined();
    expect(
      new THREE.Box3().setFromObject(frontage!).getSize(new THREE.Vector3()).y,
    ).toBeGreaterThan(40);
    expect(windows).toBeInstanceOf(THREE.InstancedMesh);
    expect((windows as THREE.InstancedMesh).count).toBeGreaterThanOrEqual(120);
    expect(photoFacades).toBeInstanceOf(THREE.InstancedMesh);
    expect((photoFacades as THREE.InstancedMesh).count).toBeGreaterThanOrEqual(10);
    expect(
      ((photoFacades as THREE.InstancedMesh).material as THREE.MeshStandardMaterial).map?.name,
    ).toBe('/assets/street-leonida/facades/luxury-tower-sunset.jpg');
    expect((asphalt.material as THREE.MeshStandardMaterial).map?.name).toBe(
      '/assets/street-leonida/textures/sunworn-asphalt.jpg',
    );
    expect(planters).toBeInstanceOf(THREE.InstancedMesh);
    expect((planters as THREE.InstancedMesh).count).toBeGreaterThanOrEqual(20);
    expect(roundedBands).toBeInstanceOf(THREE.InstancedMesh);
    expect((roundedBands as THREE.InstancedMesh).count).toBeGreaterThanOrEqual(20);
    expect(practicalLights).toBeGreaterThanOrEqual(4);
  });

  it('uses detailed instanced traffic and single-mesh motorcycles on Catalan Boulevard', () => {
    const expectedCars = [
      [91.3, 72],
      [96.2, 22],
      [108.5, -58],
      [103.7, -93],
      [91.3, -3],
      [108.5, 49],
      [96.2, -112],
      [103.7, 101],
    ] as const;

    for (const [coarsePointer, expectedCarCount, expectedBikeCount] of [
      [false, 8, 4],
      [true, 5, 3],
    ] as const) {
      const scene = new THREE.Scene();
      createViceCityDistrict(scene, [], coarsePointer);
      const traffic = scene.getObjectByName('catalan-boulevard-traffic');
      if (!traffic) throw new Error('Catalan Boulevard traffic missing');
      const trafficMeshes: THREE.InstancedMesh[] = [];
      traffic.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        expect(object).toBeInstanceOf(THREE.InstancedMesh);
        expect(object.geometry).not.toBeInstanceOf(THREE.BoxGeometry);
        expect(object.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
        trafficMeshes.push(object as THREE.InstancedMesh);
      });

      expect(traffic.userData).toMatchObject({
        renderProfile: 'instanced-detailed-vehicles',
        surfaceProfile: 'sculpted-panelled-pbr',
        vehicleType: 'sedan',
        vehicleCount: expectedCarCount,
        drawCalls: 2,
        materialOwnership: 'region-owned',
      });
      expect(trafficMeshes).toHaveLength(2);
      expect(trafficMeshes.every((mesh) => mesh.count === expectedCarCount)).toBe(true);
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      for (let index = 0; index < expectedCarCount; index += 1) {
        trafficMeshes[0]!.getMatrixAt(index, matrix);
        matrix.decompose(position, rotation, scale);
        expect(position.x).toBeCloseTo(expectedCars[index]![0], 4);
        expect(position.z).toBeCloseTo(expectedCars[index]![1], 4);
      }

      for (let index = 0; index < expectedBikeCount; index += 1) {
        const bike = scene.getObjectByName(`catalan-street-motorcycle-${index + 1}`);
        if (!bike) throw new Error(`Catalan motorcycle ${index + 1} missing`);
        const meshes: THREE.Mesh[] = [];
        bike.traverse((object) => {
          if (object instanceof THREE.Mesh) meshes.push(object);
        });
        expect(bike.userData).toMatchObject({
          renderProfile: 'single-mesh-detailed-motorcycle',
          surfaceProfile: 'rounded-panelled-pbr',
        });
        expect(meshes).toHaveLength(1);
        expect(meshes[0]!.geometry).not.toBeInstanceOf(THREE.BoxGeometry);
        expect(meshes[0]!.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      }
    }
  });

  it('keeps authored buildings clear of the Vice City arrival and one another', () => {
    const scene = new THREE.Scene();
    const collisions: AxisAlignedRectangle[] = [];
    createViceCityDistrict(scene, collisions, false);
    const world = scene.getObjectByName('vice-city-district');
    const roundedTowers = world?.getObjectByName('vice-city-rounded-waterfront-towers');
    const underpass = world?.getObjectByName('vice-city-mural-underpass');
    const arena = world?.getObjectByName('vice-city-arena');
    if (!world || !roundedTowers || !underpass || !arena)
      throw new Error('Vice City geometry missing');

    world.updateMatrixWorld(true);
    const roundedBounds = new THREE.Box3().setFromObject(roundedTowers);
    const roundedCenter = roundedBounds.getCenter(new THREE.Vector3());
    const underpassBounds = new THREE.Box3().setFromObject(underpass);
    const arenaBounds = new THREE.Box3().setFromObject(arena);

    expect(Math.abs(roundedCenter.x - VICE_CITY_WORLD.downtown.x)).toBeLessThanOrEqual(4);
    expect(underpassBounds.getSize(new THREE.Vector3()).x).toBeLessThanOrEqual(16);
    expect(horizontalIntersectionArea(underpassBounds, arenaBounds)).toBeLessThanOrEqual(1);
    expect(collidesWithBuildings(PLACE_ENTRY_VIEWS['vice-city']!.position, 0.8, collisions)).toBe(
      false,
    );
  });

  it('registers collision coverage for every solid landmark structure', () => {
    const scene = new THREE.Scene();
    const collisions: AxisAlignedRectangle[] = [];
    createViceCityDistrict(scene, collisions, false);

    const solidSamples = [
      { x: VICE_CITY_WORLD.downtown.x - 2.5, z: VICE_CITY_WORLD.downtown.z + 0.5 },
      { x: VICE_CITY_POI_WORLD.megamundoTower.x + 3, z: VICE_CITY_POI_WORLD.megamundoTower.z },
      { x: VICE_CITY_WORLD.viceBeach.x - 4.2, z: VICE_CITY_WORLD.viceBeach.z },
      { x: VICE_CITY_POI_WORLD.hotelDixon.x - 8, z: VICE_CITY_POI_WORLD.hotelDixon.z },
      VICE_CITY_POI_WORLD.saharaArena,
      {
        x: VICE_CITY_POI_WORLD.ferrisWheelStudy.x - 6.4,
        z: VICE_CITY_POI_WORLD.ferrisWheelStudy.z,
      },
    ];

    for (const sample of solidSamples) {
      expect(collidesWithBuildings(sample, 0, collisions), JSON.stringify(sample)).toBe(true);
    }
  });

  it('anchors Sahara Arena to L187 and labels the wheel as approximate visual-reference geometry', () => {
    const scene = new THREE.Scene();
    createViceCityDistrict(scene, [], false);
    const arena = scene.getObjectByName('vice-city-arena');
    const wheel = scene.getObjectByName('vice-city-ferris-wheel');

    expect(arena?.position).toMatchObject({
      x: VICE_CITY_POI_WORLD.saharaArena.x,
      z: VICE_CITY_POI_WORLD.saharaArena.z,
    });
    expect(arena?.userData).toMatchObject({
      communityId: 'L187',
      location: 'Sahara Arena',
      nameEvidence: 'KNOWN',
      placementEvidence: 'APPROXIMATE',
      visualInterpretation: 'APPROXIMATE',
    });
    expect(scene.getObjectByName('sahara-arena-identity-sign')).toBeInstanceOf(THREE.Mesh);
    expect(scene.getObjectByName('sahara-arena-entry-gates')).toBeInstanceOf(THREE.InstancedMesh);
    expect(scene.getObjectByName('sahara-arena-entry-canopy')).toBeInstanceOf(THREE.Mesh);
    expect(wheel?.userData).toMatchObject({
      evidence: 'VISUAL_REFERENCE_ONLY',
      landmarkClaim: 'NONE',
      placementEvidence: 'APPROXIMATE',
      location: 'Ferris wheel study (APPROXIMATE)',
    });
  });

  it('adds varied PBR facade, rooftop and balcony detail with a smaller mobile budget', () => {
    const desktopScene = new THREE.Scene();
    createViceCityDistrict(desktopScene, [], false);
    const mobileScene = new THREE.Scene();
    createViceCityDistrict(mobileScene, [], true);

    const desktopWindows = desktopScene.getObjectByName('vice-city-varied-window-bays');
    const mobileWindows = mobileScene.getObjectByName('vice-city-varied-window-bays');
    expect(desktopWindows).toBeInstanceOf(THREE.InstancedMesh);
    expect(mobileWindows).toBeInstanceOf(THREE.InstancedMesh);
    expect((desktopWindows as THREE.InstancedMesh).count).toBeGreaterThan(
      (mobileWindows as THREE.InstancedMesh).count,
    );
    expect(desktopScene.getObjectByName('vice-city-rooftop-hvac')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(desktopScene.getObjectByName('vice-city-hotel-balustrades')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(desktopScene.getObjectByName('vice-city-facade-weathering')).toBeInstanceOf(
      THREE.InstancedMesh,
    );

    const weathering = desktopScene.getObjectByName(
      'vice-city-facade-weathering',
    ) as THREE.InstancedMesh;
    expect(weathering.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((weathering.material as THREE.MeshStandardMaterial).roughness).toBeGreaterThan(0.8);
  });

  it('gives the screenshot-grounded Megamundo landmark a credible high-rise silhouette', () => {
    const scene = new THREE.Scene();
    createViceCityDistrict(scene, [], false);
    const tower = scene.getObjectByName('vice-city-megamundo-tower');
    if (!tower) throw new Error('Megamundo tower missing');
    const size = new THREE.Box3().setFromObject(tower).getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThanOrEqual(20);
    expect(size.y).toBeGreaterThanOrEqual(65);
    expect(size.z).toBeGreaterThanOrEqual(16);
    const ledges = tower.getObjectByName('megamundo-floor-ledges');
    expect(ledges).toBeInstanceOf(THREE.InstancedMesh);
    expect((ledges as THREE.InstancedMesh).count).toBeGreaterThanOrEqual(12);
  });
});
