import * as THREE from 'three';

import { REVIEWED_GTADB_ANCHORS } from './leonida-evidence';
import type { AxisAlignedRectangle } from './walk-engine';
import { AMBROSIA_WORLD, STATE_OF_LEONIDA_COMMUNITY_MAP } from './walk-geography';

type Vec3 = readonly [number, number, number];

interface InstanceTransform {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
}

interface ParticleSeed {
  origin: Vec3;
  phase: number;
  drift: number;
}

const AMBROSIA_AUTHORING_DATUM = { x: 42.8, z: -37 } as const;

function toAmbrosiaLocalAnchor(world: { readonly x: number; readonly z: number }): {
  readonly x: number;
  readonly z: number;
} {
  return {
    x: AMBROSIA_AUTHORING_DATUM.x + world.x - AMBROSIA_WORLD.refinery.x,
    z: AMBROSIA_AUTHORING_DATUM.z + world.z - AMBROSIA_WORLD.refinery.z,
  };
}

const AMBROSIA_LOCAL_ANCHORS = {
  xeroStation: toAmbrosiaLocalAnchor(AMBROSIA_WORLD.xeroStation),
  unknownUtilityL594: toAmbrosiaLocalAnchor(AMBROSIA_WORLD.unknownUtilityL594),
  radioTower: toAmbrosiaLocalAnchor(AMBROSIA_WORLD.radioTower),
  sugarFields: toAmbrosiaLocalAnchor(AMBROSIA_WORLD.sugarFields),
} as const;

const XERO_CANOPY_AUTHORING_DATUM = { x: 62.2, z: -50.5 } as const;
const SUGAR_FIELD_AUTHORING_DATUM = { x: 16, z: -36 } as const;

export interface AmbrosiaDistrict {
  root: THREE.Group;
  features: readonly string[];
  update: (elapsedSeconds: number) => void;
}

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const sphereGeometry = new THREE.SphereGeometry(0.5, 12, 8);

function material(color: number, roughness = 0.86, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addBox(
  parent: THREE.Object3D,
  size: Vec3,
  position: Vec3,
  surface: THREE.Material,
  name?: string,
  rotationY = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(boxGeometry, surface);
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: THREE.Object3D,
  diameter: number,
  height: number,
  position: Vec3,
  surface: THREE.Material,
  name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(cylinderGeometry, surface);
  mesh.scale.set(diameter, height, diameter);
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function addInstances(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  transforms: readonly InstanceTransform[],
  name: string,
): THREE.InstancedMesh | null {
  if (transforms.length === 0) return null;
  const mesh = new THREE.InstancedMesh(geometry, surface, transforms.length);
  const dummy = new THREE.Object3D();
  transforms.forEach((transform, index) => {
    dummy.position.set(...transform.position);
    dummy.scale.set(...transform.scale);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function addCollision(
  collisions: AxisAlignedRectangle[],
  x: number,
  z: number,
  width: number,
  depth: number,
  rotation = 0,
): void {
  const cosine = Math.abs(Math.cos(rotation));
  const sine = Math.abs(Math.sin(rotation));
  const halfWidth = (width * cosine + depth * sine) / 2 + 0.18;
  const halfDepth = (width * sine + depth * cosine) / 2 + 0.18;
  collisions.push({
    minX: x - halfWidth,
    maxX: x + halfWidth,
    minZ: z - halfDepth,
    maxZ: z + halfDepth,
  });
}

function transformCollisionSlice(
  collisions: AxisAlignedRectangle[],
  startIndex: number,
  scale: { x: number; z: number },
  translation: { x: number; z: number },
  endIndex = collisions.length,
): void {
  for (let index = startIndex; index < endIndex; index += 1) {
    const collision = collisions[index];
    if (!collision) continue;
    collision.minX = collision.minX * scale.x + translation.x;
    collision.maxX = collision.maxX * scale.x + translation.x;
    collision.minZ = collision.minZ * scale.z + translation.z;
    collision.maxZ = collision.maxZ * scale.z + translation.z;
  }
}

function translateCollisionSlice(
  collisions: AxisAlignedRectangle[],
  startIndex: number,
  endIndex: number,
  translation: { readonly x: number; readonly z: number },
): void {
  transformCollisionSlice(collisions, startIndex, { x: 1, z: 1 }, translation, endIndex);
}

function createLabelMaterial(
  title: string,
  subtitle: string,
  colors: readonly [string, string],
): THREE.MeshBasicMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#e9d8ad';
    context.lineWidth = 18;
    context.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
    context.textAlign = 'center';
    context.fillStyle = '#fff6dc';
    context.font = '900 92px Arial, sans-serif';
    context.fillText(title, canvas.width / 2, 176);
    context.fillStyle = '#e7d39e';
    context.font = '700 34px Arial, sans-serif';
    context.fillText(subtitle, canvas.width / 2, 255);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
}

function loadFacadeMaterials(): THREE.MeshStandardMaterial[] {
  const loader = new THREE.TextureLoader();
  return [0, 1, 2, 3].map((index) => {
    const texture = loader.load('/assets/street-leonida/facades/ambrosia-company-town.webp');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.repeat.set(1, 1);
    texture.offset.set(index * 0.25, 0);
    return new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.04,
    });
  });
}

function addFacadeBuilding(
  parent: THREE.Group,
  collisions: AxisAlignedRectangle[],
  facade: THREE.Material,
  shell: THREE.Material,
  options: {
    x: number;
    z: number;
    width: number;
    depth: number;
    height: number;
    facesEast: boolean;
  },
): void {
  const { x, z, width, depth, height, facesEast } = options;
  addBox(parent, [depth, height, width], [x, height / 2 + 0.2, z], shell);
  const frontX = x + (facesEast ? depth / 2 + 0.025 : -depth / 2 - 0.025);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(width, height), facade);
  front.position.set(frontX, height / 2 + 0.2, z);
  front.rotation.y = facesEast ? Math.PI / 2 : -Math.PI / 2;
  front.name = 'ambrosia-textured-storefront';
  parent.add(front);
  addBox(parent, [depth + 0.7, 0.22, width + 0.7], [x, height + 0.29, z], shell, undefined, 0);
  addCollision(collisions, x, z, depth, width);
}

function addMainStreet(
  root: THREE.Group,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): void {
  const mainStreet = new THREE.Group();
  mainStreet.name = 'ambrosia-main-street';
  mainStreet.userData.feature = true;
  mainStreet.userData.evidence = 'APPROXIMATE';
  mainStreet.userData.landmarkClaim = 'NONE';
  root.add(mainStreet);

  const facades = loadFacadeMaterials();
  const civicShell = material(0xb7aa91, 0.96);
  const shopShell = material(0x617977, 0.92);
  const darkMetal = material(0x252b2d, 0.72, 0.36);
  const fadedRed = material(0x8f493c, 0.9, 0.08);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x294650,
    emissive: 0x2b2014,
    emissiveIntensity: 0.22,
    roughness: 0.25,
    metalness: 0.3,
  });

  const roadsideOffice = new THREE.Group();
  roadsideOffice.name = 'ambrosia-generic-roadside-office';
  roadsideOffice.userData.evidence = 'APPROXIMATE';
  roadsideOffice.userData.landmarkClaim = 'NONE';
  mainStreet.add(roadsideOffice);
  addFacadeBuilding(roadsideOffice, collisions, facades[0] ?? civicShell, civicShell, {
    x: 35.5,
    z: -51.5,
    width: 12,
    depth: 7,
    height: 5.8,
    facesEast: true,
  });
  const westWorkshop = new THREE.Group();
  westWorkshop.name = 'ambrosia-local-workshop';
  westWorkshop.userData.evidence = 'APPROXIMATE';
  westWorkshop.userData.landmarkClaim = 'NONE';
  mainStreet.add(westWorkshop);
  addFacadeBuilding(westWorkshop, collisions, facades[1] ?? civicShell, civicShell, {
    x: 35.3,
    z: -66.5,
    width: 14,
    depth: 7.4,
    height: 5.6,
    facesEast: true,
  });

  const xeroCollisionStart = collisions.length;
  const station = new THREE.Group();
  station.name = 'ambrosia-xero-station';
  station.userData.feature = true;
  station.userData.communityId = 'L406';
  station.userData.nativeCoordinates = [
    REVIEWED_GTADB_ANCHORS.L406.gtadb.x,
    REVIEWED_GTADB_ANCHORS.L406.gtadb.y,
  ];
  station.userData.source = 'landmarks.json';
  station.userData.landmarkClaim = 'GTADB_NAMED';
  station.userData.evidence = REVIEWED_GTADB_ANCHORS.L406.evidence;
  station.userData.nameEvidence = REVIEWED_GTADB_ANCHORS.L406.evidence.name;
  station.userData.placementEvidence = REVIEWED_GTADB_ANCHORS.L406.evidence.placement;
  station.userData.unconfirmed = REVIEWED_GTADB_ANCHORS.L406.evidence.tagSignals.unconfirmed;
  mainStreet.add(station);
  const xeroHardstand = addBox(
    station,
    [25, 0.1, 22],
    [XERO_CANOPY_AUTHORING_DATUM.x, 0.12, XERO_CANOPY_AUTHORING_DATUM.z],
    material(0x6a6860, 0.98),
    'ambrosia-xero-hardstand',
  );
  xeroHardstand.userData.evidence = 'APPROXIMATE';
  xeroHardstand.userData.landmarkClaim = 'NONE';
  addBox(station, [12, 0.48, 8.2], [62.2, 5.1, -50.5], fadedRed, 'ambrosia-gas-canopy');
  const canopySupports: InstanceTransform[] = [
    { position: [57.4, 2.55, -53.2], scale: [0.32, 5, 0.32] },
    { position: [67, 2.55, -53.2], scale: [0.32, 5, 0.32] },
    { position: [57.4, 2.55, -47.8], scale: [0.32, 5, 0.32] },
    { position: [67, 2.55, -47.8], scale: [0.32, 5, 0.32] },
  ];
  addInstances(station, boxGeometry, darkMetal, canopySupports, 'ambrosia-gas-canopy-supports');
  addFacadeBuilding(station, collisions, facades[2] ?? shopShell, shopShell, {
    x: 68.8,
    z: -50.5,
    width: 8.2,
    depth: 5.5,
    height: 4.2,
    facesEast: false,
  });
  const pumpTransforms: InstanceTransform[] = [-1.8, 1.8].map((offset) => ({
    position: [61.5, 1.15, -50.5 + offset],
    scale: [0.65, 1.9, 0.85],
  }));
  addInstances(station, boxGeometry, fadedRed, pumpTransforms, 'ambrosia-gas-pumps');
  addCylinder(station, 0.32, 7.8, [56.3, 4.1, -43.6], darkMetal);
  const xeroSign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 2.4),
    createLabelMaterial('XERO', 'FUEL · FOOD', ['#006c78', '#172329']),
  );
  xeroSign.position.set(56.3, 7.3, -43.6);
  xeroSign.rotation.y = -0.08;
  station.add(xeroSign);
  const xeroCollisionEnd = collisions.length;
  const xeroTranslation = {
    x: AMBROSIA_LOCAL_ANCHORS.xeroStation.x - XERO_CANOPY_AUTHORING_DATUM.x,
    z: AMBROSIA_LOCAL_ANCHORS.xeroStation.z - XERO_CANOPY_AUTHORING_DATUM.z,
  };
  station.position.set(xeroTranslation.x, 0, xeroTranslation.z);
  translateCollisionSlice(collisions, xeroCollisionStart, xeroCollisionEnd, xeroTranslation);

  const eastGarage = new THREE.Group();
  eastGarage.name = 'ambrosia-industrial-storefronts';
  eastGarage.userData.evidence = 'APPROXIMATE';
  eastGarage.userData.landmarkClaim = 'NONE';
  mainStreet.add(eastGarage);
  addFacadeBuilding(eastGarage, collisions, facades[3] ?? shopShell, shopShell, {
    x: 63.2,
    z: -64.5,
    width: 14,
    depth: 8.5,
    height: 6.2,
    facesEast: false,
  });
  addBox(eastGarage, [0.12, 2.3, 4.8], [58.91, 2.2, -64.5], glass);

  const storefrontFrames: InstanceTransform[] = [
    { position: [39.04, 2.75, -54.1], scale: [0.14, 3.2, 0.16] },
    { position: [39.04, 2.75, -48.9], scale: [0.14, 3.2, 0.16] },
    { position: [39.04, 4.3, -51.5], scale: [0.14, 0.16, 5.35] },
    { position: [39.04, 2.75, -69.7], scale: [0.14, 3.1, 0.16] },
    { position: [39.04, 2.75, -63.3], scale: [0.14, 3.1, 0.16] },
    { position: [39.04, 4.25, -66.5], scale: [0.14, 0.16, 6.55] },
    { position: [66.01, 2.2, -52.3], scale: [0.14, 2.35, 0.14] },
    { position: [66.01, 2.2, -48.7], scale: [0.14, 2.35, 0.14] },
    { position: [66.01, 3.32, -50.5], scale: [0.14, 0.14, 3.75] },
    { position: [58.91, 2.65, -67.6], scale: [0.14, 3.25, 0.16] },
    { position: [58.91, 2.65, -61.4], scale: [0.14, 3.25, 0.16] },
    { position: [58.91, 4.2, -64.5], scale: [0.14, 0.16, 6.35] },
  ];
  const genericStorefrontFrames = storefrontFrames.filter((_, index) => index < 6 || index > 8);
  addInstances(
    mainStreet,
    boxGeometry,
    darkMetal,
    coarsePointer
      ? genericStorefrontFrames.filter((_, index) => index % 2 === 0)
      : genericStorefrontFrames,
    'ambrosia-storefront-window-frames',
  );
  addInstances(
    station,
    boxGeometry,
    darkMetal,
    storefrontFrames.slice(6, 9),
    'ambrosia-xero-window-frames',
  );

  const rooftopHvac: InstanceTransform[] = [
    { position: [35.4, 6.15, -66.5], scale: [1.4, 0.8, 1.8] },
    { position: [63.3, 6.75, -64.5], scale: [1.6, 0.82, 2] },
    { position: [68.8, 4.75, -50.5], scale: [1.25, 0.72, 1.4] },
  ];
  addInstances(
    mainStreet,
    boxGeometry,
    darkMetal,
    (coarsePointer ? rooftopHvac.slice(0, 2) : rooftopHvac).filter((_, index) => index !== 2),
    'ambrosia-storefront-rooftop-hvac',
  );
  addInstances(station, boxGeometry, darkMetal, rooftopHvac.slice(2), 'ambrosia-xero-rooftop-hvac');

  const roadPatches: InstanceTransform[] = [];
  for (let index = 0; index < (coarsePointer ? 7 : 14); index += 1) {
    roadPatches.push({
      position: [46.4 + (index % 3) * 1.5, 0.205, -22 - index * 2.45],
      scale: [0.6 + (index % 4) * 0.32, 0.025, 1.1 + (index % 3) * 0.52],
      rotation: [0, (index % 5) * 0.17, 0],
    });
  }
  addInstances(mainStreet, boxGeometry, darkMetal, roadPatches, 'ambrosia-road-patches');

  const billboard = new THREE.Group();
  billboard.name = 'ambrosia-roadside-billboard';
  billboard.userData.evidence = 'APPROXIMATE';
  billboard.userData.claimScope = 'supported landmark name; sign placement approximate';
  mainStreet.add(billboard);
  addInstances(
    billboard,
    boxGeometry,
    darkMetal,
    [
      { position: [38.2, 4.2, -57.5], scale: [0.24, 8, 0.24] },
      { position: [38.2, 4.2, -53.1], scale: [0.24, 8, 0.24] },
    ],
    'ambrosia-billboard-posts',
  );
  const billboardFace = new THREE.Mesh(
    new THREE.PlaneGeometry(7.6, 3.8),
    createLabelMaterial('ALLIED CRYSTAL', 'SUGAR MILL · AMBROSIA', ['#6f2825', '#172d37']),
  );
  billboardFace.position.set(38.34, 7.45, -55.3);
  billboardFace.rotation.y = Math.PI / 2;
  billboard.add(billboardFace);

  const utility = new THREE.Group();
  utility.name = 'ambrosia-utility-grid';
  utility.userData.feature = true;
  utility.userData.evidence = 'APPROXIMATE';
  utility.userData.landmarkClaim = 'NONE';
  mainStreet.add(utility);
  const poleZs = [-24, -35.5, -47.2, -58.5];
  addInstances(
    utility,
    cylinderGeometry,
    material(0x4c3525, 1),
    poleZs.map((z) => ({ position: [40.3, 4.7, z], scale: [0.34, 9.2, 0.34] })),
    'ambrosia-utility-poles',
  );
  addInstances(
    utility,
    boxGeometry,
    darkMetal,
    poleZs.map((z) => ({ position: [40.3, 8.6, z], scale: [4.1, 0.2, 0.22] })),
    'ambrosia-utility-crossarms',
  );
  const wirePositions: number[] = [];
  for (let index = 0; index < poleZs.length - 1; index += 1) {
    const start = poleZs[index];
    const end = poleZs[index + 1];
    if (start === undefined || end === undefined) continue;
    for (const offset of [-1.45, 0, 1.45]) {
      const samples = 8;
      for (let sample = 0; sample < samples; sample += 1) {
        const a = sample / samples;
        const b = (sample + 1) / samples;
        const sag = (progress: number): number => Math.sin(progress * Math.PI) * 0.7;
        wirePositions.push(
          40.3 + offset,
          8.58 - sag(a),
          THREE.MathUtils.lerp(start, end, a),
          40.3 + offset,
          8.58 - sag(b),
          THREE.MathUtils.lerp(start, end, b),
        );
      }
    }
  }
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wirePositions, 3));
  const wires = new THREE.LineSegments(
    wireGeometry,
    new THREE.LineBasicMaterial({ color: 0x151719 }),
  );
  wires.name = 'ambrosia-power-lines';
  utility.add(wires);
}

function addIndustrialCore(
  root: THREE.Group,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): {
  smoke: THREE.Points;
  smokeSeeds: ParticleSeed[];
} {
  const tankFarm = new THREE.Group();
  tankFarm.name = 'ambrosia-industrial-tank-farm';
  tankFarm.userData.feature = true;
  tankFarm.userData.communityId = 'L399';
  tankFarm.userData.nativeCoordinates = [
    REVIEWED_GTADB_ANCHORS.L399.gtadb.x,
    REVIEWED_GTADB_ANCHORS.L399.gtadb.y,
  ];
  tankFarm.userData.communityName = 'Allied Crystal Sugar Mill, Ambrosia';
  tankFarm.userData.source = 'landmarks.json';
  tankFarm.userData.evidence = REVIEWED_GTADB_ANCHORS.L399.evidence;
  root.add(tankFarm);
  const galvanized = material(0x9fa6a2, 0.42, 0.56);
  const rust = material(0x744236, 0.92, 0.12);
  const concrete = material(0x696b68, 0.96);
  const darkSteel = material(0x2f3739, 0.66, 0.48);
  const safety = material(0xb98b2f, 0.72, 0.22);

  const tanks = coarsePointer
    ? ([
        [118, -88, 7, 6.2],
        [127, -96, 6, 5.6],
      ] as const)
    : ([
        [117, -87, 8, 6.6],
        [128, -88, 7.5, 7.3],
        [122, -99, 6.5, 6.1],
      ] as const);
  tanks.forEach(([x, z, diameter, height]) => {
    addCylinder(tankFarm, diameter, height, [x, height / 2 + 0.25, z], galvanized);
    const dome = new THREE.Mesh(sphereGeometry, galvanized);
    dome.scale.set(diameter, 1.9, diameter);
    dome.position.set(x, height + 0.1, z);
    tankFarm.add(dome);
    addCollision(collisions, x, z, diameter, diameter);
  });
  const tankBands: InstanceTransform[] = [];
  tanks.forEach(([x, z, diameter, height]) => {
    for (const y of [1.5, height * 0.55, height - 0.35]) {
      tankBands.push({ position: [x, y, z], scale: [diameter + 0.22, 0.1, diameter + 0.22] });
    }
  });
  addInstances(tankFarm, cylinderGeometry, darkSteel, tankBands, 'ambrosia-tank-bands');

  const stacks = new THREE.Group();
  stacks.name = 'ambrosia-smokestacks';
  stacks.userData.feature = true;
  root.add(stacks);
  const stackSpecs = coarsePointer
    ? ([
        [103, -111, 2, 23],
        [110, -116, 1.5, 18],
      ] as const)
    : ([
        [101, -110, 2.2, 25],
        [108, -115, 1.7, 21],
        [114, -111, 1.35, 17],
      ] as const);
  stackSpecs.forEach(([x, z, diameter, height], index) => {
    addCylinder(stacks, diameter, height, [x, height / 2, z], index % 2 ? concrete : rust);
    for (const y of [height * 0.68, height * 0.84]) {
      addCylinder(stacks, diameter + 0.16, 0.65, [x, y, z], galvanized);
    }
    const beacon = new THREE.Mesh(
      sphereGeometry,
      new THREE.MeshBasicMaterial({ color: 0xff4a37, toneMapped: false }),
    );
    beacon.scale.setScalar(0.32);
    beacon.position.set(x, height + 0.32, z);
    stacks.add(beacon);
  });

  const processingBuildings: InstanceTransform[] = [
    { position: [103, 4.2, -95], scale: [12, 8, 8] },
    { position: [119, 3.3, -109], scale: [15, 6.2, 9] },
    { position: [132, 2.6, -101], scale: [9, 5, 7] },
  ];
  addInstances(
    tankFarm,
    boxGeometry,
    rust,
    coarsePointer ? processingBuildings.slice(0, 2) : processingBuildings,
    'ambrosia-processing-halls',
  );

  const claddingSeams: InstanceTransform[] = [];
  for (const [x, height, z, width] of [
    [103, 8, -90.96, 12],
    [119, 6.2, -104.46, 15],
    [132, 5, -97.46, 9],
  ] as const) {
    const seamCount = coarsePointer ? 3 : 6;
    for (let index = 1; index <= seamCount; index += 1) {
      claddingSeams.push({
        position: [x - width / 2 + (width * index) / (seamCount + 1), height / 2, z],
        scale: [0.08, height * 0.86, 0.09],
      });
    }
  }
  addInstances(
    tankFarm,
    boxGeometry,
    darkSteel,
    claddingSeams,
    'ambrosia-processing-cladding-seams',
  );

  const clerestory: InstanceTransform[] = [
    { position: [103, 6.55, -90.9], scale: [7.8, 0.82, 0.12] },
    { position: [119, 5.1, -104.4], scale: [9.4, 0.7, 0.12] },
    { position: [132, 4.05, -97.4], scale: [5.4, 0.62, 0.12] },
  ];
  addInstances(
    tankFarm,
    boxGeometry,
    galvanized,
    coarsePointer ? clerestory.slice(0, 2) : clerestory,
    'ambrosia-processing-clerestory',
  );

  const pipeRack: InstanceTransform[] = [];
  for (let x = 106; x <= 132; x += 4.3) {
    pipeRack.push({ position: [x, 4.5, -105], scale: [0.18, 8.4, 0.18] });
    pipeRack.push({ position: [x, 8.45, -105], scale: [4.4, 0.18, 0.18] });
  }
  addInstances(tankFarm, boxGeometry, safety, pipeRack, 'ambrosia-extended-pipe-rack');

  const railYard = new THREE.Group();
  railYard.name = 'ambrosia-rail-yard';
  railYard.userData.feature = true;
  railYard.userData.evidence = 'APPROXIMATE';
  railYard.userData.landmarkClaim = 'NONE';
  railYard.userData.infill = 'APPROXIMATE';
  root.add(railYard);
  addBox(railYard, [74, 0.12, 0.12], [96, 0.27, -120.2], darkSteel, 'ambrosia-rail-north');
  addBox(railYard, [74, 0.12, 0.12], [96, 0.27, -116.4], darkSteel, 'ambrosia-rail-south');
  const sleepers: InstanceTransform[] = [];
  for (let x = 60; x <= 132; x += coarsePointer ? 3.2 : 1.65) {
    sleepers.push({ position: [x, 0.17, -118.3], scale: [0.28, 0.12, 5] });
  }
  addInstances(railYard, boxGeometry, material(0x4a3022, 1), sleepers, 'ambrosia-rail-sleepers');
  const freightCars = coarsePointer ? 1 : 3;
  for (let index = 0; index < freightCars; index += 1) {
    const x = 78 + index * 14;
    addBox(railYard, [11, 3.7, 3.15], [x, 2.15, -118.3], index % 2 ? rust : concrete);
    addInstances(
      railYard,
      cylinderGeometry,
      darkSteel,
      [-3.4, 3.4].flatMap((offset) =>
        [-1.5, 1.5].map((zOffset) => ({
          position: [x + offset, 0.62, -118.3 + zOffset],
          scale: [0.72, 0.32, 0.72] as Vec3,
          rotation: [0, 0, Math.PI / 2] as Vec3,
        })),
      ),
      `ambrosia-freight-wheels-${index}`,
    );
  }

  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = 128;
  smokeCanvas.height = 128;
  const smokeContext = smokeCanvas.getContext('2d');
  if (smokeContext) {
    const gradient = smokeContext.createRadialGradient(64, 64, 3, 64, 64, 61);
    gradient.addColorStop(0, 'rgba(255,255,255,.72)');
    gradient.addColorStop(0.45, 'rgba(170,160,145,.4)');
    gradient.addColorStop(1, 'rgba(90,75,65,0)');
    smokeContext.fillStyle = gradient;
    smokeContext.fillRect(0, 0, 128, 128);
  }
  const smokeTexture = new THREE.CanvasTexture(smokeCanvas);
  const smokeSeeds: ParticleSeed[] = [];
  const smokePositions: number[] = [];
  stackSpecs.forEach(([x, z, , height], stackIndex) => {
    const count = coarsePointer ? 6 : 11;
    for (let index = 0; index < count; index += 1) {
      const phase = (index + stackIndex * 0.41) / count;
      smokeSeeds.push({ origin: [x, height, z], phase, drift: stackIndex * 0.7 + index * 0.19 });
      smokePositions.push(x, height, z);
    }
  });
  const smokeGeometry = new THREE.BufferGeometry();
  smokeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(smokePositions, 3));
  const smoke = new THREE.Points(
    smokeGeometry,
    new THREE.PointsMaterial({
      map: smokeTexture,
      color: 0xc8b8a7,
      size: coarsePointer ? 5.2 : 6.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      alphaTest: 0.03,
    }),
  );
  smoke.name = 'ambrosia-industrial-smoke';
  stacks.add(smoke);
  return { smoke, smokeSeeds };
}

function addAgriculturalEdge(root: THREE.Group, coarsePointer: boolean): void {
  const fields = new THREE.Group();
  fields.name = 'ambrosia-cane-fields';
  fields.userData.feature = true;
  fields.userData.communityId = 'L1065';
  fields.userData.nativeCoordinates = [
    REVIEWED_GTADB_ANCHORS.L1065.gtadb.x,
    REVIEWED_GTADB_ANCHORS.L1065.gtadb.y,
  ];
  fields.userData.source = 'landmarks.json';
  fields.userData.landmarkClaim = 'UNCONFIRMED';
  fields.userData.evidence = REVIEWED_GTADB_ANCHORS.L1065.evidence;
  fields.userData.nameEvidence = REVIEWED_GTADB_ANCHORS.L1065.evidence.name;
  fields.userData.placementEvidence = REVIEWED_GTADB_ANCHORS.L1065.evidence.placement;
  fields.userData.unconfirmed = REVIEWED_GTADB_ANCHORS.L1065.evidence.tagSignals.unconfirmed;
  root.add(fields);
  const soil = material(0x5f5135, 1);
  const variedSoil = material(0x4d432f, 1);
  const water = new THREE.MeshStandardMaterial({
    color: 0x3b665d,
    roughness: 0.28,
    metalness: 0.12,
    transparent: true,
    opacity: 0.82,
  });
  const fieldSoil = addBox(fields, [39, 0.12, 18], [30, 0.15, -112], soil, 'ambrosia-field-soil');
  fieldSoil.userData.evidence = 'APPROXIMATE';
  fieldSoil.userData.landmarkClaim = 'NONE';
  addBox(fields, [2.3, 0.09, 33], [12.2, 0.2, -109], water, 'ambrosia-irrigation-ditch');
  const rowTransforms: InstanceTransform[] = [];
  for (let x = 14.8; x <= 50; x += 2.15) {
    rowTransforms.push({ position: [x, 0.24, -112], scale: [0.72, 0.08, 17.5] });
  }
  addInstances(fields, boxGeometry, material(0x332b20, 1), rowTransforms, 'ambrosia-cane-furrows');

  const caneTexture = new THREE.TextureLoader().load(
    '/assets/street-leonida/vegetation/ambrosia-sugarcane.webp',
  );
  caneTexture.colorSpace = THREE.SRGBColorSpace;
  caneTexture.minFilter = THREE.LinearMipmapLinearFilter;
  const caneMaterial = new THREE.MeshStandardMaterial({
    map: caneTexture,
    transparent: true,
    alphaTest: 0.34,
    depthWrite: true,
    side: THREE.DoubleSide,
    roughness: 0.96,
  });
  const caneTransforms: InstanceTransform[] = [];
  const columns = coarsePointer ? 9 : 17;
  const rows = coarsePointer ? 3 : 6;
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const x = 15.5 + column * (34 / Math.max(1, columns - 1));
      const z = -119 + row * (14 / Math.max(1, rows - 1));
      const scale = 0.82 + ((column * 7 + row * 3) % 6) * 0.055;
      caneTransforms.push({
        position: [x, 2.2 * scale, z],
        scale: [2.5 * scale, 4.4 * scale, 1],
        rotation: [0, ((column + row) % 5) * 0.31, 0],
      });
    }
  }
  addInstances(
    fields,
    new THREE.PlaneGeometry(1, 1),
    caneMaterial,
    caneTransforms,
    'ambrosia-sugarcane-clumps',
  );
  const soilVariation = addBox(
    fields,
    [16, 0.05, 5.2],
    [22, 0.23, -122.1],
    variedSoil,
    'ambrosia-field-soil-variation',
  );
  soilVariation.userData.evidence = 'APPROXIMATE';
  soilVariation.userData.landmarkClaim = 'NONE';
}

function addSugarFieldInfrastructure(
  root: THREE.Group,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): void {
  const darkSteel = material(0x30383a, 0.68, 0.72);
  const galvanized = material(0x87908d, 0.58, 0.64);
  const concrete = material(0x8d8d86, 0.98);
  const serviceWhite = material(0xb8b6aa, 0.92, 0.08);
  const fenceMetal = material(0x59615e, 0.75, 0.62);

  const pylons = new THREE.Group();
  pylons.name = 'ambrosia-field-pylons';
  pylons.userData.feature = true;
  pylons.userData.reference = 'Approximate agricultural power infrastructure';
  pylons.userData.source = 'landmarks.json';
  pylons.userData.evidence = 'APPROXIMATE';
  pylons.userData.landmarkClaim = 'NONE';
  root.add(pylons);

  const pylonPositions = coarsePointer ? ([-5, 12, 29] as const) : ([-8, 5, 18, 31] as const);
  const pylonZ = (x: number): number => -48 + (x + 8) * 0.24;
  for (const [index, x] of pylonPositions.entries()) {
    const z = pylonZ(x);
    const pylon = new THREE.Group();
    pylon.name = `ambrosia-field-pylon-${index + 1}`;
    pylon.position.set(x, 0, z);
    pylons.add(pylon);

    for (const side of [-1, 1]) {
      const leg = addBox(
        pylon,
        [0.18, 11.2, 0.18],
        [side * 1.55, 5.5, 0],
        darkSteel,
        undefined,
        side * -0.13,
      );
      leg.rotation.z = side * -0.13;
    }
    addBox(pylon, [4.8, 0.22, 0.22], [0, 8.5, 0], darkSteel);
    addBox(pylon, [6.4, 0.24, 0.24], [0, 10.5, 0], darkSteel);
    addBox(pylon, [3.1, 0.2, 0.2], [0, 12.2, 0], darkSteel);
    const braces: InstanceTransform[] = [];
    for (let level = 1; level <= 5; level += 1) {
      const y = 1.3 + level * 1.65;
      braces.push({
        position: [0, y, 0],
        scale: [3.5 - level * 0.3, 0.12, 0.12],
        rotation: [0, 0, level % 2 === 0 ? 0.38 : -0.38],
      });
    }
    addInstances(pylon, boxGeometry, galvanized, braces, `ambrosia-pylon-braces-${index}`);
  }

  const transmissionPositions: number[] = [];
  for (let index = 0; index < pylonPositions.length - 1; index += 1) {
    const fromX = pylonPositions[index];
    const toX = pylonPositions[index + 1];
    if (fromX === undefined || toX === undefined) continue;
    for (const [offsetZ, wireHeight] of [
      [-1.45, 10.55],
      [1.45, 10.55],
      [0, 12.25],
    ] as const) {
      const samples = coarsePointer ? 5 : 9;
      for (let sample = 0; sample < samples; sample += 1) {
        const a = sample / samples;
        const b = (sample + 1) / samples;
        const sag = (progress: number): number => Math.sin(progress * Math.PI) * 0.9;
        transmissionPositions.push(
          THREE.MathUtils.lerp(fromX, toX, a),
          wireHeight - sag(a),
          THREE.MathUtils.lerp(pylonZ(fromX), pylonZ(toX), a) + offsetZ,
          THREE.MathUtils.lerp(fromX, toX, b),
          wireHeight - sag(b),
          THREE.MathUtils.lerp(pylonZ(fromX), pylonZ(toX), b) + offsetZ,
        );
      }
    }
  }
  const transmissionGeometry = new THREE.BufferGeometry();
  transmissionGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(transmissionPositions, 3),
  );
  const transmissionLines = new THREE.LineSegments(
    transmissionGeometry,
    new THREE.LineBasicMaterial({ color: 0x171b1d }),
  );
  transmissionLines.name = 'ambrosia-high-voltage-lines';
  pylons.add(transmissionLines);

  const radio = new THREE.Group();
  radio.name = 'ambrosia-radio-tower';
  radio.userData.feature = true;
  radio.userData.communityId = 'L888';
  radio.userData.nativeCoordinates = [
    REVIEWED_GTADB_ANCHORS.L888.gtadb.x,
    REVIEWED_GTADB_ANCHORS.L888.gtadb.y,
  ];
  radio.userData.source = 'landmarks.json';
  radio.userData.landmarkClaim = 'UNCONFIRMED';
  radio.userData.evidence = REVIEWED_GTADB_ANCHORS.L888.evidence;
  radio.userData.nameEvidence = REVIEWED_GTADB_ANCHORS.L888.evidence.name;
  radio.userData.placementEvidence = REVIEWED_GTADB_ANCHORS.L888.evidence.placement;
  radio.userData.unconfirmed = REVIEWED_GTADB_ANCHORS.L888.evidence.tagSignals.unconfirmed;
  radio.position.set(AMBROSIA_LOCAL_ANCHORS.radioTower.x, 0, AMBROSIA_LOCAL_ANCHORS.radioTower.z);
  root.add(radio);
  const radioFooting = addCylinder(
    radio,
    2.8,
    0.18,
    [0, 0.1, 0],
    concrete,
    'ambrosia-radio-tower-footing',
  );
  radioFooting.userData.evidence = 'APPROXIMATE';
  radioFooting.userData.landmarkClaim = 'NONE';
  for (const side of [-1, 1]) {
    const mastLeg = addBox(radio, [0.16, 15, 0.16], [side * 0.65, 7.5, 0], darkSteel);
    mastLeg.rotation.z = side * -0.065;
  }
  const radioBraces: InstanceTransform[] = [];
  for (let level = 0; level < (coarsePointer ? 5 : 9); level += 1) {
    radioBraces.push({
      position: [0, 1.5 + level * 1.5, 0],
      scale: [1.4 - level * 0.055, 0.1, 0.1],
      rotation: [0, 0, level % 2 === 0 ? 0.48 : -0.48],
    });
  }
  addInstances(radio, boxGeometry, galvanized, radioBraces, 'ambrosia-radio-tower-braces');
  const radioBeacon = new THREE.Mesh(
    sphereGeometry,
    new THREE.MeshBasicMaterial({ color: 0xff3d2e, toneMapped: false }),
  );
  radioBeacon.name = 'ambrosia-radio-beacon';
  radioBeacon.scale.setScalar(0.26);
  radioBeacon.position.y = 15.25;
  radio.add(radioBeacon);

  const utilityCollisionStart = collisions.length;
  const unknownUtility = new THREE.Group();
  unknownUtility.name = 'ambrosia-unidentified-utility-site';
  unknownUtility.userData.feature = true;
  unknownUtility.userData.communityId = 'L594';
  unknownUtility.userData.nativeCoordinates = [
    REVIEWED_GTADB_ANCHORS.L594.gtadb.x,
    REVIEWED_GTADB_ANCHORS.L594.gtadb.y,
  ];
  unknownUtility.userData.source = 'landmarks.json';
  unknownUtility.userData.landmarkClaim = 'UNKNOWN';
  unknownUtility.userData.evidence = REVIEWED_GTADB_ANCHORS.L594.evidence;
  unknownUtility.userData.nameEvidence = REVIEWED_GTADB_ANCHORS.L594.evidence.name;
  unknownUtility.userData.placementEvidence = REVIEWED_GTADB_ANCHORS.L594.evidence.placement;
  unknownUtility.userData.unconfirmed = REVIEWED_GTADB_ANCHORS.L594.evidence.tagSignals.unconfirmed;
  unknownUtility.position.set(7, 0, -48);
  root.add(unknownUtility);

  const unknownUtilityPad = addBox(
    unknownUtility,
    [13, 0.12, 10],
    [0, 0.11, 0],
    concrete,
    'ambrosia-unknown-utility-pad',
  );
  unknownUtilityPad.userData.evidence = 'APPROXIMATE';
  unknownUtilityPad.userData.landmarkClaim = 'NONE';
  addBox(
    unknownUtility,
    [6.2, 4.8, 6.6],
    [3.9, 2.45, 0],
    serviceWhite,
    'ambrosia-unknown-utility-building',
  );
  addBox(unknownUtility, [6.5, 0.32, 6.9], [3.9, 4.95, 0], concrete);
  addBox(
    unknownUtility,
    [1.8, 2.25, 1.4],
    [-2.8, 1.2, 2.8],
    darkSteel,
    'ambrosia-unknown-utility-cabinet',
  );
  addCollision(collisions, 10.9, -48, 6.2, 6.6);

  const fencePosts: InstanceTransform[] = [];
  for (let index = 0; index < (coarsePointer ? 6 : 11); index += 1) {
    const z = -4.8 + index * (9.6 / (coarsePointer ? 5 : 10));
    fencePosts.push({ position: [0.4, 1.1, z], scale: [0.09, 2.2, 0.09] });
  }
  addInstances(
    unknownUtility,
    cylinderGeometry,
    fenceMetal,
    fencePosts,
    'ambrosia-unknown-utility-fence-posts',
  );
  addCylinder(
    unknownUtility,
    0.16,
    8.2,
    [4.6, 8.9, 0],
    darkSteel,
    'ambrosia-unknown-utility-antenna',
  );
  const utilityCollisionEnd = collisions.length;
  const utilityTranslation = {
    x: AMBROSIA_LOCAL_ANCHORS.unknownUtilityL594.x - unknownUtility.position.x,
    z: AMBROSIA_LOCAL_ANCHORS.unknownUtilityL594.z - unknownUtility.position.z,
  };
  unknownUtility.position.set(
    AMBROSIA_LOCAL_ANCHORS.unknownUtilityL594.x,
    0,
    AMBROSIA_LOCAL_ANCHORS.unknownUtilityL594.z,
  );
  translateCollisionSlice(
    collisions,
    utilityCollisionStart,
    utilityCollisionEnd,
    utilityTranslation,
  );
}

function animateParticles(
  points: THREE.Points,
  seeds: readonly ParticleSeed[],
  elapsedSeconds: number,
  rise: number,
  cycle: number,
): void {
  const attribute = points.geometry.getAttribute('position');
  if (!(attribute instanceof THREE.BufferAttribute)) return;
  seeds.forEach((seed, index) => {
    const progress = (seed.phase + elapsedSeconds / cycle) % 1;
    const sway = Math.sin(elapsedSeconds * 0.32 + seed.drift) * progress * 3.2;
    attribute.setXYZ(
      index,
      seed.origin[0] + progress * 5.4 + sway,
      seed.origin[1] + progress * rise,
      seed.origin[2] + Math.cos(elapsedSeconds * 0.23 + seed.drift) * progress * 2.1,
    );
  });
  attribute.needsUpdate = true;
}

export function createAmbrosiaDistrict(
  scene: THREE.Scene,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): AmbrosiaDistrict {
  const root = new THREE.Group();
  root.name = 'ambrosia-district-details';
  addMainStreet(root, collisions, coarsePointer);
  const industrialCollisionStart = collisions.length;
  const industrial = addIndustrialCore(root, collisions, coarsePointer);
  addAgriculturalEdge(root, coarsePointer);

  const industrialScale = { x: 0.55, z: 0.55 };
  const industrialTranslation = { x: -32.9, z: 19.55 };
  for (const name of ['ambrosia-industrial-tank-farm', 'ambrosia-smokestacks']) {
    const group = root.getObjectByName(name);
    group?.scale.set(industrialScale.x, 1, industrialScale.z);
    group?.position.set(industrialTranslation.x, 0, industrialTranslation.z);
  }
  transformCollisionSlice(
    collisions,
    industrialCollisionStart,
    industrialScale,
    industrialTranslation,
  );

  const railYard = root.getObjectByName('ambrosia-rail-yard');
  railYard?.scale.set(0.5, 1, 1);
  railYard?.position.set(-20, 0, 90.3);

  const fieldScale = { x: 0.65, z: 0.6 };
  const fieldTranslation = { x: -3.5, z: 31.2 };
  const fieldReanchorTranslation = {
    x: AMBROSIA_LOCAL_ANCHORS.sugarFields.x - SUGAR_FIELD_AUTHORING_DATUM.x,
    z: AMBROSIA_LOCAL_ANCHORS.sugarFields.z - SUGAR_FIELD_AUTHORING_DATUM.z,
  };
  for (const name of ['ambrosia-cane-fields']) {
    const group = root.getObjectByName(name);
    group?.scale.set(fieldScale.x, 1, fieldScale.z);
    group?.position.set(
      fieldTranslation.x + fieldReanchorTranslation.x,
      0,
      fieldTranslation.z + fieldReanchorTranslation.z,
    );
  }
  addSugarFieldInfrastructure(root, collisions, coarsePointer);
  root
    .getObjectByName('ambrosia-field-pylons')
    ?.position.set(fieldReanchorTranslation.x, 0, fieldReanchorTranslation.z);
  const features: string[] = [];
  root.traverse((object) => {
    if (object.userData.feature === true && object.name) features.push(object.name);
  });
  root.userData.features = features;
  root.userData.qualityTier = coarsePointer ? 'mobile' : 'desktop';
  root.userData.communitySource = STATE_OF_LEONIDA_COMMUNITY_MAP.assetUrl;
  root.userData.communityMarkerCount = STATE_OF_LEONIDA_COMMUNITY_MAP.markerCount;
  scene.add(root);

  return {
    root,
    features,
    update(elapsedSeconds) {
      animateParticles(industrial.smoke, industrial.smokeSeeds, elapsedSeconds, 19, 13);
    },
  };
}
