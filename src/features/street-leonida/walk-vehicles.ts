import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Vec3 = readonly [number, number, number];

type VehicleLayer = 'paint' | 'detail';

interface VehiclePart {
  geometry: THREE.BufferGeometry;
  color: number;
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  layer?: VehicleLayer;
  wheel?: readonly [x: number, y: number, z: number, radius: number];
}

export type RoadVehicleType = 'sedan' | 'pickup' | 'convertible' | 'police' | 'tanker' | 'utility';
export type MotorcycleType = 'cruiser' | 'dirt-bike';

export interface RoadVehicleOptions {
  readonly material?: THREE.MeshPhysicalMaterial;
  readonly materialOwnership?: 'shared-module' | 'region-owned' | 'external';
}

export interface RoadVehicleInstance {
  readonly color: number;
  readonly position: Vec3;
  readonly rotationY?: number;
  readonly scale?: number;
}

const ROAD_VEHICLE_DESIGN_CUES = [
  'trapezoidal-cabin',
  'inclined-windshield',
  'low-hood',
  'wheel-arch-fenders',
  'detailed-wheel-and-light-set',
] as const;

const box = new THREE.BoxGeometry(1, 1, 1);
const roundedBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.1);
const softBox = new RoundedBoxGeometry(1, 1, 1, 1, 0.065);
const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const wheel = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const torus = new THREE.TorusGeometry(0.5, 0.12, 8, 16);
const upperWheelArch = new THREE.TorusGeometry(0.5, 0.065, 6, 18, Math.PI);
const sphere = new THREE.SphereGeometry(0.5, 12, 8);

function deformedBox(
  name: string,
  topWidth: number,
  topFront: number,
  topRear: number,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1).toNonIndexed();
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) < 0.49) continue;
    positions.setX(index, positions.getX(index) * topWidth);
    positions.setZ(index, positions.getZ(index) < 0 ? topFront : topRear);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.name = name;
  return geometry;
}

const CABIN_PROFILE = {
  topWidth: 0.76,
  topFront: -0.27,
  topRear: 0.34,
} as const;
const BOX_HALF_EXTENT = 0.5;
const trapezoidalCabin = deformedBox(
  'street-leonida/vehicle/trapezoidal-cabin',
  CABIN_PROFILE.topWidth,
  CABIN_PROFILE.topFront,
  CABIN_PROFILE.topRear,
);
const lowHood = deformedBox('street-leonida/vehicle/low-hood', 0.9, -0.43, 0.36);
const taperedDeck = deformedBox('street-leonida/vehicle/tapered-deck', 0.86, -0.36, 0.43);

export function createRoadVehicleMaterial(
  name = 'street-leonida/vehicle/sculpted-pbr',
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.38,
    clearcoat: 0.9,
    clearcoatRoughness: 0.14,
    sheen: 0.18,
    sheenRoughness: 0.46,
    ior: 1.46,
    reflectivity: 0.74,
    envMapIntensity: 1.16,
  });
  material.name = name;
  material.dithering = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute vec3 atlasSurface;\nattribute vec4 atlasWheel;\nattribute float atlasTravel;\nvarying vec3 vAtlasSurface;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      if (atlasWheel.w > 0.0) {
        float angle = -atlasTravel / atlasWheel.w;
        objectNormal.yz = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * objectNormal.yz;
      }`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vAtlasSurface = atlasSurface;
      if (atlasWheel.w > 0.0) {
        float angle = -atlasTravel / atlasWheel.w;
        transformed.yz = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * (transformed.yz - atlasWheel.yz) + atlasWheel.yz;
      }`,
    );
    shader.fragmentShader = `varying vec3 vAtlasSurface;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = vAtlasSurface.x;',
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = vAtlasSurface.y;',
      )
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat = vAtlasSurface.z;\n#endif',
      );
  };
  material.customProgramCacheKey = () => 'atlas-vehicle-surfaces-and-wheel-travel-v1';
  return material;
}

const vehicleMaterial = createRoadVehicleMaterial('street-leonida/vehicle/shared-moving-pbr');

function surfaceFor(part: VehiclePart): Vec3 {
  if (part.layer === 'paint') return [0.32, 0.38, 0.82];
  if ([0x173445, 0x183949].includes(part.color)) return [0.12, 0.05, 0.7];
  if ([0x111419, 0x111317, 0x17191c, 0x171b20, 0x382c31, 0x31383d].includes(part.color))
    return [0.84, 0, 0];
  if ([0x9ca7aa, 0xaeb8ba, 0x879194, 0xb4bec2, 0x626b70, 0xa9b2b3, 0x41494d].includes(part.color))
    return [0.3, 0.86, 0.08];
  if ([0xfff2c4, 0xd92c32, 0xffa31a, 0xc51f2b, 0xff9f1c, 0xffe1a3].includes(part.color))
    return [0.22, 0.05, 0.45];
  return [0.8, 0, 0];
}

function coloredPart(part: VehiclePart): THREE.BufferGeometry {
  const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(...(part.rotation ?? [0, 0, 0])),
  );
  matrix.compose(new THREE.Vector3(...part.position), quaternion, new THREE.Vector3(...part.scale));
  geometry.applyMatrix4(matrix);
  const color = new THREE.Color(part.color);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const surfaces = new Float32Array(positions.count * 3);
  const wheels = new Float32Array(positions.count * 4);
  const surface = surfaceFor(part);
  for (let index = 0; index < positions.count; index++) {
    surfaces.set(surface, index * 3);
    if (part.wheel) wheels.set(part.wheel, index * 4);
  }
  geometry.setAttribute('atlasSurface', new THREE.BufferAttribute(surfaces, 3));
  geometry.setAttribute('atlasWheel', new THREE.BufferAttribute(wheels, 4));
  return geometry;
}

function mergePartGeometry(parts: readonly VehiclePart[]): THREE.BufferGeometry {
  const geometries = parts.map(coloredPart);
  const merged = mergeGeometries(geometries, false) ?? geometries[0] ?? box.clone();
  for (const geometry of geometries) {
    if (geometry !== merged) geometry.dispose();
  }
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function mergeVehicle(
  parts: readonly VehiclePart[],
  name: string,
  material: THREE.MeshPhysicalMaterial = vehicleMaterial,
): THREE.Group {
  const geometry = mergePartGeometry(parts);
  const minY = geometry.boundingBox?.min.y ?? 0;
  if (minY < -0.001) {
    geometry.translate(0, -minY, 0);
    const pivots = geometry.getAttribute('atlasWheel');
    for (let index = 0; index < pivots.count; index++) {
      if (pivots.getW(index) > 0) pivots.setY(index, pivots.getY(index) - minY);
    }
  }
  geometry.setAttribute('atlasTravel', new THREE.InstancedBufferAttribute(new Float32Array(1), 1));
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  mesh.setMatrixAt(0, new THREE.Matrix4());
  mesh.name = `${name}-mesh`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.userData.renderProfile = 'single-mesh-detailed-vehicle';
  group.add(mesh);
  return group;
}

function roadWheelParts(
  wheelPositions: readonly number[],
  width: number,
  wheelRadius: number,
): VehiclePart[] {
  const result: VehiclePart[] = [];
  for (const x of [-width / 2, width / 2]) {
    for (const z of wheelPositions) {
      result.push(
        {
          geometry: wheel,
          color: 0x111419,
          position: [x * 1.015, wheelRadius, z],
          scale: [wheelRadius * 2, 0.32, wheelRadius * 2],
          rotation: [0, 0, Math.PI / 2],
          layer: 'detail',
          wheel: [x * 1.015, wheelRadius, z, wheelRadius],
        },
        {
          geometry: wheel,
          color: 0x9ca7aa,
          position: [x * 1.025, wheelRadius, z],
          scale: [wheelRadius * 1.06, 0.34, wheelRadius * 1.06],
          rotation: [0, 0, Math.PI / 2],
          layer: 'detail',
          wheel: [x * 1.025, wheelRadius, z, wheelRadius],
        },
        {
          geometry: cylinder,
          color: 0x31383d,
          position: [x * 1.034, wheelRadius, z],
          scale: [wheelRadius * 0.3, 0.36, wheelRadius * 0.3],
          rotation: [0, 0, Math.PI / 2],
          layer: 'detail',
          wheel: [x * 1.034, wheelRadius, z, wheelRadius],
        },
      );
      for (let spoke = 0; spoke < 5; spoke++) {
        result.push({
          geometry: box,
          color: 0xaeb8ba,
          position: [x * 1.034, wheelRadius, z],
          scale: [0.365, wheelRadius * 1.45, 0.045],
          rotation: [(spoke * Math.PI) / 5, 0, 0],
          layer: 'detail',
          wheel: [x * 1.034, wheelRadius, z, wheelRadius],
        });
      }
    }
  }
  return result;
}

function painted(
  geometry: THREE.BufferGeometry,
  color: number,
  position: Vec3,
  scale: Vec3,
  rotation?: Vec3,
): VehiclePart {
  return {
    geometry,
    color,
    position,
    scale,
    ...(rotation ? { rotation } : {}),
    layer: 'paint',
  };
}

function addWheelArchFenders(
  parts: VehiclePart[],
  color: number,
  width: number,
  wheelPositions: readonly number[],
  wheelRadius: number,
): void {
  for (const x of [-width * 0.515, width * 0.515]) {
    for (const z of wheelPositions) {
      parts.push(
        painted(
          upperWheelArch,
          color,
          [x, wheelRadius + 0.08, z],
          [wheelRadius * 2.22, wheelRadius * 2.22, 0.5],
          [0, Math.PI / 2, 0],
        ),
      );
    }
  }
}

function addCabin(
  parts: VehiclePart[],
  color: number,
  glass: number,
  width: number,
  cabinZ: number,
  cabinDepth: number,
  cabinHeight: number,
  baseY: number,
): void {
  const cabinWidth = width * 0.84;
  const frontWindowY = 0.57;
  const rearWindowY = 0.56;
  const sideWindowY = 0.56;
  const frontFaceRise = (CABIN_PROFILE.topFront + BOX_HALF_EXTENT) * cabinDepth;
  const rearFaceFall = (BOX_HALF_EXTENT - CABIN_PROFILE.topRear) * cabinDepth;
  const sideFaceInset = BOX_HALF_EXTENT * (1 - CABIN_PROFILE.topWidth) * cabinWidth;
  const frontWindowAngle = Math.atan2(frontFaceRise, cabinHeight);
  const rearWindowAngle = -Math.atan2(rearFaceFall, cabinHeight);
  const sideWindowAngle = Math.atan2(sideFaceInset, cabinHeight);
  parts.push(
    painted(
      trapezoidalCabin,
      color,
      [0, baseY + cabinHeight / 2, cabinZ],
      [cabinWidth, cabinHeight, cabinDepth],
    ),
    {
      geometry: softBox,
      color: glass,
      position: [
        0,
        baseY + cabinHeight * frontWindowY,
        cabinZ - cabinDepth * BOX_HALF_EXTENT + frontFaceRise * frontWindowY,
      ],
      scale: [cabinWidth * 0.69, cabinHeight * 0.52, 0.055],
      rotation: [frontWindowAngle, 0, 0],
      layer: 'detail',
    },
    {
      geometry: softBox,
      color: glass,
      position: [
        0,
        baseY + cabinHeight * rearWindowY,
        cabinZ + cabinDepth * BOX_HALF_EXTENT - rearFaceFall * rearWindowY,
      ],
      scale: [cabinWidth * 0.66, cabinHeight * 0.46, 0.055],
      rotation: [rearWindowAngle, 0, 0],
      layer: 'detail',
    },
  );
  for (const side of [-1, 1]) {
    parts.push({
      geometry: softBox,
      color: glass,
      position: [
        side * (cabinWidth * BOX_HALF_EXTENT - sideFaceInset * sideWindowY),
        baseY + cabinHeight * sideWindowY,
        cabinZ,
      ],
      scale: [0.055, cabinHeight * 0.46, cabinDepth * 0.54],
      rotation: [0, 0, side * sideWindowAngle],
      layer: 'detail',
    });
  }
}

function sedanCoachwork(
  width: number,
  length: number,
  wheelPositions: readonly number[],
  radius: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const sections = 32;
  const ringSize = 10;
  for (let section = 0; section <= sections; section++) {
    const t = section / sections;
    const z = (t - 0.5) * length * 1.03;
    const endTaper = 1 - 0.07 * Math.pow(Math.abs(t - 0.5) * 2, 5);
    const halfWidth = (width / 2) * endTaper;
    const crown = 0.88 + 0.115 * Math.sin(t * Math.PI);
    let sill = 0.42;
    for (const wheelZ of wheelPositions) {
      const distance = Math.abs(z - wheelZ);
      const arch = radius + 0.095;
      if (distance < arch)
        sill = Math.max(sill, radius + Math.sqrt(arch * arch - distance * distance));
    }
    sill = Math.min(crown - 0.035, sill);
    const ring: readonly [number, number][] = [
      [-halfWidth * 0.93, sill],
      [-halfWidth, sill + 0.025],
      [-halfWidth, crown - 0.085],
      [-halfWidth * 0.91, crown - 0.012],
      [-halfWidth * 0.7, crown],
      [halfWidth * 0.7, crown],
      [halfWidth * 0.91, crown - 0.012],
      [halfWidth, crown - 0.085],
      [halfWidth, sill + 0.025],
      [halfWidth * 0.93, sill],
    ];
    for (const [x, y] of ring) positions.push(x, y, z);
    if (section === 0) continue;
    const previous = (section - 1) * ringSize;
    const current = section * ringSize;
    for (let side = 0; side < ringSize; side++) {
      const next = (side + 1) % ringSize;
      indices.push(
        previous + side,
        current + side,
        previous + next,
        previous + next,
        current + side,
        current + next,
      );
    }
  }
  for (let side = 1; side < ringSize - 1; side++) {
    indices.push(0, side, side + 1);
    const end = sections * ringSize;
    indices.push(end, end + side + 1, end + side);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function roadVehicleParts(color: number, type: RoadVehicleType): VehiclePart[] {
  const glass = 0x173445;
  const chrome = 0xaeb8ba;
  const dark = 0x171b20;
  const interior = 0x382c31;
  const licensePlate = 0xdce3df;
  const indicator = 0xffa31a;
  const headlight = 0xfff2c4;
  const taillight = 0xd92c32;
  const isPickup = type === 'pickup';
  const isConvertible = type === 'convertible';
  const isPolice = type === 'police';
  const isTanker = type === 'tanker';
  const isUtility = type === 'utility';
  const isHeavy = isTanker || isUtility;
  const isLowRoadSedan = type === 'sedan' || isPolice;
  const length = isTanker ? 7.2 : isUtility ? 5.75 : isPickup ? 4.75 : 4.25;
  const width = isHeavy ? 2.16 : isPickup ? 1.94 : 1.84;
  const wheelRadius = isHeavy ? 0.49 : isLowRoadSedan ? 0.38 : 0.43;
  const wheelPositions = isTanker
    ? ([-2.55, 0.95, 2.45] as const)
    : isUtility
      ? ([-1.72, 1.72] as const)
      : ([-length * 0.31, length * 0.31] as const);
  const endParts: VehiclePart[] = isLowRoadSedan
    ? [
        painted(softBox, color, [0, 0.56, -length * 0.51], [width * 0.88, 0.16, 0.16]),
        painted(softBox, color, [0, 0.55, length * 0.51], [width * 0.88, 0.16, 0.16]),
        {
          geometry: softBox,
          color: chrome,
          position: [0, 0.57, -length * 0.53],
          scale: [width * 0.46, 0.035, 0.04],
          layer: 'detail',
        },
        {
          geometry: softBox,
          color: chrome,
          position: [0, 0.56, length * 0.53],
          scale: [width * 0.46, 0.035, 0.04],
          layer: 'detail',
        },
        {
          geometry: softBox,
          color: dark,
          position: [0, 0.71, -length * 0.532],
          scale: [width * 0.44, 0.13, 0.035],
          layer: 'detail',
        },
        {
          geometry: softBox,
          color: dark,
          position: [0, 0.48, -length * 0.533],
          scale: [width * 0.42, 0.06, 0.04],
          layer: 'detail',
        },
        {
          geometry: softBox,
          color: licensePlate,
          position: [0, 0.64, length * 0.535],
          scale: [0.36, 0.11, 0.035],
          layer: 'detail',
        },
      ]
    : [
        {
          geometry: box,
          color: chrome,
          position: [0, 0.46, -length * 0.505],
          scale: [width * 0.92, 0.16, 0.13],
        },
        {
          geometry: box,
          color: dark,
          position: [0, 0.66, -length * 0.512],
          scale: [width * 0.58, 0.27, 0.08],
        },
        {
          geometry: box,
          color: chrome,
          position: [0, 0.45, length * 0.51],
          scale: [width * 0.92, 0.14, 0.12],
        },
        {
          geometry: box,
          color: dark,
          position: [0, 0.29, -length * 0.51],
          scale: [width * 0.72, 0.08, 0.18],
        },
        {
          geometry: box,
          color: licensePlate,
          position: [0, 0.56, length * 0.518],
          scale: [0.48, 0.18, 0.045],
          layer: 'detail',
        },
      ];
  const parts: VehiclePart[] = [
    painted(
      isLowRoadSedan ? sedanCoachwork(width, length, wheelPositions, wheelRadius) : roundedBox,
      color,
      isLowRoadSedan ? [0, 0, 0] : [0, 0.7, 0],
      isLowRoadSedan ? [1, 1, 1] : [width, 0.56, length],
    ),
    ...(!isLowRoadSedan
      ? [
          painted(
            lowHood,
            color,
            [0, isLowRoadSedan ? 0.955 : 1.01, -length * (isLowRoadSedan ? 0.355 : 0.38)],
            [
              width * (isLowRoadSedan ? 0.91 : 0.93),
              isLowRoadSedan ? 0.21 : isHeavy ? 0.34 : 0.29,
              length * (isLowRoadSedan ? 0.3 : isHeavy ? 0.2 : 0.24),
            ],
            [isLowRoadSedan ? -0.025 : -0.045, 0, 0],
          ),
          painted(
            isLowRoadSedan ? taperedDeck : softBox,
            color,
            [0, isLowRoadSedan ? 0.945 : 0.98, length * (isLowRoadSedan ? 0.372 : 0.42)],
            [
              width * (isLowRoadSedan ? 0.91 : 0.95),
              isLowRoadSedan ? 0.19 : 0.2,
              length * (isLowRoadSedan ? 0.255 : 0.14),
            ],
          ),
        ]
      : []),
    ...endParts,
    ...roadWheelParts(wheelPositions, width, wheelRadius),
  ];

  addWheelArchFenders(parts, color, width, wheelPositions, wheelRadius);

  if (isPickup) {
    addCabin(parts, color, glass, width, -0.72, 1.55, 0.98, 0.88);
    parts.push(
      {
        geometry: box,
        color: dark,
        position: [0, 0.88, 1.15],
        scale: [width * 0.82, 0.1, 1.42],
      },
      {
        geometry: box,
        color,
        position: [-width * 0.46, 1.05, 1.15],
        scale: [0.12, 0.55, 1.52],
        layer: 'paint',
      },
      {
        geometry: box,
        color,
        position: [width * 0.46, 1.05, 1.15],
        scale: [0.12, 0.55, 1.52],
        layer: 'paint',
      },
      {
        geometry: box,
        color,
        position: [0, 1.03, 1.86],
        scale: [width * 0.88, 0.54, 0.12],
        layer: 'paint',
      },
      {
        geometry: box,
        color: chrome,
        position: [0, 1.32, 1.84],
        scale: [width * 0.9, 0.055, 0.08],
        layer: 'detail',
      },
    );
  } else if (isConvertible) {
    parts.push(
      {
        geometry: softBox,
        color: interior,
        position: [0, 1.16, 0.08],
        scale: [width * 0.76, 0.22, 1.62],
        layer: 'detail',
      },
      {
        geometry: softBox,
        color,
        position: [-width * 0.43, 1.14, 0.1],
        scale: [0.12, 0.34, 1.72],
        layer: 'paint',
      },
      {
        geometry: softBox,
        color,
        position: [width * 0.43, 1.14, 0.1],
        scale: [0.12, 0.34, 1.72],
        layer: 'paint',
      },
      {
        geometry: softBox,
        color: glass,
        position: [0, 1.35, -0.79],
        scale: [width * 0.72, 0.34, 0.055],
        rotation: [0.14, 0, 0],
        layer: 'detail',
      },
      {
        geometry: box,
        color: chrome,
        position: [0, 1.54, -0.77],
        scale: [width * 0.8, 0.055, 0.07],
        rotation: [0.14, 0, 0],
        layer: 'detail',
      },
      {
        geometry: softBox,
        color: interior,
        position: [-0.39, 1.26, 0.37],
        scale: [0.5, 0.48, 0.5],
        rotation: [-0.08, 0, 0],
        layer: 'detail',
      },
      {
        geometry: softBox,
        color: interior,
        position: [0.39, 1.26, 0.37],
        scale: [0.5, 0.48, 0.5],
        rotation: [-0.08, 0, 0],
        layer: 'detail',
      },
      {
        geometry: softBox,
        color: dark,
        position: [0, 1.26, 0.84],
        scale: [width * 0.74, 0.18, 0.3],
        layer: 'detail',
      },
    );
  } else if (isTanker) {
    addCabin(parts, color, glass, width, -2.25, 1.72, 1.12, 0.9);
    parts.push(
      {
        geometry: cylinder,
        color: 0xa9b2b3,
        position: [0, 1.52, 1.05],
        scale: [1.55, 3.75, 1.55],
        rotation: [Math.PI / 2, 0, 0],
        layer: 'detail',
      },
      ...[-0.3, 1.25, 2.4].map((z): VehiclePart => ({
        geometry: torus,
        color: chrome,
        position: [0, 1.52, z],
        scale: [1.63, 1.63, 0.38],
        layer: 'detail',
      })),
      {
        geometry: box,
        color: 0x59656a,
        position: [0, 0.87, 1.05],
        scale: [1.68, 0.12, 3.8],
        layer: 'detail',
      },
    );
  } else if (isUtility) {
    addCabin(parts, color, glass, width, -1.38, 1.82, 1.08, 0.9);
    parts.push(
      painted(softBox, color, [0, 1.05, 1.2], [width * 0.92, 0.52, 2.45]),
      {
        geometry: softBox,
        color: 0xd2d8d5,
        position: [-width * 0.36, 1.36, 1.08],
        scale: [0.38, 0.52, 1.72],
        layer: 'detail',
      },
      {
        geometry: softBox,
        color: 0xd2d8d5,
        position: [width * 0.36, 1.36, 1.08],
        scale: [0.38, 0.52, 1.72],
        layer: 'detail',
      },
      {
        geometry: cylinder,
        color: indicator,
        position: [0, 2.12, -1.4],
        scale: [0.18, 0.12, 0.18],
        layer: 'detail',
      },
    );
  } else {
    addCabin(parts, color, glass, width, -0.02, 2.36, 0.62, 0.88);
  }

  for (const x of [-width * 0.31, width * 0.31]) {
    parts.push(
      {
        geometry: isLowRoadSedan ? softBox : box,
        color: headlight,
        position: [x, isLowRoadSedan ? 0.77 : 0.78, -length * 0.515],
        scale: isLowRoadSedan ? [0.34, 0.1, 0.065] : [0.42, 0.19, 0.075],
        layer: 'detail',
      },
      {
        geometry: isLowRoadSedan ? softBox : box,
        color: taillight,
        position: [x, isLowRoadSedan ? 0.75 : 0.76, length * 0.515],
        scale: isLowRoadSedan ? [0.32, 0.09, 0.065] : [0.38, 0.18, 0.075],
        layer: 'detail',
      },
      {
        geometry: isLowRoadSedan ? softBox : box,
        color: indicator,
        position: [x * 1.27, isLowRoadSedan ? 0.77 : 0.79, -length * 0.516],
        scale: isLowRoadSedan ? [0.1, 0.075, 0.068] : [0.12, 0.13, 0.078],
        layer: 'detail',
      },
    );
  }
  for (const x of [-width * 0.505, width * 0.505]) {
    parts.push(
      {
        geometry: roundedBox,
        color: dark,
        position: [x, 0.78, 0.12],
        scale: [0.035, 0.045, length * 0.72],
        layer: 'detail',
      },
      {
        geometry: roundedBox,
        color: chrome,
        position: [x, 0.96, -0.18],
        scale: [0.045, 0.07, 0.34],
        layer: 'detail',
      },
    );
  }
  for (const x of [-1, 1]) {
    parts.push(
      {
        geometry: softBox,
        color,
        position: [
          x * width * (isLowRoadSedan ? 0.535 : 0.62),
          isLowRoadSedan ? 1.15 : 1.29,
          isLowRoadSedan ? -0.68 : -0.57,
        ],
        scale: isLowRoadSedan ? [0.16, 0.08, 0.22] : [0.22, 0.12, 0.28],
        rotation: [0, x * 0.12, 0],
        layer: 'paint',
      },
      {
        geometry: box,
        color: chrome,
        position: [x * width * 0.515, isLowRoadSedan ? 1.03 : 1.18, isLowRoadSedan ? 0.28 : 0.34],
        scale: [0.045, isLowRoadSedan ? 0.04 : 0.055, isLowRoadSedan ? 0.24 : 0.3],
        layer: 'detail',
      },
    );
  }
  if (isPolice) {
    parts.push(
      {
        geometry: box,
        color: 0xe8edf1,
        position: [-width * 0.508, 1.02, 0.12],
        scale: [0.045, 0.48, 0.95],
        layer: 'detail',
      },
      {
        geometry: box,
        color: 0xe8edf1,
        position: [width * 0.508, 1.02, 0.12],
        scale: [0.045, 0.48, 0.95],
        layer: 'detail',
      },
      {
        geometry: box,
        color: dark,
        position: [0, 0.69, -length * 0.54],
        scale: [width * 0.62, 0.07, 0.07],
        layer: 'detail',
      },
      {
        geometry: box,
        color: dark,
        position: [-width * 0.27, 0.69, -length * 0.54],
        scale: [0.07, 0.38, 0.07],
        layer: 'detail',
      },
      {
        geometry: box,
        color: dark,
        position: [width * 0.27, 0.69, -length * 0.54],
        scale: [0.07, 0.38, 0.07],
        layer: 'detail',
      },
      {
        geometry: box,
        color: dark,
        position: [0, 1.515, 0.05],
        scale: [1.34, 0.055, 0.25],
        layer: 'detail',
      },
      {
        geometry: box,
        color: 0xef3340,
        position: [-0.33, 1.58, 0.05],
        scale: [0.58, 0.09, 0.21],
        layer: 'detail',
      },
      {
        geometry: box,
        color: 0x2478ff,
        position: [0.33, 1.58, 0.05],
        scale: [0.58, 0.09, 0.21],
        layer: 'detail',
      },
      {
        geometry: cylinder,
        color: chrome,
        position: [width * 0.54, 1.28, -0.64],
        scale: [0.11, 0.08, 0.11],
        layer: 'detail',
      },
      {
        geometry: cylinder,
        color: dark,
        position: [0.45, 1.69, 0.37],
        scale: [0.025, 0.22, 0.025],
        layer: 'detail',
      },
    );
  }

  return parts;
}

function markRoadVehicle(
  vehicle: THREE.Group,
  type: RoadVehicleType,
  drawCalls: number,
  renderProfile: string,
  materialOwnership: string,
  vehicleCount = 1,
): void {
  vehicle.userData.renderProfile = renderProfile;
  vehicle.userData.vehicleType = type;
  vehicle.userData.vehicleCount = vehicleCount;
  vehicle.userData.detailLevel = 'high';
  vehicle.userData.surfaceProfile = 'sculpted-panelled-pbr';
  vehicle.userData.designCues = [...ROAD_VEHICLE_DESIGN_CUES];
  vehicle.userData.drawCalls = drawCalls;
  vehicle.userData.materialOwnership = materialOwnership;
}

export function createRoadVehicle(
  color: number,
  type: RoadVehicleType,
  options: RoadVehicleOptions = {},
): THREE.Group {
  const material = options.material ?? vehicleMaterial;
  const vehicle = mergeVehicle(roadVehicleParts(color, type), `road-${type}`, material);
  markRoadVehicle(
    vehicle,
    type,
    1,
    'single-mesh-detailed-vehicle',
    options.materialOwnership ?? (options.material ? 'external' : 'shared-module'),
  );
  return vehicle;
}

function populateInstances(
  mesh: THREE.InstancedMesh,
  instances: readonly RoadVehicleInstance[],
  colors: boolean,
): void {
  const dummy = new THREE.Object3D();
  mesh.geometry.setAttribute(
    'atlasTravel',
    new THREE.InstancedBufferAttribute(new Float32Array(instances.length), 1),
  );
  instances.forEach((instance, index) => {
    dummy.position.set(...instance.position);
    dummy.rotation.set(0, instance.rotationY ?? 0, 0);
    dummy.scale.setScalar(instance.scale ?? 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (colors) mesh.setColorAt(index, new THREE.Color(instance.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

/** Arc length in metres, independent per mover and shared across its wheel vertices. */
export function setRoadVehicleTravelDistance(
  vehicle: THREE.Object3D,
  distanceMetres: number,
): void {
  if (!Number.isFinite(distanceMetres)) return;
  vehicle.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh) || object.count !== 1) return;
    const attribute = object.geometry.getAttribute('atlasTravel');
    if (!(attribute instanceof THREE.InstancedBufferAttribute)) return;
    attribute.setX(0, distanceMetres / Math.max(0.001, Math.abs(vehicle.scale.x)));
    attribute.needsUpdate = true;
  });
}

export function createRoadVehicleBatch(
  instances: readonly RoadVehicleInstance[],
  type: RoadVehicleType,
  name: string,
): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  if (instances.length === 0) {
    markRoadVehicle(group, type, 0, 'instanced-detailed-vehicles', 'region-owned', 0);
    return group;
  }

  const parts = roadVehicleParts(0xffffff, type);
  const paintGeometry = mergePartGeometry(parts.filter((part) => part.layer === 'paint'));
  const detailGeometry = mergePartGeometry(parts.filter((part) => part.layer !== 'paint'));
  const paint = new THREE.InstancedMesh(
    paintGeometry,
    createRoadVehicleMaterial(`${name}/paint`),
    instances.length,
  );
  paint.name = `${name}-paint`;
  paint.castShadow = true;
  paint.receiveShadow = true;
  populateInstances(paint, instances, true);

  const details = new THREE.InstancedMesh(
    detailGeometry,
    createRoadVehicleMaterial(`${name}/details`),
    instances.length,
  );
  details.name = `${name}-details`;
  details.castShadow = true;
  details.receiveShadow = true;
  populateInstances(details, instances, false);

  group.add(paint, details);
  markRoadVehicle(group, type, 2, 'instanced-detailed-vehicles', 'region-owned', instances.length);
  return group;
}

function limb(color: number, position: Vec3, scale: Vec3, rotation: Vec3): VehiclePart {
  return { geometry: cylinder, color, position, scale, rotation };
}

function connectedLimb(color: number, start: Vec3, end: Vec3, radius: number): VehiclePart {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const length = direction.length();
  const rotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
  );
  const centre = a.add(b).multiplyScalar(0.5);
  return limb(
    color,
    [centre.x, centre.y, centre.z],
    [radius * 2, length, radius * 2],
    [rotation.x, rotation.y, rotation.z],
  );
}

export function createMotorcycle(
  color: number,
  type: MotorcycleType = 'cruiser',
  riderAccent = 0x9a4f32,
  options: RoadVehicleOptions = {},
): THREE.Group {
  const cruiser = type === 'cruiser';
  const wheelRadius = cruiser ? 0.42 : 0.39;
  const wheelZ = cruiser ? 0.92 : 0.82;
  const frameY = cruiser ? 0.7 : 0.82;
  const skin = 0x9d6950;
  const leather = 0x17191c;
  const metal = 0x879194;
  const chrome = 0xb4bec2;
  const engine = 0x41494d;
  const brakeDisc = 0x626b70;
  const taillight = 0xc51f2b;
  const indicator = 0xff9f1c;
  const visor = 0x183949;
  const parts: VehiclePart[] = [];

  for (const z of [-wheelZ, wheelZ]) {
    parts.push(
      {
        geometry: torus,
        color: 0x111317,
        position: [0, wheelRadius, z],
        scale: [wheelRadius / 0.62, wheelRadius / 0.62, cruiser ? 0.76 : 0.64],
        rotation: [0, Math.PI / 2, 0],
        wheel: [0, wheelRadius, z, wheelRadius],
      },
      {
        geometry: cylinder,
        color: metal,
        position: [0, wheelRadius, z],
        scale: [0.16, 0.32, 0.16],
        rotation: [0, 0, Math.PI / 2],
        wheel: [0, wheelRadius, z, wheelRadius],
      },
      {
        geometry: cylinder,
        color: brakeDisc,
        position: [0, wheelRadius, z],
        scale: [0.25, 0.055, 0.25],
        rotation: [0, 0, Math.PI / 2],
        wheel: [0, wheelRadius, z, wheelRadius],
      },
    );
    for (const angle of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
      parts.push({
        geometry: box,
        color: metal,
        position: [0, wheelRadius, z],
        scale: [0.055, wheelRadius * 1.42, 0.055],
        rotation: [angle, 0, 0],
        wheel: [0, wheelRadius, z, wheelRadius],
      });
    }
  }

  parts.push(
    {
      geometry: box,
      color: leather,
      position: [0, frameY, 0.08],
      scale: [0.24, 0.18, 1.45],
    },
    {
      geometry: sphere,
      color,
      position: [0, frameY + 0.23, -0.18],
      scale: [0.65, 0.48, 0.75],
      layer: 'paint',
    },
    {
      geometry: box,
      color: leather,
      position: [0, frameY + 0.27, 0.52],
      scale: [0.58, 0.18, 0.72],
    },
    {
      geometry: softBox,
      color: engine,
      position: [0, frameY - 0.03, 0.1],
      scale: [0.54, 0.44, 0.58],
    },
    limb(metal, [-0.13, 0.77, -0.64], [0.075, 1.2, 0.075], [0.52, 0, 0]),
    limb(metal, [0.13, 0.77, -0.64], [0.075, 1.2, 0.075], [0.52, 0, 0]),
    limb(metal, [-0.12, 0.82, 0.66], [0.075, 0.86, 0.075], [-0.48, 0, 0]),
    limb(metal, [0.12, 0.82, 0.66], [0.075, 0.86, 0.075], [-0.48, 0, 0]),
    limb(chrome, [0.28, frameY - 0.04, 0.43], [0.09, 1.08, 0.09], [Math.PI / 2, 0, 0]),
    {
      geometry: box,
      color: metal,
      position: [0, 1.22, -0.64],
      scale: [0.92, 0.08, 0.08],
    },
    {
      geometry: sphere,
      color: 0xffe1a3,
      position: [0, 1.1, -0.83],
      scale: [0.26, 0.26, 0.18],
    },
    {
      geometry: softBox,
      color,
      position: [0, wheelRadius + 0.27, -wheelZ],
      scale: [0.34, 0.1, cruiser ? 0.6 : 0.76],
      rotation: [cruiser ? 0.04 : -0.12, 0, 0],
      layer: 'paint',
    },
    {
      geometry: box,
      color: taillight,
      position: [0, frameY + 0.28, wheelZ + 0.12],
      scale: [0.3, 0.16, 0.08],
    },
    {
      geometry: box,
      color: indicator,
      position: [-0.3, frameY + 0.3, wheelZ + 0.07],
      scale: [0.12, 0.12, 0.08],
    },
    {
      geometry: box,
      color: indicator,
      position: [0.3, frameY + 0.3, wheelZ + 0.07],
      scale: [0.12, 0.12, 0.08],
    },
    {
      geometry: cylinder,
      color: leather,
      position: [-0.5, 1.22, -0.64],
      scale: [0.075, 0.2, 0.075],
      rotation: [0, 0, Math.PI / 2],
    },
    {
      geometry: cylinder,
      color: leather,
      position: [0.5, 1.22, -0.64],
      scale: [0.075, 0.2, 0.075],
      rotation: [0, 0, Math.PI / 2],
    },
  );

  const riderY = cruiser ? 1.37 : 1.48;
  parts.push(
    {
      geometry: cylinder,
      color: leather,
      position: [0, riderY, 0.28],
      scale: [0.56, 0.82, 0.56],
      rotation: [-0.13, 0, 0],
    },
    {
      geometry: sphere,
      color: riderAccent,
      position: [0, riderY + 0.63, 0.15],
      scale: [0.38, 0.38, 0.38],
    },
    {
      geometry: softBox,
      color: visor,
      position: [0, riderY + 0.65, -0.04],
      scale: [0.42, 0.16, 0.075],
      rotation: [-0.1, 0, 0],
    },
    ...[-1, 1].flatMap((side) => [
      connectedLimb(skin, [side * 0.265, riderY + 0.24, 0.02], [side * 0.39, 1.4, -0.32], 0.067),
      connectedLimb(skin, [side * 0.39, 1.4, -0.32], [side * 0.46, 1.22, -0.64], 0.055),
      connectedLimb(leather, [side * 0.2, frameY + 0.29, 0.42], [side * 0.36, 0.7, -0.04], 0.088),
      connectedLimb(leather, [side * 0.36, 0.7, -0.04], [side * 0.43, 0.28, 0.16], 0.067),
      {
        geometry: box,
        color: leather,
        position: [side * 0.46, 1.22, -0.64] as Vec3,
        scale: [0.105, 0.085, 0.1] as Vec3,
      },
      {
        geometry: box,
        color: leather,
        position: [side * 0.43, 0.24, 0.075] as Vec3,
        scale: [0.14, 0.11, 0.28] as Vec3,
      },
    ]),
  );
  if (cruiser) {
    parts.push({
      geometry: box,
      color: riderAccent,
      position: [0, riderY + 0.14, 0.575],
      scale: [0.46, 0.46, 0.06],
    });
  }

  const motorcycle = mergeVehicle(parts, type, options.material ?? vehicleMaterial);
  motorcycle.userData.renderProfile = 'single-mesh-detailed-motorcycle';
  motorcycle.userData.vehicleType = type;
  motorcycle.userData.detailLevel = 'high';
  motorcycle.userData.surfaceProfile = 'rounded-panelled-pbr';
  motorcycle.userData.drawCalls = 1;
  motorcycle.userData.materialOwnership =
    options.materialOwnership ?? (options.material ? 'external' : 'shared-module');
  return motorcycle;
}
