import { publicPath } from '../explorer/public-path';
import * as THREE from 'three';

import type { AxisAlignedRectangle } from './walk-engine';
import type { WalkPoint } from './walk-engine';
import { VICE_CITY_POI_WORLD, VICE_CITY_WORLD } from './walk-geography';
import { WALK_ROCKSTAR_REFERENCE_PROFILES } from './walk-rockstar-reference';
import { createArchitecturalDetailKit } from './walk-architectural-kit';
import {
  createPedestrianLibrary,
  type PedestrianActor,
  type PedestrianLibrary,
} from './walk-pedestrians';
import {
  createMotorcycle,
  createRoadVehicleBatch,
  createRoadVehicleMaterial,
} from './walk-vehicles';

type Vec3 = readonly [number, number, number];

interface InstanceTransform {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  color?: number;
}

interface BeamTransform {
  start: Vec3;
  end: Vec3;
  diameter: number;
}

interface ViceCityGeometry {
  box: THREE.BoxGeometry;
  plane: THREE.PlaneGeometry;
  cylinder: THREE.CylinderGeometry;
  taperedCylinder: THREE.CylinderGeometry;
  sphere: THREE.SphereGeometry;
  palmCrown: THREE.ConeGeometry;
  wheel: THREE.TorusGeometry;
}

interface ViceCityMaterials {
  whiteConcrete: THREE.MeshStandardMaterial;
  paleConcrete: THREE.MeshStandardMaterial;
  darkConcrete: THREE.MeshStandardMaterial;
  warmConcrete: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  warmGlass: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  charcoalSteel: THREE.MeshStandardMaterial;
  aquaStucco: THREE.MeshStandardMaterial;
  coralStucco: THREE.MeshStandardMaterial;
  pinkStucco: THREE.MeshStandardMaterial;
  creamStucco: THREE.MeshStandardMaterial;
  cyanLight: THREE.MeshStandardMaterial;
  amberLight: THREE.MeshStandardMaterial;
  magentaLight: THREE.MeshStandardMaterial;
  asphalt: THREE.MeshStandardMaterial;
  pavement: THREE.MeshStandardMaterial;
  court: THREE.MeshStandardMaterial;
  courtLine: THREE.MeshStandardMaterial;
  sand: THREE.MeshStandardMaterial;
  water: THREE.MeshPhysicalMaterial;
  bark: THREE.MeshStandardMaterial;
  palmLeaf: THREE.MeshStandardMaterial;
  weathering: THREE.MeshStandardMaterial;
  luxuryFacade: THREE.MeshStandardMaterial;
  muralFacade: THREE.MeshStandardMaterial;
}

export interface ViceCityDistrict {
  featureIds: string[];
  update: (elapsed: number) => void;
  dispose(): void;
}

export interface ViceCityDistrictOptions {
  readonly renderCatalanBoulevard?: boolean;
}

const FEATURE_IDS = [
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
] as const;

const ANCHORS = {
  downtown: VICE_CITY_WORLD.downtown,
  megamundo: VICE_CITY_POI_WORLD.megamundoTower,
  viceBeach: VICE_CITY_WORLD.viceBeach,
  oceanBeach: VICE_CITY_WORLD.oceanBeach,
  southBeach: VICE_CITY_WORLD.southBeach,
  hotelDixon: VICE_CITY_POI_WORLD.hotelDixon,
  saharaArena: VICE_CITY_POI_WORLD.saharaArena,
  ferrisWheelStudy: VICE_CITY_POI_WORLD.ferrisWheelStudy,
  tennis: VICE_CITY_POI_WORLD.tennisCourts,
  muralUnderpass: VICE_CITY_WORLD.laPerle,
} as const;

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const ASPHALT_ASSET = publicPath('assets/street-leonida/textures/sunworn-asphalt.jpg');
const LUXURY_FACADE_ASSET = publicPath('assets/street-leonida/facades/luxury-tower-sunset.jpg');
const REGION_FACADE_ATLAS_ASSET = publicPath(
  'assets/street-leonida/facades/reference-led-facade-atlas.png',
);

function makeSurfaceTexture(
  seed: number,
  variation: number,
  verticalStreaks = false,
): THREE.DataTexture {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  let state = seed >>> 0;
  const random = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const streak = verticalStreaks ? Math.sin(x * 1.7) * 12 + (y / size) * 18 : 0;
      const value = Math.round(
        THREE.MathUtils.clamp(222 + (random() - 0.5) * variation - streak, 138, 255),
      );
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 3.2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function pbr(
  color: number,
  roughness: number,
  metalness = 0,
  emissive = 0x000000,
  emissiveIntensity = 0,
  map?: THREE.Texture,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    ...(map ? { map } : {}),
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
  });
}

function loadVisualTexture(
  asset: string,
  fallback: THREE.Texture,
  repeat: readonly [number, number],
  clamp = false,
): THREE.Texture {
  let texture = fallback;
  if (typeof document !== 'undefined') {
    texture.dispose();
    texture = new THREE.TextureLoader().load(asset);
  }
  texture.name = asset;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  return texture;
}

function createViceSignMaterial(
  name: string,
  title: string,
  subtitle: string,
  background: number,
  accent: number,
): THREE.MeshStandardMaterial {
  let texture: THREE.Texture;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 320;
    const context = canvas.getContext('2d');
    if (context) {
      const css = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
      context.fillStyle = css(background);
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = css(accent);
      context.lineWidth = 18;
      context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
      context.fillStyle = '#f7f1e8';
      context.font = '800 105px Oswald, Arial Narrow, sans-serif';
      context.textBaseline = 'middle';
      context.fillText(title, 60, 132);
      context.fillStyle = css(accent);
      context.font = '700 34px Inter, Arial, sans-serif';
      context.fillText(subtitle, 64, 232);
      texture = new THREE.CanvasTexture(canvas);
    } else {
      texture = new THREE.DataTexture(new Uint8Array([32, 32, 40, 255]), 1, 1);
    }
  } else {
    texture = new THREE.DataTexture(new Uint8Array([32, 32, 40, 255]), 1, 1);
  }
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return pbr(0xffffff, 0.46, 0.08, accent, 0.42, texture);
}

function createGeometry(coarsePointer: boolean): ViceCityGeometry {
  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    plane: new THREE.PlaneGeometry(1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, coarsePointer ? 12 : 24),
    taperedCylinder: new THREE.CylinderGeometry(0.32, 0.5, 1, coarsePointer ? 6 : 9),
    sphere: new THREE.SphereGeometry(0.5, coarsePointer ? 8 : 12, coarsePointer ? 6 : 8),
    palmCrown: new THREE.ConeGeometry(1, 0.36, coarsePointer ? 7 : 10),
    wheel: new THREE.TorusGeometry(1, 0.026, coarsePointer ? 6 : 8, coarsePointer ? 24 : 48),
  };
}

function createMaterials(): ViceCityMaterials {
  const concreteMap = makeSurfaceTexture(72531, 34, true);
  const stuccoMap = makeSurfaceTexture(31609, 24, true);
  const asphaltMap = loadVisualTexture(ASPHALT_ASSET, makeSurfaceTexture(91873, 46), [2.5, 28]);
  const luxuryFacadeMap = loadVisualTexture(
    LUXURY_FACADE_ASSET,
    makeSurfaceTexture(44_193, 28, true),
    [1, 1],
    true,
  );
  const luxuryFacade = pbr(0xffffff, 0.58, 0.08, 0x4a2511, 0.12, luxuryFacadeMap);
  luxuryFacade.side = THREE.DoubleSide;
  const muralFacadeMap = loadVisualTexture(
    REGION_FACADE_ATLAS_ASSET,
    makeSurfaceTexture(93_721, 34, true),
    [1 / 3, 1 / 2],
    true,
  );
  muralFacadeMap.offset.set(2 / 3, 0);
  const muralFacade = pbr(0xffffff, 0.72, 0.03, 0x183640, 0.08, muralFacadeMap);
  muralFacade.side = THREE.DoubleSide;
  return {
    whiteConcrete: pbr(0xe7e2d9, 0.72, 0.04, 0x000000, 0, concreteMap),
    paleConcrete: pbr(0xc8c3ba, 0.9, 0, 0x000000, 0, concreteMap),
    darkConcrete: pbr(0x30363d, 0.94, 0, 0x000000, 0, concreteMap),
    warmConcrete: pbr(0x9c806f, 0.88, 0, 0x000000, 0, concreteMap),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x173a4a,
      roughness: 0.16,
      metalness: 0.28,
      clearcoat: 0.72,
      clearcoatRoughness: 0.18,
      transparent: true,
      opacity: 0.9,
    }),
    warmGlass: pbr(0x9e643b, 0.24, 0.18, 0x5a2f16, 0.55),
    chrome: pbr(0xaebbc1, 0.25, 0.82),
    charcoalSteel: pbr(0x283039, 0.48, 0.7),
    aquaStucco: pbr(0x9fc9c7, 0.82, 0, 0x000000, 0, stuccoMap),
    coralStucco: pbr(0xd49a94, 0.84, 0, 0x000000, 0, stuccoMap),
    pinkStucco: pbr(0xd5b6c0, 0.84, 0, 0x000000, 0, stuccoMap),
    creamStucco: pbr(0xe5d9c3, 0.88, 0, 0x000000, 0, stuccoMap),
    cyanLight: pbr(0x5de9ef, 0.25, 0.22, 0x19afbc, 1.45),
    amberLight: pbr(0xffc36a, 0.3, 0.12, 0xd96c19, 1.3),
    magentaLight: pbr(0xff5daa, 0.28, 0.16, 0xb71b66, 1.4),
    asphalt: pbr(0x252a2f, 0.76, 0.05, 0x000000, 0, asphaltMap),
    pavement: pbr(0xb8afa1, 0.96),
    court: pbr(0x2f817d, 0.91),
    courtLine: pbr(0xf2ead4, 0.82),
    sand: pbr(0xd6bd83, 1),
    water: new THREE.MeshPhysicalMaterial({
      color: 0x178ca1,
      roughness: 0.2,
      metalness: 0.05,
      transmission: 0.08,
      transparent: true,
      opacity: 0.82,
      clearcoat: 0.65,
      clearcoatRoughness: 0.16,
    }),
    bark: pbr(0x725036, 1),
    palmLeaf: pbr(0x2c7046, 0.94),
    weathering: pbr(0x5c5750, 0.96, 0.02, 0x000000, 0, concreteMap),
    luxuryFacade,
    muralFacade,
  };
}

function createFeature(
  parent: THREE.Group,
  id: (typeof FEATURE_IDS)[number],
  anchor: WalkPoint,
): THREE.Group {
  const feature = new THREE.Group();
  feature.name = id;
  feature.position.set(anchor.x, 0, anchor.z);
  feature.userData.feature = true;
  feature.userData.featureId = id;
  feature.userData.worldAnchor = { x: anchor.x, z: anchor.z };
  feature.userData.evidence = 'APPROXIMATE';
  feature.userData.landmarkClaim = 'NONE';
  feature.userData.placementEvidence = 'APPROXIMATE';
  parent.add(feature);
  return feature;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  scale: Vec3,
  position: Vec3,
  name?: string,
  rotation: Vec3 = [0, 0, 0],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.scale.set(...scale);
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  if (name) result.name = name;
  parent.add(result);
  return result;
}

function addBox(
  parent: THREE.Object3D,
  geometry: ViceCityGeometry,
  surface: THREE.Material,
  size: Vec3,
  position: Vec3,
  name?: string,
  rotationY = 0,
): THREE.Mesh {
  return addMesh(parent, geometry.box, surface, size, position, name, [0, rotationY, 0]);
}

function addInstances(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  transforms: readonly InstanceTransform[],
  name: string,
  castsShadow = true,
): THREE.InstancedMesh | null {
  if (transforms.length === 0) return null;
  const instances = new THREE.InstancedMesh(geometry, surface, transforms.length);
  const dummy = new THREE.Object3D();
  transforms.forEach((transform, index) => {
    dummy.position.set(...transform.position);
    dummy.scale.set(...transform.scale);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.updateMatrix();
    instances.setMatrixAt(index, dummy.matrix);
    if (transform.color !== undefined)
      instances.setColorAt(index, new THREE.Color(transform.color));
  });
  instances.instanceMatrix.needsUpdate = true;
  if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
  instances.name = name;
  instances.castShadow = castsShadow;
  instances.receiveShadow = true;
  parent.add(instances);
  return instances;
}

function addBeam(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  start: Vec3,
  end: Vec3,
  diameter: number,
  name?: string,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const result = new THREE.Mesh(geometry, surface);
  result.position.addVectors(from, to).multiplyScalar(0.5);
  result.quaternion.setFromUnitVectors(Y_AXIS, direction.clone().normalize());
  result.scale.set(diameter, direction.length(), diameter);
  result.castShadow = true;
  result.receiveShadow = true;
  if (name) result.name = name;
  parent.add(result);
  return result;
}

function addBeamInstances(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  beams: readonly BeamTransform[],
  name: string,
): THREE.InstancedMesh | null {
  if (beams.length === 0) return null;
  const result = new THREE.InstancedMesh(geometry, surface, beams.length);
  const dummy = new THREE.Object3D();
  beams.forEach((beam, index) => {
    const start = new THREE.Vector3(...beam.start);
    const end = new THREE.Vector3(...beam.end);
    const direction = end.clone().sub(start);
    dummy.position.addVectors(start, end).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(Y_AXIS, direction.clone().normalize());
    dummy.scale.set(beam.diameter, direction.length(), beam.diameter);
    dummy.updateMatrix();
    result.setMatrixAt(index, dummy.matrix);
  });
  result.instanceMatrix.needsUpdate = true;
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function addPileCollision(
  collisions: AxisAlignedRectangle[],
  feature: THREE.Group,
  localX: number,
  localZ: number,
): void {
  const halfExtent = 0.72;
  const x = feature.position.x + localX;
  const z = feature.position.z + localZ;
  collisions.push({
    minX: x - halfExtent,
    maxX: x + halfExtent,
    minZ: z - halfExtent,
    maxZ: z + halfExtent,
  });
}

function addSolidCollision(
  collisions: AxisAlignedRectangle[],
  feature: THREE.Group,
  localX: number,
  localZ: number,
  width: number,
  depth: number,
  rotationY = 0,
  padding = 0.2,
): void {
  const cosine = Math.abs(Math.cos(rotationY));
  const sine = Math.abs(Math.sin(rotationY));
  const halfWidth = (width * cosine + depth * sine) / 2 + padding;
  const halfDepth = (width * sine + depth * cosine) / 2 + padding;
  const x = feature.position.x + localX;
  const z = feature.position.z + localZ;
  collisions.push({
    minX: x - halfWidth,
    maxX: x + halfWidth,
    minZ: z - halfDepth,
    maxZ: z + halfDepth,
  });
}

function addRoundedWaterfrontTowers(
  root: THREE.Group,
  geometry: ViceCityGeometry,
  materials: ViceCityMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): void {
  const feature = createFeature(root, FEATURE_IDS[0], ANCHORS.downtown);
  feature.userData.location = 'Downtown';
  // These anonymous towers flank the source-anchored Megamundo footprint. Their
  // former shared centre put both glass shells through the named landmark.
  const towerX = -2.5;
  const towerSpecs = [
    { z: -36, floors: 16, width: 15.5, depth: 18.8 },
    { z: 38, floors: 20, width: 17.5, depth: 22 },
  ] as const;
  const balconies: InstanceTransform[] = [];
  const mullions: InstanceTransform[] = [];
  const windows: InstanceTransform[] = [];
  const weathering: InstanceTransform[] = [];
  const rooftop: InstanceTransform[] = [];
  towerSpecs.forEach(({ z, floors, width, depth }, towerIndex) => {
    const height = floors * 3.2;
    addMesh(
      feature,
      geometry.cylinder,
      materials.whiteConcrete,
      [width + 2.2, 2, depth + 2.2],
      [towerX, 1, z],
    );
    addSolidCollision(collisions, feature, towerX, z, width + 2.2, depth + 2.2);
    addMesh(
      feature,
      geometry.cylinder,
      materials.glass,
      [width, height, depth],
      [towerX, height / 2 + 2, z],
      `vice-city-rounded-tower-${towerIndex + 1}`,
    );
    addMesh(
      feature,
      geometry.cylinder,
      materials.whiteConcrete,
      [width + 1.5, 0.6, depth + 1.5],
      [towerX, height + 2.3, z],
    );
    // A recessed penthouse and different crown proportions give each mass a
    // distinct silhouette without changing the anonymous district anchor.
    addMesh(
      feature,
      towerIndex ? geometry.box : geometry.cylinder,
      materials.glass,
      [width * 0.56, towerIndex ? 5.8 : 3.8, depth * 0.54],
      [towerX, height + (towerIndex ? 5.5 : 4.5), z],
    );
    addMesh(
      feature,
      towerIndex ? geometry.box : geometry.cylinder,
      materials.whiteConcrete,
      [width * 0.62, 0.45, depth * 0.6],
      [towerX, height + (towerIndex ? 8.6 : 6.6), z],
    );
    for (let level = 0; level < floors; level++) {
      const y = 2.15 + level * 3.2;
      balconies.push({
        position: [towerX, y, z],
        scale: [width + 1.3, 0.24, depth + 1.3],
      });
      const columns = coarsePointer ? 6 : 12;
      for (let column = 0; column < columns; column++) {
        const angle = (column * Math.PI * 2) / columns;
        windows.push({
          position: [
            towerX + Math.cos(angle) * (width / 2 + 0.06),
            y + 1.5,
            z + Math.sin(angle) * (depth / 2 + 0.06),
          ],
          scale: [coarsePointer ? 1.35 : 1.65, 2.05, 0.08],
          rotation: [0, Math.PI / 2 - angle, 0],
          color: (level + column * 3 + towerIndex) % 7 === 0 ? 0xd2b389 : 0x608491,
        });
      }
    }
    for (let column = 0; column < (coarsePointer ? 6 : 12); column++) {
      const angle = (column * Math.PI * 2) / (coarsePointer ? 6 : 12);
      mullions.push({
        position: [
          towerX + Math.cos(angle) * (width / 2 + 0.11),
          height / 2 + 2,
          z + Math.sin(angle) * (depth / 2 + 0.11),
        ],
        scale: [0.1, height, 0.1],
      });
    }
    for (let streak = 0; streak < (coarsePointer ? 2 : 5); streak++) {
      weathering.push({
        position: [towerX - width / 2 - 0.12, 3.2 + streak * 6.4, z + ((streak % 3) - 1) * 2],
        scale: [0.04, 1.1, 0.12],
      });
    }
    rooftop.push(
      { position: [towerX - 3, height + 3.05, z - 3], scale: [1.9, 1.2, 1.4] },
      { position: [towerX + 3, height + 2.85, z + 3], scale: [1.4, 0.8, 1.2] },
    );
  });
  addInstances(
    feature,
    geometry.cylinder,
    materials.whiteConcrete,
    balconies,
    'vice-city-rounded-tower-balconies',
  );
  addInstances(
    feature,
    geometry.box,
    materials.chrome,
    mullions,
    'vice-city-rounded-tower-mullions',
    false,
  );
  addInstances(
    feature,
    geometry.box,
    materials.warmGlass,
    windows,
    'vice-city-varied-window-bays',
    false,
  );
  addInstances(
    feature,
    geometry.box,
    materials.weathering,
    weathering,
    'vice-city-facade-weathering',
    false,
  );
  addInstances(feature, geometry.box, materials.charcoalSteel, rooftop, 'vice-city-rooftop-hvac');
}

function addMegamundoTower(
  root: THREE.Group,
  geometry: ViceCityGeometry,
  materials: ViceCityMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): void {
  const feature = createFeature(root, FEATURE_IDS[1], ANCHORS.megamundo);
  feature.userData.location = 'Megamundo';
  const centerX = 0;
  const height = 72;
  addBox(feature, geometry, materials.darkConcrete, [22, height, 18], [centerX, height / 2, 0]);
  addBox(feature, geometry, materials.glass, [20.2, height - 3, 18.2], [centerX, height / 2, 0]);
  addBox(feature, geometry, materials.amberLight, [23.2, 0.52, 19.4], [centerX, height + 0.25, 0]);
  addBox(
    feature,
    geometry,
    materials.cyanLight,
    [11.8, 1.4, 0.22],
    [centerX, 5.2, 9.18],
    'megamundo-sign',
  );

  const ribs: InstanceTransform[] = [];
  const ledges: InstanceTransform[] = [];
  const ribCount = coarsePointer ? 7 : 13;
  for (let index = 0; index < ribCount; index += 1) {
    const x = centerX - 9.25 + (index * 18.5) / Math.max(1, ribCount - 1);
    ribs.push({
      position: [x, height / 2, 9.2],
      scale: [0.12, height - 3.4, 0.12],
    });
  }
  addInstances(feature, geometry.box, materials.chrome, ribs, 'megamundo-facade-ribs', false);
  const floorCount = coarsePointer ? 12 : 18;
  for (let floor = 1; floor <= floorCount; floor += 1) {
    ledges.push({
      position: [centerX, (floor * (height - 5)) / floorCount + 2.5, 9.28],
      scale: [21.8, 0.16, 0.34],
    });
  }
  addInstances(
    feature,
    geometry.box,
    materials.paleConcrete,
    ledges,
    'megamundo-floor-ledges',
    false,
  );
  addSolidCollision(collisions, feature, centerX, 0, 22, 18);
}

function addArtDecoStrip(
  root: THREE.Group,
  geometry: ViceCityGeometry,
  materials: ViceCityMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): void {
  const feature = createFeature(root, FEATURE_IDS[2], ANCHORS.viceBeach);
  feature.userData.location = 'Vice Beach';
  // Anonymous frontage shares the L32 regional focus, not the hotel's footprint.
  // Put it across the existing open forecourt; its source anchor stays untouched.
  const centerX = 15;
  const frontX = 10.44;
  const facadeMaterials = [
    materials.aquaStucco,
    materials.coralStucco,
    materials.creamStucco,
    materials.pinkStucco,
    materials.aquaStucco,
  ];
  const windows: InstanceTransform[] = [];
  const frames: InstanceTransform[] = [];
  const cornices: InstanceTransform[] = [];
  const rooftop: InstanceTransform[] = [];
  const kit = createArchitecturalDetailKit({ palette: 'coastal', coarsePointer });
  for (let index = 0; index < 5; index++) {
    const z = (index - 2) * 9.5;
    const floors = 3 + (index % 2);
    const height = floors * 3.2 + 0.6;
    addBox(feature, geometry, facadeMaterials[index]!, [9, height, 8], [centerX, height / 2, z]);
    addBox(feature, geometry, materials.whiteConcrete, [9.4, 0.28, 8.4], [centerX, height, z]);
    addBox(
      feature,
      geometry,
      index % 2 === 0 ? materials.magentaLight : materials.cyanLight,
      [0.09, height - 2.2, 0.12],
      [frontX - 0.04, height / 2 + 0.5, z - 3.7],
    );
    addSolidCollision(collisions, feature, centerX, z, 9, 8);
    for (let floor = 1; floor < floors; floor++) {
      const y = 3.2 * floor + 1.55;
      cornices.push({ position: [frontX, floor * 3.2, z], scale: [0.32, 0.2, 8.15] });
      for (const dz of [-2.1, 2.1]) {
        windows.push({ position: [frontX, y, z + dz], scale: [0.13, 1.85, 2.35] });
        frames.push(
          { position: [frontX - 0.06, y - 0.98, z + dz], scale: [0.3, 0.16, 2.65] },
          { position: [frontX - 0.06, y + 0.98, z + dz], scale: [0.22, 0.12, 2.65] },
        );
        if (!coarsePointer)
          for (const side of [-1, 1])
            frames.push({
              position: [frontX - 0.05, y, z + dz + side * 1.22],
              scale: [0.2, 1.98, 0.1],
            });
      }
    }
    rooftop.push({ position: [centerX, height + 0.55, z], scale: [1.7, 0.9, 1.3] });
    kit.addStorefront({
      position: [frontX - 0.06, 0.18, z],
      rotationY: -Math.PI / 2,
      width: 7.2,
      height: 3,
      canopyDepth: 1.35,
    });
  }
  addInstances(feature, geometry.box, materials.glass, windows, 'art-deco-windows', false);
  addInstances(feature, geometry.box, materials.whiteConcrete, frames, 'art-deco-window-frames');
  addInstances(feature, geometry.box, materials.whiteConcrete, cornices, 'art-deco-floor-cornices');
  addInstances(feature, geometry.box, materials.charcoalSteel, rooftop, 'art-deco-rooftop-vents');
  feature.add(kit.finish().group);
}

function addBeachPromenade(
  root: THREE.Group,
  geometry: ViceCityGeometry,
  materials: ViceCityMaterials,
  coarsePointer: boolean,
): void {
  const feature = createFeature(root, FEATURE_IDS[3], ANCHORS.oceanBeach);
  feature.userData.location = 'Ocean Beach';
  addBox(feature, geometry, materials.pavement, [5.5, 0.24, 28], [-1.5, 0.12, 0]);
  addBox(feature, geometry, materials.sand, [8, 0.12, 30], [5.25, 0.06, 0]);
  addBox(feature, geometry, materials.water, [4.2, 0.08, 30], [11.3, 0.02, 0]);
  addBox(feature, geometry, materials.whiteConcrete, [0.22, 0.58, 28], [1.3, 0.3, 0]);

  const lampCount = coarsePointer ? 5 : 9;
  const lampPosts: InstanceTransform[] = [];
  const lampHeads: InstanceTransform[] = [];
  for (let index = 0; index < lampCount; index += 1) {
    const z = -12 + (index * 24) / Math.max(1, lampCount - 1);
    lampPosts.push({ position: [-3.1, 2.05, z], scale: [0.13, 4.1, 0.13] });
    lampHeads.push({ position: [-3.1, 4.12, z], scale: [0.42, 0.24, 0.42] });
  }
  addInstances(feature, geometry.cylinder, materials.charcoalSteel, lampPosts, 'promenade-lamps');
  addInstances(feature, geometry.sphere, materials.amberLight, lampHeads, 'promenade-lamp-heads');
}

function addHotelWaterfront(
  root: THREE.Group,
  geometry: ViceCityGeometry,
  materials: ViceCityMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): void {
  const feature = createFeature(root, FEATURE_IDS[4], ANCHORS.hotelDixon);
  feature.userData.location = 'Hotel Dixon';
  feature.userData.communityId = 'L32';
  feature.userData.visualInterpretation = 'APPROXIMATE';
  // The GTADB point stays in the forecourt. New massing extends onto the same
  // authored western side instead of swallowing the selected map destination.
  const centerX = -19;
  const podiumHeight = 3.6;
  const floorHeight = 3.2;
  const floorCount = 8;
  addBox(
    feature,
    geometry,
    materials.whiteConcrete,
    [30, podiumHeight, 32],
    [centerX, podiumHeight / 2, 0],
    'hotel-white-podium',
  );
  addSolidCollision(collisions, feature, centerX, 0, 30, 32);
  const slabs: InstanceTransform[] = [];
  const cores: InstanceTransform[] = [];
  const glazing: InstanceTransform[] = [];
  const rails: InstanceTransform[] = [];
  const dividers: InstanceTransform[] = [];
  for (let level = 0; level < floorCount; level++) {
    const tier = Math.floor(level / 2);
    const width = 30 - tier * 3.4;
    const depth = 32 - tier * 3.4;
    const y = podiumHeight + level * floorHeight;
    slabs.push({ position: [centerX, y, 0], scale: [width, 0.28, depth] });
    cores.push({
      position: [centerX, y + floorHeight / 2, 0],
      scale: [width - 2.2, floorHeight - 0.28, depth - 2.2],
    });
    for (const side of [-1, 1]) {
      glazing.push({
        position: [centerX, y + 1.58, side * (depth / 2 - 1.06)],
        scale: [width - 2.9, 2.26, 0.12],
      });
      glazing.push({
        position: [centerX + side * (width / 2 - 1.06), y + 1.58, 0],
        scale: [0.12, 2.26, depth - 2.9],
      });
      rails.push({
        position: [centerX, y + 1.13, side * (depth / 2 - 0.08)],
        scale: [width, 0.1, 0.12],
      });
      rails.push({
        position: [centerX + side * (width / 2 - 0.08), y + 1.13, 0],
        scale: [0.12, 0.1, depth],
      });
      const count = coarsePointer ? 5 : 9;
      for (let column = 0; column < count; column++) {
        const x = centerX - width / 2 + 0.25 + (column * (width - 0.5)) / (count - 1);
        const z = -depth / 2 + 0.25 + (column * (depth - 0.5)) / (count - 1);
        rails.push({
          position: [x, y + 0.66, side * (depth / 2 - 0.08)],
          scale: [0.065, 0.94, 0.065],
        });
        rails.push({
          position: [centerX + side * (width / 2 - 0.08), y + 0.66, z],
          scale: [0.065, 0.94, 0.065],
        });
      }
      for (let bay = 1; bay < 6; bay++) {
        dividers.push({
          position: [
            centerX - (width - 2.9) / 2 + (bay * (width - 2.9)) / 6,
            y + 1.58,
            side * (depth / 2 - 1.04),
          ],
          scale: [0.12, 2.34, 0.16],
        });
      }
    }
  }
  addInstances(feature, geometry.box, materials.whiteConcrete, slabs, 'hotel-balconies');
  addInstances(feature, geometry.box, materials.whiteConcrete, cores, 'hotel-stepped-masses');
  addInstances(feature, geometry.box, materials.glass, glazing, 'hotel-windows', false);
  addInstances(
    feature,
    geometry.box,
    materials.chrome,
    rails,
    'vice-city-hotel-balustrades',
    false,
  );
  addInstances(
    feature,
    geometry.box,
    materials.whiteConcrete,
    dividers,
    'hotel-recessed-window-frames',
  );
  const roofY = podiumHeight + floorCount * floorHeight;
  addBox(
    feature,
    geometry,
    materials.whiteConcrete,
    [20.4, 0.42, 22.4],
    [centerX, roofY, 0],
    'hotel-roof-terrace',
  );
  addBox(
    feature,
    geometry,
    materials.pavement,
    [31, 0.22, 12],
    [centerX, 0.11, 23],
    'hotel-pool-terrace',
  );
  addBox(feature, geometry, materials.whiteConcrete, [15.4, 0.16, 7.4], [centerX, 0.29, 24]);
  addBox(
    feature,
    geometry,
    materials.water,
    [14.6, 0.08, 6.6],
    [centerX, 0.41, 24],
    'hotel-waterfront-pool',
  );
  const planters: InstanceTransform[] = [];
  for (const x of [-32, -6])
    for (const z of [19, 28]) planters.push({ position: [x, 0.65, z], scale: [1.7, 1.1, 1.7] });
  addInstances(feature, geometry.box, materials.whiteConcrete, planters, 'hotel-terrace-planters');
  addInstances(
    feature,
    geometry.sphere,
    materials.palmLeaf,
    planters.map((p) => ({
      position: [p.position[0], 1.25, p.position[2]] as Vec3,
      scale: [1.8, 0.9, 1.8] as Vec3,
    })),
    'hotel-terrace-planting',
  );
  const kit = createArchitecturalDetailKit({
    palette: 'coastal',
    coarsePointer,
  });
  kit.addRoofEquipment({
    position: [centerX, roofY + 0.21, 0],
    width: 17,
    depth: 18,
  });
  kit.addStorefront({
    position: [centerX, 0.2, 16.04],
    width: 12,
    height: 3.2,
    canopyDepth: 2.3,
  });
  const details = kit.finish();
  feature.add(details.group);
}

function addSportsCourt(
  root: THREE.Group,
  geometry: ViceCityGeometry,
  materials: ViceCityMaterials,
  coarsePointer: boolean,
): void {
  const feature = createFeature(root, FEATURE_IDS[5], ANCHORS.tennis);
  feature.userData.location = 'Tennis courts';
  addBox(feature, geometry, materials.court, [14, 0.16, 8], [0, 0.08, 0]);
  addBox(feature, geometry, materials.courtLine, [0.1, 0.03, 7.2], [0, 0.18, 0]);
  addBox(feature, geometry, materials.courtLine, [13.2, 0.03, 0.1], [0, 0.18, -3.55]);
  addBox(feature, geometry, materials.courtLine, [13.2, 0.03, 0.1], [0, 0.18, 3.55]);
  addBox(feature, geometry, materials.courtLine, [0.08, 1.05, 7.5], [0, 0.72, 0]);

  const fencePosts: InstanceTransform[] = [];
  const postCount = coarsePointer ? 8 : 14;
  for (let index = 0; index < postCount; index += 1) {
    const x = -6.8 + (index * 13.6) / Math.max(1, postCount - 1);
    fencePosts.push({ position: [x, 1.25, -4.1], scale: [0.1, 2.5, 0.1] });
    fencePosts.push({ position: [x, 1.25, 4.1], scale: [0.1, 2.5, 0.1] });
  }
  addInstances(
    feature,
    geometry.cylinder,
    materials.charcoalSteel,
    fencePosts,
    'tennis-fence-posts',
  );
}

function addMuralUnderpass(
  root: THREE.Group,
  geometry: ViceCityGeometry,
  materials: ViceCityMaterials,
  collisions: AxisAlignedRectangle[],
): void {
  const feature = createFeature(root, FEATURE_IDS[6], ANCHORS.muralUnderpass);
  feature.userData.location = 'La Perle';
  addBox(feature, geometry, materials.asphalt, [14, 0.16, 24], [0, 0.08, 0]);
  addBox(feature, geometry, materials.darkConcrete, [13.5, 0.8, 24], [0, 6.3, 0]);
  addBox(feature, geometry, materials.paleConcrete, [14, 0.28, 24], [0, 6.86, 0]);
  const girders: InstanceTransform[] = [];
  const parapets: InstanceTransform[] = [];
  for (const x of [-5.5, -2.75, 0, 2.75, 5.5])
    girders.push({ position: [x, 5.72, 0], scale: [0.28, 0.45, 24] });
  for (const x of [-6.8, 6.8]) parapets.push({ position: [x, 7.38, 0], scale: [0.3, 0.76, 24] });
  addInstances(
    feature,
    geometry.box,
    materials.paleConcrete,
    girders,
    'mural-viaduct-soffit-girders',
  );
  addInstances(feature, geometry.box, materials.whiteConcrete, parapets, 'mural-viaduct-parapets');
  const piles = [
    [-5, -8],
    [-5, 8],
    [5, -8],
    [5, 8],
  ] as const;
  const muralSurfaces = [
    materials.aquaStucco,
    materials.coralStucco,
    materials.pinkStucco,
    materials.creamStucco,
  ];
  const artwork: InstanceTransform[] = [];
  piles.forEach(([x, z], index) => {
    addBox(
      feature,
      geometry,
      materials.paleConcrete,
      [1.15, 5.85, 1.15],
      [x, 2.925, z],
      `vice-city-mural-underpass-pile-${index + 1}`,
    );
    addBox(feature, geometry, materials.paleConcrete, [3.2, 0.7, 1.5], [x, 5.6, z]);
    for (const side of [-1, 1]) {
      addBox(
        feature,
        geometry,
        muralSurfaces[index]!,
        [1.19, 3.7, 0.045],
        [x, 2.6, z + side * 0.596],
      );
      for (let stripe = 0; stripe < 5; stripe++)
        artwork.push({
          position: [x - 0.36 + stripe * 0.18, 1.3 + stripe * 0.56, z + side * 0.623],
          scale: [0.18, 1.25, 0.025],
          rotation: [0, 0, -0.52],
          color: [0x5c9697, 0xd0ae63, 0xc27779][(stripe + index) % 3],
        });
    }
    addPileCollision(collisions, feature, x, z);
  });
  addInstances(
    feature,
    geometry.box,
    materials.whiteConcrete,
    artwork,
    'mural-viaduct-painted-geometric-art',
    false,
  );
  const drain: InstanceTransform[] = [-6.15, 6.15].flatMap((x) =>
    [-9, 9].map((z) => ({
      position: [x, 0.19, z] as Vec3,
      scale: [0.48, 0.055, 0.7] as Vec3,
    })),
  );
  addInstances(feature, geometry.box, materials.charcoalSteel, drain, 'mural-viaduct-curb-drains');
}

function addArena(
  root: THREE.Group,
  geometry: ViceCityGeometry,
  materials: ViceCityMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): void {
  const feature = createFeature(root, FEATURE_IDS[7], ANCHORS.saharaArena);
  Object.assign(feature.userData, {
    location: 'Sahara Arena',
    communityId: 'L187',
    evidence: 'SUPPORTED',
    landmarkClaim: 'GTADB_NAME',
    nameEvidence: 'KNOWN',
    visualInterpretation: 'APPROXIMATE',
  });
  const segments = 18;
  const shellPositions: number[] = [];
  const roofPositions: number[] = [];
  const colors: number[] = [];
  const seams: BeamTransform[] = [];
  const topRing: Vec3[] = [];
  const bottomRing: Vec3[] = [];
  for (let index = 0; index < segments; index++) {
    const angle = (index / segments) * Math.PI * 2;
    bottomRing.push([Math.cos(angle) * 24.5, 3.8, Math.sin(angle) * 13.2]);
    topRing.push([
      Math.cos(angle) * (index % 2 ? 27 : 26),
      17.2 + (index % 3) * 0.55,
      Math.sin(angle) * (index % 2 ? 15.5 : 14.9),
    ]);
  }
  for (let index = 0; index < segments; index++) {
    const next = (index + 1) % segments;
    const a = bottomRing[index]!,
      b = bottomRing[next]!,
      c = topRing[next]!,
      d = topRing[index]!;
    const tint = new THREE.Color(
      index % 3 === 0 ? 0xbcc7cb : index % 3 === 1 ? 0xe2ded4 : 0xd0d6d3,
    );
    // Reverse the perimeter order on the outside so front-side normals face out.
    for (const vertex of [a, c, b, a, d, c]) {
      shellPositions.push(...vertex);
      colors.push(tint.r, tint.g, tint.b);
    }
    roofPositions.push(0, 18.4, 0, ...c, ...d);
    seams.push({ start: a, end: d, diameter: 0.11 }, { start: d, end: c, diameter: 0.12 });
    if (index % 2 === 0) seams.push({ start: a, end: c, diameter: 0.085 });
  }
  const shellGeometry = new THREE.BufferGeometry();
  shellGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shellPositions, 3));
  shellGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  shellGeometry.computeVertexNormals();
  const shellMaterial = materials.whiteConcrete.clone();
  shellMaterial.color.set(0xffffff);
  shellMaterial.vertexColors = true;
  addMesh(
    feature,
    shellGeometry,
    shellMaterial,
    [1, 1, 1],
    [0, 0, 0],
    'sahara-arena-faceted-shell',
  );
  const roofGeometry = new THREE.BufferGeometry();
  roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roofPositions, 3));
  roofGeometry.computeVertexNormals();
  addMesh(
    feature,
    roofGeometry,
    materials.darkConcrete,
    [1, 1, 1],
    [0, 0, 0],
    'sahara-arena-folded-roof',
  );
  const baseGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, segments);
  addMesh(
    feature,
    baseGeometry,
    materials.pavement,
    [56, 0.28, 33],
    [0, 0.14, 0],
    'sahara-arena-plaza',
  );
  addMesh(
    feature,
    baseGeometry,
    materials.darkConcrete,
    [49, 3.8, 26.4],
    [0, 1.9, 0],
    'sahara-arena-base',
  );
  addMesh(
    feature,
    baseGeometry,
    materials.glass,
    [49.2, 2.8, 26.6],
    [0, 2, 0],
    'sahara-arena-ground-glazing',
  );
  addBeamInstances(
    feature,
    geometry.box,
    materials.cyanLight,
    seams,
    'sahara-arena-panel-light-seams',
  );
  addBox(
    feature,
    geometry,
    materials.darkConcrete,
    [12.6, 3.1, 0.4],
    [0, 1.7, 13.3],
    'sahara-arena-entry-portal',
  );
  addBox(
    feature,
    geometry,
    materials.whiteConcrete,
    [15, 0.45, 5],
    [0, 3.55, 15.3],
    'sahara-arena-entry-canopy',
  );
  const gates: InstanceTransform[] = [];
  const fins: InstanceTransform[] = [];
  for (let index = 0; index < (coarsePointer ? 5 : 9); index++)
    gates.push({
      position: [-5.4 + (index * 10.8) / ((coarsePointer ? 5 : 9) - 1), 1.55, 13.57],
      scale: [0.12, 2.7, 0.12],
    });
  for (const x of [-6.6, 6.6]) {
    fins.push({ position: [x, 1.75, 16.7], scale: [0.22, 3.5, 0.22] });
    addSolidCollision(collisions, feature, x, 16.7, 0.3, 0.3, 0, 0.08);
  }
  addInstances(feature, geometry.box, materials.chrome, gates, 'sahara-arena-entry-gates', false);
  addInstances(feature, geometry.box, materials.whiteConcrete, fins, 'arena-exterior-ribs');
  addMesh(
    feature,
    geometry.plane,
    createViceSignMaterial(
      'street-leonida/sign/sahara-arena-approximate',
      'SAHARA',
      'ARENA',
      0x18252c,
      0x68c5c8,
    ),
    [9, 2.5, 1],
    [0, 6.1, 14.15],
    'sahara-arena-identity-sign',
  );
  // Keep the documented +Z, 22m approach and central entrance apron navigable.
  addSolidCollision(collisions, feature, 0, 0, 49, 26.4);
}

function addFerrisWheel(
  root: THREE.Group,
  geometry: ViceCityGeometry,
  materials: ViceCityMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): THREE.Group {
  const feature = createFeature(root, FEATURE_IDS[8], ANCHORS.ferrisWheelStudy);
  feature.userData.location = 'Ferris wheel study (APPROXIMATE)';
  feature.userData.evidence = 'VISUAL_REFERENCE_ONLY';
  feature.userData.landmarkClaim = 'NONE';
  const centerY = 10.5;
  addBeam(
    feature,
    geometry.cylinder,
    materials.charcoalSteel,
    [-6.4, 0.2, 0],
    [0, centerY, 0],
    0.34,
  );
  addBeam(
    feature,
    geometry.cylinder,
    materials.charcoalSteel,
    [6.4, 0.2, 0],
    [0, centerY, 0],
    0.34,
  );
  addSolidCollision(collisions, feature, -6.4, 0, 0.75, 0.75, 0, 0.08);
  addSolidCollision(collisions, feature, 6.4, 0, 0.75, 0.75, 0, 0.08);

  const rotor = new THREE.Group();
  rotor.name = 'vice-city-ferris-wheel-rotor';
  rotor.position.y = centerY;
  feature.add(rotor);
  addMesh(rotor, geometry.wheel, materials.cyanLight, [7.4, 7.4, 7.4], [0, 0, 0]);

  const spokeCount = coarsePointer ? 8 : 12;
  const spokes: BeamTransform[] = [];
  const gondolas: InstanceTransform[] = [];
  for (let index = 0; index < spokeCount; index += 1) {
    const angle = (index / spokeCount) * Math.PI * 2;
    const x = Math.cos(angle) * 7.1;
    const y = Math.sin(angle) * 7.1;
    spokes.push({ start: [0, 0, 0], end: [x, y, 0], diameter: 0.13 });
    gondolas.push({ position: [x, y, 0], scale: [0.8, 0.5, 0.7] });
  }
  addBeamInstances(rotor, geometry.cylinder, materials.chrome, spokes, 'ferris-wheel-spokes');
  addInstances(rotor, geometry.box, materials.magentaLight, gondolas, 'ferris-wheel-gondolas');

  const seating: InstanceTransform[] = [];
  const rowCount = coarsePointer ? 3 : 5;
  for (let row = 0; row < rowCount; row += 1) {
    seating.push({
      position: [0, 0.3 + row * 0.12, 7.5 + row * 1.15],
      scale: [11 - row * 1.25, 0.35, 0.72],
    });
  }
  addInstances(feature, geometry.box, materials.warmConcrete, seating, 'amphitheater-seating');
  return rotor;
}

function addCuratedPalmLine(
  root: THREE.Group,
  geometry: ViceCityGeometry,
  materials: ViceCityMaterials,
  coarsePointer: boolean,
): void {
  const feature = createFeature(root, FEATURE_IDS[9], ANCHORS.southBeach);
  feature.userData.location = 'South Beach';
  const palmCount = coarsePointer ? 6 : 10;
  const trunks: InstanceTransform[] = [];
  const crowns: InstanceTransform[] = [];
  for (let index = 0; index < palmCount; index += 1) {
    const z = -16 + (index * 32) / Math.max(1, palmCount - 1);
    const x = -1.5 + ((index * 7) % 4) * 0.7;
    const height = 5.8 + (index % 3) * 0.75;
    trunks.push({
      position: [x, height / 2, z],
      scale: [0.42, height, 0.42],
      rotation: [0.02 * (index % 2), 0, index % 2 === 0 ? -0.035 : 0.035],
    });
    crowns.push({
      position: [x, height + 0.15, z],
      scale: [2.45, 1, 2.45],
      rotation: [0, (index * Math.PI) / 5, 0],
    });
  }
  addInstances(feature, geometry.taperedCylinder, materials.bark, trunks, 'curated-palm-trunks');
  addInstances(feature, geometry.palmCrown, materials.palmLeaf, crowns, 'curated-palm-crowns');
}

function addCatalanBoulevard(
  root: THREE.Group,
  geometry: ViceCityGeometry,
  materials: ViceCityMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
  pedestrianLibrary: PedestrianLibrary,
  pedestrians: PedestrianActor[],
): void {
  const feature = createFeature(root, FEATURE_IDS[10], ANCHORS.megamundo);
  feature.userData.location = 'Catalan Boulevard, Downtown';
  feature.userData.evidence = 'APPROXIMATE';
  feature.userData.source = 'GTADB yanis,16 raster road alignment';
  feature.userData.rockstarPrimaryShot = WALK_ROCKSTAR_REFERENCE_PROFILES['vice-city'].primaryShot;
  feature.userData.rockstarSupportingShots = [
    ...WALK_ROCKSTAR_REFERENCE_PROFILES['vice-city'].supportingShots,
  ];
  const roadX = 100;
  const roadZ = 10;
  const roadLength = 240;
  addBox(
    feature,
    geometry,
    materials.asphalt,
    [31, 0.16, roadLength],
    [roadX, 0.13, roadZ],
    'catalan-boulevard-asphalt',
  );
  addBox(
    feature,
    geometry,
    materials.asphalt,
    [128, 0.14, 18],
    [68, 0.12, -20],
    'catalan-boulevard-cross-street',
    -0.035,
  );

  const guideway = new THREE.Group();
  guideway.name = 'catalan-boulevard-elevated-guideway';
  feature.add(guideway);
  addBox(
    guideway,
    geometry,
    materials.paleConcrete,
    [94, 1.8, 16],
    [100, 9.4, -20],
    'catalan-guideway-deck',
    -0.035,
  );
  addBox(guideway, geometry, materials.charcoalSteel, [94, 0.32, 16.6], [100, 8.4, -20]);
  const muralPillars = new THREE.Group();
  muralPillars.name = 'catalan-boulevard-mural-pillars';
  guideway.add(muralPillars);
  for (const [index, x] of [74, 100, 126].entries()) {
    addMesh(
      muralPillars,
      geometry.cylinder,
      materials.paleConcrete,
      [5.6, 8.5, 5.6],
      [x, 4.25, -20],
      `catalan-guideway-pillar-${index + 1}`,
    );
    addMesh(
      muralPillars,
      geometry.plane,
      materials.muralFacade,
      [4.6, 7.2, 1],
      [x, 4.15, -17.12],
      `catalan-guideway-mural-${index + 1}`,
      [0, 0, 0],
    );
  }
  const streetLife = new THREE.Group();
  streetLife.name = 'catalan-boulevard-street-life';
  streetLife.userData.referenceCue = 'motorcycles, pedestrians and traffic beneath mural pillars';
  feature.add(streetLife);
  const bikeSpecs = [
    {
      x: 91.5,
      z: 19,
      yaw: -0.08,
      body: materials.cyanLight,
      rider: materials.creamStucco,
    },
    {
      x: 96.4,
      z: 13,
      yaw: 0.11,
      body: materials.magentaLight,
      rider: materials.aquaStucco,
    },
    {
      x: 104.2,
      z: 17,
      yaw: -0.13,
      body: materials.amberLight,
      rider: materials.pinkStucco,
    },
    {
      x: 109.1,
      z: 10,
      yaw: 0.06,
      body: materials.cyanLight,
      rider: materials.coralStucco,
    },
  ].slice(0, coarsePointer ? 3 : 4);
  const motorcycleMaterial = createRoadVehicleMaterial(
    'street-leonida/catalan-boulevard/motorcycles',
  );
  for (const [index, bikeSpec] of bikeSpecs.entries()) {
    const bike = createMotorcycle(
      bikeSpec.body.color.getHex(),
      'cruiser',
      bikeSpec.rider.color.getHex(),
      { material: motorcycleMaterial, materialOwnership: 'region-owned' },
    );
    bike.name = `catalan-street-motorcycle-${index + 1}`;
    bike.position.set(bikeSpec.x, 0.15, bikeSpec.z);
    bike.rotation.y = bikeSpec.yaw;
    streetLife.add(bike);
  }
  const pedestrianCount = coarsePointer ? 5 : 10;
  for (let index = 0; index < pedestrianCount; index += 1) {
    const actor = pedestrianLibrary.create({ variant: index, pose: 'idle' });
    pedestrians.push(actor);
    const person = actor.root;
    person.name = `catalan-street-pedestrian-${index + 1}`;
    const side = index % 2 === 0 ? -1 : 1;
    person.position.set(
      side < 0 ? 82.2 + (index % 3) * 0.8 : 117.8 - (index % 3) * 0.8,
      0.32,
      9 + ((index * 7) % 24),
    );
    person.rotation.y = (side * Math.PI) / 2 + ((index % 3) - 1) * 0.22;
    streetLife.add(person);
  }
  const guidewayRails: InstanceTransform[] = [];
  for (let x = 55; x <= 145; x += 4) {
    guidewayRails.push({
      position: [x, 10.7, -27.7],
      scale: [0.16, 1.3, 0.16],
    });
    guidewayRails.push({
      position: [x, 10.7, -12.3],
      scale: [0.16, 1.3, 0.16],
    });
  }
  addInstances(
    guideway,
    geometry.box,
    materials.charcoalSteel,
    guidewayRails,
    'catalan-guideway-safety-rails',
  );

  const sidewalks: InstanceTransform[] = [
    { position: [81.6, 0.2, roadZ], scale: [5.6, 0.24, roadLength] },
    { position: [118.4, 0.2, roadZ], scale: [5.6, 0.24, roadLength] },
  ];
  addInstances(
    feature,
    geometry.box,
    materials.pavement,
    sidewalks,
    'catalan-boulevard-sidewalks',
    false,
  );
  addBox(
    feature,
    geometry,
    materials.paleConcrete,
    [2.1, 0.28, roadLength],
    [roadX, 0.25, roadZ],
    'catalan-boulevard-median',
  );

  const laneDashes: InstanceTransform[] = [];
  for (let z = -104; z <= 124; z += 8) {
    for (const x of [91.4, 96.3, 103.7, 108.6]) {
      laneDashes.push({ position: [x, 0.235, z], scale: [0.12, 0.035, 3.2] });
    }
  }
  addInstances(
    feature,
    geometry.box,
    materials.whiteConcrete,
    laneDashes,
    'catalan-boulevard-lane-dashes',
    false,
  );
  addBox(feature, geometry, materials.amberLight, [0.13, 0.04, roadLength], [98.82, 0.24, roadZ]);
  addBox(feature, geometry, materials.amberLight, [0.13, 0.04, roadLength], [101.18, 0.24, roadZ]);

  const crosswalks: InstanceTransform[] = [];
  for (const crossingZ of [-26.5, -13.5]) {
    for (let x = 85.8; x <= 114.2; x += 2.25) {
      if (Math.abs(x - roadX) < 1.7) continue;
      crosswalks.push({
        position: [x, 0.24, crossingZ],
        scale: [1.15, 0.035, 0.34],
      });
    }
  }
  addInstances(
    feature,
    geometry.box,
    materials.whiteConcrete,
    crosswalks,
    'catalan-boulevard-crosswalks',
    false,
  );

  const lampPoles: InstanceTransform[] = [];
  const lampHeads: InstanceTransform[] = [];
  for (let z = -98; z <= 118; z += coarsePointer ? 36 : 24) {
    for (const [x, direction] of [
      [83.7, 1],
      [116.3, -1],
    ] as const) {
      lampPoles.push({ position: [x, 3.35, z], scale: [0.22, 6.7, 0.22] });
      lampHeads.push({
        position: [x + direction * 1.15, 6.75, z],
        scale: [2.35, 0.16, 0.32],
      });
    }
  }
  addInstances(
    feature,
    geometry.cylinder,
    materials.charcoalSteel,
    lampPoles,
    'catalan-boulevard-streetlights',
  );
  addInstances(
    feature,
    geometry.box,
    materials.amberLight,
    lampHeads,
    'catalan-boulevard-lamp-heads',
    false,
  );
  for (const [index, z] of [-70, -20, 30, 80].entries()) {
    const light = new THREE.PointLight(0xffbd79, 18, 38, 2);
    light.name = `catalan-boulevard-practical-light-${index + 1}`;
    light.position.set(index % 2 === 0 ? 83.7 : 116.3, 6.35, z);
    light.castShadow = false;
    feature.add(light);
  }

  const palmTrunks: InstanceTransform[] = [];
  const palmCrowns: InstanceTransform[] = [];
  const palmFronds: InstanceTransform[] = [];
  for (let z = -84; z <= 108; z += coarsePointer ? 48 : 32) {
    for (const x of [79.6, 120.4]) {
      const index = palmTrunks.length;
      const height = 6.4 + (index % 3) * 0.45;
      palmTrunks.push({
        position: [x, height / 2, z],
        scale: [0.44, height, 0.44],
        rotation: [0, 0, index % 2 === 0 ? -0.025 : 0.025],
      });
      palmCrowns.push({
        position: [x, height + 0.2, z],
        scale: [1.25, 0.55, 1.25],
        rotation: [0, index * 0.83, 0],
      });
      for (let frond = 0; frond < 8; frond += 1) {
        const angle = (frond / 8) * Math.PI * 2 + index * 0.31;
        palmFronds.push({
          position: [
            x + Math.sin(angle) * 1.35,
            height + 0.15 - (frond % 2) * 0.16,
            z + Math.cos(angle) * 1.35,
          ],
          scale: [0.16, 0.08, 3.15],
          rotation: [frond % 2 === 0 ? 0.08 : -0.08, angle, 0],
        });
      }
    }
  }
  addInstances(
    feature,
    geometry.taperedCylinder,
    materials.bark,
    palmTrunks,
    'catalan-boulevard-palm-trunks',
  );
  addInstances(
    feature,
    geometry.palmCrown,
    materials.palmLeaf,
    palmCrowns,
    'catalan-boulevard-palm-cores',
  );
  addInstances(feature, geometry.box, materials.palmLeaf, palmFronds, 'catalan-boulevard-palms');

  const planterBases: InstanceTransform[] = [];
  const planterShrubs: InstanceTransform[] = [];
  for (let z = -98; z <= 116; z += coarsePointer ? 26 : 15) {
    if (z > -34 && z < -6) continue;
    for (const x of [77.9, 122.1]) {
      planterBases.push({ position: [x, 0.38, z], scale: [1.55, 0.58, 1.55] });
      planterShrubs.push({
        position: [x, 1.02, z],
        scale: [1.7, 1.35 + (planterShrubs.length % 3) * 0.18, 1.7],
      });
    }
  }
  addInstances(
    feature,
    geometry.box,
    materials.warmConcrete,
    planterBases,
    'catalan-boulevard-planter-bases',
  );
  addInstances(
    feature,
    geometry.sphere,
    materials.palmLeaf,
    planterShrubs,
    'catalan-boulevard-planters',
  );

  const storefrontSigns = new THREE.Group();
  storefrontSigns.name = 'catalan-boulevard-storefront-signs';
  feature.add(storefrontSigns);
  const signSpecs = [
    {
      x: 79.35,
      z: -76,
      rotation: Math.PI / 2,
      title: 'DIXON',
      subtitle: 'OCEAN HOTEL',
      color: 0xff5cac,
    },
    {
      x: 79.35,
      z: -48,
      rotation: Math.PI / 2,
      title: 'CAFE',
      subtitle: 'CUBANO  •  OPEN',
      color: 0x5de9ef,
    },
    {
      x: 120.65,
      z: 6,
      rotation: -Math.PI / 2,
      title: 'SOL',
      subtitle: 'MUSIC  •  LOUNGE',
      color: 0xffc36a,
    },
    {
      x: 120.65,
      z: 52,
      rotation: -Math.PI / 2,
      title: 'VICE',
      subtitle: 'STYLE  •  DESIGN',
      color: 0x5de9ef,
    },
    {
      x: 79.35,
      z: 82,
      rotation: Math.PI / 2,
      title: 'PALMA',
      subtitle: 'BAR  •  TERRACE',
      color: 0xff5cac,
    },
  ].slice(0, coarsePointer ? 3 : 5);
  for (const [index, sign] of signSpecs.entries()) {
    addMesh(
      storefrontSigns,
      geometry.plane,
      createViceSignMaterial(
        `street-leonida/sign/vice-storefront-${index + 1}`,
        sign.title,
        sign.subtitle,
        0x142934,
        sign.color,
      ),
      [7.4, 2.25, 1],
      [sign.x, 4.5, sign.z],
      `catalan-storefront-sign-${index + 1}`,
      [0, sign.rotation, 0],
    );
  }

  const carSpecs = [
    { x: 91.3, z: 72, color: 0x2f78b7, direction: 0 },
    { x: 96.2, z: 22, color: 0xe5bd35, direction: 0 },
    { x: 108.5, z: -58, color: 0xd84055, direction: Math.PI },
    { x: 103.7, z: -93, color: 0x56a48c, direction: Math.PI },
    { x: 91.3, z: -3, color: 0xd9d7ca, direction: 0 },
    { x: 108.5, z: 49, color: 0x5c4f9b, direction: Math.PI },
    { x: 96.2, z: -112, color: 0x252b31, direction: 0 },
    { x: 103.7, z: 101, color: 0xe77632, direction: Math.PI },
  ].slice(0, coarsePointer ? 5 : 8);
  const traffic = createRoadVehicleBatch(
    carSpecs.map((car) => ({
      color: car.color,
      position: [car.x, 0.16, car.z],
      rotationY: car.direction,
    })),
    'sedan',
    'catalan-boulevard-traffic',
  );
  feature.add(traffic);

  for (const signalZ of [-27, -13]) {
    for (const x of [84, 116]) {
      addBox(feature, geometry, materials.charcoalSteel, [0.28, 5.4, 0.28], [x, 2.7, signalZ]);
      addBox(
        feature,
        geometry,
        materials.charcoalSteel,
        [Math.abs(roadX - x), 0.22, 0.22],
        [(roadX + x) / 2, 5.28, signalZ],
      );
      addBox(
        feature,
        geometry,
        materials.cyanLight,
        [0.36, 0.72, 0.42],
        [roadX + (x < roadX ? -2.8 : 2.8), 4.92, signalZ],
      );
    }
  }

  addBox(feature, geometry, materials.glass, [0.16, 2.6, 5.4], [78.7, 1.42, 67]);
  addBox(feature, geometry, materials.charcoalSteel, [2.8, 0.18, 5.8], [80.1, 2.82, 67]);
  addBox(feature, geometry, materials.pavement, [2.8, 0.18, 5.8], [80.1, 0.31, 67]);

  const frontage = new THREE.Group();
  frontage.name = 'catalan-boulevard-frontage';
  frontage.userData.evidence = 'APPROXIMATE';
  frontage.userData.visualSources = ['Rockstar Games VI screenshots', 'GTADB footprint context'];
  feature.add(frontage);
  const facadeMaterials = [
    materials.whiteConcrete,
    materials.creamStucco,
    materials.paleConcrete,
    materials.whiteConcrete,
    materials.creamStucco,
  ] as const;
  const frontageSpecs = [
    { x: 62, z: -92, width: 20, depth: 28, height: 32, rounded: false },
    { x: 61, z: -56, width: 22, depth: 31, height: 43, rounded: true },
    { x: 62, z: -17, width: 20, depth: 30, height: 25, rounded: false },
    { x: 61, z: 20, width: 22, depth: 29, height: 31, rounded: false },
    { x: 60, z: 60, width: 22, depth: 32, height: 24, rounded: true },
    { x: 62, z: 102, width: 20, depth: 29, height: 19, rounded: false },
    { x: 138, z: -92, width: 20, depth: 28, height: 36, rounded: true },
    { x: 139, z: -55, width: 22, depth: 31, height: 27, rounded: false },
    { x: 138, z: -15, width: 20, depth: 30, height: 45, rounded: true },
    { x: 139, z: 23, width: 22, depth: 29, height: 31, rounded: false },
    { x: 140, z: 63, width: 22, depth: 32, height: 23, rounded: false },
    { x: 138, z: 104, width: 20, depth: 28, height: 19, rounded: true },
  ] as const;
  const windowBays: InstanceTransform[] = [];
  const balconySlabs: InstanceTransform[] = [];
  const roofUnits: InstanceTransform[] = [];
  const facadeFins: InstanceTransform[] = [];
  const roundedGlassBands: InstanceTransform[] = [];
  const photoFacadeTransforms: InstanceTransform[] = [];
  const muralFacadeTransforms: InstanceTransform[] = [];

  frontageSpecs.forEach((building, buildingIndex) => {
    const material =
      facadeMaterials[buildingIndex % facadeMaterials.length] ?? materials.whiteConcrete;
    if (building.rounded) {
      addMesh(
        frontage,
        geometry.cylinder,
        material,
        [building.width, building.height, building.depth],
        [building.x, building.height / 2, building.z],
      );
      for (let floor = 5.5; floor < building.height - 2; floor += 4.15) {
        roundedGlassBands.push({
          position: [building.x, floor, building.z],
          scale: [building.width + 0.28, 0.24, building.depth + 0.28],
        });
      }
    } else {
      addBox(
        frontage,
        geometry,
        material,
        [building.width, building.height, building.depth],
        [building.x, building.height / 2, building.z],
      );
    }
    const facesRoadFromWest = building.x < roadX;
    const facadeX =
      building.x + (facesRoadFromWest ? building.width / 2 + 0.08 : -building.width / 2 - 0.08);
    const facadeTransform: InstanceTransform = {
      position: [
        facadeX + (facesRoadFromWest ? 0.18 : -0.18),
        building.height / 2 + 0.35,
        building.z,
      ],
      scale: [building.depth * 0.92, building.height * 0.91, 1],
      rotation: [0, facesRoadFromWest ? Math.PI / 2 : -Math.PI / 2, 0],
    };
    if (buildingIndex % 6 === 1) muralFacadeTransforms.push(facadeTransform);
    else photoFacadeTransforms.push(facadeTransform);
    const bayCount = coarsePointer ? 3 : Math.max(4, Math.floor(building.depth / 4.2));
    const floorStep = coarsePointer ? 5.2 : 3.55;
    for (let floor = 4.4; floor <= building.height - 2.1; floor += floorStep) {
      for (let bay = 0; bay < bayCount; bay += 1) {
        const z =
          building.z -
          building.depth * 0.39 +
          (bay * building.depth * 0.78) / Math.max(1, bayCount - 1);
        windowBays.push({
          position: [facadeX, floor, z],
          scale: [0.14, 1.24, Math.min(1.55, building.depth / (bayCount + 1))],
          color: (floor / floorStep + bay + buildingIndex) % 11 < 1 ? 0xd98a4d : 0x173d4e,
        });
      }
      if (floor > 7 && Math.round(floor / floorStep + buildingIndex) % 2 === 0) {
        balconySlabs.push({
          position: [facadeX + (facesRoadFromWest ? 0.42 : -0.42), floor - 1.18, building.z],
          scale: [0.9, 0.16, building.depth * 0.84],
        });
      }
    }
    addBox(
      frontage,
      geometry,
      materials.glass,
      [0.22, 2.9, building.depth * 0.72],
      [facadeX, 1.58, building.z],
    );
    for (const zOffset of [-building.depth * 0.42, building.depth * 0.42]) {
      facadeFins.push({
        position: [
          facadeX + (facesRoadFromWest ? 0.32 : -0.32),
          building.height / 2,
          building.z + zOffset,
        ],
        scale: [0.42, building.height, 0.42],
      });
    }
    roofUnits.push({
      position: [building.x, building.height + 0.72, building.z],
      scale: [building.width * 0.48, 1.44, building.depth * 0.46],
    });
    addSolidCollision(
      collisions,
      feature,
      building.x,
      building.z,
      building.width,
      building.depth,
      0,
      0.35,
    );
  });
  addInstances(
    frontage,
    geometry.plane,
    materials.luxuryFacade,
    photoFacadeTransforms,
    'catalan-boulevard-photo-facades',
    false,
  );
  addInstances(
    frontage,
    geometry.plane,
    materials.muralFacade,
    muralFacadeTransforms,
    'catalan-boulevard-mural-facades',
    false,
  );
  addInstances(
    frontage,
    geometry.box,
    materials.glass,
    windowBays,
    'catalan-boulevard-window-bays',
  );
  addInstances(
    frontage,
    geometry.box,
    materials.chrome,
    balconySlabs,
    'catalan-boulevard-balconies',
  );
  addInstances(
    frontage,
    geometry.box,
    materials.paleConcrete,
    facadeFins,
    'catalan-boulevard-facade-fins',
  );
  addInstances(
    frontage,
    geometry.box,
    materials.darkConcrete,
    roofUnits,
    'catalan-boulevard-rooftops',
  );
  addInstances(
    frontage,
    geometry.cylinder,
    materials.glass,
    roundedGlassBands,
    'catalan-boulevard-rounded-glass-bands',
  );
}

/**
 * Builds the authored Vice City arrival around the pinned GTADB-derived world
 * transform. Local offsets are approximate visual reconstruction, repeated
 * details are instanced, and solid structures append world-space collisions.
 */
export function createViceCityDistrict(
  scene: THREE.Scene,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
  options: ViceCityDistrictOptions = {},
): ViceCityDistrict {
  const root = new THREE.Group();
  root.name = 'vice-city-district';
  root.userData.procedural = true;
  root.userData.qualityTier = coarsePointer ? 'mobile' : 'desktop';
  root.userData.featureIds = [...FEATURE_IDS];

  const geometry = createGeometry(coarsePointer);
  const materials = createMaterials();
  const pedestrianLibrary = createPedestrianLibrary();
  const pedestrians: PedestrianActor[] = [];
  let disposed = false;
  addRoundedWaterfrontTowers(root, geometry, materials, collisions, coarsePointer);
  addMegamundoTower(root, geometry, materials, collisions, coarsePointer);
  addArtDecoStrip(root, geometry, materials, collisions, coarsePointer);
  addBeachPromenade(root, geometry, materials, coarsePointer);
  addHotelWaterfront(root, geometry, materials, collisions, coarsePointer);
  addSportsCourt(root, geometry, materials, coarsePointer);
  addMuralUnderpass(root, geometry, materials, collisions);
  addArena(root, geometry, materials, collisions, coarsePointer);
  const ferrisWheelRotor = addFerrisWheel(root, geometry, materials, collisions, coarsePointer);
  addCuratedPalmLine(root, geometry, materials, coarsePointer);
  if (options.renderCatalanBoulevard !== false) {
    addCatalanBoulevard(
      root,
      geometry,
      materials,
      collisions,
      coarsePointer,
      pedestrianLibrary,
      pedestrians,
    );
  }

  scene.add(root);

  return {
    featureIds: [...FEATURE_IDS],
    update(elapsed: number): void {
      if (disposed) return;
      const safeElapsed = Number.isFinite(elapsed) ? elapsed : 0;
      ferrisWheelRotor.rotation.z = safeElapsed * 0.085;
      for (const actor of pedestrians) actor.update({ elapsedSeconds: safeElapsed });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      pedestrianLibrary.dispose();
    },
  };
}
