import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { collidesWithBuildings, type AxisAlignedRectangle, type WalkPoint } from './walk-engine';
import { AMBROSIA_WORLD, LEONIDA_KEYS_WORLD, REGION_WORLD } from './walk-geography';
import { createMotorcycle, createRoadVehicle, type RoadVehicleType } from './walk-vehicles';

type LifeRegion = 'vice-city' | 'ambrosia' | 'leonida-keys';

interface LinearMover {
  object: THREE.Object3D;
  axis: 'x' | 'z';
  min: number;
  max: number;
  speed: number;
  collisionRadius: number;
  region: LifeRegion;
  enabled: boolean;
}

interface BobbingObject {
  object: THREE.Object3D;
  baseY: number;
  phase: number;
}

export interface WalkWorldLife {
  update: (deltaSeconds: number, elapsedSeconds: number, observer?: WalkPoint) => void;
}

const REGION_VISIBILITY_RADIUS = 220;

const LIFE_REGION_ANCHORS: Readonly<Record<LifeRegion, WalkPoint>> = {
  'vice-city': REGION_WORLD.viceCity,
  ambrosia: REGION_WORLD.ambrosia,
  'leonida-keys': REGION_WORLD.leonidaKeys,
};

function orientLinearMover(mover: LinearMover): void {
  if (mover.axis === 'z') {
    mover.object.rotation.y = mover.speed >= 0 ? Math.PI : 0;
  } else {
    mover.object.rotation.y = mover.speed >= 0 ? -Math.PI / 2 : Math.PI / 2;
  }
}

function moverPosition(mover: LinearMover, coordinate: number): WalkPoint {
  return mover.axis === 'x'
    ? { x: coordinate, z: mover.object.position.z }
    : { x: mover.object.position.x, z: coordinate };
}

function coordinateIsClear(
  mover: LinearMover,
  coordinate: number,
  collisions: readonly AxisAlignedRectangle[],
): boolean {
  return !collidesWithBuildings(
    moverPosition(mover, coordinate),
    mover.collisionRadius,
    collisions,
  );
}

function safeWrappedCoordinate(
  mover: LinearMover,
  collisions: readonly AxisAlignedRectangle[],
): number | null {
  const startsAtMinimum = mover.speed >= 0;
  const start = startsAtMinimum ? mover.min : mover.max;
  const direction = startsAtMinimum ? 1 : -1;
  const length = Math.max(0, mover.max - mover.min);
  for (let offset = 0; offset <= length; offset += 1) {
    const candidate = start + direction * offset;
    if (coordinateIsClear(mover, candidate, collisions)) return candidate;
  }
  return null;
}

function advanceLinearMover(
  mover: LinearMover,
  deltaSeconds: number,
  collisions: readonly AxisAlignedRectangle[],
): void {
  const current = mover.object.position[mover.axis];
  let candidate = current + mover.speed * deltaSeconds;
  if (candidate > mover.max || candidate < mover.min) {
    const wrapped = safeWrappedCoordinate(mover, collisions);
    if (wrapped !== null) mover.object.position[mover.axis] = wrapped;
    return;
  }

  if (!coordinateIsClear(mover, candidate, collisions)) {
    mover.speed *= -1;
    orientLinearMover(mover);
    candidate = current + mover.speed * deltaSeconds;
  }

  if (coordinateIsClear(mover, candidate, collisions)) {
    mover.object.position[mover.axis] = candidate;
  }
}

function placeMoverOnClearRoute(
  mover: LinearMover,
  collisions: readonly AxisAlignedRectangle[],
): void {
  const current = mover.object.position[mover.axis];
  if (coordinateIsClear(mover, current, collisions)) return;
  const routeLength = Math.max(0, mover.max - mover.min);
  for (let offset = 0.5; offset <= routeLength; offset += 0.5) {
    for (const direction of [1, -1]) {
      const candidate = current + direction * offset;
      if (
        candidate >= mover.min &&
        candidate <= mover.max &&
        coordinateIsClear(mover, candidate, collisions)
      ) {
        mover.object.position[mover.axis] = candidate;
        return;
      }
    }
  }
  mover.enabled = false;
  mover.object.visible = false;
}

function boat(color: number): THREE.Group {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.95, 4.6, 6),
    new THREE.MeshStandardMaterial({ color, metalness: 0.12, roughness: 0.44 }),
  );
  hull.rotation.z = Math.PI / 2;
  hull.position.y = 0.36;
  const console = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.75, 1.15),
    new THREE.MeshStandardMaterial({ color: 0xd8e8ec, roughness: 0.42 }),
  );
  console.position.set(0, 0.85, -0.15);
  group.add(hull, console);
  return group;
}

const pedestrianMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.86,
  metalness: 0,
});

function colouredPedestrianPart(
  source: THREE.BufferGeometry,
  colorHex: number,
  position: readonly [number, number, number],
  scale: readonly [number, number, number] = [1, 1, 1],
): THREE.BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion(),
      new THREE.Vector3(...scale),
    ),
  );
  const positions = geometry.getAttribute('position');
  const color = new THREE.Color(colorHex);
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function pedestrian(shirtColor: number): THREE.Group {
  const parts = [
    colouredPedestrianPart(
      new THREE.CylinderGeometry(0.28, 0.34, 0.92, 8),
      shirtColor,
      [0, 1.28, 0],
    ),
    colouredPedestrianPart(new THREE.SphereGeometry(0.22, 8, 6), 0xa96f51, [0, 1.95, 0]),
    ...[-0.14, 0.14].map((x) =>
      colouredPedestrianPart(new THREE.CylinderGeometry(0.085, 0.1, 0.78, 7), 0x202934, [
        x,
        0.43,
        0,
      ]),
    ),
  ];
  const merged = mergeGeometries(parts, false) ?? parts[0]!;
  merged.computeBoundingSphere();
  const mesh = new THREE.Mesh(merged, pedestrianMaterial);
  mesh.name = 'pedestrian-mesh';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.userData.renderProfile = 'single-mesh-pedestrian';
  group.add(mesh);
  return group;
}

function helicopter(): THREE.Group {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({
    color: 0x19242b,
    metalness: 0.45,
    roughness: 0.42,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x4f91a8,
    metalness: 0.3,
    roughness: 0.18,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), dark);
  body.scale.set(1.7, 0.85, 0.9);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.74, 10, 7), glass);
  cockpit.scale.set(0.9, 0.72, 0.82);
  cockpit.position.z = -1.08;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 4), dark);
  tail.position.z = 2.65;
  tail.rotation.x = -0.08;
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.05, 0.13),
    new THREE.MeshBasicMaterial({ color: 0x111317 }),
  );
  rotor.position.y = 1.08;
  rotor.name = 'main-rotor';
  group.add(body, cockpit, tail, rotor);
  return group;
}

export function createWalkWorldLife(
  scene: THREE.Scene,
  reducedDensity: boolean,
  collisions: readonly AxisAlignedRectangle[] = [],
): WalkWorldLife {
  const linearMovers: LinearMover[] = [];
  const bobbing: BobbingObject[] = [];
  const palette = [0xe83e8c, 0x37b7d9, 0xf1be42, 0xdce2e5, 0x222831, 0x8b5cf6];
  const viceVehicleCount = reducedDensity ? 6 : 14;
  const viceCenter = REGION_WORLD.viceCity;
  const catalanBoulevardX = viceCenter.x + 100;
  const verticalRoads = [-8.6, -3.7, 3.7, 8.6].map((offset) => catalanBoulevardX + offset);
  const horizontalRoads = [-23, -17].map((offset) => viceCenter.z + offset);
  const viceMinX = catalanBoulevardX - 24;
  const viceMaxX = catalanBoulevardX + 24;
  const viceMinZ = viceCenter.z - 105;
  const viceMaxZ = viceCenter.z + 125;
  const vehicleTypes: RoadVehicleType[] = ['sedan', 'convertible', 'pickup', 'sedan', 'police'];

  for (let index = 0; index < viceVehicleCount; index += 1) {
    const vehicle = createRoadVehicle(
      palette[index % palette.length] ?? 0xffffff,
      vehicleTypes[index % vehicleTypes.length] ?? 'sedan',
    );
    vehicle.name = 'moving-road-vehicle';
    if (index % 4 !== 3) {
      const road = verticalRoads[index % verticalRoads.length] ?? viceCenter.x;
      vehicle.position.set(
        road + (index % 4 < 2 ? -2.4 : 2.4),
        0.16,
        viceMinZ + ((index * 19) % (viceMaxZ - viceMinZ)),
      );
      vehicle.rotation.y = Math.PI;
      linearMovers.push({
        object: vehicle,
        axis: 'z',
        min: viceMinZ,
        max: viceMaxZ,
        speed: 3.8 + (index % 4),
        collisionRadius: 1.2,
        region: 'vice-city',
        enabled: true,
      });
    } else {
      const road = horizontalRoads[index % horizontalRoads.length] ?? viceCenter.z;
      vehicle.position.set(
        viceMinX + ((index * 17) % (viceMaxX - viceMinX)),
        0.16,
        road + (index % 4 < 2 ? -2.4 : 2.4),
      );
      vehicle.rotation.y = -Math.PI / 2;
      linearMovers.push({
        object: vehicle,
        axis: 'x',
        min: viceMinX,
        max: viceMaxX,
        speed: 4.2 + (index % 3),
        collisionRadius: 1.2,
        region: 'vice-city',
        enabled: true,
      });
    }
    scene.add(vehicle);
  }

  const motorcycleCount = reducedDensity ? 4 : 8;
  const ambrosiaRoadX = AMBROSIA_WORLD.town.x + 4;
  const ambrosiaMinZ = AMBROSIA_WORLD.town.z - 14;
  const ambrosiaMaxZ = AMBROSIA_WORLD.town.z + 24;
  for (let index = 0; index < motorcycleCount; index += 1) {
    const motorcycle = createMotorcycle(
      [0x8f2427, 0x16191c, 0x3f5457][index % 3] ?? 0x16191c,
      'cruiser',
      [0x9a573b, 0xb97a59, 0x74452f, 0xc98d6c][index % 4] ?? 0x9a573b,
    );
    motorcycle.name = 'moving-ambrosia-motorcycle';
    const lane = index % 2 === 0 ? ambrosiaRoadX - 1.45 : ambrosiaRoadX + 1.25;
    motorcycle.position.set(lane, 0.14, ambrosiaMaxZ - 3 - (index % 4) * 1.2);
    motorcycle.rotation.y = 0;
    motorcycle.scale.setScalar(0.94 + (index % 3) * 0.035);
    linearMovers.push({
      object: motorcycle,
      axis: 'z',
      min: ambrosiaMinZ,
      max: ambrosiaMaxZ,
      speed: -3.15 - (index % 3) * 0.12,
      collisionRadius: 0.55,
      region: 'ambrosia',
      enabled: true,
    });
    scene.add(motorcycle);
  }

  const ambrosiaVehicleCount = reducedDensity ? 1 : 2;
  for (let index = 0; index < ambrosiaVehicleCount; index += 1) {
    const pickup = createRoadVehicle(index % 2 ? 0x33464d : 0xc7c0ad, 'pickup');
    pickup.name = 'moving-ambrosia-pickup';
    const headingSouth = index % 2 === 0;
    pickup.position.set(
      headingSouth ? ambrosiaRoadX - 1.7 : ambrosiaRoadX + 1.7,
      0.16,
      headingSouth ? ambrosiaMaxZ - 6 : ambrosiaMaxZ - 15,
    );
    pickup.rotation.y = headingSouth ? 0 : Math.PI;
    linearMovers.push({
      object: pickup,
      axis: 'z',
      min: ambrosiaMinZ,
      max: ambrosiaMaxZ,
      speed: headingSouth ? -2.45 : 2.3,
      collisionRadius: 1.2,
      region: 'ambrosia',
      enabled: true,
    });
    scene.add(pickup);
  }

  const pedestrianCount = reducedDensity ? 5 : 14;
  const viceSidewalks = [catalanBoulevardX - 18.4, catalanBoulevardX + 18.4];
  for (let index = 0; index < pedestrianCount; index += 1) {
    const person = pedestrian(palette[(index + 2) % palette.length] ?? 0xdddddd);
    person.name = 'moving-pedestrian';
    const sidewalkX = viceSidewalks[index % viceSidewalks.length] ?? viceCenter.x;
    person.position.set(sidewalkX, 0.22, viceMinZ + ((index * 13) % (viceMaxZ - viceMinZ)));
    person.scale.setScalar(0.88 + (index % 3) * 0.06);
    linearMovers.push({
      object: person,
      axis: 'z',
      min: viceMinZ,
      max: viceMaxZ,
      speed: 0.72 + (index % 4) * 0.12,
      collisionRadius: 0.36,
      region: 'vice-city',
      enabled: true,
    });
    scene.add(person);
  }

  const keyBoats = reducedDensity ? 1 : 3;
  const keysMinX = LEONIDA_KEYS_WORLD.westernKeys.x;
  const keysMaxX = LEONIDA_KEYS_WORLD.easternKeys.x;
  for (let index = 0; index < keyBoats; index += 1) {
    const vessel = boat(palette[(index + 1) % palette.length] ?? 0xffffff);
    vessel.name = 'moving-keys-boat';
    vessel.position.set(
      keysMinX + 12 + index * 23,
      0.05,
      LEONIDA_KEYS_WORLD.centralKeys.z - 12 + index * 8,
    );
    vessel.rotation.y = Math.PI / 2 + index * 0.18;
    linearMovers.push({
      object: vessel,
      axis: 'x',
      min: keysMinX,
      max: keysMaxX,
      speed: 1.5 + index * 0.24,
      collisionRadius: 0.8,
      region: 'leonida-keys',
      enabled: true,
    });
    bobbing.push({ object: vessel, baseY: 0.05, phase: index * 1.7 });
    scene.add(vessel);
  }

  for (const mover of linearMovers) placeMoverOnClearRoute(mover, collisions);

  const aircraft = helicopter();
  aircraft.name = 'moving-vice-city-helicopter';
  const helicopterRadiusX = 52;
  const helicopterRadiusZ = 38;
  aircraft.position.set(viceCenter.x + helicopterRadiusX, 63, viceCenter.z);
  scene.add(aircraft);

  return {
    update(deltaSeconds, elapsedSeconds, observer) {
      for (const mover of linearMovers) {
        if (observer) {
          const anchor = LIFE_REGION_ANCHORS[mover.region];
          mover.object.visible =
            mover.enabled &&
            Math.hypot(observer.x - anchor.x, observer.z - anchor.z) <= REGION_VISIBILITY_RADIUS;
        }
        if (mover.enabled) advanceLinearMover(mover, deltaSeconds, collisions);
      }
      for (const item of bobbing) {
        item.object.position.y = item.baseY + Math.sin(elapsedSeconds * 1.4 + item.phase) * 0.08;
      }
      const angle = elapsedSeconds * 0.085;
      if (observer) {
        aircraft.visible =
          Math.hypot(observer.x - viceCenter.x, observer.z - viceCenter.z) <=
          REGION_VISIBILITY_RADIUS;
      }
      aircraft.position.set(
        viceCenter.x + Math.cos(angle) * helicopterRadiusX,
        63 + Math.sin(angle * 1.7) * 4,
        viceCenter.z + Math.sin(angle) * helicopterRadiusZ,
      );
      aircraft.rotation.y = -angle + Math.PI / 2;
      const rotor = aircraft.getObjectByName('main-rotor');
      if (rotor) rotor.rotation.y += deltaSeconds * 24;
    },
  };
}
