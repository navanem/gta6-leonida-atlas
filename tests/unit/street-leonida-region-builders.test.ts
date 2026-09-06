import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { gtadbToWorld } from '../../src/features/street-leonida/leonida-coordinates';
import { REVIEWED_GTADB_ANCHORS } from '../../src/features/street-leonida/leonida-evidence';
import {
  AMBROSIA_WORLD,
  PLACE_ENTRY_VIEWS,
  REGION_WORLD,
} from '../../src/features/street-leonida/walk-geography';
import { collidesWithBuildings } from '../../src/features/street-leonida/walk-engine';
import {
  buildWalkRegion as buildWalkRegionInternal,
  getWalkRegionPrimaryAnchor,
  WALK_REGION_ENVIRONMENT_PRESETS,
} from '../../src/features/street-leonida/walk-region-builders';

const renderer = {
  capabilities: { getMaxAnisotropy: () => 16 },
} as THREE.WebGLRenderer;

const builtResources: ReturnType<typeof buildWalkRegionInternal>[] = [];

function buildWalkRegion(...args: Parameters<typeof buildWalkRegionInternal>) {
  const resource = buildWalkRegionInternal(...args);
  builtResources.push(resource);
  return resource;
}

describe('Street Leonida lazy region builders', () => {
  beforeEach(() => {
    builtResources.length = 0;
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    });
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(() => new THREE.Texture());
  });

  afterEach(() => {
    for (const resource of builtResources) resource.dispose();
    builtResources.length = 0;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps a shared regional geometry alive until every simultaneous owner releases it', () => {
    const first = buildWalkRegion('ambrosia', {
      renderer,
      coarsePointer: false,
    });
    const second = buildWalkRegion('ambrosia', {
      renderer,
      coarsePointer: false,
    });
    const firstGeometries = new Set<THREE.BufferGeometry>();
    const secondGeometries = new Set<THREE.BufferGeometry>();
    first.root.traverse((object) => {
      if (object instanceof THREE.Mesh) firstGeometries.add(object.geometry);
    });
    second.root.traverse((object) => {
      if (object instanceof THREE.Mesh) secondGeometries.add(object.geometry);
    });
    const sharedGeometry = [...firstGeometries].find((geometry) => secondGeometries.has(geometry));
    if (!sharedGeometry) throw new Error('Expected Ambrosia to reuse module-scope geometry');
    const disposeSharedGeometry = vi.spyOn(sharedGeometry, 'dispose');

    first.dispose();
    expect(disposeSharedGeometry).not.toHaveBeenCalled();

    second.dispose();
    expect(disposeSharedGeometry).toHaveBeenCalledOnce();
  });

  it.each(['vice-city', 'leonida-keys'] as const)(
    'keeps %s continuity below source roads while preserving authored paving',
    (region) => {
      const resource = buildWalkRegion(region, {
        renderer,
        coarsePointer: false,
      });
      const terrain = resource.root.getObjectByName(`${region}-approximate-terrain`)!;
      const land = terrain.getObjectByName(`${region}-approximate-land-surface`)!;
      expect(land.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(0.055);
      const road = resource.root.getObjectByName(`${region}-arrival-road`)!;
      expect(new THREE.Box3().setFromObject(road).max.y).toBeGreaterThan(0.2);
    },
  );

  it('builds only the requested regional landmark and architecture roots', () => {
    const resource = buildWalkRegion('port-gellhorn', {
      renderer,
      coarsePointer: false,
    });

    expect(resource.root.getObjectByName('landmarks-port-gellhorn')).toBeDefined();
    expect(resource.root.getObjectByName('architecture-port-gellhorn')).toBeDefined();
    expect(resource.root.getObjectByName('landmarks-leonida-keys')).toBeUndefined();
    expect(resource.root.getObjectByName('architecture-mount-kalaga')).toBeUndefined();
    expect(resource.collisions.length).toBeGreaterThan(0);
    const exactRemoteAnchors = [
      gtadbToWorld(REVIEWED_GTADB_ANCHORS.L304.gtadb),
      gtadbToWorld(REVIEWED_GTADB_ANCHORS.L629.gtadb),
    ];
    expect(
      resource.collisions.every((collision) => {
        const centerX = (collision.minX + collision.maxX) / 2;
        const centerZ = (collision.minZ + collision.maxZ) / 2;
        const isLocalInfill =
          Math.hypot(centerX - REGION_WORLD.portGellhorn.x, centerZ - REGION_WORLD.portGellhorn.z) <
          500;
        const isExactReviewedLandmark = exactRemoteAnchors.some(
          (anchor) => Math.hypot(centerX - anchor.x, centerZ - anchor.z) < 0.01,
        );
        return isLocalInfill || isExactReviewedLandmark;
      }),
    ).toBe(true);
  });

  it('keeps the Ambrosia datum at L399 while placing each audited feature at its own world anchor', () => {
    const resource = buildWalkRegion('ambrosia', {
      renderer,
      coarsePointer: false,
    });
    resource.root.updateMatrixWorld(true);
    const office = resource.root.getObjectByName('ambrosia-generic-roadside-office');
    const xeroCanopy = resource.root.getObjectByName('ambrosia-gas-canopy');
    const unknownUtility = resource.root.getObjectByName('ambrosia-unidentified-utility-site');
    const radioTower = resource.root.getObjectByName('ambrosia-radio-tower');
    const sugarFieldGround = resource.root.getObjectByName('ambrosia-field-soil');
    if (!office || !xeroCanopy || !unknownUtility || !radioTower || !sugarFieldGround) {
      throw new Error('Ambrosia audited feature missing');
    }
    const officePosition = new THREE.Box3().setFromObject(office).getCenter(new THREE.Vector3());
    const at = (object: THREE.Object3D): THREE.Vector3 =>
      object.getWorldPosition(new THREE.Vector3());

    expect(Math.abs(officePosition.x - AMBROSIA_WORLD.town.x)).toBeLessThan(20);
    expect(Math.abs(officePosition.z - AMBROSIA_WORLD.town.z)).toBeLessThan(20);
    expect(at(xeroCanopy)).toMatchObject(AMBROSIA_WORLD.xeroStation);
    expect(at(unknownUtility)).toMatchObject(AMBROSIA_WORLD.unknownUtilityL594);
    expect(at(radioTower)).toMatchObject(AMBROSIA_WORLD.radioTower);
    expect(at(sugarFieldGround)).toMatchObject(AMBROSIA_WORLD.sugarFields);
    expect(resource.root.userData.environment).toEqual(WALK_REGION_ENVIRONMENT_PRESETS.ambrosia);
  });

  it('renders one L406 Xero and keeps the L399 arrival market explicitly generic', () => {
    const resource = buildWalkRegion('ambrosia', {
      renderer,
      coarsePointer: false,
    });
    const xeroClaims: THREE.Object3D[] = [];
    resource.root.traverse((object) => {
      if (object.userData.communityId === 'L406') xeroClaims.push(object);
    });
    const market = resource.root.getObjectByName('ambrosia-arrival-roadside-market');
    const arrival = resource.root.getObjectByName('ambrosia-arrival-industrial-road');

    expect(xeroClaims.map(({ name }) => name)).toEqual(['ambrosia-xero-station']);
    expect(market?.userData).toMatchObject({
      evidence: 'APPROXIMATE',
      landmarkClaim: 'NONE',
      infill: 'APPROXIMATE',
    });
    expect(market?.userData.communityId).toBeUndefined();
    expect(arrival?.userData.landmarkClaim).toBe('NONE');
    expect(resource.root.getObjectByName('ambrosia-main-street-gas-station')).toBeUndefined();
    expect(resource.root.getObjectByName('ambrosia-gas-sign-face')).toBeUndefined();
  });

  it('uses isolated pads instead of one Ambrosia terrain polygon spanning remote GTADB anchors', () => {
    const resource = buildWalkRegion('ambrosia', {
      renderer,
      coarsePointer: false,
    });
    const land = resource.root.getObjectByName('ambrosia-approximate-land-surface') as THREE.Mesh;

    expect(land.scale.x).toBeLessThanOrEqual(1_000);
    expect(land.scale.y).toBeLessThanOrEqual(800);
    for (const padName of [
      'ambrosia-xero-hardstand',
      'ambrosia-unknown-utility-pad',
      'ambrosia-radio-tower-footing',
      'ambrosia-field-soil',
    ]) {
      expect(resource.root.getObjectByName(padName)?.userData, padName).toMatchObject({
        evidence: 'APPROXIMATE',
        landmarkClaim: 'NONE',
      });
    }
  });

  it('filters regional vegetation and releases the detached resource once', () => {
    const resource = buildWalkRegion('vice-city', {
      renderer,
      coarsePointer: false,
    });
    const parent = new THREE.Scene();
    parent.add(resource.root);
    const cypresses = resource.root.getObjectByName(
      'street-leonida/photo-vegetation/swamp-cypress',
    );
    const palms = resource.root.getObjectByName(
      'street-leonida/photo-vegetation/royal-palm',
    ) as THREE.InstancedMesh;

    expect(cypresses).toBeUndefined();
    expect(palms.count).toBeGreaterThan(0);
    const disposePalmInstances = vi.spyOn(palms, 'dispose');
    resource.dispose();
    resource.dispose();
    expect(disposePalmInstances).toHaveBeenCalledOnce();
    expect(resource.root.parent).toBeNull();
  });

  it.each([
    ['vice-city', 'coastal-urban'],
    ['leonida-keys', 'sandy-mangrove-islands'],
    ['grassrivers', 'wetland-pools-reeds'],
    ['port-gellhorn', 'distressed-roadside'],
    ['ambrosia', 'agricultural-soil-bands'],
    ['mount-kalaga', 'forest-rock-cut-relief'],
  ] as const)(
    'builds an approximate %s terrain silhouette without square ground or water patches',
    (region, terrainProfile) => {
      const desktop = buildWalkRegion(region, {
        renderer,
        coarsePointer: false,
      });
      const mobile = buildWalkRegion(region, { renderer, coarsePointer: true });
      const desktopTerrain = desktop.root.getObjectByName(`${region}-approximate-terrain`);
      const mobileTerrain = mobile.root.getObjectByName(`${region}-approximate-terrain`);
      if (!desktopTerrain || !mobileTerrain) throw new Error('Approximate terrain missing');

      const terrainObjects: Array<THREE.Mesh | THREE.InstancedMesh> = [];
      desktopTerrain.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
          terrainObjects.push(object);
        }
      });

      expect(desktopTerrain.userData.terrainProfile).toBe(terrainProfile);
      expect(desktopTerrain.userData.detailCount).toBeGreaterThan(0);
      expect(mobileTerrain.userData.detailCount).toBeLessThan(desktopTerrain.userData.detailCount);
      expect(terrainObjects.length).toBeGreaterThan(1);
      expect(terrainObjects.every((object) => object.userData.evidence === 'APPROXIMATE')).toBe(
        true,
      );
      expect(terrainObjects.some((object) => object.geometry.type === 'ShapeGeometry')).toBe(true);
      expect(
        terrainObjects.every(
          (object) =>
            !(
              object.geometry.type === 'PlaneGeometry' &&
              object.scale.x === object.scale.y &&
              object.scale.x >= 2_000
            ),
        ),
      ).toBe(true);
    },
  );

  it.each(['vice-city', 'leonida-keys', 'grassrivers', 'port-gellhorn', 'mount-kalaga'] as const)(
    'keeps %s fallback surfaces below source tiles and above deep water',
    (region) => {
      const resource = buildWalkRegion(region, {
        renderer,
        coarsePointer: false,
      });
      const landSurface = resource.root.getObjectByName(
        `${region}-approximate-land-surface`,
      ) as THREE.Mesh;
      const waterSurface = resource.root.getObjectByName(
        `${region}-approximate-water-surface`,
      ) as THREE.Mesh;

      expect(landSurface.position.y).toBeLessThan(0.055);
      expect(landSurface.position.y).toBeGreaterThan(-1.89);
      expect(waterSurface.position.y).toBeLessThan(0.055);
      expect(waterSurface.position.y).toBeGreaterThan(-0.19);
    },
  );

  it.each(['vice-city', 'mount-kalaga'] as const)(
    'keeps %s regional water exposed above its regional land surface',
    (region) => {
      const resource = buildWalkRegion(region, {
        renderer,
        coarsePointer: false,
      });
      const landSurface = resource.root.getObjectByName(
        `${region}-approximate-land-surface`,
      ) as THREE.Mesh;
      const waterSurface = resource.root.getObjectByName(
        `${region}-approximate-water-surface`,
      ) as THREE.Mesh;

      expect(waterSurface.position.y).toBeGreaterThan(landSurface.position.y);
    },
  );

  it.each([
    ['port-gellhorn', 'road', 180, 26],
    ['ambrosia', 'soil-bands', 72, 260],
  ] as const)(
    'gives %s %s accents their intended world footprint',
    (region, accent, width, depth) => {
      const resource = buildWalkRegion(region, {
        renderer,
        coarsePointer: false,
      });
      const accentMesh = resource.root.getObjectByName(
        `${region}-approximate-infill-${accent}`,
      ) as THREE.InstancedMesh;
      const instance = new THREE.Matrix4();
      accentMesh.getMatrixAt(0, instance);
      accentMesh.geometry.computeBoundingBox();
      const bounds = accentMesh.geometry.boundingBox!.clone().applyMatrix4(instance);

      expect(bounds.max.x - bounds.min.x).toBeCloseTo(width, 0);
      expect(bounds.max.z - bounds.min.z).toBeCloseTo(depth, 0);
    },
  );

  it.each([
    ['vice-city', 0xc9c1a4, 0x3196ad],
    ['leonida-keys', 0xc8b576, 0x2aaab0],
    ['grassrivers', 0x455543, 0x284f50],
    ['port-gellhorn', 0x766350, 0x287786],
    ['mount-kalaga', 0x6b5941, 0x3b6971],
  ] as const)(
    'uses separate, materially distinct land and water surfaces for %s',
    (region, groundColor, waterColor) => {
      const resource = buildWalkRegion(region, {
        renderer,
        coarsePointer: false,
      });
      const land = resource.root.getObjectByName(`${region}-approximate-land`) as THREE.Group;
      const water = resource.root.getObjectByName(`${region}-approximate-water`) as THREE.Group;
      const landSurface = land.getObjectByName(`${region}-approximate-land-surface`) as THREE.Mesh;
      const waterSurface = water.getObjectByName(
        `${region}-approximate-water-surface`,
      ) as THREE.Mesh;

      expect(landSurface.geometry).not.toBe(waterSurface.geometry);
      expect(landSurface.geometry.getAttribute('position').count).not.toBe(
        waterSurface.geometry.getAttribute('position').count,
      );
      expect((landSurface.material as THREE.MeshStandardMaterial).color.getHex()).toBe(groundColor);
      expect((waterSurface.material as THREE.MeshPhysicalMaterial).color.getHex()).toBe(waterColor);
      expect((waterSurface.material as THREE.MeshPhysicalMaterial).roughness).toBeLessThan(0.3);
      expect((waterSurface.material as THREE.MeshPhysicalMaterial).opacity).toBeLessThan(0.9);
    },
  );

  it('does not fabricate a Lake Leonida surface inside the Ambrosia region', () => {
    const resource = buildWalkRegion('ambrosia', {
      renderer,
      coarsePointer: false,
    });

    expect(resource.root.getObjectByName('ambrosia-lake-leonida')).toBeUndefined();
    expect(resource.root.getObjectByName('ambrosia-approximate-water-surface')).toBeUndefined();
  });

  it.each([
    ['leonida-keys', 'keys-arrival-water'],
    ['grassrivers', 'grassrivers-arrival-water'],
    ['mount-kalaga', 'kalaga-arrival-river'],
  ] as const)('keeps the authored %s water visible above regional ground', (region, name) => {
    const resource = buildWalkRegion(region, {
      renderer,
      coarsePointer: false,
    });
    const water = resource.root.getObjectByName(name);
    if (!water) throw new Error(`${name} missing`);
    resource.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(water);

    expect(bounds.min.y).toBeGreaterThanOrEqual(0.089);
    expect(bounds.max.y).toBeGreaterThan(0.13);
  });

  it('uses an instanced winding road through the Mount Kalaga rock cut', () => {
    const resource = buildWalkRegion('mount-kalaga', {
      renderer,
      coarsePointer: false,
    });
    const road = resource.root.getObjectByName('mount-kalaga-arrival-road') as THREE.InstancedMesh;
    const segmentMatrix = new THREE.Matrix4();
    const segmentPosition = new THREE.Vector3();
    const xPositions: number[] = [];

    expect(road).toBeInstanceOf(THREE.InstancedMesh);
    expect(road.count).toBeGreaterThanOrEqual(24);
    for (let index = 0; index < road.count; index += 1) {
      road.getMatrixAt(index, segmentMatrix);
      xPositions.push(segmentPosition.setFromMatrixPosition(segmentMatrix).x);
    }
    expect(Math.max(...xPositions) - Math.min(...xPositions)).toBeGreaterThan(7);
    expect(resource.root.getObjectByName('mount-kalaga-arrival-road-lines')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    const guardrails = resource.root.getObjectByName(
      'kalaga-arrival-road-guardrails',
    ) as THREE.InstancedMesh;
    expect(guardrails).toBeInstanceOf(THREE.InstancedMesh);
    expect(guardrails.count).toBeGreaterThanOrEqual(10);
  });

  it('keeps the legacy Mount Kalaga shelter visibly classified as approximate infill', () => {
    const resource = buildWalkRegion('mount-kalaga', {
      renderer,
      coarsePointer: false,
    });
    const shelter = resource.root.getObjectByName('mount-kalaga-approximate-trail-shelter');

    expect(shelter).toBeInstanceOf(THREE.Group);
    expect(shelter?.userData).toMatchObject({
      evidence: 'APPROXIMATE',
      landmarkClaim: 'NONE',
      infill: 'APPROXIMATE',
    });
  });

  it('keeps Keys island surfaces separated instead of covering the same local water', () => {
    const resource = buildWalkRegion('leonida-keys', {
      renderer,
      coarsePointer: false,
    });
    const islands = resource.root.getObjectByName('leonida-keys-approximate-land') as THREE.Group;
    const islandBoxes = islands.children
      .filter((object): object is THREE.Mesh => object instanceof THREE.Mesh)
      .map((island) => new THREE.Box3().setFromObject(island));

    expect(islandBoxes.length).toBeGreaterThan(3);
    for (let index = 0; index < islandBoxes.length; index += 1) {
      for (let next = index + 1; next < islandBoxes.length; next += 1) {
        const left = islandBoxes[index]!;
        const right = islandBoxes[next]!;
        const overlap = left.clone().intersect(right);
        const overlapArea =
          Math.max(0, overlap.max.x - overlap.min.x) * Math.max(0, overlap.max.z - overlap.min.z);
        const smallerArea = Math.min(
          (left.max.x - left.min.x) * (left.max.z - left.min.z),
          (right.max.x - right.min.x) * (right.max.z - right.min.z),
        );
        expect(overlapArea).toBeLessThan(smallerArea * 0.2);
      }
    }
  });

  it('keeps Keys islands above the channel in world space while preserving the raster beneath them', () => {
    const resource = buildWalkRegion('leonida-keys', {
      renderer,
      coarsePointer: false,
    });
    const land = resource.root.getObjectByName('leonida-keys-approximate-land') as THREE.Group;
    const water = resource.root.getObjectByName(
      'leonida-keys-approximate-water-surface',
    ) as THREE.Mesh;
    land.updateMatrixWorld(true);
    water.updateMatrixWorld(true);
    const waterCenter = water.getWorldPosition(new THREE.Vector3());
    const waterBounds = new THREE.Box3().setFromObject(water);

    const islands = land.children.filter(
      (object): object is THREE.Mesh =>
        object instanceof THREE.Mesh && !(object instanceof THREE.InstancedMesh),
    );
    let projectedOverlapCount = 0;
    for (const island of islands) {
      const islandCenter = island.getWorldPosition(new THREE.Vector3());
      const islandBounds = new THREE.Box3().setFromObject(island);
      const overlapsChannel =
        Math.min(islandBounds.max.x, waterBounds.max.x) >
          Math.max(islandBounds.min.x, waterBounds.min.x) &&
        Math.min(islandBounds.max.z, waterBounds.max.z) >
          Math.max(islandBounds.min.z, waterBounds.min.z);

      expect(islandCenter.y).toBeGreaterThan(waterCenter.y);
      if (overlapsChannel) {
        projectedOverlapCount += 1;
        expect(islandCenter.y - waterCenter.y).toBeGreaterThanOrEqual(0.02);
      }
    }
    expect(projectedOverlapCount).toBeGreaterThan(0);

    const islandMaterial = islands[0]!.material as THREE.MeshStandardMaterial;
    expect(islandMaterial.transparent).toBe(false);
    expect(islandMaterial.opacity).toBe(1);
    expect(islandMaterial.depthWrite).toBe(true);
  });

  it('does not pull approximate fallback surfaces forward over source cartography', () => {
    const resource = buildWalkRegion('vice-city', {
      renderer,
      coarsePointer: false,
    });
    const land = resource.root.getObjectByName('vice-city-approximate-land-surface') as THREE.Mesh;
    const water = resource.root.getObjectByName(
      'vice-city-approximate-water-surface',
    ) as THREE.Mesh;
    const accent = resource.root.getObjectByName(
      'vice-city-approximate-infill-shore',
    ) as THREE.InstancedMesh;

    for (const material of [land.material, water.material, accent.material] as THREE.Material[]) {
      expect(material.polygonOffset).toBe(true);
      expect(material.polygonOffsetUnits).toBeGreaterThanOrEqual(0);
      expect(material.polygonOffsetFactor).toBeGreaterThanOrEqual(0);
    }
    expect(land.position.y).toBeLessThan(water.position.y);
    expect(water.position.y).toBeLessThan(0.055);
  });

  it('builds raised forest rock-cut terrain at Mount Kalaga and disposes shared terrain resources once', () => {
    const resource = buildWalkRegion('mount-kalaga', {
      renderer,
      coarsePointer: false,
    });
    const relief = resource.root.getObjectByName('mount-kalaga-approximate-relief') as THREE.Mesh;
    const terrain = resource.root.getObjectByName(
      'mount-kalaga-approximate-terrain',
    ) as THREE.Group;
    const terrainGeometry = relief.geometry;
    const terrainMaterial = relief.material as THREE.Material;
    const geometryDispose = vi.spyOn(terrainGeometry, 'dispose');
    const materialDispose = vi.spyOn(terrainMaterial, 'dispose');

    const reliefBounds = new THREE.Box3().setFromObject(relief);
    expect(relief.geometry.type).toBe('ExtrudeGeometry');
    expect(reliefBounds.max.y - reliefBounds.min.y).toBeGreaterThan(100);
    expect(terrain.userData.evidence).toBe('APPROXIMATE');
    resource.dispose();
    resource.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });

  it.each([
    'vice-city',
    'leonida-keys',
    'grassrivers',
    'port-gellhorn',
    'ambrosia',
    'mount-kalaga',
  ] as const)('keeps %s terrain at its established regional anchor', (region) => {
    const anchorBeforeBuild = { ...getWalkRegionPrimaryAnchor(region) };
    const resource = buildWalkRegion(region, {
      renderer,
      coarsePointer: false,
    });
    const terrain = resource.root.getObjectByName(`${region}-approximate-terrain`);
    if (!terrain) throw new Error('Approximate terrain missing');
    terrain.updateMatrixWorld(true);
    const terrainBounds = new THREE.Box3().setFromObject(terrain);

    expect(getWalkRegionPrimaryAnchor(region)).toEqual(anchorBeforeBuild);
    expect(
      terrainBounds.distanceToPoint(new THREE.Vector3(anchorBeforeBuild.x, 0, anchorBeforeBuild.z)),
    ).toBeLessThan(260);
  });

  it.each([
    ['vice-city', 'shore'],
    ['leonida-keys', 'islands'],
    ['port-gellhorn', 'road'],
    ['ambrosia', 'soil-bands'],
  ] as const)('lays the %s %s terrain accent flat on the ground', (region, accent) => {
    const resource = buildWalkRegion(region, {
      renderer,
      coarsePointer: false,
    });
    const terrainAccent = resource.root.getObjectByName(
      `${region}-approximate-infill-${accent}`,
    ) as THREE.InstancedMesh;
    const firstInstance = new THREE.Matrix4();
    terrainAccent.getMatrixAt(0, firstInstance);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(firstInstance);

    expect(Math.abs(normal.y)).toBeGreaterThan(0.99);
  });

  it('preserves pine occupancy with native nearby trees and distant photographic impostors', () => {
    const resource = buildWalkRegion('mount-kalaga', {
      renderer,
      coarsePointer: false,
    });
    const arrival = resource.root.getObjectByName('mount-kalaga-arrival-park-road');
    const photoPines = arrival?.getObjectByName(
      'kalaga-arrival-photo-pines',
    ) as THREE.InstancedMesh;

    expect(photoPines).toBeInstanceOf(THREE.InstancedMesh);
    const nativePines = arrival
      ?.getObjectByName('kalaga-arrival-photo-pines-native')
      ?.getObjectByName('pine-tapered-trunks') as THREE.InstancedMesh;
    expect(nativePines).toBeInstanceOf(THREE.InstancedMesh);
    expect(photoPines.count + nativePines.count).toBeGreaterThanOrEqual(150);
    expect(arrival?.getObjectByName('kalaga-arrival-pines-canopies')).toBeUndefined();
  });

  it('places readable textured identity signs in Port Gellhorn and Mount Kalaga', () => {
    const port = buildWalkRegion('port-gellhorn', {
      renderer,
      coarsePointer: false,
    });
    const kalaga = buildWalkRegion('mount-kalaga', {
      renderer,
      coarsePointer: false,
    });
    const motelSign = port.root.getObjectByName('port-starlet-motel-sign-face') as THREE.Mesh;
    const parkSign = kalaga.root.getObjectByName('kalaga-arrival-park-sign-face') as THREE.Mesh;
    const parkSignBacking = kalaga.root.getObjectByName('kalaga-arrival-park-sign') as THREE.Mesh;

    expect(motelSign).toBeInstanceOf(THREE.Mesh);
    expect((motelSign.material as THREE.MeshStandardMaterial).map?.name).toBe(
      'street-leonida/sign/starlet-motel',
    );
    expect(parkSign).toBeInstanceOf(THREE.Mesh);
    expect((parkSign.material as THREE.MeshStandardMaterial).map?.name).toBe(
      'street-leonida/sign/mount-kalaga',
    );
    expect(parkSign.rotation.y).toBeCloseTo(parkSignBacking.rotation.y, 6);
  });

  it.each([
    [
      'vice-city',
      'vice-city',
      'vice-city-arrival-urban-boulevard',
      '/assets/street-leonida/vegetation/royal-palm.webp',
    ],
    [
      'leonida-keys',
      'leonida-keys',
      'leonida-keys-arrival-causeway',
      '/assets/street-leonida/vegetation/royal-palm.webp',
    ],
    [
      'grassrivers',
      'grassrivers',
      'grassrivers-arrival-wetland-road',
      '/assets/street-leonida/vegetation/swamp-cypress.webp',
    ],
    [
      'port-gellhorn',
      'port-gellhorn',
      'port-gellhorn-arrival-commercial-strip',
      '/assets/street-leonida/vegetation/royal-palm.webp',
    ],
    [
      'ambrosia',
      'ambrosia',
      'ambrosia-arrival-industrial-road',
      '/assets/street-leonida/vegetation/ambrosia-sugarcane.webp',
    ],
    [
      'mount-kalaga',
      'mount-kalaga-national-park',
      'mount-kalaga-arrival-park-road',
      '/assets/street-leonida/vegetation/southern-pine.webp',
    ],
  ] as const)(
    'builds a dense, walkable arrival foreground for %s',
    (region, placeSlug, featureId, vegetationAsset) => {
      const resource = buildWalkRegion(region, {
        renderer,
        coarsePointer: false,
      });
      const arrival = resource.root.getObjectByName(featureId);
      const entry = PLACE_ENTRY_VIEWS[placeSlug]!.position;
      if (!arrival) throw new Error(`${featureId} missing`);
      arrival.updateMatrixWorld(true);
      const worldPosition = arrival.getWorldPosition(new THREE.Vector3());
      let meshCount = 0;
      arrival.traverse((object) => {
        if (object instanceof THREE.Mesh) meshCount += 1;
      });

      expect(worldPosition.x).toBeCloseTo(entry.x, 6);
      expect(worldPosition.z).toBeCloseTo(entry.z, 6);
      expect(arrival.userData.evidence).toBe('APPROXIMATE');
      expect(arrival.userData.detailProfile).toBe(region);
      const road = arrival.getObjectByName(`${region}-arrival-road`);
      expect(road).toBeDefined();
      expect(road?.userData.surfaceAsset).toBe(
        '/assets/street-leonida/textures/sunworn-asphalt.jpg',
      );
      expect(arrival.userData.photoVegetationAssets).toContain(vegetationAsset);
      expect(arrival.getObjectByName(`${region}-arrival-context-surface`)).toBeUndefined();
      expect(meshCount).toBeGreaterThan(18);
      expect(resource.featureIds).toContain(featureId);
      expect(collidesWithBuildings(entry, 0.8, resource.collisions)).toBe(false);
    },
  );

  it('renders a layered Vice City streetscape at the reviewed arrival without generic-box draw-call bloat', () => {
    const desktop = buildWalkRegion('vice-city', {
      renderer,
      coarsePointer: false,
    });
    const mobile = buildWalkRegion('vice-city', {
      renderer,
      coarsePointer: true,
    });
    const arrival = desktop.root.getObjectByName('vice-city-arrival-urban-boulevard');
    const mobileArrival = mobile.root.getObjectByName('vice-city-arrival-urban-boulevard');
    if (!arrival || !mobileArrival) throw new Error('Vice City arrival foreground missing');

    const renderables: THREE.Object3D[] = [];
    arrival.traverse((object) => {
      if (object instanceof THREE.Mesh) renderables.push(object);
    });

    expect(arrival.getObjectByName('vice-city-arrival-art-deco-facades')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(arrival.getObjectByName('vice-city-arrival-facade-shells-interiors')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(arrival.getObjectByName('vice-city-arrival-photo-facades')).toBeUndefined();
    expect(
      (arrival.getObjectByName('vice-city-arrival-art-deco-facades') as THREE.InstancedMesh).count,
    ).toBe(10);
    expect(arrival.getObjectByName('vice-city-arrival-facade-shells-awnings-balconies')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(arrival.getObjectByName('vice-city-arrival-rooftop-volumes')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(arrival.getObjectByName('vice-city-arrival-road-wear')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    const wetAccents = arrival.getObjectByName(
      'vice-city-arrival-wet-asphalt-accents',
    ) as THREE.InstancedMesh;
    expect(wetAccents).toBeInstanceOf(THREE.InstancedMesh);
    expect((wetAccents.material as THREE.MeshPhysicalMaterial).roughness).toBeLessThan(0.35);
    const boulevardRoad = arrival.getObjectByName('vice-city-arrival-road') as THREE.Mesh;
    const boulevardRoadMaterial = boulevardRoad.material as THREE.MeshStandardMaterial;
    expect(boulevardRoadMaterial.color.getHex()).toBe(0xa6aeb5);
    expect(boulevardRoadMaterial.roughness).toBeGreaterThanOrEqual(0.94);
    expect(boulevardRoadMaterial.metalness).toBeLessThanOrEqual(0.005);
    expect(boulevardRoadMaterial.envMapIntensity).toBeLessThanOrEqual(0.18);
    expect(arrival.getObjectByName('vice-city-arrival-photo-palms')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(arrival.getObjectByName('vice-city-arrival-traffic-silhouettes')).toBeDefined();
    expect(arrival.getObjectByName('vice-city-arrival-secondary-signage')).toBeDefined();
    expect(arrival.getObjectByName('vice-city-arrival-atmospheric-depth')).toBeDefined();
    expect(
      (arrival.getObjectByName('vice-city-arrival-signal-heads') as THREE.InstancedMesh).count,
    ).toBe(6);

    // The extra draws cover skinned people and two native vegetation batches per planting.
    expect(renderables.length).toBeLessThanOrEqual(50);
    expect(arrival.userData.detailCount).toBeGreaterThanOrEqual(240);
    expect(mobileArrival.userData.detailCount).toBeLessThan(arrival.userData.detailCount);
    expect(arrival.userData.confidence).toBe('VISUAL_REFERENCE_ONLY');
    expect(arrival.userData.landmarkClaim).toBe('NONE');
  });

  it('does not allocate the superseded legacy Catalan corridor behind the new Vice City arrival', () => {
    const resource = buildWalkRegion('vice-city', {
      renderer,
      coarsePointer: false,
    });
    const legacyCorridor = resource.root.getObjectByName('vice-city-catalan-boulevard');

    expect(legacyCorridor).toBeUndefined();
    expect(resource.featureIds).not.toContain('vice-city-catalan-boulevard');
    expect(resource.featureIds).toContain('vice-city-arrival-urban-boulevard');
  });
});
