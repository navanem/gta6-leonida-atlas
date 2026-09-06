import { publicPath } from '../explorer/public-path';
import * as THREE from 'three';
import { createNativeVegetation } from './walk-native-vegetation';
import { createPedestrianLibrary } from './walk-pedestrians';
import { installWalkWaterSurface } from './walk-water-surface';
import { createCanyonRelief } from './walk-canyon-relief';
import { addArrivalArchitecture } from './walk-arrival-architecture';
import { applyArrivalPhotographicSurfaces } from './walk-arrival-surfaces';
import { addRegionalScenery } from './walk-regional-scenery';
import { createFacadeShellKit, type FacadeShellSpec } from './walk-facade-shell';

import { gtadbToWorld } from './leonida-coordinates';
import { REVIEWED_GTADB_ANCHORS, type ReviewedGtadbAnchorId } from './leonida-evidence';
import type { AxisAlignedRectangle } from './walk-engine';
import { PLACE_ENTRY_VIEWS } from './walk-geography';
import type { WalkRenderRegion } from './walk-region-streaming';
import { WALK_ROCKSTAR_REFERENCE_PROFILES } from './walk-rockstar-reference';
import {
  createRoadVehicle,
  createRoadVehicleBatch,
  createRoadVehicleMaterial,
  type RoadVehicleType,
} from './walk-vehicles';

type DetailedArrivalRegion = WalkRenderRegion;
const facadeCleanup = new WeakMap<THREE.Group, () => void>();
type Vec3 = readonly [number, number, number];

interface Transform {
  readonly position: Vec3;
  readonly scale: Vec3;
  readonly rotation?: Vec3;
  readonly color?: number;
}

interface ArrivalGeometry {
  readonly coarsePointer: boolean;
  readonly box: THREE.BoxGeometry;
  readonly cylinder: THREE.CylinderGeometry;
  readonly cone: THREE.ConeGeometry;
  readonly sphere: THREE.SphereGeometry;
  readonly torus: THREE.TorusGeometry;
  readonly rock: THREE.DodecahedronGeometry;
  readonly plane: THREE.PlaneGeometry;
  readonly context: THREE.ShapeGeometry;
  readonly crossedVegetation: THREE.BufferGeometry;
}

interface ArrivalMaterials {
  readonly asphalt: THREE.MeshStandardMaterial;
  readonly wornAsphalt: THREE.MeshStandardMaterial;
  readonly whiteLine: THREE.MeshStandardMaterial;
  readonly yellowLine: THREE.MeshStandardMaterial;
  readonly concrete: THREE.MeshStandardMaterial;
  readonly paleConcrete: THREE.MeshStandardMaterial;
  readonly weatheredConcrete: THREE.MeshStandardMaterial;
  readonly glass: THREE.MeshPhysicalMaterial;
  readonly warmGlass: THREE.MeshStandardMaterial;
  readonly steel: THREE.MeshStandardMaterial;
  readonly galvanized: THREE.MeshStandardMaterial;
  readonly rust: THREE.MeshStandardMaterial;
  readonly timber: THREE.MeshStandardMaterial;
  readonly darkTimber: THREE.MeshStandardMaterial;
  readonly cream: THREE.MeshStandardMaterial;
  readonly coral: THREE.MeshStandardMaterial;
  readonly aqua: THREE.MeshStandardMaterial;
  readonly industrial: THREE.MeshStandardMaterial;
  readonly dark: THREE.MeshStandardMaterial;
  readonly sand: THREE.MeshStandardMaterial;
  readonly marsh: THREE.MeshStandardMaterial;
  readonly water: THREE.MeshPhysicalMaterial;
  readonly bark: THREE.MeshStandardMaterial;
  readonly foliage: THREE.MeshStandardMaterial;
  readonly reed: THREE.MeshStandardMaterial;
  readonly cane: THREE.MeshStandardMaterial;
  readonly sandstone: THREE.MeshStandardMaterial;
  readonly darkRock: THREE.MeshStandardMaterial;
  readonly magenta: THREE.MeshStandardMaterial;
  readonly cyan: THREE.MeshStandardMaterial;
  readonly amber: THREE.MeshStandardMaterial;
}

export const REGIONAL_ARRIVAL_FEATURE_IDS: Readonly<Record<DetailedArrivalRegion, string>> = {
  'vice-city': 'vice-city-arrival-urban-boulevard',
  'leonida-keys': 'leonida-keys-arrival-causeway',
  grassrivers: 'grassrivers-arrival-wetland-road',
  'port-gellhorn': 'port-gellhorn-arrival-commercial-strip',
  ambrosia: 'ambrosia-arrival-industrial-road',
  'mount-kalaga': 'mount-kalaga-arrival-park-road',
};

const PLACE_SLUGS: Readonly<Record<DetailedArrivalRegion, string>> = {
  'vice-city': 'vice-city',
  'leonida-keys': 'leonida-keys',
  grassrivers: 'grassrivers',
  'port-gellhorn': 'port-gellhorn',
  ambrosia: 'ambrosia',
  'mount-kalaga': 'mount-kalaga-national-park',
};

const ASPHALT_ASSET = publicPath('assets/street-leonida/textures/sunworn-asphalt.jpg');
const GRASS_ASSET = publicPath('assets/street-leonida/textures/subtropical-grass.jpg');
const REGION_FACADE_ATLAS_ASSET = publicPath(
  'assets/street-leonida/facades/reference-led-facade-atlas.png',
);
const REGION_SURFACE_ATLAS_ASSET = publicPath(
  'assets/street-leonida/textures/reference-led-surface-atlas.png',
);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const MOUNT_ROAD_START_Z = 28;
const MOUNT_ROAD_END_Z = -252;
const PHOTO_VEGETATION_ASSETS = {
  palm: publicPath('assets/street-leonida/vegetation/royal-palm.webp'),
  cypress: publicPath('assets/street-leonida/vegetation/swamp-cypress.webp'),
  pine: publicPath('assets/street-leonida/vegetation/southern-pine.webp'),
  sugarcane: publicPath('assets/street-leonida/vegetation/ambrosia-sugarcane.webp'),
} as const;

function mountRoadPointAt(index: number, segmentCount: number): { x: number; z: number } {
  const progress = index / segmentCount;
  return {
    x: Math.sin(progress * Math.PI * 2) * 5.7 + Math.sin(progress * Math.PI * 4) * 1.35,
    z: MOUNT_ROAD_START_Z + (MOUNT_ROAD_END_Z - MOUNT_ROAD_START_Z) * progress,
  };
}

function createNoiseTexture(seed: number, variation: number): THREE.DataTexture {
  const size = 48;
  const data = new Uint8Array(size * size * 4);
  let state = seed >>> 0;
  const random = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const broad = Math.sin(x * 0.43 + y * 0.21) * variation * 0.18;
      const value = THREE.MathUtils.clamp(
        Math.round(216 + (random() - 0.5) * variation + broad),
        118,
        255,
      );
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 11);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function standard(
  color: number,
  roughness: number,
  metalness = 0,
  map?: THREE.Texture,
  emissive = 0x000000,
  emissiveIntensity = 0,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...(map ? { map } : {}),
    emissive,
    emissiveIntensity,
  });
}

function createGeometry(coarsePointer: boolean): ArrivalGeometry {
  return {
    coarsePointer,
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, coarsePointer ? 8 : 16),
    cone: new THREE.ConeGeometry(0.5, 1, coarsePointer ? 8 : 14),
    sphere: new THREE.SphereGeometry(0.5, coarsePointer ? 8 : 14, coarsePointer ? 6 : 10),
    torus: new THREE.TorusGeometry(0.5, 0.08, coarsePointer ? 6 : 10, coarsePointer ? 16 : 28),
    rock: new THREE.DodecahedronGeometry(0.5, coarsePointer ? 0 : 1),
    plane: new THREE.PlaneGeometry(1, 1),
    context: createArrivalContextGeometry(),
    crossedVegetation: createCrossedVegetationGeometry(),
  };
}

function createArrivalContextGeometry(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.94, -0.78);
  shape.bezierCurveTo(-1.03, -0.22, -0.88, 0.48, -0.53, 0.91);
  shape.bezierCurveTo(-0.08, 1.03, 0.5, 0.92, 0.86, 0.61);
  shape.bezierCurveTo(1.04, 0.12, 0.98, -0.46, 0.62, -0.9);
  shape.bezierCurveTo(0.14, -1.03, -0.47, -1.01, -0.94, -0.78);
  return new THREE.ShapeGeometry(shape, 10);
}

function createCrossedVegetationGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const halfWidth = (768 / 1152) * 0.5;
  for (let plane = 0; plane < 3; plane += 1) {
    const angle = (plane / 3) * Math.PI;
    const x = Math.cos(angle) * halfWidth;
    const z = Math.sin(angle) * halfWidth;
    const normalX = -Math.sin(angle);
    const normalZ = Math.cos(angle);
    const base = plane * 4;
    positions.push(-x, 0, -z, x, 0, z, x, 1, z, -x, 1, -z);
    for (let vertex = 0; vertex < 4; vertex += 1) normals.push(normalX, 0, normalZ);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.name = 'street-leonida/arrival-crossed-photo-vegetation';
  return geometry;
}

function loadTexture(
  asset: string,
  renderer: THREE.WebGLRenderer,
  repeat: readonly [number, number] = [1, 1],
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(asset);
  texture.name = asset;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(16, Math.max(1, renderer.capabilities.getMaxAnisotropy()));
  return texture;
}

function createSignMaterial(
  name: string,
  title: string,
  subtitle: string,
  background: number,
  accent: number,
): THREE.MeshStandardMaterial {
  let texture: THREE.Texture | null = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 320;
    const context = canvas.getContext('2d');
    if (context) {
      const cssColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
      context.fillStyle = cssColor(background);
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = cssColor(accent);
      context.lineWidth = 16;
      context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
      context.fillStyle = cssColor(accent);
      context.fillRect(52, 54, 14, 212);
      context.fillStyle = '#f4efe5';
      context.font = '700 104px Oswald, Arial Narrow, sans-serif';
      context.textBaseline = 'middle';
      context.fillText(title, 104, 135);
      context.fillStyle = cssColor(accent);
      context.font = '600 34px Inter, Arial, sans-serif';
      context.letterSpacing = '3px';
      context.fillText(subtitle, 108, 230);
      texture = new THREE.CanvasTexture(canvas);
    }
  }
  if (!texture) {
    const red = (background >> 16) & 255;
    const green = (background >> 8) & 255;
    const blue = background & 255;
    texture = new THREE.DataTexture(
      new Uint8Array([red, green, blue, 255]),
      1,
      1,
      THREE.RGBAFormat,
    );
  }
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    emissive: accent,
    emissiveIntensity: 0.12,
    roughness: 0.52,
    metalness: 0.08,
  });
}

function createAtlasMaterial(
  renderer: THREE.WebGLRenderer,
  column: 0 | 1 | 2,
  row: 0 | 1,
  emissive = 0x000000,
  emissiveIntensity = 0,
): THREE.MeshStandardMaterial {
  const texture = loadTexture(REGION_FACADE_ATLAS_ASSET, renderer);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1 / 3, 1 / 2);
  texture.offset.set(column / 3, row === 0 ? 1 / 2 : 0);
  texture.name = `${REGION_FACADE_ATLAS_ASSET}#${column},${row}`;
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.035,
    emissive,
    emissiveIntensity,
    side: THREE.DoubleSide,
  });
}

function createSurfaceAtlasMaterial(
  renderer: THREE.WebGLRenderer,
  column: 0 | 1,
  row: 0 | 1,
  options: {
    readonly color?: number;
    readonly roughness?: number;
    readonly metalness?: number;
    readonly opacity?: number;
  } = {},
): THREE.MeshStandardMaterial {
  const texture = loadTexture(REGION_SURFACE_ATLAS_ASSET, renderer);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1 / 2, 1 / 2);
  texture.offset.set(column / 2, row === 0 ? 1 / 2 : 0);
  texture.name = `${REGION_SURFACE_ATLAS_ASSET}#${column},${row}`;
  const opacity = options.opacity ?? 1;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: options.color ?? 0xffffff,
    roughness: options.roughness ?? 0.9,
    metalness: options.metalness ?? 0,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
  });
  material.name = `street-leonida/surface/${column}-${row}`;
  return material;
}

function createMaterials(renderer: THREE.WebGLRenderer): ArrivalMaterials {
  const asphalt = loadTexture(ASPHALT_ASSET, renderer, [2.5, 24]);
  const grass = loadTexture(GRASS_ASSET, renderer, [8, 18]);
  const concrete = createNoiseTexture(214_907, 31);
  const timber = createNoiseTexture(990_421, 42);
  return {
    asphalt: standard(0x53585a, 0.86, 0.018, asphalt),
    wornAsphalt: standard(0x625b54, 0.93, 0.006, asphalt),
    whiteLine: standard(0xf1eee2, 0.72),
    yellowLine: standard(0xf0bc42, 0.7),
    concrete: standard(0xa8a49a, 0.92, 0, concrete),
    paleConcrete: standard(0xd6d1c6, 0.84, 0, concrete),
    weatheredConcrete: standard(0x77756e, 0.98, 0, concrete),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x174150,
      roughness: 0.12,
      metalness: 0.3,
      clearcoat: 0.82,
      clearcoatRoughness: 0.16,
      transparent: true,
      opacity: 0.9,
    }),
    warmGlass: standard(0xba7240, 0.22, 0.12, undefined, 0x6d3212, 0.72),
    steel: standard(0x3d4850, 0.42, 0.72),
    galvanized: standard(0x9aa4a5, 0.52, 0.55),
    rust: standard(0x8a4932, 0.9, 0.18),
    timber: standard(0x805c3d, 0.94, 0, timber),
    darkTimber: standard(0x3e3026, 0.97, 0, timber),
    cream: standard(0xd8cdb5, 0.86, 0, concrete),
    coral: standard(0xc47d70, 0.84, 0, concrete),
    aqua: standard(0x5caaa7, 0.8, 0, concrete),
    industrial: standard(0xc59a32, 0.72, 0.14),
    dark: standard(0x23282d, 0.86, 0.08),
    sand: standard(0xcdb77d, 0.98),
    marsh: standard(0x69835b, 1, 0, grass),
    water: new THREE.MeshPhysicalMaterial({
      color: 0x14839a,
      roughness: 0.16,
      metalness: 0.08,
      clearcoat: 0.84,
      clearcoatRoughness: 0.12,
      reflectivity: 0.9,
      transparent: true,
      opacity: 0.88,
    }),
    bark: standard(0x684733, 0.98),
    foliage: standard(0x22623e, 0.93),
    reed: standard(0x647944, 0.98),
    cane: standard(0x819342, 0.96),
    sandstone: standard(0x9c6547, 1),
    darkRock: standard(0x4b4c45, 1),
    magenta: standard(0xff4caa, 0.25, 0.1, undefined, 0xc61a72, 2.15),
    cyan: standard(0x5debf0, 0.23, 0.12, undefined, 0x17adbd, 2.1),
    amber: standard(0xffc370, 0.27, 0.08, undefined, 0xe56d18, 1.85),
  };
}

function addPhotoVegetation(
  feature: THREE.Group,
  geometry: ArrivalGeometry,
  renderer: THREE.WebGLRenderer,
  asset: string,
  positions: readonly (readonly [number, number, number])[],
  name: string,
): void {
  const near = positions.filter(([x, z]) => Math.abs(x) < 80 && z > -110);
  const far = positions.filter(([x, z]) => Math.abs(x) >= 80 || z <= -110);
  const kind = asset.includes('cypress')
    ? 'cypress'
    : asset.includes('pine')
      ? 'pine'
      : asset.includes('sugarcane')
        ? 'cane'
        : 'palm';
  const native = createNativeVegetation(kind, near, geometry.coarsePointer ? 'mid' : 'near');
  native.name = `${name}-native`;
  feature.add(native);
  if (!far.length) return;
  const texture = loadTexture(asset, renderer);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    color: 0xf1eee4,
    alphaTest: 0.48,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    fog: true,
  });
  material.alphaToCoverage = true;
  material.dithering = true;
  const vegetation = addInstances(
    feature,
    geometry.crossedVegetation,
    material,
    far.map(([x, z, height], index) => ({
      position: [x, 0, z],
      scale: [height, height, height],
      rotation: [0, index * 0.73, 0],
    })),
    name,
    true,
  );
  vegetation.userData.photoAsset = asset;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3,
  scale: Vec3,
  rotation: Vec3 = [0, 0, 0],
  name?: string,
  shadows = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function addBeam(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  start: Vec3,
  end: Vec3,
  diameter: number,
  name?: string,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const beam = new THREE.Mesh(geometry, material);
  beam.position.addVectors(from, to).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(Y_AXIS, direction.clone().normalize());
  beam.scale.set(diameter, direction.length(), diameter);
  beam.castShadow = true;
  beam.receiveShadow = true;
  if (name) beam.name = name;
  parent.add(beam);
  return beam;
}

function addUtilityGrid(
  parent: THREE.Object3D,
  geometry: ArrivalGeometry,
  materials: ArrivalMaterials,
  x: number,
  zPositions: readonly number[],
  name: string,
): THREE.Group {
  const grid = new THREE.Group();
  grid.name = name;
  parent.add(grid);
  addInstances(
    grid,
    geometry.cylinder,
    materials.darkTimber,
    zPositions.map((z) => ({
      position: [x, 4.8, z],
      scale: [0.24, 9.6, 0.24],
    })),
    `${name}-poles`,
  );
  addInstances(
    grid,
    geometry.box,
    materials.darkTimber,
    zPositions.map((z) => ({
      position: [x, 8.45, z],
      scale: [4.8, 0.18, 0.18],
    })),
    `${name}-crossarms`,
  );
  for (let index = 0; index < zPositions.length - 1; index += 1) {
    const startZ = zPositions[index]!;
    const endZ = zPositions[index + 1]!;
    for (const [lineIndex, xOffset] of [-1.75, 0, 1.75].entries()) {
      const middleZ = (startZ + endZ) / 2;
      const y = 8.42 - (lineIndex % 2) * 0.12;
      addBeam(
        grid,
        geometry.cylinder,
        materials.dark,
        [x + xOffset, y, startZ],
        [x + xOffset, y - 0.45, middleZ],
        0.035,
      );
      addBeam(
        grid,
        geometry.cylinder,
        materials.dark,
        [x + xOffset, y - 0.45, middleZ],
        [x + xOffset, y, endZ],
        0.035,
      );
    }
  }
  return grid;
}

function addSmallBoat(
  parent: THREE.Object3D,
  geometry: ArrivalGeometry,
  materials: ArrivalMaterials,
  position: Vec3,
  rotationY: number,
  name?: string,
  cabin = false,
): THREE.Group {
  const boat = new THREE.Group();
  if (name) boat.name = name;
  boat.position.set(...position);
  boat.rotation.y = rotationY;
  parent.add(boat);
  addMesh(boat, geometry.box, materials.paleConcrete, [0, 0.24, 0], [2.4, 0.42, 6.4], [0.04, 0, 0]);
  addMesh(boat, geometry.box, materials.aqua, [0, 0.47, 0.2], [1.9, 0.28, 5.2]);
  if (cabin) {
    addMesh(boat, geometry.box, materials.glass, [0, 1.2, -0.45], [1.65, 1.3, 2.2]);
    addMesh(boat, geometry.box, materials.paleConcrete, [0, 1.95, -0.45], [2.1, 0.18, 2.8]);
  }
  addMesh(
    boat,
    geometry.cylinder,
    materials.steel,
    [0, cabin ? 3.2 : 2.25, -0.3],
    [0.08, cabin ? 2.6 : 3.8, 0.08],
  );
  return boat;
}

function addInstances(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: readonly Transform[],
  name: string,
  shadows = true,
): THREE.InstancedMesh {
  const instances = new THREE.InstancedMesh(geometry, material, transforms.length);
  const dummy = new THREE.Object3D();
  const usesInstanceColors = transforms.some((transform) => transform.color !== undefined);
  transforms.forEach((transform, index) => {
    dummy.position.set(...transform.position);
    dummy.scale.set(...transform.scale);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.updateMatrix();
    instances.setMatrixAt(index, dummy.matrix);
    if (usesInstanceColors) {
      instances.setColorAt(index, new THREE.Color(transform.color ?? 0xffffff));
    }
  });
  instances.instanceMatrix.needsUpdate = true;
  if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
  instances.castShadow = shadows;
  instances.receiveShadow = true;
  instances.name = name;
  parent.add(instances);
  return instances;
}

function addCollision(
  collisions: AxisAlignedRectangle[],
  anchor: { x: number; z: number },
  yaw: number,
  localX: number,
  localZ: number,
  width: number,
  depth: number,
): void {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  const worldX = anchor.x + localX * cosine + localZ * sine;
  const worldZ = anchor.z - localX * sine + localZ * cosine;
  const halfX = (Math.abs(cosine) * width + Math.abs(sine) * depth) / 2;
  const halfZ = (Math.abs(sine) * width + Math.abs(cosine) * depth) / 2;
  collisions.push({
    minX: worldX - halfX,
    maxX: worldX + halfX,
    minZ: worldZ - halfZ,
    maxZ: worldZ + halfZ,
  });
}

function reviewedAnchorToFeatureLocal(
  feature: THREE.Group,
  anchorId: ReviewedGtadbAnchorId,
): { x: number; z: number } {
  const world = gtadbToWorld(REVIEWED_GTADB_ANCHORS[anchorId].gtadb);
  const deltaX = world.x - feature.position.x;
  const deltaZ = world.z - feature.position.z;
  const cosine = Math.cos(feature.rotation.y);
  const sine = Math.sin(feature.rotation.y);
  return {
    x: deltaX * cosine - deltaZ * sine,
    z: deltaX * sine + deltaZ * cosine,
  };
}

function addCommonRoad(
  feature: THREE.Group,
  geometry: ArrivalGeometry,
  materials: ArrivalMaterials,
  region: DetailedArrivalRegion,
  coarsePointer: boolean,
): number {
  const widths: Readonly<Record<DetailedArrivalRegion, number>> = {
    'vice-city': 24,
    'leonida-keys': 14,
    grassrivers: 7,
    'port-gellhorn': 18,
    ambrosia: 15,
    'mount-kalaga': 12,
  };
  const width = widths[region];
  const material =
    region === 'port-gellhorn'
      ? materials.wornAsphalt
      : materials.asphalt;
  if (region === 'vice-city') {
    // Keep the broad boulevard charcoal under the desktop IBL path. Reflections
    // belong to the small wet accent meshes, not to the whole carriageway.
    material.name = 'street-leonida/vice-city/dry-sunworn-asphalt';
    material.color.setHex(0xa6aeb5);
    material.roughness = 0.96;
    material.metalness = 0;
    material.envMapIntensity = 0.14;
  }
  if (region === 'mount-kalaga') {
    const segmentCount = coarsePointer ? 24 : 30;
    const roadSegments: Transform[] = [];
    const roadLines: Transform[] = [];
    const shoulders: Transform[] = [];
    const patches: Transform[] = [];
    for (let index = 0; index < segmentCount; index += 1) {
      const start = mountRoadPointAt(index, segmentCount);
      const end = mountRoadPointAt(index + 1, segmentCount);
      const deltaX = end.x - start.x;
      const deltaZ = end.z - start.z;
      const length = Math.hypot(deltaX, deltaZ);
      const yaw = Math.atan2(deltaX, deltaZ);
      const centerX = (start.x + end.x) / 2;
      const centerZ = (start.z + end.z) / 2;
      const perpendicularX = deltaZ / length;
      const perpendicularZ = -deltaX / length;
      roadSegments.push({
        position: [centerX, 0.16, centerZ],
        scale: [width, 0.22, length + 0.72],
        rotation: [0, yaw, 0],
      });
      for (const offset of [-width / 2 + 0.48, width / 2 - 0.48]) {
        roadLines.push({
          position: [centerX + perpendicularX * offset, 0.295, centerZ + perpendicularZ * offset],
          scale: [0.16, 0.025, length + 0.76],
          rotation: [0, yaw, 0],
          color: 0xece9df,
        });
      }
      for (const offset of [-0.24, 0.24]) {
        roadLines.push({
          position: [centerX + perpendicularX * offset, 0.302, centerZ + perpendicularZ * offset],
          scale: [0.12, 0.028, length + 0.76],
          rotation: [0, yaw, 0],
          color: 0xe4bd48,
        });
      }
      for (const side of [-1, 1]) {
        const offset = side * (width / 2 + 1.35);
        shoulders.push({
          position: [centerX + perpendicularX * offset, 0.08, centerZ + perpendicularZ * offset],
          scale: [2.3, 0.15, length + 0.82],
          rotation: [0, yaw, 0],
        });
      }
      if (!coarsePointer && index % 2 === 0) {
        const offset = ((index * 5) % 7) - 3;
        patches.push({
          position: [centerX + perpendicularX * offset, 0.288, centerZ + perpendicularZ * offset],
          scale: [0.75 + (index % 3) * 0.3, 0.012, Math.min(3.6, length * 0.42)],
          rotation: [0, yaw + ((index % 5) - 2) * 0.035, 0],
        });
      }
    }

    const road = addInstances(
      feature,
      geometry.box,
      material,
      roadSegments,
      'mount-kalaga-arrival-road',
      false,
    );
    road.userData.surfaceAsset = ASPHALT_ASSET;
    addInstances(
      feature,
      geometry.box,
      materials.whiteLine,
      roadLines,
      'mount-kalaga-arrival-road-lines',
      false,
    );
    addInstances(
      feature,
      geometry.box,
      materials.darkRock,
      shoulders,
      'mount-kalaga-arrival-shoulders',
      false,
    );
    if (patches.length > 0) {
      addInstances(
        feature,
        geometry.box,
        materials.dark,
        patches,
        'mount-kalaga-arrival-road-patches',
        false,
      );
    }
    return width;
  }
  const road = addMesh(
    feature,
    geometry.box,
    material,
    [0, 0.16, -112],
    [width, 0.22, 280],
    [0, 0, 0],
    `${region}-arrival-road`,
    false,
  );
  road.userData.surfaceAsset = ASPHALT_ASSET;
  const roadLines: Transform[] = [-1, 1].map((side) => ({
    position: [side * (width / 2 - 0.48), 0.295, -112] as Vec3,
    scale: [0.16, 0.025, 276] as Vec3,
    color: 0xece9df,
  }));
  roadLines.push(
    ...[-0.24, 0.24].map((x) => ({
      position: [x, 0.302, -112] as Vec3,
      scale: [0.12, 0.028, 276] as Vec3,
      color: 0xe4bd48,
    })),
  );
  addInstances(
    feature,
    geometry.box,
    materials.whiteLine,
    roadLines,
    `${region}-arrival-road-lines`,
    false,
  );
  if (region === 'port-gellhorn') {
    const laneDashes: Transform[] = [];
    for (let z = 14; z > -250; z -= 13) {
      for (const x of [-4.45, 4.45]) {
        laneDashes.push({ position: [x, 0.305, z], scale: [0.12, 0.03, 5.4] });
      }
    }
    addInstances(
      feature,
      geometry.box,
      materials.whiteLine,
      laneDashes,
      `${region}-arrival-lane-dashes`,
      false,
    );
  }
  const shoulderMaterial =
    region === 'leonida-keys' || region === 'grassrivers'
      ? materials.concrete
      : materials.paleConcrete;
  addInstances(
    feature,
    geometry.box,
    shoulderMaterial,
    [-1, 1].map((side) => ({
      position: [side * (width / 2 + 1.35), 0.08, -112] as Vec3,
      scale: [2.3, 0.15, 280] as Vec3,
    })),
    `${region}-arrival-shoulders`,
    false,
  );
  if (!coarsePointer && region !== 'vice-city') {
    const patches: Transform[] = [];
    for (let index = 0; index < 14; index += 1) {
      patches.push({
        position: [((index * 7) % 9) - 4, 0.288, 5 - index * 18],
        scale: [0.7 + (index % 3) * 0.35, 0.012, 2.2 + (index % 4) * 0.55],
        rotation: [0, ((index % 5) - 2) * 0.08, 0],
      });
    }
    addInstances(
      feature,
      geometry.box,
      materials.dark,
      patches,
      `${region}-arrival-road-patches`,
      false,
    );
  }
  return width;
}

function addStreetLights(
  feature: THREE.Group,
  geometry: ArrivalGeometry,
  materials: ArrivalMaterials,
  roadWidth: number,
  coarsePointer: boolean,
  name: string,
): void {
  const poles: Transform[] = [];
  const arms: Transform[] = [];
  const heads: Transform[] = [];
  const spacing = coarsePointer ? 58 : 38;
  for (let z = -12; z >= -230; z -= spacing) {
    for (const side of [-1, 1]) {
      const x = side * (roadWidth / 2 + 2.25);
      poles.push({ position: [x, 3.55, z], scale: [0.18, 7.1, 0.18] });
      arms.push({
        position: [x - side * 0.72, 6.92, z],
        scale: [1.55, 0.12, 0.12],
      });
      heads.push({
        position: [x - side * 1.42, 6.82, z],
        scale: [0.75, 0.18, 0.38],
      });
    }
  }
  addInstances(
    feature,
    geometry.box,
    materials.steel,
    [...poles, ...arms],
    `${name}-fixtures`,
    true,
  );
  addInstances(feature, geometry.box, materials.amber, heads, `${name}-heads`, false);
}

function addVehicle(
  feature: THREE.Group,
  position: Vec3,
  rotationY: number,
  color: number,
  name: string,
  type: RoadVehicleType = 'sedan',
): void {
  const vehicle = createRoadVehicle(color, type, {
    material: createRoadVehicleMaterial(`street-leonida/arrival/${name}`),
    materialOwnership: 'region-owned',
  });
  vehicle.name = name;
  vehicle.position.set(position[0], 0.27, position[2]);
  vehicle.rotation.y = rotationY;
  feature.add(vehicle);
}

interface ViceCityArrivalBuilding {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly color: number;
}

/**
 * A camera-aligned Vice City foreground grounded in the official waterfront,
 * Ocean Beach and mural-viaduct shots. It deliberately avoids named landmark
 * claims: every facade is subordinate infill and remains APPROXIMATE.
 */
function addViceCityArrival(
  feature: THREE.Group,
  geometry: ArrivalGeometry,
  materials: ArrivalMaterials,
  roadWidth: number,
  coarsePointer: boolean,
  renderer: THREE.WebGLRenderer,
): readonly { x: number; z: number; width: number; depth: number }[] {
  feature.userData.confidence = 'VISUAL_REFERENCE_ONLY';
  feature.userData.landmarkClaim = 'NONE';
  feature.userData.infill = 'APPROXIMATE';
  feature.userData.referenceCues = [
    'pastel Art Deco rhythm',
    'palmed multi-lane boulevard',
    'humid reflective asphalt',
    'waterfront high-rise haze',
  ];
  feature.userData.materialPalette = [
    'sun-worn asphalt',
    'pastel stucco',
    'coastal glass',
    'pale concrete',
  ];

  const laneDashes: Transform[] = [];
  const laneXs = coarsePointer ? [-5.2, 5.2] : [-7.6, -3.8, 3.8, 7.6];
  for (let z = 8; z >= -246; z -= coarsePointer ? 18 : 12) {
    for (const x of laneXs) {
      laneDashes.push({ position: [x, 0.31, z], scale: [0.13, 0.025, 4.8] });
    }
  }
  addInstances(
    feature,
    geometry.box,
    materials.whiteLine,
    laneDashes,
    'vice-city-arrival-lane-dashes',
    false,
  );

  const crosswalks: Transform[] = [];
  for (const z of [-32, -41]) {
    for (let x = -roadWidth / 2 + 1; x <= roadWidth / 2 - 1; x += 2.15) {
      if (Math.abs(x) < 0.9) continue;
      crosswalks.push({ position: [x, 0.318, z], scale: [1.08, 0.026, 0.42] });
    }
  }
  addInstances(
    feature,
    geometry.box,
    materials.whiteLine,
    crosswalks,
    'vice-city-arrival-crosswalks',
    false,
  );

  const roadWear = Array.from({ length: coarsePointer ? 8 : 18 }, (_, index) => ({
    position: [
      ((index * 5.7) % (roadWidth - 4)) - (roadWidth - 4) / 2,
      0.306,
      -8 - index * (coarsePointer ? 27 : 13.4),
    ] as Vec3,
    scale: [0.65 + (index % 4) * 0.28, 0.012, 1.9 + (index % 3) * 0.7] as Vec3,
    rotation: [0, ((index % 7) - 3) * 0.07, 0] as Vec3,
  }));
  if (!coarsePointer) {
    roadWear.push(
      ...Array.from({ length: 14 }, (_, index) => ({
        position: [((index * 7) % 9) - 4, 0.3, 5 - index * 18] as Vec3,
        scale: [0.7 + (index % 3) * 0.35, 0.012, 2.2 + (index % 4) * 0.55] as Vec3,
        rotation: [0, ((index % 5) - 2) * 0.08, 0] as Vec3,
      })),
    );
  }
  addInstances(
    feature,
    geometry.context,
    new THREE.MeshStandardMaterial({
      color: 0x32342f,
      roughness: 0.97,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    }),
    roadWear.map((t) => ({
      ...t,
      position: [t.position[0], 0.276, t.position[2]] as Vec3,
      scale: [t.scale[0], t.scale[2], 1] as Vec3,
      rotation: [-Math.PI / 2, 0, t.rotation[1]] as Vec3,
    })),
    'vice-city-arrival-road-wear',
    false,
  );

  const wetAsphalt = new THREE.MeshPhysicalMaterial({
    color: 0x1e3035,
    roughness: 0.22,
    metalness: 0.06,
    clearcoat: 0.88,
    clearcoatRoughness: 0.14,
    transparent: true,
    opacity: 0.58,
  });
  wetAsphalt.name = 'street-leonida/vice-city/wet-asphalt';
  const wetTransforms = Array.from({ length: coarsePointer ? 5 : 12 }, (_, index) => ({
    position: [
      index % 2 === 0 ? -5.4 + (index % 3) * 1.2 : 4.7 - (index % 3) * 0.8,
      0.323,
      -14 - index * (coarsePointer ? 42 : 19),
    ] as Vec3,
    scale: [1.3 + (index % 4) * 0.42, 0.009, 5.4 + (index % 3) * 1.7] as Vec3,
    rotation: [0, ((index % 5) - 2) * 0.045, 0] as Vec3,
  }));
  addInstances(
    feature,
    geometry.context,
    wetAsphalt,
    wetTransforms.map((t) => ({
      ...t,
      position: [t.position[0], 0.278, t.position[2]] as Vec3,
      scale: [t.scale[0], t.scale[2], 1] as Vec3,
      rotation: [-Math.PI / 2, 0, t.rotation[1]] as Vec3,
    })),
    'vice-city-arrival-wet-asphalt-accents',
    false,
  );

  const allBuildings: readonly ViceCityArrivalBuilding[] = [
    { x: -22, z: -30, width: 14, depth: 24, height: 18, color: 0xe7d9c5 },
    { x: 22, z: -34, width: 15, depth: 27, height: 25, color: 0xc99191 },
    { x: -23, z: -64, width: 16, depth: 27, height: 30, color: 0x91b7b4 },
    { x: 23, z: -72, width: 16, depth: 31, height: 21, color: 0xe5c6a8 },
    { x: -22, z: -101, width: 15, depth: 31, height: 36, color: 0xd7b3bd },
    { x: 23, z: -113, width: 17, depth: 32, height: 34, color: 0xddd7c8 },
    { x: -23, z: -143, width: 17, depth: 30, height: 24, color: 0xd49b8d },
    { x: 23, z: -157, width: 16, depth: 32, height: 39, color: 0xa7c7c3 },
  ];
  const buildings = [
    ...allBuildings,
    { x: -23, z: 13, width: 16, depth: 26, height: 16, color: 0xe5d9c5 },
    { x: 24, z: 15, width: 17, depth: 28, height: 23, color: 0xc7d8d4 },
  ];
  // Solid cores are inset from all four facades. Window openings remain true
  // recesses instead of being hidden behind another full-front rectangle.
  const cores: Transform[] = buildings.map((building) => ({
    position: [building.x, building.height / 2 + 0.28, building.z],
    scale: [building.width - 1.2, building.height, building.depth - 1.2],
    color: building.color,
  }));
  addInstances(feature, geometry.box, materials.cream, cores, 'vice-city-arrival-art-deco-facades');
  const shellKit = createFacadeShellKit({ resourceOwnership: 'region' });
  const shells: FacadeShellSpec[] = [];
  const crowns: Transform[] = [];
  const equipment: Transform[] = [];
  buildings.forEach((building, index) => {
    const floors = Math.max(3, Math.round(building.height / 3.3));
    for (const side of [-1, 1]) {
      shells.push({
        position: [building.x + (side * building.width) / 2, 0.28, building.z],
        rotationY: (side * Math.PI) / 2,
        width: building.depth,
        height: building.height,
        floors,
        bayWidth: 3.1 + (index % 3) * 0.45,
        seed: index / 10,
        style: index % 3 ? 'coastal' : 'urban',
        color: building.color,
        storefront: side === (building.x < 0 ? 1 : -1),
        balconies: index % 3 !== 1,
      });
      shells.push({
        position: [building.x, 0.28, building.z + (side * building.depth) / 2],
        rotationY: side > 0 ? 0 : Math.PI,
        width: building.width,
        height: building.height,
        floors,
        bayWidth: 3.7,
        seed: index / 10 + 0.2,
        style: 'coastal',
        color: building.color,
        balconies: index % 2 === 0,
      });
    }
    crowns.push({
      position: [building.x, building.height + 0.38, building.z],
      scale: [building.width + 0.25, 0.3, building.depth + 0.25],
      color: 0xded8c7,
    });
    equipment.push({
      position: [building.x, building.height + 0.95, building.z - 2],
      scale: [2.5, 1.3, 3.8],
      color: 0x7e8580,
    });
  });
  const facades = shellKit.create(shells, 'vice-city-arrival-facade-shells');
  facades.setDetail(!coarsePointer);
  feature.add(facades.root);
  facadeCleanup.set(feature, () => shellKit.dispose());
  addInstances(feature, geometry.box, materials.cream, crowns, 'vice-city-arrival-parapet-crowns');
  addInstances(
    feature,
    geometry.box,
    materials.steel,
    equipment,
    'vice-city-arrival-rooftop-volumes',
  );

  const signage = new THREE.Group();
  signage.name = 'vice-city-arrival-secondary-signage';
  signage.userData.evidence = 'APPROXIMATE';
  signage.userData.landmarkClaim = 'NONE';
  feature.add(signage);
  const signSpecs = [
    {
      x: -14.75,
      z: -27,
      yaw: Math.PI / 2,
      title: 'CAFE',
      subtitle: 'OPEN LATE',
      accent: 0x62e8ea,
    },
    {
      x: 14.75,
      z: -70,
      yaw: -Math.PI / 2,
      title: 'MOTEL',
      subtitle: 'POOL  •  BEACH',
      accent: 0xff5baa,
    },
    {
      x: -14.75,
      z: -135,
      yaw: Math.PI / 2,
      title: 'PARKING',
      subtitle: '24 HOURS',
      accent: 0xffc66f,
    },
  ].slice(0, 2);
  signSpecs.forEach((sign, index) => {
    const face = addMesh(
      signage,
      geometry.plane,
      createSignMaterial(
        `street-leonida/sign/vice-infill-${index + 1}`,
        sign.title,
        sign.subtitle,
        0x142632,
        sign.accent,
      ),
      [sign.x, 5.3, sign.z],
      [5.7, 1.75, 1],
      [0, sign.yaw, 0],
      `vice-city-arrival-infill-sign-${index + 1}`,
      false,
    );
    face.userData.evidence = 'APPROXIMATE';
    face.userData.landmarkClaim = 'NONE';
  });

  addPhotoVegetation(
    feature,
    geometry,
    renderer,
    PHOTO_VEGETATION_ASSETS.palm,
    Array.from(
      { length: coarsePointer ? 10 : 18 },
      (_, index) =>
        [
          index % 2 === 0 ? -(roadWidth / 2 + 4.1) : roadWidth / 2 + 4.1,
          -12 - index * (coarsePointer ? 20 : 13),
          8.2 + (index % 4) * 0.85,
        ] as const,
    ),
    'vice-city-arrival-photo-palms',
  );
  addStreetLights(
    feature,
    geometry,
    materials,
    roadWidth,
    coarsePointer,
    'vice-city-arrival-streetlights',
  );

  const carSpecs = [
    { x: -7.5, z: -18, yaw: 0, color: 0xd13f5b },
    { x: -3.6, z: -62, yaw: 0, color: 0x2c7895 },
    { x: 3.7, z: -29, yaw: Math.PI, color: 0xe0b541 },
    { x: 7.6, z: -91, yaw: Math.PI, color: 0xddd8ca },
    { x: -7.5, z: -128, yaw: 0, color: 0x3f9b80 },
    { x: 3.7, z: -168, yaw: Math.PI, color: 0x553f78 },
  ].slice(0, coarsePointer ? 4 : 6);
  const traffic = createRoadVehicleBatch(
    carSpecs.map((car) => ({
      color: car.color,
      position: [car.x, 0.27, car.z],
      rotationY: car.yaw,
    })),
    'sedan',
    'vice-city-arrival-traffic-silhouettes',
  );
  traffic.userData.referenceCue = 'dense boulevard traffic';
  feature.add(traffic);
  const signalPoles: Transform[] = [];
  const signalArms: Transform[] = [];
  const signalHeads: Transform[] = [];
  for (const z of [-35.5, -37.5]) {
    for (const [side, x] of [
      [-1, -(roadWidth / 2 + 2.1)],
      [1, roadWidth / 2 + 2.1],
    ] as const) {
      signalPoles.push({ position: [x, 3.4, z], scale: [0.2, 6.8, 0.2] });
      signalArms.push({
        position: [x - side * 4.6, 6.55, z],
        scale: [9.3, 0.18, 0.18],
      });
    }
    for (const laneX of [-6.2, 0, 6.2]) {
      signalHeads.push({
        position: [laneX, 6.12, z],
        scale: [0.48, 1.18, 0.4],
        color: laneX === 0 ? 0xffc370 : 0x29343a,
      });
    }
  }
  addInstances(
    feature,
    geometry.box,
    materials.steel,
    [...signalPoles, ...signalArms],
    'vice-city-arrival-signal-fixtures',
  );
  addInstances(
    feature,
    geometry.box,
    materials.amber,
    signalHeads,
    'vice-city-arrival-signal-heads',
    false,
  );

  const atmosphericDepth = new THREE.Group();
  atmosphericDepth.name = 'vice-city-arrival-atmospheric-depth';
  atmosphericDepth.userData.haze = 'subtropical-humid';
  atmosphericDepth.userData.evidence = 'APPROXIMATE';
  feature.add(atmosphericDepth);
  const hazeMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4dbd8,
    roughness: 0.66,
    metalness: 0.12,
    fog: true,
  });
  hazeMaterial.name = 'street-leonida/vice-city/distant-haze';
  const skyline = Array.from({ length: coarsePointer ? 8 : 14 }, (_, index) => {
    const height = 28 + ((index * 17) % 58);
    return {
      position: [
        -105 + index * (210 / Math.max(1, (coarsePointer ? 8 : 14) - 1)),
        height / 2,
        -238 - (index % 3) * 18,
      ] as Vec3,
      scale: [11 + (index % 4) * 3.5, height, 12 + (index % 3) * 4] as Vec3,
    };
  });
  addInstances(
    atmosphericDepth,
    geometry.box,
    hazeMaterial,
    [
      ...skyline.map((tower) => ({ ...tower, color: 0x759bad })),
      ...skyline.map((tower, index) => ({
        position: [tower.position[0], tower.position[1] * 2 + 0.75, tower.position[2]] as Vec3,
        scale: [tower.scale[0] * 0.52, 1.5, tower.scale[2] * 0.48] as Vec3,
        rotation: [0, (index % 3) * 0.14, 0] as Vec3,
        color: 0xd6d1c6,
      })),
    ],
    'vice-city-arrival-haze-skyline',
    false,
  );

  return buildings.map((building) => ({
    x: building.x,
    z: building.z,
    width: building.width,
    depth: building.depth,
  }));
}

function addKeysArrival(
  feature: THREE.Group,
  geometry: ArrivalGeometry,
  materials: ArrivalMaterials,
  roadWidth: number,
  coarsePointer: boolean,
  renderer: THREE.WebGLRenderer,
): readonly { x: number; z: number; width: number; depth: number }[] {
  feature.userData.locality = 'Watson Bay';
  feature.userData.gtadbAnchorId = 'L544';
  feature.userData.localityConfidence = 'APPROXIMATE';
  addMesh(
    feature,
    geometry.box,
    materials.water,
    [0, 0.14, -112],
    [180, 0.08, 290],
    [0, 0, 0],
    'keys-arrival-water',
    false,
  );
  addMesh(
    feature,
    geometry.box,
    materials.concrete,
    [0, -0.02, -112],
    [roadWidth + 5, 0.42, 280],
    [0, 0, 0],
    'keys-causeway-deck',
    true,
  );
  const rails: Transform[] = [];
  const posts: Transform[] = [];
  for (const side of [-1, 1]) {
    rails.push({
      position: [side * (roadWidth / 2 + 1.55), 1.05, -112],
      scale: [0.16, 0.22, 278],
    });
    for (let z = 12; z >= -244; z -= 8) {
      posts.push({
        position: [side * (roadWidth / 2 + 1.55), 0.58, z],
        scale: [0.18, 1.1, 0.18],
      });
    }
  }
  addInstances(feature, geometry.box, materials.galvanized, rails, 'keys-causeway-guardrails');
  addInstances(feature, geometry.box, materials.galvanized, posts, 'keys-causeway-rail-posts');
  const piers: Transform[] = [];
  for (let z = -22; z >= -232; z -= 35) {
    for (const x of [-5.2, 5.2]) {
      piers.push({ position: [x, -1.1, z], scale: [0.9, 2.5, 0.9] });
    }
  }
  addInstances(
    feature,
    geometry.cylinder,
    materials.weatheredConcrete,
    piers,
    'keys-causeway-piers',
    true,
  );

  addMesh(
    feature,
    geometry.sphere,
    materials.sand,
    [-28, -0.15, -42],
    [22, 1.4, 15],
    [0, 0.3, 0],
    'keys-arrival-islet-west',
    false,
  );
  addMesh(
    feature,
    geometry.sphere,
    materials.sand,
    [31, -0.14, -118],
    [26, 1.2, 17],
    [0, -0.2, 0],
    'keys-arrival-islet-east',
    false,
  );
  addPhotoVegetation(
    feature,
    geometry,
    renderer,
    PHOTO_VEGETATION_ASSETS.palm,
    [
      [-24, -34, 8.6],
      [-33, -47, 10.2],
      [27, -110, 8.4],
      [36, -121, 9.2],
      [-17, -156, 7.8],
    ],
    'keys-arrival-photo-palms',
  );

  const rustyAnchor = new THREE.Group();
  rustyAnchor.name = 'keys-rusty-anchor';
  const rustyAnchorPosition = reviewedAnchorToFeatureLocal(feature, 'L325');
  rustyAnchor.position.set(rustyAnchorPosition.x, 0, rustyAnchorPosition.z);
  rustyAnchor.rotation.y = 0.035;
  rustyAnchor.userData.communityId = 'L325';
  rustyAnchor.userData.rawGtadb = [
    REVIEWED_GTADB_ANCHORS.L325.gtadb.x,
    REVIEWED_GTADB_ANCHORS.L325.gtadb.y,
  ];
  rustyAnchor.userData.evidence = REVIEWED_GTADB_ANCHORS.L325.evidence;
  rustyAnchor.userData.nameEvidence = REVIEWED_GTADB_ANCHORS.L325.evidence.name;
  rustyAnchor.userData.placementEvidence = REVIEWED_GTADB_ANCHORS.L325.evidence.placement;
  rustyAnchor.userData.unconfirmed = REVIEWED_GTADB_ANCHORS.L325.evidence.tagSignals.unconfirmed;
  rustyAnchor.userData.visualInterpretation = 'APPROXIMATE';
  rustyAnchor.userData.visualReference = 'Rockstar / Leonida_Keys_03';
  feature.add(rustyAnchor);
  addMesh(rustyAnchor, geometry.box, materials.cream, [0, 3.15, 0], [17, 6.3, 8.5]);

  const rustyRoofMaterial = standard(0x505a58, 0.78, 0.26, createNoiseTexture(325, 24));
  rustyRoofMaterial.name = 'street-leonida/keys/rusty-anchor-weathered-metal-roof';
  const rustyRoofRise = 1.55;
  const rustyRoofRun = 4.85;
  const rustyRoofPitch = Math.atan2(rustyRoofRise, rustyRoofRun);
  const rustyRoofLength = Math.hypot(rustyRoofRise, rustyRoofRun);
  addInstances(
    rustyAnchor,
    geometry.box,
    rustyRoofMaterial,
    [-1, 1].map((side) => ({
      position: [0, 7.075, side * 2.425] as Vec3,
      scale: [18.4, 0.2, rustyRoofLength] as Vec3,
      rotation: [side * rustyRoofPitch, 0, 0] as Vec3,
    })),
    'keys-rusty-anchor-pitched-metal-roof',
  );
  const rustyRoofSeams: Transform[] = [];
  for (let x = -8.7; x <= 8.7; x += coarsePointer ? 1.2 : 0.65) {
    for (const side of [-1, 1]) {
      rustyRoofSeams.push({
        position: [x, 7.19, side * 2.425],
        scale: [0.035, 0.04, rustyRoofLength],
        rotation: [side * rustyRoofPitch, 0, 0],
      });
    }
  }
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.steel,
    rustyRoofSeams,
    'keys-rusty-anchor-roof-seams',
    false,
  );

  const centralGablePitch = Math.atan2(1, 1.8);
  const centralGableLength = Math.hypot(1, 1.8);
  addMesh(
    rustyAnchor,
    geometry.box,
    materials.aqua,
    [0, 7.55, 0.8],
    [3.6, 1.7, 2.4],
    [0, 0, 0],
    'keys-rusty-anchor-central-gable',
  );
  addInstances(
    rustyAnchor,
    geometry.box,
    rustyRoofMaterial,
    [-1, 1].map((side) => ({
      position: [side * 0.9, 8.9, 0.8] as Vec3,
      scale: [centralGableLength, 0.18, 2.75] as Vec3,
      rotation: [0, 0, -side * centralGablePitch] as Vec3,
    })),
    'keys-rusty-anchor-central-gable-roof',
  );
  // Close both roof profiles so oblique street views cannot see through the gables.
  const rustyGableShape = new THREE.Shape();
  rustyGableShape.moveTo(-0.5, 0);
  rustyGableShape.lineTo(0.5, 0);
  rustyGableShape.lineTo(0, 1);
  rustyGableShape.closePath();
  addInstances(
    rustyAnchor,
    new THREE.ShapeGeometry(rustyGableShape),
    materials.cream,
    [
      {
        position: [8.5, 6.3, 0],
        scale: [9.7, 1.55, 1],
        rotation: [0, Math.PI / 2, 0],
      },
      {
        position: [-8.5, 6.3, 0],
        scale: [9.7, 1.55, 1],
        rotation: [0, -Math.PI / 2, 0],
      },
      { position: [0, 8.4, 2.01], scale: [3.6, 1, 1] },
      {
        position: [0, 8.4, -0.41],
        scale: [3.6, 1, 1],
        rotation: [0, Math.PI, 0],
      },
    ],
    'keys-rusty-anchor-gable-endcaps',
  );
  addMesh(
    rustyAnchor,
    geometry.box,
    materials.paleConcrete,
    [0, 8.3, -1],
    [2, 4.4, 1.5],
    [0, 0, 0],
    'keys-rusty-anchor-central-chimney',
  );
  addMesh(rustyAnchor, geometry.box, materials.steel, [0, 10.55, -1], [2.35, 0.2, 1.8]);
  addMesh(
    rustyAnchor,
    geometry.box,
    materials.dark,
    [0, 7.65, 2.03],
    [1.35, 0.62, 0.12],
    [0, 0, 0],
    'keys-rusty-anchor-gable-louver',
    false,
  );

  const siding: Transform[] = [];
  for (let y = 0.72; y <= 5.72; y += 0.36) {
    siding.push({ position: [0, y, 4.29], scale: [16.7, 0.055, 0.08] });
  }
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.paleConcrete,
    siding,
    'keys-rusty-anchor-weathered-siding',
    false,
  );
  addMesh(
    rustyAnchor,
    geometry.box,
    materials.darkTimber,
    [0, 2.42, 4.34],
    [1.35, 3.6, 0.16],
    [0, 0, 0],
    'keys-rusty-anchor-front-door',
  );
  const rustyWindows: Transform[] = [];
  const rustyWindowFrames: Transform[] = [];
  const rustyWindowShutters: Transform[] = [];
  for (const x of [-5.9, -3, 3, 5.9]) {
    rustyWindows.push({ position: [x, 3.15, 4.36], scale: [1.45, 1.6, 0.14] });
    for (const side of [-1, 1]) {
      rustyWindowFrames.push({
        position: [x + side * 0.78, 3.15, 4.45],
        scale: [0.11, 1.82, 0.16],
      });
      rustyWindowFrames.push({
        position: [x, 3.15 + side * 0.84, 4.45],
        scale: [1.66, 0.11, 0.16],
      });
      rustyWindowShutters.push({
        position: [x + side * 1.02, 3.15, 4.43],
        scale: [0.36, 1.82, 0.14],
      });
    }
  }
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.glass,
    rustyWindows,
    'keys-rusty-anchor-windows',
  );
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.cream,
    rustyWindowFrames,
    'keys-rusty-anchor-window-frames',
  );
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.aqua,
    rustyWindowShutters,
    'keys-rusty-anchor-window-shutters',
  );

  addMesh(
    rustyAnchor,
    geometry.box,
    materials.weatheredConcrete,
    [0, 0.28, 5.55],
    [18.5, 0.5, 3],
    [0, 0, 0],
    'keys-rusty-anchor-porch-deck',
  );
  addMesh(
    rustyAnchor,
    geometry.box,
    rustyRoofMaterial,
    [0, 5.65, 5.55],
    [18.5, 0.24, 3],
    [0.08, 0, 0],
    'keys-rusty-anchor-porch-roof',
  );
  const porchPostXs = [-8, -6, -4, -2, 2, 4, 6, 8];
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.cream,
    porchPostXs.map((x) => ({
      position: [x, 2.85, 6.42] as Vec3,
      scale: [0.28, 5.7, 0.32] as Vec3,
    })),
    'keys-rusty-anchor-porch-posts',
  );
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.aqua,
    porchPostXs.flatMap((x) =>
      [-1, 1].map((side) => ({
        position: [x + side * 0.34, 5.18, 6.42] as Vec3,
        scale: [0.86, 0.13, 0.18] as Vec3,
        rotation: [0, 0, side * 0.68] as Vec3,
      })),
    ),
    'keys-rusty-anchor-porch-braces',
  );
  const railingCentres = [-7, -5, -3, 3, 5, 7];
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.cream,
    railingCentres.flatMap((x) =>
      [-1, 1].map((side) => ({
        position: [x, 1.24, 6.62] as Vec3,
        scale: [2.28, 0.13, 0.15] as Vec3,
        rotation: [0, 0, side * 0.55] as Vec3,
      })),
    ),
    'keys-rusty-anchor-openwork-railing',
  );
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.aqua,
    railingCentres.map((x) => ({
      position: [x, 2.04, 6.62] as Vec3,
      scale: [2.08, 0.18, 0.32] as Vec3,
    })),
    'keys-rusty-anchor-railing-caps',
  );
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.weatheredConcrete,
    [
      { position: [0, 0.2, 7.45], scale: [3.1, 0.4, 0.9] },
      { position: [0, 0.08, 8.03], scale: [3.6, 0.16, 0.55] },
    ],
    'keys-rusty-anchor-porch-steps',
  );
  addMesh(rustyAnchor, geometry.box, materials.aqua, [0, 8.25, 5.12], [15.8, 2.25, 0.46]);
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.darkTimber,
    [-6.25, 6.25].map((x) => ({
      position: [x, 6.43, 5.1] as Vec3,
      scale: [0.2, 2.7, 0.22] as Vec3,
    })),
    'keys-rusty-anchor-sign-brackets',
  );
  const identitySign = addMesh(
    rustyAnchor,
    geometry.plane,
    createSignMaterial(
      'street-leonida/sign/rusty-anchor',
      'THE RUSTY ANCHOR',
      'WATERFRONT PORCH',
      0x315f58,
      0xe8dfbf,
    ),
    [0, 8.25, 5.36],
    [15.25, 1.82, 1],
    [0, 0, 0],
    'keys-rusty-anchor-sign-face',
    false,
  );
  identitySign.userData.evidence = 'VISUAL_REFERENCE_ONLY';
  identitySign.userData.placement = 'APPROXIMATE';
  identitySign.userData.communityId = 'L325';
  identitySign.userData.nameEvidence = REVIEWED_GTADB_ANCHORS.L325.evidence.name;

  const picnicXs = [-5.8, 0, 5.8];
  const picnicZs = [10, 11, 10.1];
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.timber,
    picnicXs.map((x, index) => ({
      position: [x, 1.15, picnicZs[index]!] as Vec3,
      scale: [3.3, 0.2, 1.15] as Vec3,
    })),
    'keys-rusty-anchor-picnic-tabletops',
  );
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.aqua,
    picnicXs.flatMap((x, index) =>
      [-1, 1].map((side) => ({
        position: [x, 0.72, picnicZs[index]! + side * 0.96] as Vec3,
        scale: [3.55, 0.16, 0.42] as Vec3,
      })),
    ),
    'keys-rusty-anchor-picnic-seats',
  );
  addInstances(
    rustyAnchor,
    geometry.box,
    materials.darkTimber,
    picnicXs.flatMap((x, index) =>
      [-1, 1].flatMap((xSide) =>
        [-1, 1].map((zSide) => ({
          position: [x + xSide * 1.08, 0.56, picnicZs[index]! + zSide * 0.38] as Vec3,
          scale: [0.2, 1.24, 0.22] as Vec3,
          rotation: [zSide * 0.46, 0, 0] as Vec3,
        })),
      ),
    ),
    'keys-rusty-anchor-picnic-supports',
  );
  const limestoneSurface = createSurfaceAtlasMaterial(renderer, 1, 1, {
    color: 0xf4ead7,
    roughness: 0.98,
  });
  addMesh(
    rustyAnchor,
    geometry.box,
    limestoneSurface,
    [0, 0.12, 10.2],
    [23.5, 0.16, 9.2],
    [0, 0.04, 0],
    'keys-coral-limestone-surface',
    false,
  );
  addInstances(
    rustyAnchor,
    geometry.rock,
    limestoneSurface,
    Array.from({ length: coarsePointer ? 10 : 18 }, (_, index) => ({
      position: [
        (index % 2 === 0 ? -1 : 1) * (8.45 + (Math.floor(index / 2) % 3) * 0.38),
        0.25,
        7.5 + Math.floor(index / 2) * 0.72,
      ] as Vec3,
      scale: [0.55 + (index % 3) * 0.18, 0.4, 0.7] as Vec3,
      rotation: [0, index * 0.71, 0] as Vec3,
    })),
    'keys-rusty-anchor-limestone-garden',
    false,
  );
  const rustyAnchorPalms: readonly (readonly [number, number, number])[] = [
    [-10.1, -1.4, 9.2],
    [9.6, 0.8, 8.8],
    [-8.8, 10.8, 7.4],
  ];
  addPhotoVegetation(
    rustyAnchor,
    geometry,
    renderer,
    PHOTO_VEGETATION_ASSETS.palm,
    rustyAnchorPalms.slice(0, coarsePointer ? 2 : 3),
    'keys-rusty-anchor-photo-palms',
  );

  addUtilityGrid(
    feature,
    geometry,
    materials,
    -10.5,
    [8, -26, -60, -94, -128, -162],
    'keys-roadside-utility-wires',
  );

  const marinaFleet = new THREE.Group();
  marinaFleet.name = 'keys-marina-fleet';
  feature.add(marinaFleet);
  [
    [45, -74, 0.16, true],
    [48, -97, -0.08, false],
    [25, -69, 0.1, true],
    [39, -83, -0.18, false],
    [29, -103, 0.05, true],
  ]
    .slice(0, coarsePointer ? 3 : 5)
    .forEach(([x, z, rotation, cabin], index) => {
      addSmallBoat(
        marinaFleet,
        geometry,
        materials,
        [Number(x), 0.02, Number(z)],
        Number(rotation),
        `keys-marina-boat-${index + 1}`,
        Boolean(cabin),
      );
    });

  const barX = -21;
  const barZ = -61;
  addMesh(
    feature,
    geometry.box,
    materials.aqua,
    [barX, 2.5, barZ],
    [12, 5, 7],
    [0, 0.04, 0],
    'keys-bait-bar',
  );
  addMesh(feature, geometry.box, materials.darkTimber, [barX, 5.25, barZ], [13.2, 0.3, 8.2]);
  addMesh(feature, geometry.box, materials.glass, [barX, 2.75, barZ + 3.56], [7.5, 2.1, 0.16]);
  addMesh(feature, geometry.box, materials.coral, [barX, 4.55, barZ + 3.85], [12.5, 0.65, 1.6]);
  addMesh(
    feature,
    geometry.torus,
    materials.magenta,
    [barX, 6.55, barZ + 3.9],
    [2.4, 2.4, 0.75],
    [Math.PI / 2, 0, 0],
    'keys-bait-bar-neon',
  );

  const dockPlanks: Transform[] = [];
  for (let z = -82; z >= -126; z -= 1.8) {
    dockPlanks.push({ position: [24, 0.24, z], scale: [5.8, 0.15, 1.45] });
  }
  addInstances(feature, geometry.box, materials.timber, dockPlanks, 'keys-arrival-marina-planks');
  addInstances(
    feature,
    geometry.cylinder,
    materials.darkTimber,
    [-84, -98, -112, -126].flatMap((z) =>
      [21.4, 26.6].map((x) => ({
        position: [x, -0.15, z] as Vec3,
        scale: [0.3, 2.1, 0.3] as Vec3,
      })),
    ),
    'keys-arrival-marina-posts',
  );
  addVehicle(feature, [-3.2, 0.3, -76], 0, 0x2f657d, 'keys-arrival-car');
  addStreetLights(feature, geometry, materials, roadWidth, coarsePointer, 'keys-arrival-lights');
  return [
    { x: barX, z: barZ, width: 12, depth: 7 },
    {
      x: rustyAnchorPosition.x,
      z: rustyAnchorPosition.z,
      width: 18.5,
      depth: 12.5,
    },
  ];
}

function addGrassriversArrival(
  feature: THREE.Group,
  geometry: ArrivalGeometry,
  materials: ArrivalMaterials,
  roadWidth: number,
  coarsePointer: boolean,
  renderer: THREE.WebGLRenderer,
): readonly { x: number; z: number; width: number; depth: number }[] {
  const tannicWater = materials.water.clone();
  tannicWater.name = 'street-leonida/grassrivers/tannic-water';
  tannicWater.color.setHex(0x17251f);
  tannicWater.roughness = 0.23;
  tannicWater.metalness = 0.02;
  tannicWater.clearcoat = 0.6;
  tannicWater.clearcoatRoughness = 0.24;
  tannicWater.opacity = 0.98;
  tannicWater.envMapIntensity = 0.9;
  addMesh(
    feature,
    geometry.box,
    tannicWater,
    [0, 0.14, -112],
    [190, 0.08, 290],
    [0, 0, 0],
    'grassrivers-arrival-water',
    false,
  );
  const marshSurface = createSurfaceAtlasMaterial(renderer, 0, 1, {
    color: 0x435344,
    roughness: 0.94,
    metalness: 0,
    opacity: 0.58,
  });
  const marshSurfaceTiles: readonly Transform[] = [
    {
      position: [-56, 0.185, -18],
      scale: [45, 72, 1],
      rotation: [-Math.PI / 2, 0, 0.18],
    },
    {
      position: [58, 0.187, -62],
      scale: [43, 64, 1],
      rotation: [-Math.PI / 2, 0, -0.27],
    },
    {
      position: [-52, 0.189, -112],
      scale: [51, 70, 1],
      rotation: [-Math.PI / 2, 0, -0.11],
    },
    {
      position: [54, 0.186, -158],
      scale: [48, 76, 1],
      rotation: [-Math.PI / 2, 0, 0.31],
    },
    {
      position: [-48, 0.188, -216],
      scale: [55, 68, 1],
      rotation: [-Math.PI / 2, 0, 0.09],
    },
  ];
  const marshEdge = addInstances(
    feature,
    geometry.context,
    marshSurface,
    marshSurfaceTiles.slice(0, coarsePointer ? 3 : marshSurfaceTiles.length),
    'grassrivers-marsh-surface',
    false,
  );
  marshEdge.userData.evidence = 'APPROXIMATE';
  marshEdge.userData.edgeProfile = 'irregular-marsh-mangrove-margin';
  const marshPatches: Transform[] = [];
  for (let index = 0; index < (coarsePointer ? 12 : 25); index += 1) {
    const side = index % 2 ? -1 : 1;
    marshPatches.push({
      position: [side * (15 + (index % 6) * 7), 0.23, 4 - index * 10.5],
      scale: [12 + (index % 4) * 5, 0.26, 8 + (index % 5) * 3],
      rotation: [0, index * 0.37, 0],
    });
  }
  addInstances(
    feature,
    geometry.sphere,
    materials.marsh,
    marshPatches,
    'grassrivers-marsh-islands',
    false,
  );
  const bridgeRails: Transform[] = [];
  for (const side of [-1, 1]) {
    bridgeRails.push({
      position: [side * (roadWidth / 2 + 1.2), 0.82, -55],
      scale: [0.13, 0.18, 105],
    });
  }
  addInstances(
    feature,
    geometry.box,
    materials.galvanized,
    bridgeRails,
    'grassrivers-bridge-rails',
  );

  const reeds: Transform[] = [];
  for (let index = 0; index < (coarsePointer ? 90 : 220); index += 1) {
    const side = index % 2 ? -1 : 1;
    const x = side * (10 + ((index * 17) % 62));
    const z = 12 - ((index * 29) % 275);
    const height = 0.8 + ((index * 13) % 19) / 10;
    reeds.push({
      position: [x, height / 2, z],
      scale: [0.12, height, 0.12],
      rotation: [0, index * 0.4, 0],
    });
  }
  const reedBeds = addInstances(
    feature,
    geometry.cylinder,
    materials.reed,
    reeds,
    'grassrivers-reed-beds',
    false,
  );
  reedBeds.userData.evidence = 'APPROXIMATE';
  reedBeds.userData.edgeProfile = 'irregular-marsh-mangrove-margin';

  const campX = 20;
  const campZ = -60;
  const corrugatedRoofMaterial = materials.rust.clone();
  corrugatedRoofMaterial.name = 'street-leonida/grassrivers/corrugated-roof';
  corrugatedRoofMaterial.roughness = 0.91;
  corrugatedRoofMaterial.metalness = 0.3;
  const roofPanels: Transform[] = [];
  const stiltPositions: readonly Vec3[] = [
    [campX - 3, 1.6, campZ - 2],
    [campX + 3, 1.6, campZ - 2],
    [campX - 3, 1.6, campZ + 2],
    [campX + 3, 1.6, campZ + 2],
  ];
  addInstances(
    feature,
    geometry.cylinder,
    materials.darkTimber,
    stiltPositions.map((position) => ({ position, scale: [0.35, 3.2, 0.35] })),
    'grassrivers-camp-stilts',
  );
  addMesh(feature, geometry.box, materials.timber, [campX, 3.2, campZ], [8, 0.4, 6]);
  const fishCamp = addMesh(
    feature,
    geometry.box,
    materials.cream,
    [campX, 5.35, campZ],
    [7.2, 4.1, 5.3],
    [0, 0, 0],
    'grassrivers-fish-camp',
  );
  fishCamp.userData.outpost = true;
  fishCamp.userData.evidence = 'APPROXIMATE';
  for (const side of [-1, 1]) {
    roofPanels.push({
      position: [campX + side * 1.95, 7.78, campZ],
      scale: [4.35, 0.28, 7.15],
      rotation: [0, 0, -side * 0.2],
    });
  }
  addMesh(feature, geometry.box, materials.dark, [campX, 5.4, campZ + 2.7], [1.3, 2.4, 0.12]);
  addMesh(
    feature,
    geometry.box,
    materials.aqua,
    [campX - 2.35, 5.6, campZ + 2.72],
    [1.5, 1.4, 0.12],
  );
  addMesh(
    feature,
    geometry.box,
    materials.aqua,
    [campX + 2.35, 5.6, campZ + 2.72],
    [1.5, 1.4, 0.12],
  );

  const boardwalk: Transform[] = [];
  for (let z = -32; z >= -85; z -= 1.35)
    boardwalk.push({ position: [13.5, 1.05, z], scale: [4.5, 0.16, 1.1] });
  addInstances(feature, geometry.box, materials.timber, boardwalk, 'grassrivers-boardwalk');
  addMesh(
    feature,
    geometry.box,
    materials.rust,
    [-20, 0.35, -42],
    [5.8, 0.45, 2.8],
    [0, 0.22, 0],
    'grassrivers-airboat-hull',
  );
  addMesh(
    feature,
    geometry.torus,
    materials.steel,
    [-21.7, 1.65, -41.6],
    [2.6, 2.6, 1],
    [0, Math.PI / 2 + 0.22, 0],
    'grassrivers-airboat-cage',
  );
  addMesh(
    feature,
    geometry.box,
    materials.dark,
    [-21.7, 1.65, -41.6],
    [0.12, 2.2, 0.18],
    [0, 0.22, 0],
  );

  const settlement = new THREE.Group();
  settlement.name = 'grassrivers-waterfront-settlement';
  settlement.userData.evidence = 'APPROXIMATE';
  settlement.userData.density = 'very-low';
  feature.add(settlement);
  const stiltFacade = createAtlasMaterial(renderer, 1, 0);
  const settlementBuildings = [
    { x: 46, z: -126, width: 13, depth: 9, height: 7, color: materials.cream },
    { x: -43, z: -193, width: 15, depth: 10, height: 8, color: materials.aqua },
  ].slice(0, coarsePointer ? 1 : 2);
  settlement.userData.outpostCount = settlementBuildings.length + 1;
  for (const [index, building] of settlementBuildings.entries()) {
    const baseY = 2.4;
    addInstances(
      settlement,
      geometry.cylinder,
      materials.darkTimber,
      [-1, 1].flatMap((xSide) =>
        [-1, 1].map((zSide) => ({
          position: [
            building.x + xSide * (building.width / 2 - 1),
            baseY / 2,
            building.z + zSide * (building.depth / 2 - 0.8),
          ] as Vec3,
          scale: [0.32, baseY, 0.32] as Vec3,
        })),
      ),
      `grassrivers-settlement-stilts-${index + 1}`,
    );
    const outpost = addMesh(
      settlement,
      geometry.box,
      building.color,
      [building.x, baseY + building.height / 2, building.z],
      [building.width, building.height, building.depth],
      [0, index % 2 === 0 ? 0.08 : -0.11, 0],
      `grassrivers-spaced-outpost-${index + 2}`,
    );
    outpost.userData.outpost = true;
    outpost.userData.evidence = 'APPROXIMATE';
    addMesh(
      settlement,
      geometry.plane,
      stiltFacade,
      [building.x, baseY + building.height / 2, building.z + building.depth / 2 + 0.06],
      [building.width * 0.96, building.height * 0.94, 1],
      [0, 0, 0],
      `grassrivers-settlement-facade-${index + 1}`,
      false,
    );
    for (const side of [-1, 1]) {
      roofPanels.push({
        position: [
          building.x + side * (building.width * 0.24),
          baseY + building.height + 0.76,
          building.z,
        ],
        scale: [building.width * 0.54, 0.3, building.depth + 1.5],
        rotation: [0, index % 2 === 0 ? 0.08 : -0.11, -side * 0.18],
      });
    }
    addMesh(
      settlement,
      geometry.box,
      materials.timber,
      [building.x, baseY + 0.35, building.z + building.depth / 2 + 1.2],
      [building.width + 2.4, 0.22, 2.5],
    );
  }
  addInstances(
    feature,
    geometry.box,
    corrugatedRoofMaterial,
    roofPanels,
    'grassrivers-corrugated-outpost-roofs',
  );

  const waterTower = new THREE.Group();
  waterTower.name = 'grassrivers-water-tower';
  waterTower.position.set(-48, 0, -113);
  waterTower.userData.evidence = 'APPROXIMATE';
  waterTower.userData.namedLandmark = false;
  waterTower.userData.identity = 'unnamed-wetland-water-tower';
  feature.add(waterTower);
  addInstances(
    waterTower,
    geometry.cylinder,
    materials.rust,
    [-1, 1].flatMap((xSide) =>
      [-1, 1].map((zSide) => ({
        position: [xSide * 2.3, 6.5, zSide * 2.3] as Vec3,
        scale: [0.22, 13, 0.22] as Vec3,
      })),
    ),
    'grassrivers-water-tower-legs',
  );
  addMesh(waterTower, geometry.cylinder, materials.galvanized, [0, 13.4, 0], [6.6, 5, 6.6]);
  addMesh(waterTower, geometry.cone, materials.rust, [0, 16.5, 0], [7, 2.1, 7]);
  const towerEvidenceLabel = addMesh(
    waterTower,
    geometry.plane,
    createSignMaterial(
      'street-leonida/sign/approximate-water-tower',
      'APPROXIMATE',
      'UNNAMED WATER TOWER',
      0x7c725a,
      0xe6ddc0,
    ),
    [0, 13.5, 3.34],
    [5.4, 1.8, 1],
    [0, 0, 0],
    'grassrivers-water-tower-evidence-label',
    false,
  );
  towerEvidenceLabel.userData.evidence = 'APPROXIMATE';

  const dockFleet = new THREE.Group();
  dockFleet.name = 'grassrivers-dock-fleet';
  feature.add(dockFleet);
  [
    [-20, -31, 0.22, false],
    [-49, -79, -0.14, true],
    [19, -94, 0.08, false],
    [49, -91, -0.2, true],
    [-22, -137, 0.14, false],
  ]
    .slice(0, coarsePointer ? 3 : 5)
    .forEach(([x, z, rotation, cabin], index) => {
      addSmallBoat(
        dockFleet,
        geometry,
        materials,
        [Number(x), 0.03, Number(z)],
        Number(rotation),
        `grassrivers-boat-${index + 1}`,
        Boolean(cabin),
      );
    });

  const wildlife = new THREE.Group();
  wildlife.name = 'grassrivers-wildlife';
  feature.add(wildlife);
  addInstances(
    wildlife,
    geometry.cylinder,
    materials.marsh,
    Array.from({ length: coarsePointer ? 24 : 62 }, (_, index) => ({
      position: [((index * 19) % 95) - 48, 0.03, -18 - ((index * 31) % 205)] as Vec3,
      scale: [0.28 + (index % 4) * 0.12, 0.045, 0.28 + (index % 3) * 0.1] as Vec3,
      rotation: [0, index * 0.61, 0] as Vec3,
    })),
    'grassrivers-lily-pads',
    false,
  );
  const gatorPositions: readonly Vec3[] = [
    [-18, 0.1, -72],
    [33, 0.1, -130],
    [-42, 0.1, -173],
  ];
  for (const [index, position] of gatorPositions.entries()) {
    const gator = new THREE.Group();
    gator.name = `grassrivers-alligator-${index + 1}`;
    gator.position.set(...position);
    wildlife.add(gator);
    addMesh(
      gator,
      geometry.sphere,
      materials.darkRock,
      [0, 0.06, 0],
      [0.65, 0.18, 3.2],
      [0, 0.15 * index, 0],
    );
    addMesh(
      gator,
      geometry.cone,
      materials.darkRock,
      [0, 0.05, -2.15],
      [0.7, 3.2, 0.7],
      [Math.PI / 2, 0, 0],
    );
  }

  addPhotoVegetation(
    feature,
    geometry,
    renderer,
    PHOTO_VEGETATION_ASSETS.cypress,
    [
      [-32, -25, 10],
      [35, -18, 12],
      [-39, -92, 14],
      [42, -132, 11],
      [-30, -175, 13],
    ],
    'grassrivers-photo-cypress',
  );
  return [
    { x: campX, z: campZ, width: 8, depth: 6 },
    ...settlementBuildings.map(({ x, z, width, depth }) => ({
      x,
      z,
      width,
      depth,
    })),
  ];
}

function addPortGellhornArrival(
  feature: THREE.Group,
  geometry: ArrivalGeometry,
  materials: ArrivalMaterials,
  roadWidth: number,
  coarsePointer: boolean,
  renderer: THREE.WebGLRenderer,
): readonly { x: number; z: number; width: number; depth: number }[] {
  const motelX = -22;
  const motelZ = -62;
  addMesh(
    feature,
    geometry.box,
    materials.coral,
    [motelX, 5.2, motelZ],
    [26, 10, 12],
    [0, 0.03, 0],
    'port-arrival-motel',
  );
  addMesh(
    feature,
    geometry.box,
    materials.weatheredConcrete,
    [motelX, 10.35, motelZ],
    [27.4, 0.45, 13.2],
    [0, 0.03, 0],
  );
  addMesh(
    feature,
    geometry.box,
    materials.concrete,
    [motelX, 4.65, motelZ + 6.8],
    [28, 0.38, 2.2],
    [0, 0.03, 0],
  );
  const motelDoors: Transform[] = [];
  const motelWindows: Transform[] = [];
  const roomCount = coarsePointer ? 5 : 9;
  for (let floor = 0; floor < 2; floor += 1) {
    for (let index = 0; index < roomCount; index += 1) {
      const x = motelX - 11 + (index * 22) / Math.max(1, roomCount - 1);
      motelDoors.push({
        position: [x, 2.2 + floor * 4.3, motelZ + 6.08],
        scale: [1.2, 2.5, 0.16],
      });
      motelWindows.push({
        position: [x + 1.35, 2.3 + floor * 4.3, motelZ + 6.1],
        scale: [1.2, 1.55, 0.14],
      });
    }
  }
  addInstances(feature, geometry.box, materials.dark, motelDoors, 'port-arrival-motel-doors');
  addInstances(
    feature,
    geometry.box,
    materials.warmGlass,
    motelWindows,
    'port-arrival-motel-windows',
  );
  addInstances(
    feature,
    geometry.box,
    materials.galvanized,
    [4.95, 9.1].map((height) => ({
      position: [motelX, height, motelZ + 7.75] as Vec3,
      scale: [27.2, 0.12, 0.12] as Vec3,
    })),
    'port-arrival-motel-rails',
  );
  const starletMotel = new THREE.Group();
  starletMotel.name = 'port-starlet-motel';
  const starletMotelPosition = reviewedAnchorToFeatureLocal(feature, 'L304');
  starletMotel.position.set(starletMotelPosition.x, 0, starletMotelPosition.z);
  starletMotel.userData.communityId = 'L304';
  starletMotel.userData.rawGtadb = [
    REVIEWED_GTADB_ANCHORS.L304.gtadb.x,
    REVIEWED_GTADB_ANCHORS.L304.gtadb.y,
  ];
  starletMotel.userData.evidence = REVIEWED_GTADB_ANCHORS.L304.evidence;
  starletMotel.userData.nameEvidence = REVIEWED_GTADB_ANCHORS.L304.evidence.name;
  starletMotel.userData.placementEvidence = REVIEWED_GTADB_ANCHORS.L304.evidence.placement;
  starletMotel.userData.unconfirmed = REVIEWED_GTADB_ANCHORS.L304.evidence.tagSignals.unconfirmed;
  starletMotel.userData.demolished = REVIEWED_GTADB_ANCHORS.L304.evidence.tagSignals.demolished;
  starletMotel.userData.visualInterpretation = 'APPROXIMATE';
  starletMotel.userData.visualReference = 'Rockstar / Port_Gellhorn_01';
  feature.add(starletMotel);
  // PG01 supports a low pitched roof, masonry piers and a deep shaded porch.
  // The interpreted footprint stays centred on L304; no scene image stands in for geometry.
  addMesh(starletMotel, geometry.box, materials.cream, [0, 1.85, -1], [26, 3.4, 10]);
  addMesh(starletMotel, geometry.box, materials.weatheredConcrete, [0, 0.18, 0], [27, 0.36, 13]);
  addMesh(starletMotel, geometry.box, materials.wornAsphalt, [0, 0.055, 5.5], [34, 0.1, 30]);
  const roofPitch = Math.atan2(2.3, 6.7);
  const roofLength = Math.hypot(2.3, 6.7);
  const motelRoofMaterial = standard(0x424948, 0.72, 0.3, createNoiseTexture(304, 24));
  motelRoofMaterial.name = 'street-leonida/starlet/weathered-metal-roof';
  addInstances(
    starletMotel,
    geometry.box,
    motelRoofMaterial,
    [-1, 1].map((side) => ({
      position: [0, 4.7, side * 3.35] as Vec3,
      scale: [27.5, 0.18, roofLength] as Vec3,
      rotation: [side * roofPitch, 0, 0] as Vec3,
    })),
    'port-starlet-motel-pitched-roof',
  );
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-6, 0);
  gableShape.lineTo(6, 0);
  gableShape.lineTo(0, 2.05);
  gableShape.closePath();
  const gableGeometry = new THREE.ExtrudeGeometry(gableShape, {
    depth: 0.16,
    bevelEnabled: false,
  });
  addInstances(
    starletMotel,
    gableGeometry,
    materials.cream,
    [-13, 12.84].map((x) => ({
      position: [x, 3.58, 0] as Vec3,
      scale: [1, 1, 1] as Vec3,
      rotation: [0, Math.PI / 2, 0] as Vec3,
    })),
    'port-starlet-motel-gable-ends',
  );
  const roofSeams: Transform[] = [];
  for (let x = -13; x <= 13; x += coarsePointer ? 1.4 : 0.7) {
    for (const side of [-1, 1]) {
      roofSeams.push({
        position: [x, 4.81, side * 3.35],
        scale: [0.032, 0.045, roofLength],
        rotation: [side * roofPitch, 0, 0],
      });
    }
  }
  addInstances(
    starletMotel,
    geometry.box,
    materials.steel,
    roofSeams,
    'port-starlet-motel-roof-seams',
    false,
  );
  addInstances(
    starletMotel,
    geometry.box,
    materials.paleConcrete,
    [-6.65, 6.65].map((z) => ({
      position: [0, 3.49, z] as Vec3,
      scale: [27.5, 0.18, 0.16] as Vec3,
    })),
    'port-starlet-motel-eaves',
  );
  const exactMotelDoors: Transform[] = [];
  const exactMotelWindows: Transform[] = [];
  const windowFrames: Transform[] = [];
  const windowBlinds: Transform[] = [];
  const porchPiers: Transform[] = [];
  const porchLights: Transform[] = [];
  for (let index = 0; index < 7; index += 1) {
    const x = -11.1 + index * 3.65;
    exactMotelDoors.push({
      position: [x - 0.72, 1.58, 4.055],
      scale: [0.88, 2.4, 0.14],
    });
    exactMotelWindows.push({
      position: [x + 0.83, 2.02, 4.08],
      scale: [1.52, 1.52, 0.14],
    });
    for (const side of [-1, 1]) {
      windowFrames.push({
        position: [x + 0.83 + side * 0.81, 2.02, 4.22],
        scale: [0.12, 1.76, 0.24],
      });
      windowFrames.push({
        position: [x + 0.83, 2.02 + side * 0.81, 4.22],
        scale: [1.74, 0.12, 0.24],
      });
    }
    for (let slat = 0; slat < 6; slat += 1) {
      windowBlinds.push({
        position: [x + 0.83, 1.43 + slat * 0.23, 4.17],
        scale: [1.49, 0.1, 0.055],
        rotation: [0.2, 0, 0],
      });
    }
    porchPiers.push({
      position: [x - 1.67, 1.86, 6.08],
      scale: [0.47, 3.28, 0.57],
    });
    porchLights.push({
      position: [x - 0.72, 3.05, 4.24],
      scale: [0.22, 0.12, 0.15],
    });
  }
  porchPiers.push({ position: [12.5, 1.86, 6.08], scale: [0.47, 3.28, 0.57] });
  addInstances(
    starletMotel,
    geometry.box,
    materials.dark,
    exactMotelDoors,
    'port-starlet-motel-doors',
  );
  addInstances(
    starletMotel,
    geometry.box,
    materials.glass,
    exactMotelWindows,
    'port-starlet-motel-windows',
  );
  addInstances(
    starletMotel,
    geometry.box,
    materials.darkTimber,
    windowFrames,
    'port-starlet-motel-window-frames',
  );
  addInstances(
    starletMotel,
    geometry.box,
    materials.paleConcrete,
    windowBlinds,
    'port-starlet-motel-window-blinds',
    false,
  );
  addInstances(
    starletMotel,
    geometry.box,
    materials.weatheredConcrete,
    porchPiers,
    'port-starlet-motel-porch-piers',
  );
  addInstances(
    starletMotel,
    geometry.box,
    materials.amber,
    porchLights,
    'port-starlet-motel-porch-lamps',
    false,
  );
  for (const x of [-7.3, 7.3]) {
    const porchLight = new THREE.PointLight(0xffc88e, 9, 11, 2);
    porchLight.position.set(x, 3.05, 5.1);
    porchLight.castShadow = false;
    starletMotel.add(porchLight);
  }
  addInstances(
    starletMotel,
    geometry.box,
    materials.whiteLine,
    [-10.8, -7.2, -3.6, 0, 3.6, 7.2, 10.8].map((x) => ({
      position: [x, 0.116, 13.4] as Vec3,
      scale: [0.1, 0.012, 4.8] as Vec3,
    })),
    'port-starlet-motel-parking-wear',
    false,
  );
  const starletSign = new THREE.Group();
  starletSign.name = 'port-starlet-motel-sign';
  const starletSignPosition = reviewedAnchorToFeatureLocal(feature, 'L307');
  starletSign.position.set(starletSignPosition.x, 0, starletSignPosition.z);
  starletSign.userData.communityId = 'L307';
  starletSign.userData.rawGtadb = [
    REVIEWED_GTADB_ANCHORS.L307.gtadb.x,
    REVIEWED_GTADB_ANCHORS.L307.gtadb.y,
  ];
  starletSign.userData.evidence = REVIEWED_GTADB_ANCHORS.L307.evidence;
  starletSign.userData.nameEvidence = REVIEWED_GTADB_ANCHORS.L307.evidence.name;
  starletSign.userData.placementEvidence = REVIEWED_GTADB_ANCHORS.L307.evidence.placement;
  starletSign.userData.unconfirmed = REVIEWED_GTADB_ANCHORS.L307.evidence.tagSignals.unconfirmed;
  feature.add(starletSign);
  addInstances(
    starletSign,
    geometry.cylinder,
    materials.rust,
    [-1, 1].map((side) => ({
      position: [side * 2.8, 5.2, 0] as Vec3,
      scale: [0.3, 10.4, 0.3] as Vec3,
    })),
    'port-starlet-motel-sign-posts',
  );
  addMesh(starletSign, geometry.box, materials.dark, [0, 9.4, 0], [9.2, 4.6, 0.62]);
  addMesh(
    starletSign,
    geometry.plane,
    createSignMaterial(
      'street-leonida/sign/starlet-motel',
      'STARLET MOTEL',
      'GTADB NAME  •  APPROXIMATE',
      0x15252a,
      0xffb24d,
    ),
    [0, 9.4, 0.33],
    [8.65, 3.96, 1],
    [0, 0, 0],
    'port-starlet-motel-sign-face',
    false,
  );
  const signBulbs: Transform[] = [];
  for (let x = -4.1; x <= 4.1; x += 0.7) {
    signBulbs.push({
      position: [x, 11.35, 0.43],
      scale: [0.16, 0.16, 0.16],
    });
    signBulbs.push({
      position: [x, 7.46, 0.43],
      scale: [0.16, 0.16, 0.16],
    });
  }
  for (let y = 8.05; y <= 10.8; y += 0.65) {
    signBulbs.push({
      position: [-4.22, y, 0.43],
      scale: [0.16, 0.16, 0.16],
    });
    signBulbs.push({
      position: [4.22, y, 0.43],
      scale: [0.16, 0.16, 0.16],
    });
  }
  addInstances(
    starletSign,
    geometry.sphere,
    materials.amber,
    signBulbs,
    'port-starlet-sign-bulbs',
    false,
  );
  const motelLight = new THREE.PointLight(0xff9f53, 18, 40, 2);
  motelLight.position.set(0, 8.4, 2);
  motelLight.castShadow = false;
  starletSign.add(motelLight);

  const dinerX = 19;
  const dinerZ = -39;
  addMesh(
    feature,
    geometry.box,
    materials.cream,
    [dinerX, 2.9, dinerZ],
    [15, 5.6, 10],
    [0, -0.04, 0],
    'port-arrival-diner',
  );
  addMesh(feature, geometry.box, materials.glass, [dinerX, 3.1, dinerZ + 5.05], [11.8, 2.35, 0.18]);
  addMesh(feature, geometry.box, materials.coral, [dinerX, 5.85, dinerZ], [16.2, 0.5, 11.2]);
  addMesh(
    feature,
    geometry.box,
    materials.cyan,
    [dinerX, 5.55, dinerZ + 5.65],
    [11, 0.22, 0.18],
    [0, 0, 0],
    'port-arrival-diner-neon',
  );

  const cabaret = new THREE.Group();
  cabaret.name = 'port-delights-cabaret';
  const cabaretPosition = reviewedAnchorToFeatureLocal(feature, 'L629');
  cabaret.position.set(cabaretPosition.x, 0, cabaretPosition.z);
  cabaret.userData.communityId = 'L629';
  cabaret.userData.rawGtadb = [
    REVIEWED_GTADB_ANCHORS.L629.gtadb.x,
    REVIEWED_GTADB_ANCHORS.L629.gtadb.y,
  ];
  cabaret.userData.evidence = REVIEWED_GTADB_ANCHORS.L629.evidence;
  cabaret.userData.nameEvidence = REVIEWED_GTADB_ANCHORS.L629.evidence.name;
  cabaret.userData.placementEvidence = REVIEWED_GTADB_ANCHORS.L629.evidence.placement;
  cabaret.userData.unconfirmed = REVIEWED_GTADB_ANCHORS.L629.evidence.tagSignals.unconfirmed;
  cabaret.userData.visualInterpretation = 'APPROXIMATE';
  feature.add(cabaret);
  addMesh(cabaret, geometry.box, materials.cream, [0, 2.9, 0], [15, 5.6, 10]);
  addMesh(cabaret, geometry.box, materials.glass, [0, 3.1, 5.05], [11.8, 2.35, 0.18]);
  addMesh(cabaret, geometry.box, materials.coral, [0, 5.85, 0], [16.2, 0.5, 11.2]);
  addMesh(cabaret, geometry.box, materials.cyan, [0, 5.55, 5.65], [11, 0.22, 0.18]);
  addMesh(
    cabaret,
    geometry.box,
    materials.dark,
    [0, 2.3, 5.48],
    [4.6, 4.35, 0.52],
    [0, 0, 0],
    'port-cabaret-recessed-entry',
  );
  addMesh(
    cabaret,
    geometry.box,
    materials.warmGlass,
    [0, 1.95, 5.78],
    [2.65, 3.5, 0.12],
    [0, 0, 0],
    'port-cabaret-entry-glass',
  );
  addMesh(cabaret, geometry.box, materials.coral, [0, 4.5, 6.35], [7.8, 0.24, 2]);
  addInstances(
    cabaret,
    geometry.box,
    materials.rust,
    [-5.7, -3.75, 3.75, 5.7].map((x) => ({
      position: [x, 3.1, 5.46] as Vec3,
      scale: [0.22, 5.35, 0.3] as Vec3,
    })),
    'port-cabaret-vertical-fins',
  );
  addMesh(
    cabaret,
    geometry.box,
    materials.darkTimber,
    [3.8, 6.78, -0.35],
    [3.8, 1.35, 3.2],
    [0, -0.08, 0],
    'port-cabaret-rooftop-volume',
  );
  addMesh(cabaret, geometry.box, materials.dark, [0, 7.8, 5.35], [12.8, 3.2, 0.46]);
  addMesh(
    cabaret,
    geometry.plane,
    createSignMaterial(
      'street-leonida/sign/delights-cabaret',
      'DELIGHTS',
      'UNCONFIRMED  •  APPROXIMATE',
      0x321827,
      0xff4c8f,
    ),
    [0, 7.8, 5.59],
    [12.15, 2.65, 1],
    [0, 0, 0],
    'port-cabaret-sign-face',
    false,
  );
  const cabaretLight = new THREE.PointLight(0xff336f, 16, 36, 2);
  cabaretLight.position.set(0, 5.3, 8.2);
  cabaretLight.castShadow = false;
  cabaret.add(cabaretLight);

  const wetRoad = new THREE.Group();
  wetRoad.name = 'port-wet-road-puddles';
  feature.add(wetRoad);
  const wetRoadSurface = createSurfaceAtlasMaterial(renderer, 1, 0, {
    color: 0x30383b,
    roughness: 0.72,
    metalness: 0.025,
  });
  addInstances(
    wetRoad,
    geometry.box,
    wetRoadSurface,
    Array.from({ length: coarsePointer ? 10 : 20 }, (_, index) => ({
      position: [0, 0.279, 7 - index * 14] as Vec3,
      scale: [17.65, 0.012, 14.2] as Vec3,
    })),
    'port-wet-road-surface',
    false,
  );
  const puddleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0d1c22,
    roughness: 0.18,
    metalness: 0.08,
    clearcoat: 0.82,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity: 0.62,
  });
  addInstances(
    wetRoad,
    geometry.sphere,
    puddleMaterial,
    Array.from({ length: coarsePointer ? 10 : 24 }, (_, index) => ({
      position: [((index * 17) % 13) - 6, 0.298, -14 - index * 9.8] as Vec3,
      scale: [0.9 + (index % 4) * 0.55, 0.018, 1.8 + (index % 5) * 0.65] as Vec3,
      rotation: [0, index * 0.47, 0] as Vec3,
    })),
    'port-road-reflection-patches',
    false,
  );

  addUtilityGrid(
    feature,
    geometry,
    materials,
    12.2,
    [11, -25, -61, -97, -133, -169],
    'port-roadside-utility-grid',
  );
  const radioTower = new THREE.Group();
  radioTower.name = 'port-radio-tower';
  radioTower.position.set(-39, 0, -105);
  feature.add(radioTower);
  for (const side of [-1, 1]) {
    addBeam(
      radioTower,
      geometry.cylinder,
      materials.rust,
      [side * 2.4, 0, 0],
      [side * 0.5, 24, 0],
      0.16,
    );
    addBeam(
      radioTower,
      geometry.cylinder,
      materials.rust,
      [0, 0, side * 2.4],
      [0, 24, side * 0.5],
      0.16,
    );
  }
  for (let y = 3; y <= 21; y += 3) {
    addBeam(
      radioTower,
      geometry.cylinder,
      materials.rust,
      [-2.15 + y * 0.075, y, 0],
      [2.15 - y * 0.075, y, 0],
      0.08,
    );
  }
  addMesh(
    radioTower,
    geometry.sphere,
    materials.magenta,
    [0, 24.3, 0],
    [0.22, 0.22, 0.22],
    [0, 0, 0],
    undefined,
    false,
  );

  const canopyX = 20;
  const canopyZ = -100;
  addMesh(
    feature,
    geometry.box,
    materials.paleConcrete,
    [canopyX, 5.7, canopyZ],
    [22, 0.6, 13],
    [0, 0, 0],
    'port-arrival-gas-canopy',
  );
  addMesh(feature, geometry.box, materials.cyan, [canopyX, 5.55, canopyZ + 6.4], [22, 0.35, 0.2]);
  const canopyPosts = [-1, 1].flatMap((xSide) =>
    [-1, 1].map((zSide) => ({
      position: [canopyX + xSide * 8.6, 2.8, canopyZ + zSide * 4.6] as Vec3,
      scale: [0.34, 5.6, 0.34] as Vec3,
    })),
  );
  addInstances(
    feature,
    geometry.box,
    materials.galvanized,
    canopyPosts,
    'port-arrival-canopy-posts',
  );
  addInstances(
    feature,
    geometry.box,
    materials.industrial,
    [-4, 4].map((offset) => ({
      position: [canopyX + offset, 1.25, canopyZ] as Vec3,
      scale: [1.1, 2.3, 1.2] as Vec3,
    })),
    'port-arrival-fuel-pumps',
  );

  addStreetLights(
    feature,
    geometry,
    materials,
    roadWidth,
    coarsePointer,
    'port-arrival-streetlights',
  );
  addVehicle(feature, [3.6, 0.3, -76], 0, 0xb32e3f, 'port-arrival-car');
  addVehicle(feature, [-4.4, 0.3, -134], Math.PI, 0x2f657d, 'port-arrival-pickup', 'pickup');
  addPhotoVegetation(
    feature,
    geometry,
    renderer,
    PHOTO_VEGETATION_ASSETS.palm,
    [
      [-33, -24, 9.6],
      [33, -19, 8.8],
      [-37, -108, 10.2],
      [38, -148, 9.4],
      [-31, -188, 8.7],
    ],
    'port-arrival-photo-palms',
  );
  return [
    { x: motelX, z: motelZ, width: 27, depth: 13 },
    { x: dinerX, z: dinerZ, width: 15, depth: 10 },
    {
      x: starletMotelPosition.x,
      z: starletMotelPosition.z,
      width: 27,
      depth: 13,
    },
    { x: cabaretPosition.x, z: cabaretPosition.z, width: 16, depth: 11 },
  ];
}

function addAmbrosiaArrival(
  feature: THREE.Group,
  geometry: ArrivalGeometry,
  materials: ArrivalMaterials,
  roadWidth: number,
  coarsePointer: boolean,
  renderer: THREE.WebGLRenderer,
): readonly { x: number; z: number; width: number; depth: number }[] {
  feature.userData.landmarkClaim = 'NONE';
  const roadsideMarket = new THREE.Group();
  roadsideMarket.name = 'ambrosia-arrival-roadside-market';
  roadsideMarket.userData.evidence = 'APPROXIMATE';
  roadsideMarket.userData.landmarkClaim = 'NONE';
  roadsideMarket.userData.infill = 'APPROXIMATE';
  feature.add(roadsideMarket);
  const marketX = -22;
  const marketZ = -31;
  addMesh(
    roadsideMarket,
    geometry.box,
    materials.cream,
    [marketX - 3, 2.5, marketZ - 12],
    [17, 5, 8],
  );
  addMesh(
    roadsideMarket,
    geometry.plane,
    createAtlasMaterial(renderer, 0, 1),
    [marketX - 3, 2.5, marketZ - 7.94],
    [16.4, 4.7, 1],
    [0, 0, 0],
    'ambrosia-roadside-market-facade',
    false,
  );
  addMesh(
    roadsideMarket,
    geometry.box,
    materials.industrial,
    [marketX, 5.8, marketZ],
    [20, 0.65, 12],
  );
  addMesh(
    roadsideMarket,
    geometry.box,
    materials.coral,
    [marketX, 5.56, marketZ + 5.86],
    [20, 0.22, 0.25],
  );
  addInstances(
    roadsideMarket,
    geometry.box,
    materials.paleConcrete,
    [-1, 1].flatMap((xSide) =>
      [-1, 1].map((zSide) => ({
        position: [marketX + xSide * 7.6, 2.8, marketZ + zSide * 4.1] as Vec3,
        scale: [0.46, 5.6, 0.46] as Vec3,
      })),
    ),
    'ambrosia-market-canopy-posts',
  );
  addInstances(
    roadsideMarket,
    geometry.box,
    materials.industrial,
    [-4.2, 4.2].map((offset) => ({
      position: [marketX + offset, 1.18, marketZ] as Vec3,
      scale: [1.15, 2.2, 1.25] as Vec3,
    })),
    'ambrosia-market-display-islands',
  );
  addMesh(
    roadsideMarket,
    geometry.cylinder,
    materials.steel,
    [marketX + 8.4, 4.2, marketZ + 10],
    [0.34, 8.4, 0.34],
  );
  addMesh(
    roadsideMarket,
    geometry.box,
    materials.industrial,
    [marketX + 8.4, 8.2, marketZ + 10],
    [5.2, 3.8, 0.55],
  );
  addMesh(
    roadsideMarket,
    geometry.plane,
    createSignMaterial(
      'street-leonida/sign/roadside-market',
      'ROADSIDE',
      'MARKET  •  COLD DRINKS',
      0x1f5b74,
      0xffdf79,
    ),
    [marketX + 8.4, 8.2, marketZ + 10.29],
    [4.75, 3.2, 1],
    [0, 0, 0],
    'ambrosia-market-sign-face',
    false,
  );

  addUtilityGrid(
    feature,
    geometry,
    materials,
    11.6,
    [12, -20, -52, -84, -116, -148, -180],
    'ambrosia-utility-grid',
  );
  const arrivalUtilityGrid = feature.getObjectByName('ambrosia-utility-grid');
  if (arrivalUtilityGrid) {
    arrivalUtilityGrid.userData.evidence = 'APPROXIMATE';
    arrivalUtilityGrid.userData.landmarkClaim = 'NONE';
    arrivalUtilityGrid.userData.infill = 'APPROXIMATE';
  }

  const billboard = new THREE.Group();
  billboard.name = 'ambrosia-weathered-billboard';
  billboard.userData.evidence = 'APPROXIMATE';
  billboard.userData.landmarkClaim = 'NONE';
  feature.add(billboard);
  addInstances(
    billboard,
    geometry.cylinder,
    materials.rust,
    [-1, 1].map((side) => ({
      position: [22 + side * 3.8, 4.8, -37] as Vec3,
      scale: [0.3, 9.6, 0.3] as Vec3,
    })),
    'ambrosia-weathered-billboard-posts',
  );
  addMesh(
    billboard,
    geometry.box,
    materials.dark,
    [22, 9.3, -37],
    [14.5, 6.2, 0.55],
    [0, 0, 0],
    'ambrosia-weathered-billboard-face',
  );
  addMesh(
    billboard,
    geometry.plane,
    createSurfaceAtlasMaterial(renderer, 1, 1, {
      color: 0xb39b78,
      roughness: 0.96,
      metalness: 0.01,
    }),
    [22, 9.3, -36.68],
    [13.8, 5.5, 1],
    [0, 0, 0],
    'ambrosia-weathered-billboard-patina',
    false,
  );

  const industrialHorizon = new THREE.Group();
  industrialHorizon.name = 'ambrosia-industrial-horizon';
  industrialHorizon.userData.evidence = 'APPROXIMATE';
  industrialHorizon.userData.landmarkClaim = 'NONE';
  industrialHorizon.userData.infill = 'APPROXIMATE';
  feature.add(industrialHorizon);
  addInstances(
    industrialHorizon,
    geometry.cylinder,
    materials.weatheredConcrete,
    [
      { position: [31, 13, -164] as Vec3, scale: [7.5, 26, 7.5] as Vec3 },
      { position: [42, 15, -169] as Vec3, scale: [8.4, 30, 8.4] as Vec3 },
      { position: [53, 12, -161] as Vec3, scale: [7.1, 24, 7.1] as Vec3 },
    ],
    'ambrosia-horizon-process-towers',
  );
  addInstances(
    industrialHorizon,
    geometry.cylinder,
    materials.rust,
    [
      { position: [-36, 22, -185] as Vec3, scale: [2.4, 44, 2.4] as Vec3 },
      { position: [-27, 18, -179] as Vec3, scale: [1.9, 36, 1.9] as Vec3 },
    ],
    'ambrosia-horizon-smokestacks',
  );
  const pylon = new THREE.Group();
  pylon.name = 'ambrosia-power-pylon';
  pylon.position.set(-50, 0, -135);
  industrialHorizon.add(pylon);
  for (const side of [-1, 1]) {
    addBeam(
      pylon,
      geometry.cylinder,
      materials.steel,
      [side * 5.5, 0, 0],
      [side * 1.1, 26, 0],
      0.18,
    );
    addBeam(
      pylon,
      geometry.cylinder,
      materials.steel,
      [side * 5.1, 7, 0],
      [-side * 3.9, 14, 0],
      0.11,
    );
  }
  for (const y of [8, 14, 20, 25]) {
    addBeam(
      pylon,
      geometry.cylinder,
      materials.steel,
      [-5.5 + y * 0.17, y, 0],
      [5.5 - y * 0.17, y, 0],
      0.12,
    );
  }

  const cane: Transform[] = [];
  const rows = coarsePointer ? 12 : 28;
  for (let row = 0; row < rows; row += 1) {
    const side = row % 2 ? -1 : 1;
    const x = side * (11 + (row % 7) * 2.1);
    for (let z = -10; z >= -245; z -= coarsePointer ? 9 : 5.5) {
      if (x < -10 && z < -18 && z > -54) continue;
      cane.push({
        position: [x, 1.25, z],
        scale: [0.16, 2.5, 0.16],
        rotation: [0, row * 0.37, 0],
      });
    }
  }
  addInstances(
    feature,
    geometry.cylinder,
    materials.cane,
    cane,
    'ambrosia-arrival-cane-fields',
    false,
  );
  addPhotoVegetation(
    feature,
    geometry,
    renderer,
    PHOTO_VEGETATION_ASSETS.sugarcane,
    Array.from({ length: coarsePointer ? 12 : 28 }, (_, index) => {
      const side = index % 2 ? -1 : 1;
      return [side * (13 + (index % 6) * 3.2), -8 - index * 8.3, 2.6 + (index % 4) * 0.28] as const;
    }).filter(([x, z]) => !(x < -10 && z < -18 && z > -54)),
    'ambrosia-arrival-photo-sugarcane',
  );

  const railZ = -12;
  addInstances(
    feature,
    geometry.box,
    materials.steel,
    [-1.05, 1.05].map((zOffset) => ({
      position: [0, 0.38, railZ + zOffset] as Vec3,
      scale: [48, 0.1, 0.12] as Vec3,
    })),
    'ambrosia-arrival-rail-crossing',
  );
  const sleepers: Transform[] = [];
  for (let x = -23; x <= 23; x += 1.3)
    sleepers.push({ position: [x, 0.31, railZ], scale: [0.28, 0.08, 3.2] });
  addInstances(
    feature,
    geometry.box,
    materials.darkTimber,
    sleepers,
    'ambrosia-arrival-rail-sleepers',
    false,
  );

  const hallX = -24;
  const hallZ = -70;
  addMesh(
    feature,
    geometry.box,
    materials.weatheredConcrete,
    [hallX, 6, hallZ],
    [28, 12, 18],
    [0, 0.03, 0],
    'ambrosia-arrival-processing-hall',
  );
  const facadeTexture = loadTexture(
    publicPath('assets/street-leonida/facades/ambrosia-company-town.webp'),
    renderer,
  );
  facadeTexture.wrapS = THREE.ClampToEdgeWrapping;
  facadeTexture.wrapT = THREE.ClampToEdgeWrapping;
  const facadeMaterial = new THREE.MeshStandardMaterial({
    map: facadeTexture,
    roughness: 0.88,
    metalness: 0.02,
  });
  addMesh(
    feature,
    geometry.plane,
    facadeMaterial,
    [hallX, 6, hallZ + 9.13],
    [26, 10.5, 1],
    [0, 0, 0],
    'ambrosia-arrival-photoreal-facade',
  );
  addMesh(feature, geometry.box, materials.rust, [hallX, 12.35, hallZ], [29.2, 0.7, 19.2]);
  addMesh(feature, geometry.box, materials.dark, [hallX, 4.2, hallZ + 9.08], [6.2, 7.5, 0.2]);
  addInstances(
    feature,
    geometry.box,
    materials.warmGlass,
    [-9, -3, 3, 9].map((offset) => ({
      position: [hallX + offset, 8.1, hallZ + 9.12] as Vec3,
      scale: [3.2, 2.2, 0.18] as Vec3,
    })),
    'ambrosia-arrival-hall-windows',
  );

  const silos: Transform[] = [];
  const siloRoofs: Transform[] = [];
  for (let index = 0; index < 4; index += 1) {
    const x = 19 + (index % 2) * 8;
    const z = -63 - Math.floor(index / 2) * 12;
    silos.push({ position: [x, 8.5, z], scale: [6.8, 17, 6.8] });
    siloRoofs.push({ position: [x, 18.2, z], scale: [7.3, 3.2, 7.3] });
  }
  addInstances(feature, geometry.cylinder, materials.galvanized, silos, 'ambrosia-arrival-silos');
  addInstances(feature, geometry.cone, materials.rust, siloRoofs, 'ambrosia-arrival-silo-roofs');
  addMesh(
    feature,
    geometry.cylinder,
    materials.rust,
    [29, 18, -125],
    [3.8, 36, 3.8],
    [0, 0, 0],
    'ambrosia-arrival-smokestack',
  );
  addMesh(
    feature,
    geometry.box,
    materials.steel,
    [1, 12, -91],
    [34, 1.2, 1.2],
    [0, 0, -0.22],
    'ambrosia-arrival-conveyor',
  );
  addMesh(
    feature,
    geometry.box,
    materials.industrial,
    [0, 12.7, -91],
    [33, 0.28, 1.35],
    [0, 0, -0.22],
  );

  addStreetLights(
    feature,
    geometry,
    materials,
    roadWidth,
    coarsePointer,
    'ambrosia-arrival-yard-lights',
  );
  addVehicle(feature, [-3.8, 0.3, -112], 0, 0xb32e3f, 'ambrosia-arrival-tanker', 'tanker');
  return [
    { x: hallX, z: hallZ, width: 28, depth: 18 },
    { x: marketX - 3, z: marketZ - 12, width: 17, depth: 8 },
    { x: marketX, z: marketZ, width: 20, depth: 12 },
  ];
}

function addMountKalagaArrival(
  feature: THREE.Group,
  geometry: ArrivalGeometry,
  materials: ArrivalMaterials,
  roadWidth: number,
  coarsePointer: boolean,
  renderer: THREE.WebGLRenderer,
): readonly { x: number; z: number; width: number; depth: number }[] {
  const rockCut = new THREE.Group();
  rockCut.name = 'kalaga-weathered-rock-cut-corridor';
  feature.add(rockCut);
  const rockCutWalls: Transform[] = [];
  const rockCutSteps = coarsePointer ? 12 : 24;
  for (let index = 0; index < rockCutSteps; index += 1) {
    const z = 2 - index * 9.8;
    for (const side of [-1, 1]) {
      const height = 7 + ((index * 7 + (side > 0 ? 3 : 0)) % 7);
      rockCutWalls.push({
        position: [side * (24 + ((index * 5) % 7)), height * 0.44, z],
        scale: [9 + (index % 4) * 1.25, height * 0.9, 9 + (index % 3) * 1.35],
        rotation: [index * 0.08, index * 0.41, side * 0.12],
      });
    }
  }
  const rockCutSurface = createSurfaceAtlasMaterial(renderer, 0, 0, {
    color: 0xcfc0ae,
    roughness: 1,
  });
  addInstances(
    rockCut,
    geometry.rock,
    rockCutSurface,
    rockCutWalls,
    'kalaga-rock-cut-cliff-masses',
    true,
  );
  addInstances(
    rockCut,
    geometry.rock,
    materials.darkRock,
    Array.from({ length: coarsePointer ? 22 : 58 }, (_, index) => {
      const side = index % 2 ? -1 : 1;
      return {
        position: [side * (8.5 + ((index * 7) % 7)), 0.45, -5 - ((index * 17) % 226)] as Vec3,
        scale: [0.8 + (index % 4) * 0.35, 0.65, 1.1 + (index % 5) * 0.3] as Vec3,
        rotation: [index * 0.11, index * 0.57, index * 0.04] as Vec3,
      };
    }),
    'kalaga-rock-cut-roadside-rockfall',
  );

  const railBridge = new THREE.Group();
  railBridge.name = 'kalaga-overhead-rail-bridge';
  railBridge.position.set(0, 0, -158);
  feature.add(railBridge);
  addMesh(railBridge, geometry.box, materials.darkTimber, [0, 13.5, 0], [86, 0.75, 5.2]);
  addInstances(
    railBridge,
    geometry.box,
    materials.rust,
    [-31, 31].map((x) => ({
      position: [x, 6.7, 0] as Vec3,
      scale: [2.8, 13.4, 4.4] as Vec3,
    })),
    'kalaga-rail-bridge-piers',
  );
  const bridgeBeams: Array<{ start: Vec3; end: Vec3 }> = [];
  for (const zSide of [-1, 1]) {
    bridgeBeams.push({
      start: [-41, 14, zSide * 2.5],
      end: [41, 14, zSide * 2.5],
    });
    bridgeBeams.push({
      start: [-41, 23, zSide * 2.5],
      end: [41, 23, zSide * 2.5],
    });
    for (let x = -40; x < 40; x += 10) {
      bridgeBeams.push({
        start: [x, 14, zSide * 2.5],
        end: [x + 10, 23, zSide * 2.5],
      });
      bridgeBeams.push({
        start: [x, 23, zSide * 2.5],
        end: [x + 10, 14, zSide * 2.5],
      });
    }
  }
  for (const [index, beam] of bridgeBeams.entries()) {
    addBeam(
      railBridge,
      geometry.cylinder,
      materials.rust,
      beam.start,
      beam.end,
      0.18,
      index === 0 ? 'kalaga-rail-bridge-truss' : undefined,
    );
  }

  const industrialSite = new THREE.Group();
  industrialSite.name = 'kalaga-industrial-silo-site';
  industrialSite.userData.evidence = 'VISUAL_REFERENCE_ONLY';
  industrialSite.userData.function = 'APPROXIMATE';
  industrialSite.position.set(43, 0, -205);
  feature.add(industrialSite);
  addInstances(
    industrialSite,
    geometry.cylinder,
    materials.weatheredConcrete,
    [0, 9, 18, 27].map((x, index) => ({
      position: [x, 13 + (index % 2) * 2.2, 0] as Vec3,
      scale: [7.3, 26 + (index % 2) * 4.4, 7.3] as Vec3,
    })),
    'kalaga-industrial-silo-bodies',
  );
  addMesh(
    industrialSite,
    geometry.plane,
    createAtlasMaterial(renderer, 1, 1),
    [13.5, 13.5, 7.38],
    [34, 25, 1],
    [0, 0, 0],
    'kalaga-industrial-weathered-facade',
    false,
  );
  addMesh(
    industrialSite,
    geometry.box,
    materials.rust,
    [13.5, 26.5, 0],
    [43, 1.1, 1.1],
    [0, 0, -0.12],
  );

  const understory = new THREE.Group();
  understory.name = 'kalaga-forest-understory';
  feature.add(understory);
  addInstances(
    understory,
    geometry.sphere,
    materials.foliage,
    Array.from({ length: coarsePointer ? 26 : 72 }, (_, index) => {
      const side = index % 2 ? -1 : 1;
      return {
        position: [side * (11 + ((index * 13) % 50)), 0.65, 10 - ((index * 29) % 265)] as Vec3,
        scale: [
          1.4 + (index % 4) * 0.45,
          1.1 + (index % 3) * 0.4,
          1.6 + (index % 5) * 0.32,
        ] as Vec3,
        rotation: [0, index * 0.73, 0] as Vec3,
      };
    }),
    'kalaga-native-shrubs',
    false,
  );
  addInstances(
    understory,
    geometry.cylinder,
    materials.darkTimber,
    Array.from({ length: coarsePointer ? 8 : 18 }, (_, index) => ({
      position: [
        index % 2 ? -14 - (index % 5) * 5 : 14 + (index % 5) * 5,
        0.5,
        -18 - index * 12,
      ] as Vec3,
      scale: [0.24, 5 + (index % 4), 0.24] as Vec3,
      rotation: [Math.PI / 2, index * 0.4, 0] as Vec3,
    })),
    'kalaga-fallen-timber',
  );

  const rocks: Transform[] = [];
  for (let index = 0; index < (coarsePointer ? 36 : 82); index += 1) {
    const side = index % 2 ? -1 : 1;
    const x = side * (10 + ((index * 11) % 45));
    const z = 14 - ((index * 23) % 278);
    const size = 1.4 + ((index * 7) % 34) / 10;
    rocks.push({
      position: [x, size * 0.34, z],
      scale: [size, size * 0.75, size * (0.7 + (index % 4) * 0.1)],
      rotation: [index * 0.07, index * 0.43, index * 0.03],
    });
  }
  addInstances(feature, geometry.rock, materials.sandstone, rocks, 'kalaga-arrival-rocks', true);
  const pines: Array<readonly [number, number, number]> = [];
  for (let index = 0; index < (coarsePointer ? 64 : 160); index += 1) {
    const side = index % 2 ? -1 : 1;
    const row = Math.floor(index / 2) % 3;
    const z = 14 - ((index * 19) % 282);
    let x = side * (11.5 + row * 6 + ((index * 7) % 5) * 0.8);
    if (x < 0 && x >= -22 && z >= -45 && z <= 8) x -= 14;
    pines.push([x, z, 10 + ((index * 13) % 105) / 10]);
  }
  addPhotoVegetation(
    feature,
    geometry,
    renderer,
    PHOTO_VEGETATION_ASSETS.pine,
    pines.filter((_, index) => index % (coarsePointer ? 2 : 1) === 0),
    'kalaga-arrival-photo-pines',
  );

  const riverZ = -102;
  addMesh(
    feature,
    geometry.box,
    materials.water,
    [0, 0.14, riverZ],
    [150, 0.08, 26],
    [0, 0.13, 0],
    'kalaga-arrival-river',
    false,
  );
  addMesh(
    feature,
    geometry.box,
    materials.steel,
    [0, 0.55, riverZ],
    [roadWidth + 3.2, 0.55, 32],
    [0, 0, 0],
    'kalaga-arrival-bridge-deck',
  );
  const truss: Transform[] = [];
  for (const side of [-1, 1]) {
    const x = side * (roadWidth / 2 + 1.25);
    for (let z = riverZ - 14; z <= riverZ + 14; z += 4.7) {
      truss.push({ position: [x, 2.7, z], scale: [0.2, 5.2, 0.2] });
      truss.push({
        position: [x, 5.2, z + 2.3],
        scale: [0.2, 5.6, 0.2],
        rotation: [Math.PI / 4, 0, 0],
      });
    }
    truss.push({ position: [x, 5.3, riverZ], scale: [0.24, 0.24, 31] });
  }
  addInstances(feature, geometry.box, materials.rust, truss, 'kalaga-arrival-bridge-truss');

  const cabinX = -19;
  const cabinZ = -48;
  const roadsideShelter = addMesh(
    feature,
    geometry.box,
    materials.darkTimber,
    [cabinX, 2.6, cabinZ],
    [10, 5.2, 8],
    [0, 0.08, 0],
    'kalaga-approximate-roadside-shelter',
  );
  roadsideShelter.userData.evidence = 'APPROXIMATE';
  roadsideShelter.userData.landmarkClaim = 'NONE';
  addMesh(feature, geometry.box, materials.warmGlass, [cabinX, 3, cabinZ + 4.05], [2.3, 1.8, 0.14]);
  addMesh(
    feature,
    geometry.box,
    materials.dark,
    [cabinX + 3.1, 2.55, cabinZ + 4.08],
    [1.5, 3.8, 0.16],
  );
  addMesh(feature, geometry.cylinder, materials.darkRock, [-10, 2.4, -20], [0.42, 4.8, 0.42]);
  const parkSignBacking = addMesh(
    feature,
    geometry.box,
    materials.industrial,
    [-10, 5.25, -20],
    [7.5, 2.3, 0.55],
    [0, 0.08, 0],
    'kalaga-arrival-park-sign',
  );
  parkSignBacking.userData.evidence = 'APPROXIMATE';
  parkSignBacking.userData.landmarkClaim = 'NONE';
  const parkSign = addMesh(
    feature,
    geometry.plane,
    createSignMaterial(
      'street-leonida/sign/mount-kalaga',
      'MOUNT KALAGA',
      'COMMUNITY RECONSTRUCTION  •  APPROXIMATE',
      0x193c2d,
      0xd5aa4a,
    ),
    [-10, 5.25, -19.71],
    [7.05, 2.02, 1],
    [0, 0.08, 0],
    'kalaga-arrival-park-sign-face',
    false,
  );
  parkSign.userData.evidence = 'APPROXIMATE';
  parkSign.userData.placement = 'APPROXIMATE';
  parkSign.userData.landmarkClaim = 'NONE';

  const guardrailSegments: Transform[] = [];
  const roadSegmentCount = coarsePointer ? 24 : 30;
  for (let index = 0; index < roadSegmentCount; index += 1) {
    const start = mountRoadPointAt(index, roadSegmentCount);
    const end = mountRoadPointAt(index + 1, roadSegmentCount);
    const centerZ = (start.z + end.z) / 2;
    if (centerZ > -125 || centerZ < -235) continue;
    const deltaX = end.x - start.x;
    const deltaZ = end.z - start.z;
    const length = Math.hypot(deltaX, deltaZ);
    const yaw = Math.atan2(deltaX, deltaZ);
    const perpendicularX = deltaZ / length;
    const perpendicularZ = -deltaX / length;
    const centerX = (start.x + end.x) / 2;
    for (const side of [-1, 1]) {
      const offset = side * (roadWidth / 2 + 1.5);
      guardrailSegments.push({
        position: [centerX + perpendicularX * offset, 0.75, centerZ + perpendicularZ * offset],
        scale: [0.16, 0.22, length + 0.58],
        rotation: [0, yaw, 0],
      });
    }
  }
  addInstances(
    feature,
    geometry.box,
    materials.galvanized,
    guardrailSegments,
    'kalaga-arrival-road-guardrails',
  );
  addVehicle(feature, [3.2, 0.3, -62], 0, 0x2f657d, 'kalaga-arrival-utility-truck', 'utility');
  return [{ x: cabinX, z: cabinZ, width: 10, depth: 8 }];
}

export interface RegionalArrivalGroup extends THREE.Group {
  update(elapsedSeconds: number): void;
  dispose(): void;
}

/**
 * Adds a region-specific, evidence-labelled foreground at each map arrival.
 * Global placement remains in the pinned GTADB coordinate frame; these close-up
 * silhouettes interpret documented regional character and are APPROXIMATE.
 */
export function addRegionalArrivalForeground(
  parent: THREE.Object3D,
  collisions: AxisAlignedRectangle[],
  region: WalkRenderRegion,
  coarsePointer: boolean,
  renderer: THREE.WebGLRenderer,
): RegionalArrivalGroup | null {
  const view = PLACE_ENTRY_VIEWS[PLACE_SLUGS[region]];
  if (!view) return null;
  const geometry = createGeometry(coarsePointer);
  const materials = createMaterials(renderer);
  const photographedSurfaces = applyArrivalPhotographicSurfaces(materials, coarsePointer);
  const feature = new THREE.Group() as RegionalArrivalGroup;
  feature.name = REGIONAL_ARRIVAL_FEATURE_IDS[region];
  feature.position.set(view.position.x, 0, view.position.z);
  feature.rotation.y = Math.atan2(view.position.x - view.target.x, view.position.z - view.target.z);
  feature.userData.feature = true;
  feature.userData.featureId = feature.name;
  feature.userData.evidence = 'APPROXIMATE';
  feature.userData.detailProfile = region;
  feature.userData.roadLengthMetres = 280;
  feature.userData.source = 'Rockstar visual evidence + pinned GTADB context';
  feature.userData.rockstarPrimaryShot = WALK_ROCKSTAR_REFERENCE_PROFILES[region].primaryShot;
  feature.userData.rockstarSupportingShots = [
    ...WALK_ROCKSTAR_REFERENCE_PROFILES[region].supportingShots,
  ];
  feature.userData.photoVegetationAssets = [
    region === 'grassrivers'
      ? PHOTO_VEGETATION_ASSETS.cypress
      : region === 'mount-kalaga'
        ? PHOTO_VEGETATION_ASSETS.pine
        : region === 'ambrosia'
          ? PHOTO_VEGETATION_ASSETS.sugarcane
          : PHOTO_VEGETATION_ASSETS.palm,
  ];
  parent.add(feature);

  const roadWidth = addCommonRoad(feature, geometry, materials, region, coarsePointer);
  const localCollisions =
    region === 'vice-city'
      ? addViceCityArrival(feature, geometry, materials, roadWidth, coarsePointer, renderer)
      : region === 'leonida-keys'
        ? addKeysArrival(feature, geometry, materials, roadWidth, coarsePointer, renderer)
        : region === 'grassrivers'
          ? addGrassriversArrival(feature, geometry, materials, roadWidth, coarsePointer, renderer)
          : region === 'port-gellhorn'
            ? addPortGellhornArrival(
                feature,
                geometry,
                materials,
                roadWidth,
                coarsePointer,
                renderer,
              )
            : region === 'ambrosia'
              ? addAmbrosiaArrival(feature, geometry, materials, roadWidth, coarsePointer, renderer)
              : addMountKalagaArrival(
                  feature,
                  geometry,
                  materials,
                  roadWidth,
                  coarsePointer,
                  renderer,
                );
  const scenery = addRegionalScenery(feature, region, coarsePointer, localCollisions, {
    plaster: materials.cream,
    concrete: materials.concrete,
    wood: materials.timber,
    metal: materials.steel,
    glass: materials.glass,
    ground: region === 'grassrivers' ? materials.marsh : materials.sand,
    accent: materials.aqua,
    canvas: materials.coral,
  });
  for (const c of scenery.collisions)
    addCollision(
      collisions,
      view.position,
      feature.rotation.y,
      (c.minX + c.maxX) / 2,
      (c.minZ + c.maxZ) / 2,
      c.maxX - c.minX,
      c.maxZ - c.minZ,
    );
  const architecture = addArrivalArchitecture(feature, region, coarsePointer);
  for (const c of architecture.collisions) {
    addCollision(
      collisions,
      view.position,
      feature.rotation.y,
      (c.minX + c.maxX) / 2,
      (c.minZ + c.maxZ) / 2,
      c.maxX - c.minX,
      c.maxZ - c.minZ,
    );
  }
  if (region === 'mount-kalaga') {
    feature.add(createCanyonRelief(coarsePointer, photographedSurfaces.applyRock, scenery.parcels));
  }
  if (region === 'port-gellhorn') {
    for (let i = 0; i < (coarsePointer ? 2 : 4); i++) {
      const light = new THREE.PointLight(0xffbd7b, 170, 38, 2);
      light.name = 'port-streetlight-pool';
      light.position.set(i % 2 ? -10.5 : 10.5, 6.8, 3 - i * 24);
      feature.add(light);
    }
  }
  for (const collision of localCollisions) {
    addCollision(
      collisions,
      view.position,
      feature.rotation.y,
      collision.x,
      collision.z,
      collision.width,
      collision.depth,
    );
  }
  const activeWater = feature.getObjectByName(
    region === 'grassrivers' ? 'grassrivers-arrival-water' : 'keys-arrival-water',
  ) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial> | undefined;
  const waterSurface = activeWater
    ? installWalkWaterSurface(activeWater.material, region === 'grassrivers' ? 0.45 : 1)
    : null;
  const people = createPedestrianLibrary();
  const actors = Array.from({ length: coarsePointer ? 2 : 4 }, (_, index) => {
    const actor = people.create({
      variant: index + (region === 'port-gellhorn' ? 3 : 0),
      height: 1.65 + index * 0.045,
      pose: index % 2 ? 'phone' : 'idle',
    });
    actor.root.position.set((index % 2 ? -1 : 1) * (roadWidth / 2 + 1.25), 0.155, 4 - index * 9);
    actor.root.rotation.y = index * 1.6;
    feature.add(actor.root);
    return actor;
  });
  // Generic palms stay on land; the authored marina water is in this same local frame.
  let palmWaterBounds: THREE.Box3 | undefined;
  if (region === 'leonida-keys' && activeWater) {
    activeWater.geometry.computeBoundingBox();
    activeWater.updateMatrix();
    palmWaterBounds = activeWater.geometry.boundingBox!.clone().applyMatrix4(activeWater.matrix);
  }
  // Canyon relief already places pines on its own elevated surface. A second
  // flat-ground planting would leave trunks buried in the rock slopes.
  const plantingCount = region === 'mount-kalaga' ? 0 : coarsePointer ? 20 : 42;
  // Anonymous vegetation describes regional character, not an exact mapped landmark.
  const planting = Array.from({ length: plantingCount }, (_, i) => {
    const angle = i * 2.39996;
    const radius = 35 + ((i * 31) % 85);
    return [Math.cos(angle) * radius, 20 + Math.sin(angle) * radius, 7 + (i % 6)] as const;
  }).filter(
    ([x, z]) =>
      Math.abs(x) > roadWidth / 2 + 6 &&
      !(palmWaterBounds && x >= palmWaterBounds.min.x && x <= palmWaterBounds.max.x &&
        z >= palmWaterBounds.min.z && z <= palmWaterBounds.max.z) &&
      !scenery.collisions.some(
        (c) => x > c.minX - 4 && x < c.maxX + 4 && z > c.minZ - 4 && z < c.maxZ + 4,
      ) &&
      !localCollisions.some(
        (c) => Math.abs(x - c.x) < c.width / 2 + 5 && Math.abs(z - c.z) < c.depth / 2 + 5,
      ),
  );
  feature.add(
    createNativeVegetation(
      region === 'grassrivers' ? 'cypress' : region === 'mount-kalaga' ? 'pine' : 'palm',
      planting,
      coarsePointer ? 'mid' : 'near',
    ),
  );
  let disposed = false;
  feature.update = (elapsed) => {
    if (!disposed) {
      waterSurface?.update(elapsed);
      actors.forEach((actor) => actor.update({ elapsedSeconds: elapsed }));
    }
  };
  feature.dispose = () => {
    if (disposed) return;
    disposed = true;
    photographedSurfaces.dispose();
    waterSurface?.dispose();
    people.dispose();
    facadeCleanup.get(feature)?.();
    facadeCleanup.delete(feature);
  };
  let detailCount = 0;
  feature.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) detailCount += object.count;
    else if (object instanceof THREE.Mesh) detailCount += 1;
  });
  feature.userData.detailCount = detailCount;
  return feature;
}
