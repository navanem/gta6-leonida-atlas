import * as THREE from 'three';

import type { AxisAlignedRectangle } from './walk-engine';
import { LEGACY_REGION_TRANSLATIONS } from './walk-geography';
import type { WalkRenderRegion } from './walk-region-streaming';

type Vec3 = readonly [number, number, number];

interface InstanceTransform {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
}

interface BeamTransform {
  start: Vec3;
  end: Vec3;
  radius: number;
}

interface ArchitectureGeometry {
  box: THREE.BoxGeometry;
  cylinder: THREE.CylinderGeometry;
  slimCylinder: THREE.CylinderGeometry;
  awning: THREE.CylinderGeometry;
  sphere: THREE.SphereGeometry;
  rock: THREE.DodecahedronGeometry;
  decoCrown: THREE.ExtrudeGeometry;
}

interface ArchitectureMaterials {
  creamStucco: THREE.MeshStandardMaterial;
  coralStucco: THREE.MeshStandardMaterial;
  aquaStucco: THREE.MeshStandardMaterial;
  paleTrim: THREE.MeshStandardMaterial;
  darkTrim: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  warmGlass: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  paintedSteel: THREE.MeshStandardMaterial;
  galvanized: THREE.MeshStandardMaterial;
  rust: THREE.MeshStandardMaterial;
  industrialYellow: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  weatheredConcrete: THREE.MeshStandardMaterial;
  fadedCoral: THREE.MeshStandardMaterial;
  fadedAqua: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  darkTimber: THREE.MeshStandardMaterial;
  rope: THREE.MeshStandardMaterial;
  boatHull: THREE.MeshStandardMaterial;
  mangrove: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  moss: THREE.MeshStandardMaterial;
  sandstone: THREE.MeshStandardMaterial;
  darkRock: THREE.MeshStandardMaterial;
  bridgeSteel: THREE.MeshStandardMaterial;
  asphalt: THREE.MeshStandardMaterial;
  pinkLight: THREE.MeshBasicMaterial;
  cyanLight: THREE.MeshBasicMaterial;
  amberLight: THREE.MeshBasicMaterial;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function makeSurfaceTexture(seed: number, contrast: number): THREE.DataTexture {
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
      const broadVariation = Math.sin(x * 0.67 + y * 0.31) * contrast * 0.25;
      const value = Math.round(
        THREE.MathUtils.clamp(220 + (random() - 0.5) * contrast + broadVariation, 140, 255),
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
  texture.repeat.set(2.5, 2.5);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function surfaceMaterial(
  color: number,
  map: THREE.Texture,
  roughness: number,
  metalness = 0,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, map, roughness, metalness });
}

function createRoadsideSignMaterial(label: string): THREE.MeshBasicMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#164f5e');
    gradient.addColorStop(1, '#0b2734');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#52e3ef';
    context.lineWidth = 14;
    context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    context.fillStyle = '#f1fbf7';
    context.font = '900 102px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(82, 227, 239, .75)';
    context.shadowBlur = 18;
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
}

function detailMaterial(
  color: number,
  roughness: number,
  metalness = 0,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

function createGeometry(): ArchitectureGeometry {
  const decoProfile = new THREE.Shape();
  decoProfile.moveTo(-0.5, -0.5);
  decoProfile.lineTo(0.5, -0.5);
  decoProfile.lineTo(0.5, 0.12);
  decoProfile.lineTo(0.36, 0.12);
  decoProfile.lineTo(0.36, 0.28);
  decoProfile.lineTo(0.17, 0.28);
  decoProfile.lineTo(0.17, 0.5);
  decoProfile.lineTo(-0.17, 0.5);
  decoProfile.lineTo(-0.17, 0.28);
  decoProfile.lineTo(-0.36, 0.28);
  decoProfile.lineTo(-0.36, 0.12);
  decoProfile.lineTo(-0.5, 0.12);
  decoProfile.closePath();
  const decoCrown = new THREE.ExtrudeGeometry(decoProfile, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    bevelSegments: 1,
  });
  decoCrown.translate(0, 0, -0.09);
  decoCrown.computeVertexNormals();

  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
    slimCylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    awning: new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, false, 0, Math.PI),
    sphere: new THREE.SphereGeometry(0.5, 12, 8),
    rock: new THREE.DodecahedronGeometry(0.5, 1),
    decoCrown,
  };
}

function createMaterials(): ArchitectureMaterials {
  const stuccoMap = makeSurfaceTexture(91831, 24);
  const concreteMap = makeSurfaceTexture(65191, 42);
  const timberMap = makeSurfaceTexture(27419, 52);
  const rockMap = makeSurfaceTexture(48109, 62);

  return {
    creamStucco: surfaceMaterial(0xf2dbc2, stuccoMap, 0.84),
    coralStucco: surfaceMaterial(0xd77c77, stuccoMap, 0.86),
    aquaStucco: surfaceMaterial(0x65b8b3, stuccoMap, 0.84),
    paleTrim: detailMaterial(0xf4ecdc, 0.74),
    darkTrim: detailMaterial(0x20292e, 0.72, 0.12),
    glass: new THREE.MeshStandardMaterial({
      color: 0x183e4e,
      emissive: 0x0b2b39,
      emissiveIntensity: 0.5,
      roughness: 0.18,
      metalness: 0.34,
      transparent: true,
      opacity: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    warmGlass: new THREE.MeshStandardMaterial({
      color: 0x664b35,
      emissive: 0x6b3d1c,
      emissiveIntensity: 0.62,
      roughness: 0.24,
      metalness: 0.2,
      transparent: true,
      opacity: 0.9,
    }),
    chrome: detailMaterial(0xb7c7c9, 0.24, 0.78),
    paintedSteel: detailMaterial(0x32424b, 0.56, 0.48),
    galvanized: surfaceMaterial(0x9da6a5, concreteMap, 0.46, 0.54),
    rust: surfaceMaterial(0x855044, concreteMap, 0.9, 0.08),
    industrialYellow: detailMaterial(0xd3a83a, 0.72, 0.24),
    concrete: surfaceMaterial(0xb6b2a8, concreteMap, 0.92),
    weatheredConcrete: surfaceMaterial(0x777b78, concreteMap, 0.98),
    fadedCoral: surfaceMaterial(0xae6e6a, concreteMap, 0.96),
    fadedAqua: surfaceMaterial(0x6f9c99, concreteMap, 0.94),
    timber: surfaceMaterial(0x9a6b42, timberMap, 0.96),
    darkTimber: surfaceMaterial(0x554132, timberMap, 1),
    rope: detailMaterial(0x685a43, 1),
    boatHull: detailMaterial(0xe8e5dc, 0.38, 0.18),
    mangrove: surfaceMaterial(0x5b4835, timberMap, 1),
    foliage: detailMaterial(0x2e6246, 0.98),
    moss: detailMaterial(0x70815c, 1),
    sandstone: surfaceMaterial(0xa86f4c, rockMap, 1),
    darkRock: surfaceMaterial(0x5f5046, rockMap, 1),
    bridgeSteel: surfaceMaterial(0x5e4038, concreteMap, 0.76, 0.35),
    asphalt: surfaceMaterial(0x262a2c, concreteMap, 0.98),
    pinkLight: new THREE.MeshBasicMaterial({ color: 0xff4b9c, toneMapped: false }),
    cyanLight: new THREE.MeshBasicMaterial({ color: 0x4de5ef, toneMapped: false }),
    amberLight: new THREE.MeshBasicMaterial({ color: 0xffc45b, toneMapped: false }),
  };
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3,
  scale: Vec3,
  rotation: Vec3 = [0, 0, 0],
  name?: string,
  castsShadow = true,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(...position);
  result.scale.set(...scale);
  result.rotation.set(...rotation);
  result.castShadow = castsShadow;
  result.receiveShadow = true;
  if (name) result.name = name;
  parent.add(result);
  return result;
}

function addInstances(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: readonly InstanceTransform[],
  name: string,
  castsShadow = false,
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
  instances.name = name;
  parent.add(instances);
  return instances;
}

function addBeamInstances(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  beams: readonly BeamTransform[],
  name: string,
  castsShadow = false,
): THREE.InstancedMesh | null {
  if (beams.length === 0) return null;
  const instances = new THREE.InstancedMesh(geometry, material, beams.length);
  const midpoint = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();

  beams.forEach((beam, index) => {
    const start = new THREE.Vector3(...beam.start);
    const end = new THREE.Vector3(...beam.end);
    direction.copy(end).sub(start);
    const length = direction.length();
    midpoint.copy(start).add(end).multiplyScalar(0.5);
    quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
    scale.set(beam.radius * 2, length, beam.radius * 2);
    matrix.compose(midpoint, quaternion, scale);
    instances.setMatrixAt(index, matrix);
  });

  instances.instanceMatrix.needsUpdate = true;
  instances.castShadow = castsShadow;
  instances.receiveShadow = true;
  instances.name = name;
  parent.add(instances);
  return instances;
}

function addCollision(
  collisions: AxisAlignedRectangle[],
  x: number,
  z: number,
  width: number,
  depth: number,
  rotationY = 0,
  padding = 0.18,
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

function createRegion(root: THREE.Group, name: string): THREE.Group {
  const region = new THREE.Group();
  region.name = `architecture-${name}`;
  region.userData.region = name;
  root.add(region);
  return region;
}

function addViceCityArchitecture(
  root: THREE.Group,
  geometry: ArchitectureGeometry,
  materials: ArchitectureMaterials,
  coarsePointer: boolean,
): void {
  const region = createRegion(root, 'vice-city');
  const facadeCount = coarsePointer ? 2 : 3;
  const pilasters: InstanceTransform[] = [];
  const windows: InstanceTransform[] = [];
  const windowFrames: InstanceTransform[] = [];
  const balconySlabs: InstanceTransform[] = [];
  const balconyRails: InstanceTransform[] = [];
  const balconyUprights: InstanceTransform[] = [];
  const storefronts: InstanceTransform[] = [];
  const awnings: InstanceTransform[] = [];
  const crowns: InstanceTransform[] = [];
  const roofUnits: InstanceTransform[] = [];
  const roofVents: InstanceTransform[] = [];

  for (let buildingIndex = 0; buildingIndex < facadeCount; buildingIndex += 1) {
    const x = 164.5;
    const z = 76 + buildingIndex * 10.5;
    const height = 7 + (buildingIndex % 3) * 1.6;
    const frontZ = z - 3.77;
    const columns = coarsePointer ? 3 : 4;
    const columnSpacing = 7.4 / Math.max(1, columns - 1);

    crowns.push({
      position: [x, height + 0.46, frontZ - 0.04],
      scale: [9.7, 1.22, 1],
    });
    for (const xOffset of [-4.05, -2.05, 0, 2.05, 4.05]) {
      pilasters.push({
        position: [x + xOffset, height / 2 + 1.15, frontZ - 0.11],
        scale: [0.22, Math.max(2.8, height - 1.7), 0.24],
      });
    }

    for (let floor = 0; floor < 2; floor += 1) {
      const windowY = 3.2 + floor * 2.25;
      for (let column = 0; column < columns; column += 1) {
        const windowX = x - 3.7 + column * columnSpacing;
        windows.push({
          position: [windowX, windowY, frontZ - 0.15],
          scale: [1.22, 1.35, 0.1],
        });
        windowFrames.push(
          {
            position: [windowX, windowY + 0.76, frontZ - 0.22],
            scale: [1.5, 0.09, 0.1],
          },
          {
            position: [windowX, windowY - 0.76, frontZ - 0.22],
            scale: [1.5, 0.09, 0.1],
          },
          {
            position: [windowX - 0.74, windowY, frontZ - 0.22],
            scale: [0.09, 1.55, 0.1],
          },
          {
            position: [windowX + 0.74, windowY, frontZ - 0.22],
            scale: [0.09, 1.55, 0.1],
          },
        );
      }

      const balconyY = windowY - 0.9;
      balconySlabs.push({
        position: [x, balconyY, frontZ - 0.62],
        scale: [9.25, 0.16, 1.12],
      });
      balconyRails.push({
        position: [x, balconyY + 0.72, frontZ - 1.13],
        scale: [9.08, 0.08, 0.08],
      });
      for (let rail = -4; rail <= 4; rail += coarsePointer ? 2 : 1) {
        balconyUprights.push({
          position: [x + rail, balconyY + 0.38, frontZ - 1.13],
          scale: [0.055, 0.68, 0.055],
        });
      }
    }

    for (const xOffset of [-3.05, 0, 3.05]) {
      storefronts.push({
        position: [x + xOffset, 1.28, frontZ - 0.18],
        scale: [2.45, 2.15, 0.1],
      });
      awnings.push({
        position: [x + xOffset, 2.48, frontZ - 0.76],
        scale: [0.62, 1.25, 1.05],
        rotation: [0, 0, Math.PI / 2],
      });
    }

    roofUnits.push({
      position: [x - 2.15, height + 0.75, z + 0.35],
      scale: [2.35, 1.1, 1.65],
    });
    roofVents.push({
      position: [x + 2.05, height + 0.82, z - 0.3],
      scale: [0.78, 1.4, 0.78],
    });
  }

  addInstances(region, geometry.box, materials.paleTrim, pilasters, 'vice-deco-pilasters', true);
  addInstances(region, geometry.box, materials.glass, windows, 'vice-deco-windows');
  if (!coarsePointer) {
    addInstances(region, geometry.box, materials.chrome, windowFrames, 'vice-window-frames');
  }
  addInstances(region, geometry.box, materials.paleTrim, balconySlabs, 'vice-balcony-slabs', true);
  addInstances(region, geometry.box, materials.chrome, balconyRails, 'vice-balcony-rails');
  if (!coarsePointer) {
    addInstances(region, geometry.box, materials.chrome, balconyUprights, 'vice-balcony-uprights');
  }
  addInstances(region, geometry.box, materials.warmGlass, storefronts, 'vice-storefront-glass');
  addInstances(region, geometry.awning, materials.coralStucco, awnings, 'vice-storefront-awnings');
  addInstances(region, geometry.decoCrown, materials.paleTrim, crowns, 'vice-stepped-crowns');
  addInstances(region, geometry.box, materials.paintedSteel, roofUnits, 'vice-rooftop-units', true);
  if (!coarsePointer) {
    addInstances(region, geometry.cylinder, materials.galvanized, roofVents, 'vice-rooftop-vents');
  }

  const towerLobbyGlass: InstanceTransform[] = [];
  const towerMullions: InstanceTransform[] = [];
  const towerBalconyRails: InstanceTransform[] = [];
  const towerRoofUnits: InstanceTransform[] = [];
  for (const [towerIndex, towerZ, towerHeight] of [
    [0, 18, 46],
    [1, 37, 53],
  ] as const) {
    for (const xOffset of [-2.7, 0, 2.7]) {
      towerLobbyGlass.push({
        position: [169 + xOffset, 2.05, towerZ + 5.48],
        scale: [2.25, 2.8, 0.12],
      });
      towerMullions.push({
        position: [169 + xOffset + 1.18, 2.05, towerZ + 5.57],
        scale: [0.07, 2.95, 0.08],
      });
    }
    const railLevels = coarsePointer ? [10, 22, 34] : [8, 14, 20, 26, 32, 38];
    for (const level of railLevels.filter((value) => value < towerHeight - 2)) {
      towerBalconyRails.push(
        {
          position: [169, level + 0.38, towerZ + 6.09],
          scale: [9.7, 0.09, 0.09],
        },
        {
          position: [164.1, level + 0.38, towerZ],
          scale: [0.09, 0.09, 11.7],
        },
        {
          position: [173.9, level + 0.38, towerZ],
          scale: [0.09, 0.09, 11.7],
        },
      );
    }
    towerRoofUnits.push(
      {
        position: [166.8, towerHeight + 2.55, towerZ],
        scale: [2.8, 1.45, 2.2],
      },
      {
        position: [171.1, towerHeight + 2.5, towerZ + (towerIndex ? 0.8 : -0.8)],
        scale: [2.15, 1.25, 1.75],
      },
    );
  }
  addInstances(region, geometry.box, materials.glass, towerLobbyGlass, 'vice-tower-lobbies');
  if (!coarsePointer) {
    addInstances(region, geometry.box, materials.chrome, towerMullions, 'vice-tower-mullions');
  }
  addInstances(
    region,
    geometry.box,
    materials.chrome,
    towerBalconyRails,
    'vice-tower-balcony-rails',
  );
  addInstances(
    region,
    geometry.box,
    materials.paintedSteel,
    towerRoofUnits,
    'vice-tower-rooftop-plant',
    true,
  );

  const canopyLights: InstanceTransform[] = [];
  for (let index = 0; index < facadeCount * 3; index += 1) {
    const buildingIndex = Math.floor(index / 3);
    const column = index % 3;
    canopyLights.push({
      position: [161.45 + column * 3.05, 2.35, 71.82 + buildingIndex * 10.5],
      scale: [0.16, 0.16, 0.16],
    });
  }
  if (!coarsePointer) {
    addInstances(region, geometry.sphere, materials.pinkLight, canopyLights, 'vice-canopy-lights');
  }
}

function addPortGellhornArchitecture(
  root: THREE.Group,
  geometry: ArchitectureGeometry,
  materials: ArchitectureMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): void {
  const region = createRegion(root, 'port-gellhorn');
  const motelX = -137;
  const motelZ = -47;
  const frontZ = motelZ + 4.08;
  const roomCount = coarsePointer ? 6 : 9;
  const roomSpacing = 22 / Math.max(1, roomCount - 1);
  const doors: InstanceTransform[] = [];
  const transoms: InstanceTransform[] = [];
  const walkway: InstanceTransform[] = [
    { position: [motelX, 0.42, frontZ + 0.65], scale: [28, 0.24, 2.05] },
    { position: [motelX, 4.62, frontZ + 0.65], scale: [28, 0.18, 2.05] },
  ];
  const rails: InstanceTransform[] = [];
  const railPosts: InstanceTransform[] = [];
  const airConditioners: InstanceTransform[] = [];
  const ventSlats: InstanceTransform[] = [];
  const roomLights: InstanceTransform[] = [];

  for (let index = 0; index < roomCount; index += 1) {
    const roomX = motelX - 11 + index * roomSpacing;
    doors.push({ position: [roomX, 1.78, frontZ + 0.1], scale: [1.05, 2.55, 0.12] });
    transoms.push({ position: [roomX, 3.15, frontZ + 0.12], scale: [1.05, 0.24, 0.1] });
    airConditioners.push({
      position: [roomX + 1.22, 1.25, frontZ + 0.24],
      scale: [0.76, 0.58, 0.42],
    });
    const slatCount = coarsePointer ? 2 : 4;
    for (let slat = 0; slat < slatCount; slat += 1) {
      ventSlats.push({
        position: [roomX + 1.22, 1.06 + slat * (0.36 / Math.max(1, slatCount - 1)), frontZ + 0.47],
        scale: [0.58, 0.035, 0.03],
      });
    }
    roomLights.push({
      position: [roomX - 0.78, 3.25, frontZ + 0.26],
      scale: [0.17, 0.17, 0.17],
    });
  }

  rails.push(
    { position: [motelX, 5.35, frontZ + 1.58], scale: [27.4, 0.09, 0.09] },
    { position: [motelX, 4.85, frontZ + 1.58], scale: [27.4, 0.07, 0.07] },
  );
  for (let index = 0; index <= (coarsePointer ? 7 : 14); index += 1) {
    const x = motelX - 13.6 + (index * 27.2) / (coarsePointer ? 7 : 14);
    railPosts.push({ position: [x, 5.08, frontZ + 1.58], scale: [0.06, 0.98, 0.06] });
  }

  addInstances(region, geometry.box, materials.concrete, walkway, 'port-motel-walkways', true);
  addInstances(region, geometry.box, materials.darkTrim, doors, 'port-motel-doors');
  addInstances(region, geometry.box, materials.warmGlass, transoms, 'port-motel-transoms');
  addInstances(region, geometry.box, materials.galvanized, airConditioners, 'port-motel-ac-units');
  if (!coarsePointer) {
    addInstances(region, geometry.box, materials.darkTrim, ventSlats, 'port-motel-ac-grilles');
  }
  addInstances(region, geometry.box, materials.chrome, rails, 'port-motel-rails');
  addInstances(region, geometry.box, materials.chrome, railPosts, 'port-motel-rail-posts');
  addInstances(region, geometry.sphere, materials.amberLight, roomLights, 'port-motel-room-lights');

  const facadeWeathering: InstanceTransform[] = [];
  const weatheringCount = coarsePointer ? 5 : 12;
  for (let index = 0; index < weatheringCount; index += 1) {
    facadeWeathering.push({
      position: [
        motelX - 12.4 + (index * 24.8) / Math.max(1, weatheringCount - 1),
        1.15 + (index % 3) * 1.42,
        frontZ + 0.075,
      ],
      scale: [0.9 + (index % 4) * 0.34, 0.08, 0.035],
      rotation: [0, 0, ((index % 5) - 2) * 0.035],
    });
  }
  addInstances(
    region,
    geometry.box,
    materials.weatheredConcrete,
    facadeWeathering,
    'port-motel-facade-weathering',
  );

  const rooftopHvac: InstanceTransform[] = [
    { position: [motelX - 8.2, 8.38, motelZ], scale: [2.15, 1.05, 1.55] },
    { position: [motelX, 8.3, motelZ + 0.35], scale: [1.8, 0.92, 1.35] },
    { position: [motelX + 8.4, 8.4, motelZ - 0.28], scale: [2.3, 1.12, 1.65] },
  ];
  addInstances(
    region,
    geometry.box,
    materials.galvanized,
    coarsePointer ? rooftopHvac.slice(0, 2) : rooftopHvac,
    'port-motel-rooftop-hvac',
    true,
  );

  const stairBeams: BeamTransform[] = [];
  for (const side of [-1, 1]) {
    const x = motelX + side * 13.4;
    stairBeams.push(
      { start: [x, 0.45, frontZ + 2.15], end: [x, 4.65, frontZ + 1.4], radius: 0.07 },
      {
        start: [x + side * 0.9, 0.45, frontZ + 2.15],
        end: [x + side * 0.9, 4.65, frontZ + 1.4],
        radius: 0.07,
      },
    );
  }
  if (!coarsePointer) {
    addBeamInstances(
      region,
      geometry.slimCylinder,
      materials.chrome,
      stairBeams,
      'port-motel-stair-rails',
    );
  }

  const signX = -120.8;
  const signZ = -41.7;
  addMesh(
    region,
    geometry.box,
    materials.weatheredConcrete,
    [signX, 3.3, signZ],
    [0.34, 6.6, 0.34],
    [0, 0, 0],
    'port-weathered-sign-post',
  );
  addMesh(
    region,
    geometry.decoCrown,
    materials.fadedAqua,
    [signX, 7.05, signZ],
    [4.1, 2.4, 1.5],
    [0, 0.06, 0],
    'port-weathered-sign',
  );
  const signFaceMaterial = createRoadsideSignMaterial('GELLHORN');
  for (const side of [-1, 1]) {
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(3.55, 1.18), signFaceMaterial);
    signFace.position.set(signX, 7.02, signZ + side * 0.2);
    signFace.rotation.y = side < 0 ? Math.PI : 0;
    signFace.name = 'port-gellhorn-sign-face';
    region.add(signFace);
  }
  const signBulbs: InstanceTransform[] = [];
  for (let index = 0; index < (coarsePointer ? 5 : 9); index += 1) {
    signBulbs.push({
      position: [signX - 1.72 + index * (3.44 / (coarsePointer ? 4 : 8)), 7.25, signZ - 0.19],
      scale: [0.12, 0.12, 0.12],
    });
  }
  if (!coarsePointer) {
    addInstances(region, geometry.sphere, materials.cyanLight, signBulbs, 'port-sign-bulbs');
  }
  addCollision(collisions, signX, signZ, 0.6, 0.6, 0, 0.08);

  const clubPanels: InstanceTransform[] = [
    { position: [-94, 3.6, -23.1], scale: [10.8, 4.9, 0.12] },
    { position: [-94, 6.12, -23.22], scale: [12.6, 0.22, 0.18] },
    { position: [-94, 1.48, -23.28], scale: [4.1, 2.7, 0.12] },
  ];
  addInstances(region, geometry.box, materials.darkTrim, clubPanels, 'port-club-layered-entry');
  const clubLights: InstanceTransform[] = [];
  for (let index = 0; index < (coarsePointer ? 7 : 13); index += 1) {
    clubLights.push({
      position: [-99.4 + index * (10.8 / (coarsePointer ? 6 : 12)), 6.13, -23.48],
      scale: [0.11, 0.11, 0.11],
    });
  }
  if (!coarsePointer) {
    addInstances(
      region,
      geometry.sphere,
      materials.pinkLight,
      clubLights,
      'port-club-marquee-lights',
    );
  }
}

function addAmbrosiaArchitecture(
  root: THREE.Group,
  geometry: ArchitectureGeometry,
  materials: ArchitectureMaterials,
  collisions: AxisAlignedRectangle[],
  coarsePointer: boolean,
): void {
  const region = createRegion(root, 'ambrosia');
  const pipeBeams: BeamTransform[] = [];
  const pipeSupports: BeamTransform[] = [];
  const gantryBeams: BeamTransform[] = [];
  const railBeams: BeamTransform[] = [];
  const siloLadders: InstanceTransform[] = [];
  const ladderRungs: InstanceTransform[] = [];

  const pipeRuns = coarsePointer
    ? [
        { startX: 70, endX: 82, y: 8.8, z: -87.5 },
        { startX: 82, endX: 99, y: 10.8, z: -94.2 },
      ]
    : [
        { startX: 63, endX: 82, y: 8.8, z: -87.5 },
        { startX: 70, endX: 82, y: 11.4, z: -94.4 },
        { startX: 82, endX: 105, y: 10.8, z: -94.2 },
        { startX: 82, endX: 98, y: 6.8, z: -86.9 },
      ];
  for (const [index, run] of pipeRuns.entries()) {
    const radius = index % 2 === 0 ? 0.28 : 0.19;
    pipeBeams.push({
      start: [run.startX, run.y, run.z],
      end: [run.endX, run.y, run.z],
      radius,
    });
    for (const x of [run.startX + 2, (run.startX + run.endX) / 2, run.endX - 2]) {
      pipeSupports.push({
        start: [x, 0.4, run.z],
        end: [x, run.y - 0.3, run.z],
        radius: 0.08,
      });
    }
  }

  const gantryStartX = 72;
  const gantryEndX = 108;
  const gantryZ = -98;
  gantryBeams.push(
    { start: [gantryStartX, 9.2, gantryZ], end: [gantryEndX, 9.2, gantryZ], radius: 0.13 },
    { start: [gantryStartX, 12.2, gantryZ], end: [gantryEndX, 12.2, gantryZ], radius: 0.13 },
  );
  const bayCount = coarsePointer ? 4 : 6;
  for (let bay = 0; bay <= bayCount; bay += 1) {
    const x = gantryStartX + (bay / bayCount) * (gantryEndX - gantryStartX);
    gantryBeams.push({ start: [x, 0.4, gantryZ], end: [x, 12.2, gantryZ], radius: 0.11 });
    if (bay < bayCount) {
      const nextX = gantryStartX + ((bay + 1) / bayCount) * (gantryEndX - gantryStartX);
      gantryBeams.push({
        start: [x, 9.2, gantryZ],
        end: [nextX, 12.2, gantryZ],
        radius: 0.09,
      });
      gantryBeams.push({
        start: [x, 12.2, gantryZ],
        end: [nextX, 9.2, gantryZ],
        radius: 0.09,
      });
    }
  }

  addBeamInstances(
    region,
    geometry.cylinder,
    materials.galvanized,
    pipeBeams,
    'ambrosia-process-pipes',
    true,
  );
  addBeamInstances(
    region,
    geometry.slimCylinder,
    materials.rust,
    pipeSupports,
    'ambrosia-pipe-supports',
  );
  addBeamInstances(
    region,
    geometry.slimCylinder,
    materials.paintedSteel,
    gantryBeams,
    'ambrosia-pipe-gantry',
    true,
  );

  addMesh(
    region,
    geometry.box,
    materials.galvanized,
    [90, 9.35, gantryZ],
    [35.4, 0.18, 1.25],
    [0, 0, 0],
    'ambrosia-catwalk',
    false,
  );
  railBeams.push(
    { start: [72.3, 10.4, -97.35], end: [107.7, 10.4, -97.35], radius: 0.055 },
    { start: [72.3, 10.4, -98.65], end: [107.7, 10.4, -98.65], radius: 0.055 },
  );
  for (let x = 73; x <= 107; x += coarsePointer ? 6.8 : 4.25) {
    railBeams.push(
      { start: [x, 9.45, -97.35], end: [x, 10.4, -97.35], radius: 0.045 },
      { start: [x, 9.45, -98.65], end: [x, 10.4, -98.65], radius: 0.045 },
    );
  }
  addBeamInstances(
    region,
    geometry.slimCylinder,
    materials.industrialYellow,
    railBeams,
    'ambrosia-catwalk-rails',
  );

  const siloXs = coarsePointer ? [70, 98] : [63, 70, 98, 105];
  for (const x of siloXs) {
    siloLadders.push(
      { position: [x + 3.24, 7.2, -91], scale: [0.08, 12.4, 0.08] },
      { position: [x + 3.24, 7.2, -90.48], scale: [0.08, 12.4, 0.08] },
    );
    for (let y = 1.4; y <= 13; y += coarsePointer ? 1.8 : 1.2) {
      ladderRungs.push({ position: [x + 3.24, y, -90.74], scale: [0.08, 0.08, 0.62] });
    }
  }
  addInstances(region, geometry.box, materials.chrome, siloLadders, 'ambrosia-silo-ladder-rails');
  if (!coarsePointer) {
    addInstances(region, geometry.box, materials.chrome, ladderRungs, 'ambrosia-silo-ladder-rungs');
  }

  const controlX = 112;
  const controlZ = -104;
  addMesh(
    region,
    geometry.box,
    materials.weatheredConcrete,
    [controlX, 2.8, controlZ],
    [8.2, 5.2, 6.1],
    [0, -0.05, 0],
    'ambrosia-control-house',
  );
  const controlWindows: InstanceTransform[] = [];
  for (const xOffset of [-2.5, 0, 2.5]) {
    controlWindows.push({
      position: [controlX + xOffset, 3.15, controlZ + 3.07],
      scale: [1.55, 1.2, 0.1],
      rotation: [0, -0.05, 0],
    });
  }
  addInstances(
    region,
    geometry.box,
    materials.warmGlass,
    controlWindows,
    'ambrosia-control-windows',
  );
  addMesh(
    region,
    geometry.box,
    materials.industrialYellow,
    [controlX, 5.53, controlZ],
    [8.8, 0.24, 6.6],
    [0, -0.05, 0],
    'ambrosia-control-roof-edge',
  );
  addCollision(collisions, controlX, controlZ, 8.2, 6.1, -0.05);
}

function addKeysArchitecture(
  root: THREE.Group,
  geometry: ArchitectureGeometry,
  materials: ArchitectureMaterials,
  coarsePointer: boolean,
): void {
  const region = createRegion(root, 'leonida-keys');
  const docks = coarsePointer
    ? ([{ x: 57, z: 193, rotation: -0.35 }] as const)
    : ([
        { x: 57, z: 193, rotation: -0.35 },
        { x: 18, z: 181, rotation: 0.22 },
      ] as const);
  const planks: InstanceTransform[] = [];
  const posts: InstanceTransform[] = [];
  const railBeams: BeamTransform[] = [];
  const mooringCaps: InstanceTransform[] = [];

  for (const dock of docks) {
    const cosine = Math.cos(dock.rotation);
    const sine = Math.sin(dock.rotation);
    const localToWorld = (along: number, across: number): readonly [number, number] => [
      dock.x + along * cosine + across * sine,
      dock.z - along * sine + across * cosine,
    ];
    const plankCount = coarsePointer ? 12 : 20;
    for (let index = 0; index < plankCount; index += 1) {
      const along = -4.75 + index * (9.5 / Math.max(1, plankCount - 1));
      const [x, z] = localToWorld(along, 0);
      planks.push({
        position: [x, 0.64 + (index % 3) * 0.006, z],
        scale: [0.38, 0.12, 1.45],
        rotation: [0, dock.rotation, 0],
      });
    }

    for (const along of [-4.4, -1.5, 1.5, 4.4]) {
      for (const across of [-0.72, 0.72]) {
        const [x, z] = localToWorld(along, across);
        posts.push({
          position: [x, 1.3, z],
          scale: [0.14, 2.35, 0.14],
          rotation: [0, dock.rotation, 0],
        });
        mooringCaps.push({ position: [x, 2.52, z], scale: [0.34, 0.22, 0.34] });
      }
    }

    for (const across of [-0.72, 0.72]) {
      const [startX, startZ] = localToWorld(-4.4, across);
      const [endX, endZ] = localToWorld(4.4, across);
      railBeams.push({
        start: [startX, 1.95, startZ],
        end: [endX, 1.95, endZ],
        radius: 0.045,
      });
    }
  }
  addInstances(region, geometry.box, materials.timber, planks, 'keys-dock-planks');
  addInstances(region, geometry.cylinder, materials.darkTimber, posts, 'keys-dock-posts', true);
  if (!coarsePointer) {
    addInstances(region, geometry.sphere, materials.chrome, mooringCaps, 'keys-mooring-caps');
  }
  addBeamInstances(region, geometry.slimCylinder, materials.rope, railBeams, 'keys-dock-ropes');

  const boatDetails = coarsePointer
    ? ([{ x: 65, z: 198, rotation: -0.4 }] as const)
    : ([
        { x: 65, z: 198, rotation: -0.4 },
        { x: 23, z: 186, rotation: 0.2 },
      ] as const);
  const consoles: InstanceTransform[] = [];
  const windshields: InstanceTransform[] = [];
  const seatBases: InstanceTransform[] = [];
  const bowRails: BeamTransform[] = [];
  for (const boat of boatDetails) {
    consoles.push({
      position: [boat.x, 1.55, boat.z],
      scale: [1.2, 0.9, 1.18],
      rotation: [0, boat.rotation, 0],
    });
    windshields.push({
      position: [
        boat.x + Math.sin(boat.rotation) * 0.75,
        2.05,
        boat.z + Math.cos(boat.rotation) * 0.75,
      ],
      scale: [1.12, 0.58, 0.08],
      rotation: [-0.18, boat.rotation, 0],
    });
    seatBases.push({
      position: [
        boat.x - Math.sin(boat.rotation) * 0.65,
        1.34,
        boat.z - Math.cos(boat.rotation) * 0.65,
      ],
      scale: [1.18, 0.42, 0.88],
      rotation: [0, boat.rotation, 0],
    });
    const bowX = boat.x + Math.sin(boat.rotation) * 2.15;
    const bowZ = boat.z + Math.cos(boat.rotation) * 2.15;
    for (const side of [-1, 1]) {
      const sideX = Math.cos(boat.rotation) * side * 0.7;
      const sideZ = -Math.sin(boat.rotation) * side * 0.7;
      bowRails.push({
        start: [boat.x + sideX, 1.35, boat.z + sideZ],
        end: [bowX + sideX * 0.35, 1.5, bowZ + sideZ * 0.35],
        radius: 0.035,
      });
    }
  }
  addInstances(region, geometry.box, materials.boatHull, consoles, 'keys-boat-consoles');
  addInstances(region, geometry.box, materials.glass, windshields, 'keys-boat-windshields');
  addInstances(region, geometry.box, materials.fadedAqua, seatBases, 'keys-boat-seats');
  if (!coarsePointer) {
    addBeamInstances(region, geometry.slimCylinder, materials.chrome, bowRails, 'keys-boat-rails');
  }

  const marinaBeams: BeamTransform[] = [];
  const marinaX = 72.5;
  const marinaZ = 199;
  for (const xOffset of [-4.2, 4.2]) {
    for (const zOffset of [-2.4, 2.4]) {
      marinaBeams.push({
        start: [marinaX + xOffset, 0.45, marinaZ + zOffset],
        end: [marinaX + xOffset, 4.5, marinaZ + zOffset],
        radius: 0.09,
      });
    }
  }
  addBeamInstances(
    region,
    geometry.slimCylinder,
    materials.paintedSteel,
    marinaBeams,
    'keys-marina-canopy-posts',
    true,
  );
  addMesh(
    region,
    geometry.box,
    materials.fadedAqua,
    [marinaX, 4.62, marinaZ],
    [9.2, 0.22, 5.5],
    [0, -0.06, 0],
    'keys-marina-canopy',
  );
  const roofSeams: InstanceTransform[] = [];
  const seamCount = coarsePointer ? 4 : 8;
  for (let index = 0; index < seamCount; index += 1) {
    roofSeams.push({
      position: [marinaX - 4.05 + (index * 8.1) / Math.max(1, seamCount - 1), 4.75, marinaZ],
      scale: [0.06, 0.07, 5.05],
      rotation: [0, -0.06, 0],
    });
  }
  addInstances(region, geometry.box, materials.galvanized, roofSeams, 'keys-marina-roof-seams');
}

function addGrassriversArchitecture(
  root: THREE.Group,
  geometry: ArchitectureGeometry,
  materials: ArchitectureMaterials,
  coarsePointer: boolean,
): void {
  const region = createRegion(root, 'grassrivers');
  const boardwalkPlanks: InstanceTransform[] = [];
  const boardwalkPosts: InstanceTransform[] = [];
  const boardwalkRails: BeamTransform[] = [];
  const startX = 45;
  const endX = 66.5;
  const boardwalkZ = 142.1;
  const plankCount = coarsePointer ? 18 : 32;
  for (let index = 0; index < plankCount; index += 1) {
    const x = startX + (index / Math.max(1, plankCount - 1)) * (endX - startX);
    boardwalkPlanks.push({
      position: [x, 1.2 + (index % 4) * 0.008, boardwalkZ],
      scale: [0.58, 0.14, 2.35],
      rotation: [0, 0.03 * Math.sin(index), 0],
    });
  }
  for (let x = startX; x <= endX; x += coarsePointer ? 5.4 : 3.6) {
    for (const side of [-1, 1]) {
      boardwalkPosts.push({
        position: [x, 1.45, boardwalkZ + side * 1.12],
        scale: [0.13, 2.65, 0.13],
      });
    }
  }
  boardwalkRails.push(
    { start: [startX, 2.1, boardwalkZ - 1.12], end: [endX, 2.1, boardwalkZ - 1.12], radius: 0.05 },
    { start: [startX, 2.1, boardwalkZ + 1.12], end: [endX, 2.1, boardwalkZ + 1.12], radius: 0.05 },
  );
  addInstances(
    region,
    geometry.box,
    materials.timber,
    boardwalkPlanks,
    'grassrivers-boardwalk-planks',
  );
  addInstances(
    region,
    geometry.cylinder,
    materials.darkTimber,
    boardwalkPosts,
    'grassrivers-boardwalk-posts',
    true,
  );
  addBeamInstances(
    region,
    geometry.slimCylinder,
    materials.rope,
    boardwalkRails,
    'grassrivers-boardwalk-rails',
  );

  const campDetails: InstanceTransform[] = [
    { position: [68, 5.1, 138.86], scale: [1.15, 2.1, 0.1] },
    { position: [65.9, 5.2, 138.84], scale: [1.55, 1.25, 0.1] },
    { position: [70.1, 5.2, 138.84], scale: [1.55, 1.25, 0.1] },
  ];
  addInstances(region, geometry.box, materials.darkTrim, campDetails, 'grassrivers-camp-openings');
  const roofFlashing: InstanceTransform[] = [
    { position: [68, 7.05, 138.72], scale: [7.2, 0.12, 0.14] },
    { position: [64.6, 6.55, 138.73], scale: [0.12, 1.1, 0.14] },
    { position: [71.4, 6.55, 138.73], scale: [0.12, 1.1, 0.14] },
  ];
  addInstances(
    region,
    geometry.box,
    materials.galvanized,
    coarsePointer ? roofFlashing.slice(0, 2) : roofFlashing,
    'grassrivers-camp-roof-flashing',
  );
  const shutters: InstanceTransform[] = [
    { position: [64.98, 5.2, 138.71], scale: [0.34, 1.52, 0.1], rotation: [0, 0.22, 0] },
    { position: [71.02, 5.2, 138.71], scale: [0.34, 1.52, 0.1], rotation: [0, -0.22, 0] },
  ];
  if (!coarsePointer) {
    addInstances(region, geometry.box, materials.fadedAqua, shutters, 'grassrivers-camp-shutters');
  }
}

function addKalagaArchitecture(
  root: THREE.Group,
  geometry: ArchitectureGeometry,
  materials: ArchitectureMaterials,
  coarsePointer: boolean,
): void {
  const region = createRegion(root, 'mount-kalaga');
  const bridgeX = 41;
  const startZ = -153;
  const endZ = -127;
  const bridgeBeams: BeamTransform[] = [];
  const bridgeRivets: InstanceTransform[] = [];
  const expansionPlates: InstanceTransform[] = [];
  const sideOffset = 3.18;
  const bayCount = coarsePointer ? 4 : 8;

  for (const side of [-1, 1]) {
    const x = bridgeX + side * sideOffset;
    bridgeBeams.push(
      { start: [x, 1.42, startZ], end: [x, 1.42, endZ], radius: 0.1 },
      { start: [x, 7.18, startZ], end: [x, 7.18, endZ], radius: 0.1 },
      { start: [x, 3.15, startZ], end: [x, 3.15, endZ], radius: 0.065 },
    );
    for (let bay = 0; bay <= bayCount; bay += 1) {
      const z = startZ + (bay / bayCount) * (endZ - startZ);
      bridgeBeams.push({ start: [x, 1.42, z], end: [x, 7.18, z], radius: 0.085 });
      bridgeRivets.push(
        { position: [x - side * 0.13, 1.55, z], scale: [0.18, 0.18, 0.18] },
        { position: [x - side * 0.13, 7.04, z], scale: [0.18, 0.18, 0.18] },
      );
      if (bay < bayCount) {
        const nextZ = startZ + ((bay + 1) / bayCount) * (endZ - startZ);
        bridgeBeams.push(
          { start: [x, 1.55, z], end: [x, 7.05, nextZ], radius: 0.075 },
          { start: [x, 7.05, z], end: [x, 1.55, nextZ], radius: 0.075 },
        );
      }
    }
  }
  for (let z = startZ + 2.2; z < endZ; z += coarsePointer ? 6.5 : 3.25) {
    expansionPlates.push({ position: [bridgeX, 1.51, z], scale: [6.15, 0.08, 0.16] });
  }
  addBeamInstances(
    region,
    geometry.slimCylinder,
    materials.bridgeSteel,
    bridgeBeams,
    'kalaga-bridge-steelwork',
    true,
  );
  if (!coarsePointer) {
    addInstances(
      region,
      geometry.sphere,
      materials.galvanized,
      bridgeRivets,
      'kalaga-bridge-rivets',
    );
    addInstances(
      region,
      geometry.box,
      materials.galvanized,
      expansionPlates,
      'kalaga-bridge-expansion-joints',
    );
  }

  const bridgePiers: InstanceTransform[] = [
    { position: [37.7, -0.1, -149], scale: [1.4, 5.2, 2.8] },
    { position: [44.3, -0.1, -149], scale: [1.4, 5.2, 2.8] },
    { position: [37.7, -0.1, -131], scale: [1.4, 5.2, 2.8] },
    { position: [44.3, -0.1, -131], scale: [1.4, 5.2, 2.8] },
  ];
  addInstances(region, geometry.box, materials.concrete, bridgePiers, 'kalaga-bridge-piers', true);

  const rockCount = coarsePointer ? 18 : 42;
  const sandstoneRocks: InstanceTransform[] = [];
  const darkRocks: InstanceTransform[] = [];
  let randomState = 88403;
  const random = (): number => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  for (let index = 0; index < rockCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 24 + random() * 30;
    const x = -16 + Math.cos(angle) * radius;
    const z = -177 + Math.sin(angle) * radius * 0.58;
    if (Math.abs(x - bridgeX) < 6 && z > startZ - 5 && z < endZ + 5) continue;
    const width = 2.3 + random() * 5.2;
    const height = 1.8 + random() * 5.4;
    const transform: InstanceTransform = {
      position: [x, height * 0.36, z],
      scale: [width, height, width * (0.55 + random() * 0.45)],
      rotation: [(random() - 0.5) * 0.22, random() * Math.PI, (random() - 0.5) * 0.18],
    };
    (index % 3 === 0 ? darkRocks : sandstoneRocks).push(transform);
  }
  addInstances(
    region,
    geometry.rock,
    materials.sandstone,
    sandstoneRocks,
    'kalaga-sandstone-outcrops',
    true,
  );
  addInstances(region, geometry.rock, materials.darkRock, darkRocks, 'kalaga-dark-outcrops', true);

  const guardRails: BeamTransform[] = [
    { start: [37.95, 2.35, startZ], end: [37.95, 2.35, endZ], radius: 0.045 },
    { start: [44.05, 2.35, startZ], end: [44.05, 2.35, endZ], radius: 0.045 },
  ];
  addBeamInstances(
    region,
    geometry.slimCylinder,
    materials.galvanized,
    guardRails,
    'kalaga-road-guardrails',
  );
}

/**
 * Adds a deterministic, higher-detail streetscape layer to the six official
 * Leonida region interpretations. The kit uses only procedural geometry and
 * tiny generated surface maps; no external imagery or copyrighted game assets.
 */
export function addHighFidelityWalkArchitecture(
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
  root.name = 'high-fidelity-walk-architecture';
  root.userData.procedural = true;
  root.userData.qualityTier = coarsePointer ? 'mobile' : 'desktop';

  const geometry = createGeometry();
  const materials = createMaterials();
  const alignToGrid = options.alignToGrid ?? true;
  const includes = (region: WalkRenderRegion): boolean =>
    options.regions === undefined || options.regions.includes(region);
  const translateRegion = (
    name: string,
    collisionStart: number,
    translation: { x: number; z: number },
  ): void => {
    if (!alignToGrid) return;
    const region = root.getObjectByName(`architecture-${name}`);
    region?.position.set(translation.x, 0, translation.z);
    for (let index = collisionStart; index < collisions.length; index += 1) {
      const collision = collisions[index];
      if (!collision) continue;
      collision.minX += translation.x;
      collision.maxX += translation.x;
      collision.minZ += translation.z;
      collision.maxZ += translation.z;
    }
  };

  if ((options.viceCity ?? true) && includes('vice-city'))
    addViceCityArchitecture(root, geometry, materials, coarsePointer);
  const collisionStart = collisions.length;
  if (includes('port-gellhorn')) {
    addPortGellhornArchitecture(root, geometry, materials, collisions, coarsePointer);
    translateRegion('port-gellhorn', collisionStart, LEGACY_REGION_TRANSLATIONS.portGellhorn);
  }
  if ((options.ambrosia ?? true) && includes('ambrosia'))
    addAmbrosiaArchitecture(root, geometry, materials, collisions, coarsePointer);
  if (includes('leonida-keys')) {
    addKeysArchitecture(root, geometry, materials, coarsePointer);
    translateRegion('leonida-keys', collisions.length, LEGACY_REGION_TRANSLATIONS.leonidaKeys);
  }
  if (includes('grassrivers')) {
    addGrassriversArchitecture(root, geometry, materials, coarsePointer);
    translateRegion('grassrivers', collisions.length, LEGACY_REGION_TRANSLATIONS.grassrivers);
  }
  if (includes('mount-kalaga')) {
    addKalagaArchitecture(root, geometry, materials, coarsePointer);
    translateRegion('mount-kalaga', collisions.length, LEGACY_REGION_TRANSLATIONS.mountKalaga);
  }

  scene.add(root);
  return root;
}
