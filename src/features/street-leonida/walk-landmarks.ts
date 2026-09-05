import * as THREE from 'three';

import type { AxisAlignedRectangle } from './walk-engine';
import { LEGACY_REGION_TRANSLATIONS } from './walk-geography';
import type { WalkRenderRegion } from './walk-region-streaming';

type Vec3 = readonly [number, number, number];

interface LandmarkGeometry {
  box: THREE.BoxGeometry;
  cylinder: THREE.CylinderGeometry;
  cone: THREE.ConeGeometry;
  lowPolySphere: THREE.SphereGeometry;
  trunk: THREE.CylinderGeometry;
}

interface LandmarkMaterials {
  asphalt: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  paleConcrete: THREE.MeshStandardMaterial;
  darkConcrete: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  cyanGlass: THREE.MeshStandardMaterial;
  coral: THREE.MeshStandardMaterial;
  turquoise: THREE.MeshStandardMaterial;
  cream: THREE.MeshStandardMaterial;
  pinkNeon: THREE.MeshBasicMaterial;
  cyanNeon: THREE.MeshBasicMaterial;
  amberNeon: THREE.MeshBasicMaterial;
  sand: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  shallowWater: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  weatheredWood: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  rust: THREE.MeshStandardMaterial;
  whiteMetal: THREE.MeshStandardMaterial;
  trailerAluminum: THREE.MeshStandardMaterial;
  marsh: THREE.MeshStandardMaterial;
  reed: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  pine: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial;
  cane: THREE.MeshStandardMaterial;
  redRock: THREE.MeshStandardMaterial;
  ochreRock: THREE.MeshStandardMaterial;
  gator: THREE.MeshStandardMaterial;
}

interface InstanceTransform {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
}

const UP = new THREE.Vector3(0, 1, 0);

function createGeometry(): LandmarkGeometry {
  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    cone: new THREE.ConeGeometry(0.5, 1, 9),
    lowPolySphere: new THREE.SphereGeometry(0.5, 10, 6),
    trunk: new THREE.CylinderGeometry(0.35, 0.22, 1, 7),
  };
}

function standard(color: number, roughness = 0.86, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function createMaterials(): LandmarkMaterials {
  return {
    asphalt: standard(0x1c2127, 0.96),
    concrete: standard(0x8f9696, 0.98),
    paleConcrete: standard(0xc6bfaf, 0.95),
    darkConcrete: standard(0x34383d, 0.94),
    glass: new THREE.MeshStandardMaterial({
      color: 0x264e63,
      emissive: 0x102b3d,
      emissiveIntensity: 0.38,
      roughness: 0.28,
      metalness: 0.4,
    }),
    cyanGlass: new THREE.MeshStandardMaterial({
      color: 0x3aa5b4,
      emissive: 0x0b4d61,
      emissiveIntensity: 0.46,
      roughness: 0.24,
      metalness: 0.3,
    }),
    coral: standard(0xd87986, 0.8),
    turquoise: standard(0x54bebb, 0.78),
    cream: standard(0xead9bd, 0.9),
    pinkNeon: new THREE.MeshBasicMaterial({ color: 0xff3f9b, toneMapped: false }),
    cyanNeon: new THREE.MeshBasicMaterial({ color: 0x44e6ff, toneMapped: false }),
    amberNeon: new THREE.MeshBasicMaterial({ color: 0xffbe55, toneMapped: false }),
    sand: standard(0xd9bd83, 1),
    water: new THREE.MeshStandardMaterial({
      color: 0x0b6983,
      roughness: 0.22,
      metalness: 0.14,
      transparent: true,
      opacity: 0.92,
    }),
    shallowWater: new THREE.MeshStandardMaterial({
      color: 0x2da6a1,
      roughness: 0.28,
      metalness: 0.08,
      transparent: true,
      opacity: 0.78,
    }),
    timber: standard(0x95633e, 0.98),
    weatheredWood: standard(0x6e6250, 1),
    steel: standard(0x59656a, 0.52, 0.62),
    rust: standard(0x884838, 0.93, 0.08),
    whiteMetal: standard(0xd8d7cf, 0.54, 0.26),
    trailerAluminum: standard(0xa9b0ae, 0.5, 0.38),
    marsh: standard(0x456443, 1),
    reed: standard(0x7f8b45, 1),
    foliage: standard(0x33714c, 0.98),
    pine: standard(0x244b38, 1),
    bark: standard(0x62452e, 1),
    cane: standard(0x8ea34f, 1),
    redRock: standard(0x8e4937, 1),
    ochreRock: standard(0xb16d43, 1),
    gator: standard(0x334735, 1),
  };
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  scale: Vec3,
  position: Vec3,
  rotation: Vec3 = [0, 0, 0],
  castsShadow = true,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.scale.set(...scale);
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.castShadow = castsShadow;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function box(
  parent: THREE.Object3D,
  geometry: LandmarkGeometry,
  material: THREE.Material,
  size: Vec3,
  position: Vec3,
  rotationY = 0,
  castsShadow = true,
): THREE.Mesh {
  return mesh(parent, geometry.box, material, size, position, [0, rotationY, 0], castsShadow);
}

function cylinder(
  parent: THREE.Object3D,
  geometry: LandmarkGeometry,
  material: THREE.Material,
  diameter: number,
  height: number,
  position: Vec3,
  rotation: Vec3 = [0, 0, 0],
): THREE.Mesh {
  return mesh(
    parent,
    geometry.cylinder,
    material,
    [diameter, height, diameter],
    position,
    rotation,
  );
}

function cone(
  parent: THREE.Object3D,
  geometry: LandmarkGeometry,
  material: THREE.Material,
  diameter: number,
  height: number,
  position: Vec3,
  rotation: Vec3 = [0, 0, 0],
): THREE.Mesh {
  return mesh(parent, geometry.cone, material, [diameter, height, diameter], position, rotation);
}

function addCollision(
  collisions: AxisAlignedRectangle[],
  x: number,
  z: number,
  width: number,
  depth: number,
  rotationY = 0,
  padding = 0.25,
): void {
  const cosine = Math.abs(Math.cos(rotationY));
  const sine = Math.abs(Math.sin(rotationY));
  const halfWidth = (width * cosine + depth * sine) / 2 + padding;
  const halfDepth = (width * sine + depth * cosine) / 2 + padding;
  collisions.push({
    minX: x - halfWidth,
    maxX: x + halfWidth,
    minZ: z - halfDepth,
    maxZ: z + halfDepth,
  });
}

function addInstances(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: readonly InstanceTransform[],
  castsShadow = false,
  name?: string,
): THREE.InstancedMesh | null {
  if (transforms.length === 0) return null;
  const instances = new THREE.InstancedMesh(geometry, material, transforms.length);
  const dummy = new THREE.Object3D();
  transforms.forEach((transform, index) => {
    dummy.position.set(...transform.position);
    dummy.scale.set(...transform.scale);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.updateMatrix();
    instances.setMatrixAt(index, dummy.matrix);
  });
  instances.instanceMatrix.needsUpdate = true;
  instances.castShadow = castsShadow;
  instances.receiveShadow = true;
  if (name) instances.name = name;
  parent.add(instances);
  return instances;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function addRod(
  parent: THREE.Object3D,
  geometry: LandmarkGeometry,
  material: THREE.Material,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
): THREE.Mesh {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const result = mesh(
    parent,
    geometry.cylinder,
    material,
    [radius * 2, direction.length(), radius * 2],
    [midpoint.x, midpoint.y, midpoint.z],
    [0, 0, 0],
  );
  result.quaternion.setFromUnitVectors(UP, direction.normalize());
  return result;
}

function addWire(
  parent: THREE.Object3D,
  material: THREE.LineBasicMaterial,
  points: readonly THREE.Vector3[],
): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([...points]);
  const line = new THREE.Line(geometry, material);
  parent.add(line);
  return line;
}

function addRibbon(
  parent: THREE.Object3D,
  points: readonly THREE.Vector3[],
  width: number,
  material: THREE.Material,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3([...points], false, 'catmullrom', 0.32);
  const samples = curve.getSpacedPoints(Math.max(18, points.length * 10));
  const positions: number[] = [];
  const indices: number[] = [];
  samples.forEach((sample, index) => {
    const previous = samples[Math.max(0, index - 1)] ?? sample;
    const next = samples[Math.min(samples.length - 1, index + 1)] ?? sample;
    const tangent = next.clone().sub(previous).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(width / 2);
    const left = sample.clone().add(normal);
    const right = sample.clone().sub(normal);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    if (index < samples.length - 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.receiveShadow = true;
  parent.add(ribbon);
  return ribbon;
}

function addViceCityTower(
  parent: THREE.Object3D,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  collisions: AxisAlignedRectangle[],
  x: number,
  z: number,
  height: number,
  accent: THREE.Material,
  coarsePointer: boolean,
): void {
  box(parent, geometry, materials.paleConcrete, [10.8, 1.1, 13.2], [x, 0.76, z]);
  box(parent, geometry, materials.glass, [8.8, height, 10.8], [x, height / 2 + 1.3, z]);
  box(parent, geometry, materials.cyanGlass, [3.6, height - 4, 11.05], [x, height / 2 + 1.3, z]);
  const balconyCount = coarsePointer ? 9 : 15;
  const balconies: InstanceTransform[] = [];
  for (let level = 0; level < balconyCount; level += 1) {
    balconies.push({
      position: [x, 4.2 + (level * (height - 7)) / Math.max(1, balconyCount - 1), z],
      scale: [10.1, 0.18, 12.1],
    });
  }
  addInstances(parent, geometry.box, materials.cream, balconies);
  box(parent, geometry, accent, [0.22, height - 3, 11.45], [x - 4.55, height / 2 + 1.3, z]);
  box(parent, geometry, accent, [0.22, height - 3, 11.45], [x + 4.55, height / 2 + 1.3, z]);
  const crown = cylinder(parent, geometry, materials.paleConcrete, 7.8, 1.15, [
    x,
    height + 1.88,
    z,
  ]);
  crown.scale.z *= 1.25;
  addCollision(collisions, x, z, 10.8, 13.2);
}

function addViceCity(
  root: THREE.Group,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): THREE.Group {
  const region = new THREE.Group();
  region.name = 'landmarks-vice-city';
  root.add(region);

  addViceCityTower(
    region,
    geometry,
    materials,
    collisions,
    169,
    18,
    46,
    materials.pinkNeon,
    coarsePointer,
  );
  addViceCityTower(
    region,
    geometry,
    materials,
    collisions,
    169,
    37,
    53,
    materials.cyanNeon,
    coarsePointer,
  );

  box(region, geometry, materials.sand, [17, 0.12, 94], [184, 0.14, 54], 0, false);
  const lifeguardX = 184;
  const lifeguardZ = 64;
  const lifeguardLegs = [-1.35, 1.35].flatMap((xOffset) =>
    [-1.05, 1.05].map<InstanceTransform>((zOffset) => ({
      position: [lifeguardX + xOffset, 1.45, lifeguardZ + zOffset],
      scale: [0.2, 2.8, 0.2],
    })),
  );
  addInstances(region, geometry.box, materials.timber, lifeguardLegs, true);
  box(region, geometry, materials.turquoise, [3.7, 2.35, 3.1], [lifeguardX, 3.55, lifeguardZ]);
  box(region, geometry, materials.cream, [4.3, 0.25, 3.65], [lifeguardX, 4.82, lifeguardZ]);
  box(
    region,
    geometry,
    materials.pinkNeon,
    [0.18, 1.25, 2.45],
    [lifeguardX - 1.95, 3.55, lifeguardZ],
  );
  addCollision(collisions, lifeguardX, lifeguardZ, 4.1, 3.5);

  const hotelPalette = [materials.coral, materials.turquoise, materials.cream];
  const hotelCount = coarsePointer ? 3 : 5;
  for (let index = 0; index < hotelCount; index += 1) {
    const z = 76 + index * 10.5;
    const height = 7 + (index % 3) * 1.6;
    const wall = hotelPalette[index % hotelPalette.length] ?? materials.coral;
    box(region, geometry, wall, [10.5, height, 7.4], [164.5, height / 2 + 0.25, z]);
    box(
      region,
      geometry,
      index % 2 === 0 ? materials.pinkNeon : materials.cyanNeon,
      [10.8, 0.18, 0.2],
      [164.5, height - 0.4, z - 3.76],
    );
    const windowTransforms: InstanceTransform[] = [];
    for (let floor = 0; floor < 2; floor += 1) {
      for (let column = 0; column < 4; column += 1) {
        windowTransforms.push({
          position: [161 + column * 2.35, 2.2 + floor * 2.35, z - 3.76],
          scale: [1.25, 1.1, 0.12],
        });
      }
    }
    addInstances(region, geometry.box, materials.glass, windowTransforms);
    addCollision(collisions, 164.5, z, 10.5, 7.4);
  }

  const underpassZ = 113;
  box(region, geometry, materials.darkConcrete, [49, 1.25, 10], [126, 6.3, underpassZ]);
  const columns: InstanceTransform[] = [];
  for (let x = 105; x <= 147; x += coarsePointer ? 10.5 : 7) {
    columns.push({ position: [x, 3.15, underpassZ - 3.2], scale: [0.8, 6.3, 0.8] });
    columns.push({ position: [x, 3.15, underpassZ + 3.2], scale: [0.8, 6.3, 0.8] });
  }
  addInstances(region, geometry.box, materials.concrete, columns, true);
  const muralMaterials = [materials.pinkNeon, materials.cyanNeon, materials.amberNeon];
  for (let index = 0; index < 6; index += 1) {
    box(
      region,
      geometry,
      muralMaterials[index % muralMaterials.length] ?? materials.pinkNeon,
      [4.8, 2.35, 0.12],
      [109 + index * 7, 2.5, underpassZ - 5.06],
      0,
      false,
    );
  }

  const stadium = new THREE.Mesh(
    new THREE.TorusGeometry(13, 3.1, 8, coarsePointer ? 20 : 36),
    materials.paleConcrete,
  );
  stadium.position.set(103, 2.1, 104);
  stadium.rotation.x = Math.PI / 2;
  stadium.scale.z = 0.62;
  stadium.castShadow = true;
  region.add(stadium);
  addCollision(collisions, 103, 104, 28, 18);

  const wheelCenter = new THREE.Vector3(139, 12.8, 126);
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(8.2, 0.24, 7, coarsePointer ? 24 : 40),
    materials.cyanNeon,
  );
  wheel.position.copy(wheelCenter);
  region.add(wheel);
  const spokeCount = coarsePointer ? 6 : 10;
  for (let index = 0; index < spokeCount; index += 1) {
    const angle = (index / spokeCount) * Math.PI * 2;
    addRod(
      region,
      geometry,
      materials.steel,
      wheelCenter,
      new THREE.Vector3(
        wheelCenter.x + Math.cos(angle) * 8,
        wheelCenter.y + Math.sin(angle) * 8,
        wheelCenter.z,
      ),
      0.075,
    );
  }
  addRod(region, geometry, materials.steel, new THREE.Vector3(132, 0.3, 126), wheelCenter, 0.22);
  addRod(region, geometry, materials.steel, new THREE.Vector3(146, 0.3, 126), wheelCenter, 0.22);
  return region;
}

function addCauseway(
  region: THREE.Group,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  coarsePointer: boolean,
): void {
  const points = [
    new THREE.Vector3(0, 1.1, 164),
    new THREE.Vector3(16, 1.2, 171),
    new THREE.Vector3(33, 1.3, 181),
    new THREE.Vector3(51, 1.2, 189),
    new THREE.Vector3(72, 1.1, 196),
  ];
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.25);
  const segmentCount = coarsePointer ? 16 : 26;
  const decks: InstanceTransform[] = [];
  const piers: InstanceTransform[] = [];
  const roadMarkings: InstanceTransform[] = [];
  const guardrails: InstanceTransform[] = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const progress = index / segmentCount;
    const nextProgress = (index + 1) / segmentCount;
    const start = curve.getPoint(progress);
    const end = curve.getPoint(nextProgress);
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const length = start.distanceTo(end) + 0.16;
    const yaw = Math.atan2(end.x - start.x, end.z - start.z);
    decks.push({
      position: [midpoint.x, midpoint.y, midpoint.z],
      scale: [7.2, 0.42, length],
      rotation: [0, yaw, 0],
    });
    if (index % 2 === 0) {
      roadMarkings.push({
        position: [midpoint.x, midpoint.y + 0.25, midpoint.z],
        scale: [0.12, 0.035, length * 0.58],
        rotation: [0, yaw, 0],
      });
    }
    for (const side of [-1, 1]) {
      const offset = side * 3.42;
      guardrails.push({
        position: [
          midpoint.x + Math.cos(yaw) * offset,
          midpoint.y + 0.58,
          midpoint.z - Math.sin(yaw) * offset,
        ],
        scale: [0.13, 0.46, length + 0.12],
        rotation: [0, yaw, 0],
      });
    }
    if (index % (coarsePointer ? 4 : 3) === 1) {
      piers.push({ position: [midpoint.x - 2.4, 0.55, midpoint.z], scale: [0.55, 1.1, 0.55] });
      piers.push({ position: [midpoint.x + 2.4, 0.55, midpoint.z], scale: [0.55, 1.1, 0.55] });
    }
  }
  addInstances(region, geometry.box, materials.asphalt, decks);
  addInstances(region, geometry.box, materials.paleConcrete, piers);
  addInstances(
    region,
    geometry.box,
    materials.cream,
    roadMarkings,
    false,
    'keys-causeway-road-markings',
  );
  addInstances(
    region,
    geometry.box,
    materials.steel,
    guardrails,
    false,
    'keys-causeway-guardrails',
  );
}

function addBoat(
  parent: THREE.Object3D,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  x: number,
  z: number,
  rotationY: number,
): void {
  const hull = cylinder(
    parent,
    geometry,
    materials.whiteMetal,
    1.5,
    5.8,
    [x, 0.6, z],
    [0, rotationY, Math.PI / 2],
  );
  hull.scale.z = 0.48;
  box(parent, geometry, materials.glass, [1.5, 0.75, 1.7], [x, 1.2, z], rotationY);
}

function addKeys(
  root: THREE.Group,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): THREE.Group {
  const region = new THREE.Group();
  region.name = 'landmarks-leonida-keys';
  root.add(region);

  addRibbon(
    region,
    [
      new THREE.Vector3(-11, 0.12, 170),
      new THREE.Vector3(18, 0.13, 178),
      new THREE.Vector3(45, 0.13, 188),
      new THREE.Vector3(76, 0.12, 197),
    ],
    25,
    materials.shallowWater,
  );
  const islets = coarsePointer
    ? [
        [8, 174, 10, 5],
        [56, 188, 13, 6],
      ]
    : [
        [-6, 168, 9, 4],
        [8, 174, 10, 5],
        [35, 184, 7, 4],
        [56, 188, 13, 6],
        [76, 199, 8, 4],
      ];
  islets.forEach(([x = 0, z = 0, width = 1, depth = 1]) => {
    const island = mesh(
      region,
      geometry.lowPolySphere,
      materials.sand,
      [width, 0.7, depth],
      [x, 0.08, z],
      [0, x * 0.07, 0],
      false,
    );
    island.receiveShadow = true;
  });
  addCauseway(region, geometry, materials, coarsePointer);

  const dockPositions = coarsePointer
    ? ([[57, 193, -0.35]] as const)
    : ([
        [57, 193, -0.35],
        [18, 181, 0.22],
      ] as const);
  dockPositions.forEach(([x, z, rotationY]) => {
    box(region, geometry, materials.timber, [10, 0.22, 1.55], [x, 0.5, z], rotationY);
    const legs: InstanceTransform[] = [];
    for (const offset of [-4, 0, 4]) {
      legs.push({ position: [x + offset, 0.25, z - 0.5], scale: [0.18, 1.1, 0.18] });
      legs.push({ position: [x + offset, 0.25, z + 0.5], scale: [0.18, 1.1, 0.18] });
    }
    addInstances(region, geometry.box, materials.weatheredWood, legs);
  });
  addBoat(region, geometry, materials, 65, 198, -0.4);
  if (!coarsePointer) addBoat(region, geometry, materials, 23, 186, 0.2);

  const barX = 72;
  const barZ = 174;
  box(region, geometry, materials.weatheredWood, [11, 4.2, 6.5], [barX, 2.25, barZ], -0.1);
  box(region, geometry, materials.rust, [12, 0.4, 7.2], [barX, 4.55, barZ], -0.1);
  const neonRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 6, 16), materials.pinkNeon);
  neonRing.position.set(72, 5.8, 170.6);
  neonRing.rotation.y = -0.1;
  region.add(neonRing);
  addCollision(collisions, barX, barZ, 11, 6.5, -0.1);

  const trailerCount = coarsePointer ? 2 : 4;
  for (let index = 0; index < trailerCount; index += 1) {
    const x = 49 + (index % 2) * 13;
    const z = 165 + Math.floor(index / 2) * 9;
    const rotationY = index % 2 ? 0.12 : -0.08;
    box(region, geometry, materials.trailerAluminum, [8.5, 3.2, 3.8], [x, 1.85, z], rotationY);
    box(region, geometry, materials.glass, [2.2, 1.2, 0.12], [x - 1.7, 2.1, z - 1.94], rotationY);
    addCollision(collisions, x, z, 8.5, 3.8, rotationY);
  }
  return region;
}

function addGrassrivers(
  root: THREE.Group,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): THREE.Group {
  const region = new THREE.Group();
  region.name = 'landmarks-grassrivers';
  root.add(region);

  box(region, geometry, materials.marsh, [112, 0.13, 68], [25, 0.12, 129], 0, false);
  addRibbon(
    region,
    [
      new THREE.Vector3(-30, 0.22, 112),
      new THREE.Vector3(-8, 0.22, 123),
      new THREE.Vector3(14, 0.22, 119),
      new THREE.Vector3(39, 0.22, 135),
      new THREE.Vector3(76, 0.22, 130),
    ],
    7.5,
    materials.water,
  );
  addRibbon(
    region,
    [
      new THREE.Vector3(-14, 0.23, 151),
      new THREE.Vector3(8, 0.23, 141),
      new THREE.Vector3(32, 0.23, 151),
      new THREE.Vector3(67, 0.23, 146),
    ],
    5.3,
    materials.shallowWater,
  );

  const reedCount = coarsePointer ? 58 : 132;
  const random = seededRandom(60219);
  const reeds: InstanceTransform[] = [];
  for (let index = 0; index < reedCount; index += 1) {
    const x = -27 + random() * 108;
    const z = 101 + random() * 61;
    const scale = 0.75 + random() * 0.72;
    reeds.push({
      position: [x, 0.72 * scale, z],
      scale: [0.12, 1.45 * scale, 0.12],
      rotation: [0, random() * Math.PI, 0],
    });
  }
  addInstances(region, geometry.cylinder, materials.reed, reeds);

  const campX = 68;
  const campZ = 141;
  const stiltTransforms = [-2.4, 2.4].flatMap((xOffset) =>
    [-1.7, 1.7].map<InstanceTransform>((zOffset) => ({
      position: [campX + xOffset, 1.85, campZ + zOffset],
      scale: [0.24, 3.7, 0.24],
    })),
  );
  addInstances(region, geometry.box, materials.timber, stiltTransforms, true);
  box(region, geometry, materials.weatheredWood, [6.5, 0.35, 5], [campX, 3.4, campZ]);
  box(region, geometry, materials.cream, [5.7, 3.2, 4.2], [campX, 5.15, campZ]);
  const campRoof = cone(region, geometry, materials.rust, 8.4, 2, [campX, 7.55, campZ]);
  campRoof.rotation.y = Math.PI / 4;
  campRoof.scale.z = 0.76;
  box(region, geometry, materials.timber, [9.5, 0.2, 1.4], [campX - 6.6, 3.35, campZ + 0.3], -0.08);
  addCollision(collisions, campX, campZ, 6.5, 5);

  const airboatX = 6;
  const airboatZ = 119;
  box(region, geometry, materials.rust, [5.4, 0.42, 2.5], [airboatX, 0.55, airboatZ], 0.24);
  box(region, geometry, materials.darkConcrete, [2.25, 0.75, 1.7], [airboatX, 1.1, airboatZ], 0.24);
  const cage = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.09, 7, 18), materials.steel);
  cage.position.set(4.25, 1.8, 119.4);
  cage.rotation.y = Math.PI / 2 + 0.24;
  region.add(cage);
  const propeller = box(
    region,
    geometry,
    materials.darkConcrete,
    [0.12, 1.65, 0.2],
    [4.25, 1.8, 119.4],
    0.24,
  );
  propeller.rotation.z = 0.7;

  const gatorX = 45;
  const gatorZ = 124;
  const gatorBody = mesh(
    region,
    geometry.lowPolySphere,
    materials.gator,
    [4.3, 0.62, 1.2],
    [gatorX, 0.4, gatorZ],
    [0, -0.32, 0],
    false,
  );
  gatorBody.receiveShadow = true;
  box(region, geometry, materials.gator, [2.1, 0.36, 0.9], [47.7, 0.38, 123.1], -0.32, false);
  const tail = cone(region, geometry, materials.gator, 1.3, 3.8, [42.2, 0.38, 125.05]);
  tail.rotation.z = Math.PI / 2;
  tail.rotation.y = -0.32;
  return region;
}

function addPowerLineRun(
  region: THREE.Group,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  points: readonly Vec3[],
  coarsePointer: boolean,
): void {
  const wireMaterial = new THREE.LineBasicMaterial({ color: 0x25282c });
  points.forEach(([x, , z]) => {
    cylinder(region, geometry, materials.weatheredWood, 0.35, 8.5, [x, 4.35, z]);
    box(region, geometry, materials.weatheredWood, [4, 0.18, 0.22], [x, 8.2, z]);
  });
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (!start || !end) continue;
    for (const offset of coarsePointer ? [-1.25, 1.25] : [-1.25, 0, 1.25]) {
      addWire(region, wireMaterial, [
        new THREE.Vector3(start[0] + offset, 8.2, start[2]),
        new THREE.Vector3((start[0] + end[0]) / 2 + offset, 7.25, (start[2] + end[2]) / 2),
        new THREE.Vector3(end[0] + offset, 8.2, end[2]),
      ]);
    }
  }
}

function addPortRoadsideDetails(
  region: THREE.Group,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  coarsePointer: boolean,
): void {
  const details = new THREE.Group();
  details.name = 'port-gellhorn-roadside-details';
  details.userData.surfaceProfile = 'weathered-coastal-street-furniture';
  region.add(details);

  const allLightPositions = [
    [-144, -1, 1],
    [-124, -1, 1],
    [-104, -1, 1],
    [-84, -1, 1],
    [-142, -55, -1],
    [-122, -55, -1],
    [-102, -54, -1],
    [-82, -53, -1],
  ] as const;
  const lightPositions = coarsePointer
    ? allLightPositions.filter((_, index) => index % 2 === 0)
    : allLightPositions;
  const poles: InstanceTransform[] = [];
  const lampHeads: InstanceTransform[] = [];
  const bulbs: InstanceTransform[] = [];
  for (const [x, z, direction] of lightPositions) {
    poles.push({ position: [x, 3.25, z], scale: [0.22, 6.5, 0.22] });
    lampHeads.push({
      position: [x + direction * 0.5, 6.43, z],
      scale: [1.2, 0.16, 0.42],
    });
    bulbs.push({
      position: [x + direction * 0.82, 6.33, z],
      scale: [0.32, 0.055, 0.24],
    });
  }
  addInstances(details, geometry.cylinder, materials.steel, poles, false, 'port-streetlight-poles');
  addInstances(
    details,
    geometry.box,
    materials.whiteMetal,
    lampHeads,
    false,
    'port-streetlight-heads',
  );
  addInstances(details, geometry.box, materials.amberNeon, bulbs, false, 'port-streetlight-bulbs');

  const cabinets = (
    coarsePointer
      ? [
          [-147, 5],
          [-91, 5],
        ]
      : [
          [-147, 5],
          [-129, 5],
          [-109, 5],
          [-91, 5],
        ]
  ) as readonly (readonly [number, number])[];
  addInstances(
    details,
    geometry.box,
    materials.darkConcrete,
    cabinets.map(([x, z]) => ({
      position: [x, 0.78, z],
      scale: [0.95, 1.42, 0.62],
      rotation: [0, 0.04 * Math.sign(x + 118), 0],
    })),
    false,
    'port-utility-cabinets',
  );

  const bollardCount = coarsePointer ? 4 : 8;
  const bollards = Array.from({ length: bollardCount }, (_, index): InstanceTransform => ({
    position: [-130 + index * (24 / Math.max(1, bollardCount - 1)), 0.44, 7],
    scale: [0.3, 0.88, 0.3],
  }));
  addInstances(
    details,
    geometry.cylinder,
    materials.rust,
    bollards,
    false,
    'port-weathered-bollards',
  );
}

function addPortGellhorn(
  root: THREE.Group,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): THREE.Group {
  const region = new THREE.Group();
  region.name = 'landmarks-port-gellhorn';
  root.add(region);

  // Authored in the region's legacy local space. After the canonical
  // translation this places the motel just south of the coastal road rather
  // than across its carriageway.
  const motelX = -116;
  const motelZ = 1;
  box(region, geometry, materials.coral, [27, 5.2, 8], [motelX, 2.8, motelZ]);
  const motelWindows: InstanceTransform[] = [];
  const windowCount = coarsePointer ? 6 : 9;
  for (let index = 0; index < windowCount; index += 1) {
    motelWindows.push({
      position: [motelX - 11 + (index * 22) / Math.max(1, windowCount - 1), 2.5, motelZ + 4.05],
      scale: [1.45, 1.8, 0.12],
    });
  }
  addInstances(region, geometry.box, materials.darkConcrete, motelWindows);
  box(region, geometry, materials.pinkNeon, [27.4, 0.2, 0.18], [motelX, 5.1, motelZ + 4.13]);
  box(region, geometry, materials.concrete, [28.5, 0.28, 2.2], [motelX, 5.3, motelZ + 3.05]);
  addCollision(collisions, motelX, motelZ, 27, 8);

  const clubX = -63;
  const clubZ = 6;
  box(region, geometry, materials.darkConcrete, [15, 6.5, 10], [clubX, 3.55, clubZ], 0.12);
  const clubNeon = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.15, 7, 18), materials.cyanNeon);
  clubNeon.position.set(clubX + 0.6, 4.2, clubZ - 5.15);
  clubNeon.rotation.y = 0.12;
  clubNeon.scale.x = 1.45;
  region.add(clubNeon);
  box(
    region,
    geometry,
    materials.pinkNeon,
    [7.6, 0.2, 0.18],
    [clubX + 0.6, 6.15, clubZ - 5.15],
    0.12,
  );
  addCollision(collisions, clubX, clubZ, 15, 10, 0.12);

  const trailerCount = coarsePointer ? 3 : 6;
  for (let index = 0; index < trailerCount; index += 1) {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = -142 + column * 16;
    const z = 3 + row * 10;
    const rotationY = (column - 1) * 0.08;
    box(region, geometry, materials.trailerAluminum, [9.2, 3.4, 4.1], [x, 1.9, z], rotationY);
    box(region, geometry, materials.glass, [2.1, 1.15, 0.12], [x - 2.1, 2.15, z - 2.09], rotationY);
    addCollision(collisions, x, z, 9.2, 4.1, rotationY);
  }

  const towerX = -158;
  const towerZ = -7;
  const tank = cylinder(region, geometry, materials.steel, 7.1, 4.7, [towerX, 14.2, towerZ]);
  tank.scale.z = 1.03;
  cone(region, geometry, materials.steel, 7.2, 2.1, [towerX, 17.6, towerZ]);
  const towerLegs = [-2.3, 2.3].flatMap((xOffset) =>
    [-2.3, 2.3].map((zOffset) =>
      addRod(
        region,
        geometry,
        materials.steel,
        new THREE.Vector3(towerX + xOffset * 1.5, 0.2, towerZ + zOffset * 1.5),
        new THREE.Vector3(towerX + xOffset, 12, towerZ + zOffset),
        0.13,
      ),
    ),
  );
  void towerLegs;

  addPowerLineRun(
    region,
    geometry,
    materials,
    [
      [-152, 0, -57],
      [-127, 0, -56],
      [-102, 0, -54],
      [-77, 0, -53],
    ],
    coarsePointer,
  );
  addPortRoadsideDetails(region, geometry, materials, coarsePointer);
  return region;
}

function addPylon(
  region: THREE.Group,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  x: number,
  z: number,
  coarsePointer: boolean,
): void {
  const baseLeft = new THREE.Vector3(x - 2.2, 0.2, z);
  const baseRight = new THREE.Vector3(x + 2.2, 0.2, z);
  const top = new THREE.Vector3(x, 14, z);
  addRod(region, geometry, materials.steel, baseLeft, top, 0.1);
  addRod(region, geometry, materials.steel, baseRight, top, 0.1);
  const levels = coarsePointer ? [6.5, 11.5] : [4.5, 8.5, 12.5];
  levels.forEach((height, index) => {
    const halfWidth = 3.6 - index * 0.55;
    addRod(
      region,
      geometry,
      materials.steel,
      new THREE.Vector3(x - halfWidth, height, z),
      new THREE.Vector3(x + halfWidth, height, z),
      0.09,
    );
  });
}

function addAmbrosia(
  root: THREE.Group,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): THREE.Group {
  const region = new THREE.Group();
  region.name = 'landmarks-ambrosia';
  root.add(region);

  const millX = 82;
  const millZ = -91;
  box(region, geometry, materials.rust, [24, 7.2, 13], [millX, 3.85, millZ]);
  box(region, geometry, materials.darkConcrete, [25, 0.5, 14], [millX, 7.55, millZ]);
  addCollision(collisions, millX, millZ, 24, 13);
  const siloPositions = coarsePointer
    ? ([
        [70, -91],
        [98, -91],
      ] as const)
    : ([
        [63, -91],
        [70, -91],
        [98, -91],
        [105, -91],
      ] as const);
  siloPositions.forEach(([x, z]) => {
    cylinder(region, geometry, materials.whiteMetal, 6.4, 13.5, [x, 7, z]);
    cone(region, geometry, materials.whiteMetal, 6.5, 2.2, [x, 14.85, z]);
    const bands: InstanceTransform[] = [];
    for (let height = 3; height <= 12; height += 3) {
      bands.push({ position: [x, height, z], scale: [6.55, 0.13, 6.55] });
    }
    addInstances(region, geometry.cylinder, materials.steel, bands);
    addCollision(collisions, x, z, 6.6, 6.6, 0, 0.1);
  });

  const stackX = 91;
  const stackZ = -102;
  const stack = cylinder(region, geometry, materials.rust, 3.2, 27, [stackX, 13.7, stackZ]);
  stack.scale.x = 0.82;
  stack.scale.z = 0.82;
  cylinder(region, geometry, materials.paleConcrete, 2.75, 1.1, [stackX, 22.3, stackZ]);
  cylinder(region, geometry, materials.paleConcrete, 2.55, 1.1, [stackX, 17.6, stackZ]);
  addCollision(collisions, stackX, stackZ, 3, 3);

  const pylons = [
    [20, -118],
    [45, -116],
    [70, -114],
    [95, -112],
  ] as const;
  pylons.forEach(([x, z]) => addPylon(region, geometry, materials, x, z, coarsePointer));
  const wireMaterial = new THREE.LineBasicMaterial({ color: 0x303436 });
  for (let index = 0; index < pylons.length - 1; index += 1) {
    const start = pylons[index];
    const end = pylons[index + 1];
    if (!start || !end) continue;
    for (const height of coarsePointer ? [11.5] : [8.5, 12.5]) {
      addWire(region, wireMaterial, [
        new THREE.Vector3(start[0], height, start[1]),
        new THREE.Vector3((start[0] + end[0]) / 2, height - 1.15, (start[1] + end[1]) / 2),
        new THREE.Vector3(end[0], height, end[1]),
      ]);
    }
  }
  return region;
}

function addTrussBridge(
  region: THREE.Group,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  coarsePointer: boolean,
): void {
  const startZ = -153;
  const endZ = -127;
  const x = 41;
  box(region, geometry, materials.asphalt, [6.5, 0.45, endZ - startZ], [x, 1.25, -140]);
  const segmentCount = coarsePointer ? 4 : 6;
  for (const side of [-1, 1]) {
    const sideX = x + side * 3.25;
    addRod(
      region,
      geometry,
      materials.rust,
      new THREE.Vector3(sideX, 1.5, startZ),
      new THREE.Vector3(sideX, 1.5, endZ),
      0.12,
    );
    addRod(
      region,
      geometry,
      materials.rust,
      new THREE.Vector3(sideX, 7.2, startZ),
      new THREE.Vector3(sideX, 7.2, endZ),
      0.12,
    );
    for (let index = 0; index <= segmentCount; index += 1) {
      const z = startZ + (index / segmentCount) * (endZ - startZ);
      addRod(
        region,
        geometry,
        materials.rust,
        new THREE.Vector3(sideX, 1.5, z),
        new THREE.Vector3(sideX, 7.2, z),
        0.11,
      );
      if (index < segmentCount) {
        const nextZ = startZ + ((index + 1) / segmentCount) * (endZ - startZ);
        addRod(
          region,
          geometry,
          materials.rust,
          new THREE.Vector3(sideX, index % 2 === 0 ? 1.5 : 7.2, z),
          new THREE.Vector3(sideX, index % 2 === 0 ? 7.2 : 1.5, nextZ),
          0.1,
        );
      }
    }
  }
}

function addMountKalaga(
  root: THREE.Group,
  geometry: LandmarkGeometry,
  materials: LandmarkMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): THREE.Group {
  const region = new THREE.Group();
  region.name = 'landmarks-mount-kalaga';
  root.add(region);

  const rockCutCenterX = -16;
  const rockCutCenterZ = -177;
  const terraces = coarsePointer ? 3 : 5;
  for (let index = 0; index < terraces; index += 1) {
    const diameter = 52 - index * 8.2;
    const terrace = cylinder(
      region,
      geometry,
      index % 2 === 0 ? materials.redRock : materials.ochreRock,
      diameter,
      1.7,
      [rockCutCenterX + index * 1.4, 0.15 + index * 1.25, rockCutCenterZ - index * 0.8],
    );
    terrace.scale.z = 0.66;
  }
  const rockRandom = seededRandom(8861);
  const rockCount = coarsePointer ? 12 : 24;
  for (let index = 0; index < rockCount; index += 1) {
    const angle = rockRandom() * Math.PI * 2;
    const radius = 21 + rockRandom() * 28;
    const x = rockCutCenterX + Math.cos(angle) * radius;
    const z = rockCutCenterZ + Math.sin(angle) * radius * 0.55;
    const height = 3 + rockRandom() * 8;
    const rock = cone(
      region,
      geometry,
      index % 2 ? materials.redRock : materials.ochreRock,
      3 + rockRandom() * 6,
      height,
      [x, height / 2, z],
      [0, rockRandom() * Math.PI, rockRandom() * 0.14],
    );
    rock.scale.z = 0.7 + rockRandom() * 0.65;
  }

  addRibbon(
    region,
    [
      new THREE.Vector3(-42, 0.28, -142),
      new THREE.Vector3(-13, 0.28, -148),
      new THREE.Vector3(18, 0.28, -138),
      new THREE.Vector3(48, 0.28, -140),
      new THREE.Vector3(78, 0.28, -132),
    ],
    8,
    materials.water,
  );
  addTrussBridge(region, geometry, materials, coarsePointer);

  const trailShelterX = -48;
  const trailShelterZ = -161;
  const trailShelter = new THREE.Group();
  trailShelter.name = 'mount-kalaga-approximate-trail-shelter';
  trailShelter.position.set(trailShelterX, 0, trailShelterZ);
  trailShelter.userData.evidence = 'APPROXIMATE';
  trailShelter.userData.landmarkClaim = 'NONE';
  trailShelter.userData.infill = 'APPROXIMATE';
  region.add(trailShelter);
  box(trailShelter, geometry, materials.weatheredWood, [8.5, 4.3, 5.5], [0, 2.35, 0], -0.08);
  const officeRoof = cone(trailShelter, geometry, materials.darkConcrete, 10.3, 2.2, [0, 5.55, 0]);
  officeRoof.rotation.y = Math.PI / 4 - 0.08;
  officeRoof.scale.z = 0.72;
  addCollision(collisions, trailShelterX, trailShelterZ, 8.5, 5.5, -0.08);
  return region;
}

/**
 * Adds a deterministic, procedural interpretation of the locations visible in
 * official GTA VI regional media. It deliberately uses no downloaded models,
 * images or textures, so the reconstruction remains lightweight and original.
 */
export function addScreenshotGroundedLandmarks(
  scene: THREE.Scene,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
  options: {
    viceCity?: boolean;
    ambrosia?: boolean;
    alignToGrid?: boolean;
    regions?: readonly WalkRenderRegion[];
  } = {},
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'screenshot-grounded-landmarks';
  const geometry = createGeometry();
  const materials = createMaterials();

  const alignToGrid = options.alignToGrid ?? true;
  const includes = (region: WalkRenderRegion): boolean =>
    options.regions === undefined || options.regions.includes(region);
  const addAlignedRegion = (
    addRegion: () => THREE.Group,
    translation: { x: number; z: number },
  ): void => {
    const collisionStart = collisions.length;
    const region = addRegion();
    if (!alignToGrid) return;
    region.position.set(translation.x, 0, translation.z);
    for (let index = collisionStart; index < collisions.length; index += 1) {
      const collision = collisions[index];
      if (!collision) continue;
      collision.minX += translation.x;
      collision.maxX += translation.x;
      collision.minZ += translation.z;
      collision.maxZ += translation.z;
    }
  };

  if ((options.viceCity ?? true) && includes('vice-city')) {
    addViceCity(root, geometry, materials, collisions, coarsePointer);
  }
  if (includes('leonida-keys'))
    addAlignedRegion(
      () => addKeys(root, geometry, materials, collisions, coarsePointer),
      LEGACY_REGION_TRANSLATIONS.leonidaKeys,
    );
  if (includes('grassrivers'))
    addAlignedRegion(
      () => addGrassrivers(root, geometry, materials, collisions, coarsePointer),
      LEGACY_REGION_TRANSLATIONS.grassrivers,
    );
  if (includes('port-gellhorn'))
    addAlignedRegion(
      () => addPortGellhorn(root, geometry, materials, collisions, coarsePointer),
      LEGACY_REGION_TRANSLATIONS.portGellhorn,
    );
  if ((options.ambrosia ?? true) && includes('ambrosia')) {
    addAmbrosia(root, geometry, materials, collisions, coarsePointer);
  }
  if (includes('mount-kalaga'))
    addAlignedRegion(
      () => addMountKalaga(root, geometry, materials, collisions, coarsePointer),
      LEGACY_REGION_TRANSLATIONS.mountKalaga,
    );

  scene.add(root);
  return root;
}
