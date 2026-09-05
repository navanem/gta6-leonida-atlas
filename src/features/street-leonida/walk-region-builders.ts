import * as THREE from 'three';

import type { AxisAlignedRectangle, WalkPoint } from './walk-engine';
import {
  AMBROSIA_WORLD,
  GRASSRIVERS_WORLD,
  LEONIDA_KEYS_WORLD,
  MOUNT_KALAGA_WORLD,
  PORT_GELLHORN_WORLD,
  REGION_WORLD,
  VICE_CITY_WORLD,
} from './walk-geography';
import { addHighFidelityWalkArchitecture } from './walk-architecture';
import { createAmbrosiaDistrict } from './walk-ambrosia';
import { addScreenshotGroundedLandmarks } from './walk-landmarks';
import { addPhotorealWalkVegetation } from './walk-photo-vegetation';
import { addRegionalArrivalForeground } from './walk-regional-arrivals';
import type { WalkRenderRegion } from './walk-region-streaming';
import { createViceCityDistrict } from './walk-vice-city';

export interface WalkRegionEnvironmentPreset {
  readonly groundColor: number;
  readonly waterColor: number;
  readonly hazeColor: number;
  readonly groundEvidence: 'APPROXIMATE';
}

export const WALK_REGION_ENVIRONMENT_PRESETS: Readonly<
  Record<WalkRenderRegion, WalkRegionEnvironmentPreset>
> = {
  'mount-kalaga': {
    groundColor: 0x52684c,
    waterColor: 0x315b68,
    hazeColor: 0x9faaa4,
    groundEvidence: 'APPROXIMATE',
  },
  'port-gellhorn': {
    groundColor: 0x817d65,
    waterColor: 0x286b78,
    hazeColor: 0xc0aa91,
    groundEvidence: 'APPROXIMATE',
  },
  ambrosia: {
    groundColor: 0x778153,
    waterColor: 0x416f72,
    hazeColor: 0xc1ad83,
    groundEvidence: 'APPROXIMATE',
  },
  grassrivers: {
    groundColor: 0x4f694d,
    waterColor: 0x315f62,
    hazeColor: 0xa9b6a2,
    groundEvidence: 'APPROXIMATE',
  },
  'vice-city': {
    groundColor: 0x9aa98a,
    waterColor: 0x167f9a,
    hazeColor: 0x95bed0,
    groundEvidence: 'APPROXIMATE',
  },
  'leonida-keys': {
    groundColor: 0xb9ad79,
    waterColor: 0x218e98,
    hazeColor: 0x9cc8c7,
    groundEvidence: 'APPROXIMATE',
  },
};

const REGION_GROUND_ANCHORS: Readonly<Record<WalkRenderRegion, readonly WalkPoint[]>> = {
  'mount-kalaga': [
    MOUNT_KALAGA_WORLD.centre,
    MOUNT_KALAGA_WORLD.westernWilderness,
    MOUNT_KALAGA_WORLD.highlands,
    MOUNT_KALAGA_WORLD.easternForest,
    MOUNT_KALAGA_WORLD.southernEntrance,
  ],
  'port-gellhorn': [
    PORT_GELLHORN_WORLD.centre,
    PORT_GELLHORN_WORLD.docks,
    PORT_GELLHORN_WORLD.coastalStrip,
    PORT_GELLHORN_WORLD.easternCountryside,
  ],
  ambrosia: [AMBROSIA_WORLD.town, AMBROSIA_WORLD.freight],
  grassrivers: [
    GRASSRIVERS_WORLD.centre,
    GRASSRIVERS_WORLD.westernWetlands,
    GRASSRIVERS_WORLD.easternWetlands,
    GRASSRIVERS_WORLD.southernMangroves,
  ],
  'vice-city': [
    VICE_CITY_WORLD.downtown,
    VICE_CITY_WORLD.viceBeach,
    VICE_CITY_WORLD.littleCuba,
    VICE_CITY_WORLD.viceCityPort,
  ],
  'leonida-keys': [
    LEONIDA_KEYS_WORLD.watsonBay,
    LEONIDA_KEYS_WORLD.westernKeys,
    LEONIDA_KEYS_WORLD.centralKeys,
    LEONIDA_KEYS_WORLD.easternKeys,
    LEONIDA_KEYS_WORLD.northernEntrance,
  ],
};

const AMBROSIA_AUTHORING_ANCHOR = { x: 42.8, z: -37 } as const;

/** Keep regional infill clear of the GTADB raster at y=0.055 and ocean top at y=-0.19. */
const REGIONAL_GROUND_Y = 0.085;
const REGIONAL_WATER_Y = 0.105;
const REGIONAL_ACCENT_Y = 0.125;
const KEYS_ISLAND_Y = 0.135;

export interface WalkRegionResource {
  readonly region: WalkRenderRegion;
  readonly root: THREE.Group;
  readonly collisions: AxisAlignedRectangle[];
  readonly featureIds: readonly string[];
  update(elapsedSeconds: number): void;
  dispose(): void;
}

export interface WalkRegionBuilderOptions {
  readonly renderer: THREE.WebGLRenderer;
  readonly coarsePointer: boolean;
}

function moveChildren(source: THREE.Object3D, target: THREE.Object3D): void {
  for (const child of [...source.children]) target.add(child);
}

function translateCollisions(collisions: AxisAlignedRectangle[], translation: WalkPoint): void {
  for (const collision of collisions) {
    collision.minX += translation.x;
    collision.maxX += translation.x;
    collision.minZ += translation.z;
    collision.maxZ += translation.z;
  }
}

type ApproximateTerrainProfile = {
  readonly name:
    | 'coastal-urban'
    | 'sandy-mangrove-islands'
    | 'wetland-pools-reeds'
    | 'distressed-roadside'
    | 'agricultural-soil-bands'
    | 'forest-rock-cut-relief';
  readonly groundColor: number;
  readonly waterColor: number;
  readonly accentColor: number;
  readonly accent: 'shore' | 'islands' | 'reeds' | 'road' | 'soil-bands' | 'relief';
};

const APPROXIMATE_TERRAIN_PROFILES: Readonly<Record<WalkRenderRegion, ApproximateTerrainProfile>> =
  {
    'vice-city': {
      name: 'coastal-urban',
      groundColor: 0xc9c1a4,
      waterColor: 0x3196ad,
      accentColor: 0xe1d4b2,
      accent: 'shore',
    },
    'leonida-keys': {
      name: 'sandy-mangrove-islands',
      groundColor: 0xc8b576,
      waterColor: 0x2aaab0,
      accentColor: 0x63724d,
      accent: 'islands',
    },
    grassrivers: {
      name: 'wetland-pools-reeds',
      groundColor: 0x455543,
      waterColor: 0x284f50,
      accentColor: 0x73804b,
      accent: 'reeds',
    },
    'port-gellhorn': {
      name: 'distressed-roadside',
      groundColor: 0x766350,
      waterColor: 0x287786,
      accentColor: 0x3e403b,
      accent: 'road',
    },
    ambrosia: {
      name: 'agricultural-soil-bands',
      groundColor: 0x806740,
      waterColor: 0x456d68,
      accentColor: 0xa38a50,
      accent: 'soil-bands',
    },
    'mount-kalaga': {
      name: 'forest-rock-cut-relief',
      groundColor: 0x6b5941,
      waterColor: 0x3b6971,
      accentColor: 0x665f51,
      accent: 'relief',
    },
  };

type TerrainOutline = readonly (readonly [number, number])[];

const TERRAIN_OUTLINES = {
  coastLand: [
    [-1, -0.52],
    [-0.6, -0.9],
    [0.22, -0.78],
    [1, -0.26],
    [0.8, 0.16],
    [0.48, 0.72],
    [-0.2, 0.66],
    [-0.86, 0.3],
  ],
  coastWater: [
    [-1, -0.14],
    [-0.5, -0.48],
    [0.24, -0.34],
    [1, 0.02],
    [0.64, 0.35],
    [-0.06, 0.25],
    [-0.72, 0.52],
  ],
  island: [
    [-1, -0.1],
    [-0.62, -0.72],
    [0.08, -0.92],
    [0.78, -0.5],
    [0.92, 0.12],
    [0.44, 0.76],
    [-0.32, 0.88],
    [-0.9, 0.46],
  ],
  channel: [
    [-1, -0.36],
    [-0.62, -0.56],
    [-0.4, -0.58],
    [0.08, -0.18],
    [0.58, -0.44],
    [1, 0.12],
    [0.44, 0.54],
    [-0.22, 0.28],
    [-0.76, 0.56],
  ],
  wetland: [
    [-1, -0.24],
    [-0.72, -0.82],
    [-0.12, -0.62],
    [0.44, -0.96],
    [0.94, -0.34],
    [0.72, 0.48],
    [0.14, 0.84],
    [-0.58, 0.62],
  ],
  roadside: [
    [-1, -0.3],
    [-0.54, -0.62],
    [0.82, -0.42],
    [1, 0.18],
    [0.38, 0.48],
    [-0.7, 0.6],
  ],
  harbour: [
    [-1, -0.42],
    [-0.32, -0.7],
    [0.48, -0.46],
    [1, 0.12],
    [0.38, 0.5],
    [-0.18, 0.42],
    [-0.72, 0.02],
  ],
  field: [
    [-1, -0.46],
    [-0.46, -0.74],
    [0.64, -0.58],
    [1, -0.04],
    [0.7, 0.58],
    [-0.2, 0.76],
    [-0.88, 0.32],
  ],
  lake: [
    [-1, -0.2],
    [-0.62, -0.68],
    [0.12, -0.78],
    [0.86, -0.32],
    [0.72, 0.36],
    [0.34, 0.68],
    [-0.26, 0.7],
    [-0.72, 0.5],
  ],
  forest: [
    [-1, -0.28],
    [-0.7, -0.88],
    [-0.04, -0.7],
    [0.58, -0.98],
    [1, -0.28],
    [0.74, 0.52],
    [0.16, 0.84],
    [-0.54, 0.66],
  ],
  stream: [
    [-1, -0.18],
    [-0.48, -0.44],
    [0.06, -0.16],
    [0.54, -0.36],
    [1, 0.14],
    [0.62, 0.3],
    [0.38, 0.34],
    [-0.24, 0.16],
    [-0.76, 0.42],
  ],
  rockCut: [
    [-1, -0.54],
    [-0.34, -0.96],
    [0.3, -0.72],
    [0.92, -0.16],
    [0.64, 0.68],
    [-0.1, 0.9],
    [-0.78, 0.42],
  ],
  shoreStrip: [
    [-1, -0.1],
    [-0.42, -0.32],
    [0.42, -0.24],
    [1, 0.08],
    [0.42, 0.28],
    [-0.44, 0.18],
  ],
} as const satisfies Readonly<Record<string, TerrainOutline>>;

function createTerrainShapeGeometry(outline: TerrainOutline): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  const [start, ...remaining] = outline;
  if (!start) throw new Error('Terrain outline requires at least one point.');
  shape.moveTo(start[0], start[1]);
  for (const point of remaining) shape.lineTo(point[0], point[1]);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function addApproximateTerrainMesh(
  terrain: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: WalkPoint,
  scale: readonly [number, number],
  y: number,
  heightScale = 1,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(position.x, y, position.z);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(scale[0], scale[1], heightScale);
  mesh.receiveShadow = true;
  mesh.userData.evidence = 'APPROXIMATE';
  terrain.add(mesh);
  return mesh;
}

function createTerrainLayer(terrain: THREE.Group, name: string): THREE.Group {
  const layer = new THREE.Group();
  layer.name = name;
  layer.userData.evidence = 'APPROXIMATE';
  terrain.add(layer);
  return layer;
}

function getTerrainCentre(anchors: readonly WalkPoint[]): WalkPoint {
  const total = anchors.reduce((sum, anchor) => ({ x: sum.x + anchor.x, z: sum.z + anchor.z }), {
    x: 0,
    z: 0,
  });
  return { x: total.x / anchors.length, z: total.z / anchors.length };
}

function getRegionalScale(
  anchors: readonly WalkPoint[],
  minimum: readonly [number, number],
): readonly [number, number] {
  const xs = anchors.map((anchor) => anchor.x);
  const zs = anchors.map((anchor) => anchor.z);
  return [
    Math.max(minimum[0], (Math.max(...xs) - Math.min(...xs)) * 0.62),
    Math.max(minimum[1], (Math.max(...zs) - Math.min(...zs)) * 0.62),
  ];
}

function getIslandScale(anchors: readonly WalkPoint[], index: number): readonly [number, number] {
  const anchor = anchors[index]!;
  const nearest = Math.min(
    ...anchors
      .filter((_, candidateIndex) => candidateIndex !== index)
      .map((candidate) => Math.hypot(anchor.x - candidate.x, anchor.z - candidate.z)),
  );
  const radius = Math.max(55, Math.min(360, nearest * 0.27));
  return [radius, radius * 0.72];
}

function addApproximateTerrainInstances(
  terrain: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: readonly THREE.Matrix4[],
): void {
  const instances = new THREE.InstancedMesh(geometry, material, transforms.length);
  instances.name = name;
  transforms.forEach((matrix, index) => instances.setMatrixAt(index, matrix));
  instances.instanceMatrix.needsUpdate = true;
  instances.userData.evidence = 'APPROXIMATE';
  terrain.add(instances);
}

function addPlanarTerrainInstances(
  layer: THREE.Group,
  region: WalkRenderRegion,
  accent: ApproximateTerrainProfile['accent'],
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  placements: readonly {
    readonly position: WalkPoint;
    readonly size: readonly [number, number];
    readonly rotation: number;
  }[],
): number {
  const matrices = placements.map(({ position, size, rotation }) => {
    const quaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      rotation,
    );
    quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
    );
    return new THREE.Matrix4().compose(
      new THREE.Vector3(position.x, REGIONAL_ACCENT_Y, position.z),
      quaternion,
      new THREE.Vector3(size[0], size[1], 1),
    );
  });
  addApproximateTerrainInstances(
    layer,
    `${region}-approximate-infill-${accent}`,
    geometry,
    material,
    matrices,
  );
  return placements.length;
}

function addApproximateGround(
  root: THREE.Group,
  region: WalkRenderRegion,
  coarsePointer: boolean,
): void {
  const preset = WALK_REGION_ENVIRONMENT_PRESETS[region];
  const profile = APPROXIMATE_TERRAIN_PROFILES[region];
  const anchors = REGION_GROUND_ANCHORS[region];
  const terrain = new THREE.Group();
  terrain.name = `${region}-approximate-terrain`;
  terrain.userData.evidence = preset.groundEvidence;
  terrain.userData.terrainProfile = profile.name;
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: profile.groundColor,
    roughness: 0.96,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: profile.waterColor,
    roughness: 0.24,
    metalness: 0.04,
    transparent: true,
    opacity: 0.84,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: profile.accentColor,
    roughness: 0.86,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const land = createTerrainLayer(terrain, `${region}-approximate-land`);
  const water = createTerrainLayer(terrain, `${region}-approximate-water`);
  const centre = getTerrainCentre(anchors);
  const detailLimit = coarsePointer ? 4 : 8;
  let detailCount = 0;

  const addLand = (
    geometry: THREE.BufferGeometry,
    position: WalkPoint,
    scale: readonly [number, number],
    name = `${region}-approximate-land-surface`,
    heightScale = 1,
  ) => {
    addApproximateTerrainMesh(
      land,
      name,
      geometry,
      groundMaterial,
      position,
      scale,
      region === 'leonida-keys' ? KEYS_ISLAND_Y : REGIONAL_GROUND_Y,
      heightScale,
    );
    detailCount += 1;
  };
  const addWater = (
    geometry: THREE.BufferGeometry,
    position: WalkPoint,
    scale: readonly [number, number],
    name = `${region}-approximate-water-surface`,
  ) => {
    addApproximateTerrainMesh(
      water,
      name,
      geometry,
      waterMaterial,
      position,
      scale,
      REGIONAL_WATER_Y,
    );
    detailCount += 1;
  };

  switch (region) {
    case 'vice-city': {
      const scale = getRegionalScale(anchors, [780, 560]);
      addLand(createTerrainShapeGeometry(TERRAIN_OUTLINES.coastLand), centre, scale);
      addWater(
        createTerrainShapeGeometry(TERRAIN_OUTLINES.coastWater),
        { x: centre.x + scale[0] * 0.52, z: centre.z + scale[1] * 0.1 },
        [scale[0] * 0.56, scale[1] * 0.88],
      );
      detailCount += addPlanarTerrainInstances(
        land,
        region,
        profile.accent,
        createTerrainShapeGeometry(TERRAIN_OUTLINES.shoreStrip),
        accentMaterial,
        anchors
          .slice(0, coarsePointer ? Math.max(2, Math.ceil(anchors.length / 2)) : detailLimit)
          .map((anchor, index) => ({
            position: anchor,
            size: [150, 32] as const,
            rotation: index * 0.3,
          })),
      );
      break;
    }
    case 'leonida-keys': {
      addWater(
        createTerrainShapeGeometry(TERRAIN_OUTLINES.channel),
        centre,
        getRegionalScale(anchors, [1_000, 760]),
      );
      const islandGeometry = createTerrainShapeGeometry(TERRAIN_OUTLINES.island);
      const islandCount = coarsePointer ? 3 : anchors.length;
      for (let index = 0; index < islandCount; index += 1) {
        addLand(
          islandGeometry,
          anchors[index]!,
          getIslandScale(anchors, index),
          index === 0
            ? `${region}-approximate-land-surface`
            : `${region}-approximate-land-island-${index}`,
        );
      }
      detailCount += addPlanarTerrainInstances(
        land,
        region,
        profile.accent,
        new THREE.CircleGeometry(1, 10),
        accentMaterial,
        anchors.slice(0, detailLimit).map((anchor, index) => ({
          position: { x: anchor.x + 35, z: anchor.z - 25 },
          size: [42, 34] as const,
          rotation: index * 0.4,
        })),
      );
      break;
    }
    case 'grassrivers': {
      addLand(
        createTerrainShapeGeometry(TERRAIN_OUTLINES.wetland),
        centre,
        getRegionalScale(anchors, [760, 620]),
      );
      const poolGeometry = new THREE.CircleGeometry(1, coarsePointer ? 9 : 14);
      const poolCount = coarsePointer ? 2 : anchors.length;
      for (let index = 0; index < poolCount; index += 1) {
        const anchor = anchors[index]!;
        addWater(
          poolGeometry,
          { x: anchor.x + 95, z: anchor.z - 70 },
          [Math.min(210, getIslandScale(anchors, index)[0]), 105],
          index === 0
            ? `${region}-approximate-water-surface`
            : `${region}-approximate-water-pool-${index}`,
        );
      }
      const reedGeometry = new THREE.CylinderGeometry(0.42, 0.72, 1, coarsePointer ? 5 : 7);
      const reeds = anchors.slice(0, detailLimit).map((anchor, index) => {
        const matrix = new THREE.Matrix4();
        matrix.compose(
          new THREE.Vector3(anchor.x + (index % 2) * 42, 2.4, anchor.z - (index % 3) * 35),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), index * 0.45),
          new THREE.Vector3(2.8, 4.8, 2.8),
        );
        return matrix;
      });
      addApproximateTerrainInstances(
        land,
        `${region}-approximate-infill-reeds`,
        reedGeometry,
        accentMaterial,
        reeds,
      );
      detailCount += reeds.length;
      break;
    }
    case 'port-gellhorn': {
      const scale = getRegionalScale(anchors, [680, 260]);
      addLand(createTerrainShapeGeometry(TERRAIN_OUTLINES.roadside), centre, scale);
      addWater(createTerrainShapeGeometry(TERRAIN_OUTLINES.harbour), anchors[1]!, [
        Math.min(260, scale[0] * 0.28),
        150,
      ]);
      detailCount += addPlanarTerrainInstances(
        land,
        region,
        profile.accent,
        new THREE.PlaneGeometry(1, 1),
        accentMaterial,
        anchors
          .slice(0, coarsePointer ? Math.max(2, Math.ceil(anchors.length / 2)) : detailLimit)
          .map((anchor) => ({
            position: anchor,
            size: [180, 26] as const,
            rotation: 0,
          })),
      );
      break;
    }
    case 'ambrosia': {
      const scale = getRegionalScale(anchors, [760, 420]);
      addLand(createTerrainShapeGeometry(TERRAIN_OUTLINES.field), centre, scale);
      detailCount += addPlanarTerrainInstances(
        land,
        region,
        profile.accent,
        new THREE.PlaneGeometry(1, 1),
        accentMaterial,
        Array.from({ length: coarsePointer ? 4 : 8 }, (_, index) => ({
          position: { x: centre.x + (index - 3.5) * 95, z: centre.z + (index % 2 ? 65 : -65) },
          size: [72, 260] as const,
          rotation: 0,
        })),
      );
      break;
    }
    case 'mount-kalaga': {
      const scale = getRegionalScale(anchors, [860, 720]);
      addLand(createTerrainShapeGeometry(TERRAIN_OUTLINES.forest), centre, scale);
      addWater(createTerrainShapeGeometry(TERRAIN_OUTLINES.stream), anchors[2]!, [280, 85]);
      const reliefGeometry = new THREE.ExtrudeGeometry(
        new THREE.Shape(TERRAIN_OUTLINES.rockCut.map(([x, y]) => new THREE.Vector2(x, y))),
        { depth: 0.38, bevelEnabled: false },
      );
      const reliefCount = coarsePointer ? 2 : 4;
      for (let index = 0; index < reliefCount; index += 1) {
        const anchor = anchors[(index + 1) % anchors.length]!;
        const relief = addApproximateTerrainMesh(
          land,
          index === 0 ? `${region}-approximate-relief` : `${region}-approximate-relief-${index}`,
          reliefGeometry,
          accentMaterial,
          { x: anchor.x + (index - 1) * 120, z: anchor.z + (index % 2 ? 95 : -95) },
          [210 + index * 30, 160 + index * 24],
          4,
          360 + index * 45,
        );
        relief.rotation.z = index * 0.22;
        detailCount += 1;
      }
      break;
    }
  }
  terrain.userData.detailCount = detailCount;
  root.add(terrain);
}

type TrackedRegionResource = THREE.BufferGeometry | THREE.Material | THREE.Texture;

interface ObjectTreeResources {
  readonly geometries: ReadonlySet<THREE.BufferGeometry>;
  readonly materials: ReadonlySet<THREE.Material>;
  readonly textures: ReadonlySet<THREE.Texture>;
  readonly instances: ReadonlySet<THREE.InstancedMesh>;
}

const regionResourceOwnerCounts = new WeakMap<TrackedRegionResource, number>();

function acquireObjectTreeResources(root: THREE.Object3D): ObjectTreeResources {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const instances = new Set<THREE.InstancedMesh>();
  root.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) instances.add(object);
    const renderable = object as THREE.Mesh;
    if (renderable.geometry) geometries.add(renderable.geometry);
    const objectMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [];
    for (const material of objectMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  for (const resource of [...geometries, ...materials, ...textures]) {
    regionResourceOwnerCounts.set(resource, (regionResourceOwnerCounts.get(resource) ?? 0) + 1);
  }

  return { geometries, materials, textures, instances };
}

function releaseResource(resource: TrackedRegionResource): void {
  const ownerCount = regionResourceOwnerCounts.get(resource);
  if (ownerCount === undefined) return;
  if (ownerCount > 1) {
    regionResourceOwnerCounts.set(resource, ownerCount - 1);
    return;
  }
  regionResourceOwnerCounts.delete(resource);
  resource.dispose();
}

function disposeObjectTree(root: THREE.Object3D, resources: ObjectTreeResources): void {
  for (const instance of resources.instances) instance.dispose();
  for (const texture of resources.textures) releaseResource(texture);
  for (const material of resources.materials) releaseResource(material);
  for (const geometry of resources.geometries) releaseResource(geometry);
  root.removeFromParent();
}

export function buildWalkRegion(
  region: WalkRenderRegion,
  options: WalkRegionBuilderOptions,
): WalkRegionResource {
  const root = new THREE.Group();
  root.name = `walk-region-${region}`;
  root.userData.region = region;
  root.userData.lazy = true;
  root.userData.anchor = WALK_REGION_ENVIRONMENT_PRESETS[region].groundEvidence;
  root.userData.environment = WALK_REGION_ENVIRONMENT_PRESETS[region];
  const collisions: AxisAlignedRectangle[] = [];
  const updates: Array<(elapsedSeconds: number) => void> = [];
  const staging = new THREE.Scene();

  addApproximateGround(root, region, options.coarsePointer);
  addPhotorealWalkVegetation(staging, options.renderer, options.coarsePointer, {
    regions: [region],
  });

  if (region === 'vice-city') {
    const district = createViceCityDistrict(staging, collisions, options.coarsePointer, {
      renderCatalanBoulevard: false,
    });
    updates.push(district.update);
  } else if (region === 'ambrosia') {
    const district = createAmbrosiaDistrict(staging, collisions, options.coarsePointer);
    const translation = {
      x: AMBROSIA_WORLD.town.x - AMBROSIA_AUTHORING_ANCHOR.x,
      z: AMBROSIA_WORLD.town.z - AMBROSIA_AUTHORING_ANCHOR.z,
    };
    district.root.position.set(translation.x, 0, translation.z);
    translateCollisions(collisions, translation);
    updates.push(district.update);
  } else {
    // Grassrivers' reviewed foreground supersedes the older demo camp and bright
    // water ribbons. Keeping both stacked produced a fourth outpost and a Keys-
    // like turquoise channel through the otherwise tannic wetland.
    if (region !== 'grassrivers') {
      addScreenshotGroundedLandmarks(staging, collisions, options.coarsePointer, {
        viceCity: false,
        ambrosia: false,
        regions: [region],
      });
      addHighFidelityWalkArchitecture(staging, collisions, options.coarsePointer, {
        viceCity: false,
        ambrosia: false,
        regions: [region],
      });
    }
  }

  addRegionalArrivalForeground(
    staging,
    collisions,
    region,
    options.coarsePointer,
    options.renderer,
  );

  moveChildren(staging, root);
  const featureIds: string[] = [];
  root.traverse((object) => {
    if (object.name && object.userData.feature === true) featureIds.push(object.name);
  });
  const resources = acquireObjectTreeResources(root);

  let disposed = false;
  return {
    region,
    root,
    collisions,
    featureIds,
    update(elapsedSeconds) {
      if (disposed) return;
      for (const update of updates) update(elapsedSeconds);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeObjectTree(root, resources);
    },
  };
}

export function getWalkRegionPrimaryAnchor(region: WalkRenderRegion): WalkPoint {
  switch (region) {
    case 'mount-kalaga':
      return REGION_WORLD.mountKalaga;
    case 'port-gellhorn':
      return REGION_WORLD.portGellhorn;
    case 'leonida-keys':
      return REGION_WORLD.leonidaKeys;
    case 'vice-city':
      return REGION_WORLD.viceCity;
    case 'ambrosia':
      return REGION_WORLD.ambrosia;
    case 'grassrivers':
      return REGION_WORLD.grassrivers;
  }
}
