import * as THREE from 'three';

import {
  ALL_LOCATION_ANCHORS,
  AMBROSIA_WORLD,
  GRASSRIVERS_WORLD,
  LEONIDA_KEYS_WORLD,
  MOUNT_KALAGA_WORLD,
  PLACE_ENTRY_VIEWS,
  PORT_GELLHORN_WORLD,
  VICE_CITY_WORLD,
} from './walk-geography';
import type { WalkRenderRegion } from './walk-region-streaming';

interface WalkPoint {
  x: number;
  z: number;
}

interface VegetationPatch {
  region: WalkRenderRegion;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  desktopCount: number;
  mobileCount: number;
  minHeight: number;
  maxHeight: number;
}

interface VegetationPlacement extends WalkPoint {
  height: number;
  widthScale: number;
  rotation: number;
  tint: THREE.Color;
}

interface SpeciesDefinition {
  name: string;
  asset: string;
  seed: number;
  minimumSpacing: number;
  patches: readonly VegetationPatch[];
  tint: (random: () => number) => THREE.Color;
}

const TREE_ASPECT_RATIO = 768 / 1152;
const TREE_PLANE_COUNT = 3;

const ARRIVAL_EXCLUSIONS: readonly (WalkPoint & { radius: number })[] = Object.values(
  PLACE_ENTRY_VIEWS,
).map(({ position }) => ({ ...position, radius: 16 }));

const NAMED_LOCATION_CLEARANCE = 5;

const SPECIES: readonly SpeciesDefinition[] = [
  {
    name: 'royal-palm',
    asset: '/assets/street-leonida/vegetation/royal-palm.webp',
    seed: 0x70616c6d,
    minimumSpacing: 3.7,
    patches: [
      {
        region: 'vice-city',
        minX: VICE_CITY_WORLD.viceBeach.x + 15,
        maxX: VICE_CITY_WORLD.viceBeach.x + 105,
        minZ: VICE_CITY_WORLD.viceBeach.z - 45,
        maxZ: VICE_CITY_WORLD.southBeach.z + 20,
        desktopCount: 32,
        mobileCount: 14,
        minHeight: 8.4,
        maxHeight: 12.6,
      },
      {
        region: 'leonida-keys',
        minX: LEONIDA_KEYS_WORLD.westernKeys.x + 80,
        maxX: LEONIDA_KEYS_WORLD.centralKeys.x - 80,
        minZ: LEONIDA_KEYS_WORLD.centralKeys.z - 180,
        maxZ: LEONIDA_KEYS_WORLD.westernKeys.z + 180,
        desktopCount: 26,
        mobileCount: 11,
        minHeight: 6.8,
        maxHeight: 10.2,
      },
      {
        region: 'leonida-keys',
        minX: LEONIDA_KEYS_WORLD.watsonBay.x - 260,
        maxX: LEONIDA_KEYS_WORLD.watsonBay.x + 320,
        minZ: LEONIDA_KEYS_WORLD.watsonBay.z - 220,
        maxZ: LEONIDA_KEYS_WORLD.watsonBay.z + 260,
        desktopCount: 26,
        mobileCount: 11,
        minHeight: 6.8,
        maxHeight: 10.2,
      },
      {
        region: 'port-gellhorn',
        minX: PORT_GELLHORN_WORLD.coastalStrip.x - 180,
        maxX: PORT_GELLHORN_WORLD.centre.x + 220,
        minZ: PORT_GELLHORN_WORLD.docks.z + 40,
        maxZ: PORT_GELLHORN_WORLD.coastalStrip.z + 120,
        desktopCount: 10,
        mobileCount: 5,
        minHeight: 7.2,
        maxHeight: 10.8,
      },
      {
        region: 'ambrosia',
        minX: AMBROSIA_WORLD.town.x + 20,
        maxX: AMBROSIA_WORLD.town.x + 240,
        minZ: AMBROSIA_WORLD.town.z - 220,
        maxZ: AMBROSIA_WORLD.town.z - 30,
        desktopCount: 8,
        mobileCount: 4,
        minHeight: 6.6,
        maxHeight: 10.5,
      },
    ],
    tint: (random) =>
      new THREE.Color().setRGB(
        0.9 + random() * 0.1,
        0.91 + random() * 0.09,
        0.84 + random() * 0.12,
      ),
  },
  {
    name: 'swamp-cypress',
    asset: '/assets/street-leonida/vegetation/swamp-cypress.webp',
    seed: 0x63797072,
    minimumSpacing: 3.25,
    patches: [
      {
        region: 'grassrivers',
        minX: GRASSRIVERS_WORLD.westernWetlands.x - 24,
        maxX: GRASSRIVERS_WORLD.centre.x - 4,
        minZ: GRASSRIVERS_WORLD.north.z - 4,
        maxZ: GRASSRIVERS_WORLD.southernMangroves.z + 4,
        desktopCount: 34,
        mobileCount: 16,
        minHeight: 7.1,
        maxHeight: 11.3,
      },
      {
        region: 'grassrivers',
        minX: GRASSRIVERS_WORLD.centre.x - 2,
        maxX: GRASSRIVERS_WORLD.easternWetlands.x + 8,
        minZ: GRASSRIVERS_WORLD.north.z,
        maxZ: GRASSRIVERS_WORLD.southernMangroves.z + 8,
        desktopCount: 38,
        mobileCount: 18,
        minHeight: 7.4,
        maxHeight: 12.2,
      },
    ],
    tint: (random) =>
      new THREE.Color().setRGB(
        0.82 + random() * 0.13,
        0.88 + random() * 0.11,
        0.77 + random() * 0.13,
      ),
  },
  {
    name: 'southern-pine',
    asset: '/assets/street-leonida/vegetation/southern-pine.webp',
    seed: 0x70696e65,
    minimumSpacing: 3.7,
    patches: [
      {
        region: 'mount-kalaga',
        minX: MOUNT_KALAGA_WORLD.westernWilderness.x - 28,
        maxX: MOUNT_KALAGA_WORLD.highlands.x - 8,
        minZ: MOUNT_KALAGA_WORLD.westernWilderness.z - 320,
        maxZ: MOUNT_KALAGA_WORLD.southernEntrance.z + 4,
        desktopCount: 77,
        mobileCount: 30,
        minHeight: 8.1,
        maxHeight: 13.2,
      },
      {
        region: 'mount-kalaga',
        minX: MOUNT_KALAGA_WORLD.highlands.x - 6,
        maxX: MOUNT_KALAGA_WORLD.easternForest.x + 24,
        minZ: MOUNT_KALAGA_WORLD.highlands.z - 260,
        maxZ: MOUNT_KALAGA_WORLD.southernEntrance.z + 8,
        desktopCount: 79,
        mobileCount: 30,
        minHeight: 8.4,
        maxHeight: 14.1,
      },
    ],
    tint: (random) =>
      new THREE.Color().setRGB(
        0.82 + random() * 0.15,
        0.86 + random() * 0.13,
        0.78 + random() * 0.14,
      ),
  },
] as const;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pointNearArrival(point: WalkPoint): boolean {
  return ARRIVAL_EXCLUSIONS.some((arrival) => {
    const deltaX = point.x - arrival.x;
    const deltaZ = point.z - arrival.z;
    return deltaX * deltaX + deltaZ * deltaZ < arrival.radius * arrival.radius;
  });
}

function pointNearNamedLocation(point: WalkPoint): boolean {
  return ALL_LOCATION_ANCHORS.some(({ world }) => {
    const deltaX = point.x - world.x;
    const deltaZ = point.z - world.z;
    return deltaX * deltaX + deltaZ * deltaZ < NAMED_LOCATION_CLEARANCE * NAMED_LOCATION_CLEARANCE;
  });
}

function createCrossedTreeGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const halfWidth = TREE_ASPECT_RATIO / 2;

  for (let planeIndex = 0; planeIndex < TREE_PLANE_COUNT; planeIndex += 1) {
    const angle = (planeIndex / TREE_PLANE_COUNT) * Math.PI;
    const horizontalX = Math.cos(angle) * halfWidth;
    const horizontalZ = Math.sin(angle) * halfWidth;
    const normalX = -Math.sin(angle);
    const normalZ = Math.cos(angle);
    const baseIndex = planeIndex * 4;

    positions.push(
      -horizontalX,
      0,
      -horizontalZ,
      horizontalX,
      0,
      horizontalZ,
      horizontalX,
      1,
      horizontalZ,
      -horizontalX,
      1,
      -horizontalZ,
    );
    for (let vertex = 0; vertex < 4; vertex += 1) normals.push(normalX, 0, normalZ);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = 'street-leonida/photo-vegetation-cross-planes';
  return geometry;
}

function loadVegetationTexture(
  renderer: THREE.WebGLRenderer,
  source: string,
  coarsePointer: boolean,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(source);
  texture.name = `street-leonida/photo-vegetation/${source.split('/').at(-1) ?? 'tree'}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(
    coarsePointer ? 8 : 16,
    Math.max(1, renderer.capabilities.getMaxAnisotropy()),
  );
  return texture;
}

function createVegetationMaterial(texture: THREE.Texture, name: string): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    color: 0xb9c1b2,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    fog: true,
    toneMapped: true,
  });
  material.alphaToCoverage = true;
  material.dithering = true;
  material.name = `street-leonida/photo-vegetation/${name}`;
  return material;
}

function createPlacements(
  definition: SpeciesDefinition,
  coarsePointer: boolean,
  regions?: readonly WalkRenderRegion[],
): VegetationPlacement[] {
  const random = seededRandom(definition.seed);
  const placements: VegetationPlacement[] = [];
  const minimumSpacingSquared = definition.minimumSpacing * definition.minimumSpacing;

  for (const patch of definition.patches) {
    if (regions && !regions.includes(patch.region)) continue;
    const desiredCount = coarsePointer ? patch.mobileCount : patch.desktopCount;
    let patchCount = 0;
    let attempts = 0;
    while (patchCount < desiredCount && attempts < desiredCount * 120) {
      attempts += 1;
      const point = {
        x: THREE.MathUtils.lerp(patch.minX, patch.maxX, random()),
        z: THREE.MathUtils.lerp(patch.minZ, patch.maxZ, random()),
      };
      if (pointNearArrival(point) || pointNearNamedLocation(point)) continue;
      if (
        placements.some((placement) => {
          const deltaX = point.x - placement.x;
          const deltaZ = point.z - placement.z;
          return deltaX * deltaX + deltaZ * deltaZ < minimumSpacingSquared;
        })
      )
        continue;

      placements.push({
        ...point,
        height: THREE.MathUtils.lerp(patch.minHeight, patch.maxHeight, random()),
        widthScale: 0.84 + random() * 0.28,
        rotation: random() * Math.PI,
        tint: definition.tint(random),
      });
      patchCount += 1;
    }
  }

  return placements;
}

function createSpeciesInstances(
  definition: SpeciesDefinition,
  geometry: THREE.BufferGeometry,
  material: THREE.MeshLambertMaterial,
  coarsePointer: boolean,
  regions?: readonly WalkRenderRegion[],
): THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshLambertMaterial> {
  const placements = createPlacements(definition, coarsePointer, regions);
  const instances = new THREE.InstancedMesh(geometry, material, placements.length);
  const dummy = new THREE.Object3D();

  placements.forEach((placement, index) => {
    dummy.position.set(placement.x, 0.09, placement.z);
    dummy.rotation.set(0, placement.rotation, 0);
    dummy.scale.set(
      placement.height * placement.widthScale,
      placement.height,
      placement.height * placement.widthScale,
    );
    dummy.updateMatrix();
    instances.setMatrixAt(index, dummy.matrix);
    instances.setColorAt(index, placement.tint);
  });

  instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  instances.instanceMatrix.needsUpdate = true;
  if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
  instances.castShadow = false;
  instances.receiveShadow = false;
  instances.frustumCulled = true;
  instances.computeBoundingBox();
  instances.computeBoundingSphere();
  instances.name = `street-leonida/photo-vegetation/${definition.name}`;
  instances.userData.species = definition.name;
  instances.userData.instanceCount = placements.length;
  return instances;
}

/**
 * Adds high-detail photographic vegetation while retaining a fixed three-draw-call budget.
 * Each species is a single instanced mesh whose geometry contains three crossed alpha planes.
 */
export function addPhotorealWalkVegetation(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  coarsePointer: boolean,
  options: { regions?: readonly WalkRenderRegion[] } = {},
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'street-leonida/photo-vegetation';
  const geometry = createCrossedTreeGeometry();
  const textures: THREE.Texture[] = [];
  const materials: THREE.MeshLambertMaterial[] = [];
  const instances: THREE.InstancedMesh[] = [];
  const requestedRegions = options.regions ? new Set(options.regions) : null;
  const visibleSpecies = requestedRegions
    ? SPECIES.filter((definition) =>
        definition.patches.some((patch) => requestedRegions.has(patch.region)),
      )
    : SPECIES;

  for (const definition of visibleSpecies) {
    const texture = loadVegetationTexture(renderer, definition.asset, coarsePointer);
    const material = createVegetationMaterial(texture, definition.name);
    const speciesInstances = createSpeciesInstances(
      definition,
      geometry,
      material,
      coarsePointer,
      options.regions,
    );
    textures.push(texture);
    materials.push(material);
    instances.push(speciesInstances);
    root.add(speciesInstances);
  }

  root.userData.drawCallBudget = visibleSpecies.length;
  root.userData.instanceCount = instances.reduce((total, mesh) => total + mesh.count, 0);
  root.userData.dispose = (): void => {
    geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
  };
  scene.add(root);
  return root;
}
