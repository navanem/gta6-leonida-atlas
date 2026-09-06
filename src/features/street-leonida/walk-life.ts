import * as THREE from 'three';

import { collidesWithBuildings, type AxisAlignedRectangle, type WalkPoint } from './walk-engine';
import { LEONIDA_KEYS_WORLD, PLACE_ENTRY_VIEWS, REGION_WORLD } from './walk-geography';
import {
  createMotorcycle,
  createRoadVehicle,
  setRoadVehicleTravelDistance,
  type RoadVehicleType,
} from './walk-vehicles';
import { createPedestrianLibrary, type PedestrianActor } from './walk-pedestrians';

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
  pedestrian?: PedestrianActor;
  travelDistance?: number;
  route?: { origin: WalkPoint; direction: WalkPoint; coordinate: number };
}

interface BobbingObject {
  object: THREE.Object3D;
  baseY: number;
  phase: number;
}

export interface WalkWorldLife {
  update: (deltaSeconds: number, elapsedSeconds: number, observer?: WalkPoint) => void;
  dispose(): void;
}

const REGION_VISIBILITY_RADIUS = 220;

const LIFE_REGION_ANCHORS: Readonly<Record<LifeRegion, WalkPoint>> = {
  'vice-city': REGION_WORLD.viceCity,
  ambrosia: REGION_WORLD.ambrosia,
  'leonida-keys': REGION_WORLD.leonidaKeys,
};

function orientLinearMover(mover: LinearMover): void {
  if (mover.route) {
    const sign = Math.sign(mover.speed);
    mover.object.rotation.y = Math.atan2(
      -mover.route.direction.x * sign,
      -mover.route.direction.z * sign,
    );
    return;
  }
  if (mover.axis === 'z') {
    mover.object.rotation.y = mover.speed >= 0 ? Math.PI : 0;
  } else {
    mover.object.rotation.y = mover.speed >= 0 ? -Math.PI / 2 : Math.PI / 2;
  }
}

function moverPosition(mover: LinearMover, coordinate: number): WalkPoint {
  if (mover.route)
    return {
      x: mover.route.origin.x + coordinate * mover.route.direction.x,
      z: mover.route.origin.z + coordinate * mover.route.direction.z,
    };
  return mover.axis === 'x'
    ? { x: coordinate, z: mover.object.position.z }
    : { x: mover.object.position.x, z: coordinate };
}

function moverCoordinate(mover: LinearMover): number {
  return mover.route?.coordinate ?? mover.object.position[mover.axis];
}

function setMoverCoordinate(mover: LinearMover, coordinate: number): void {
  if (mover.route) mover.route.coordinate = coordinate;
  const point = moverPosition(mover, coordinate);
  mover.object.position.x = point.x;
  mover.object.position.z = point.z;
}

function arrivalRoute(
  mover: LinearMover,
  region: 'vice-city' | 'ambrosia',
  lane: number,
  coordinate: number,
): LinearMover {
  const view = PLACE_ENTRY_VIEWS[region]!;
  const yaw = Math.atan2(view.position.x - view.target.x, view.position.z - view.target.z);
  mover.route = {
    origin: {
      x: view.position.x + Math.cos(yaw) * lane,
      z: view.position.z - Math.sin(yaw) * lane,
    },
    direction: { x: Math.sin(yaw), z: Math.cos(yaw) },
    coordinate,
  };
  setMoverCoordinate(mover, coordinate);
  return mover;
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
  const current = moverCoordinate(mover);
  let candidate = current + mover.speed * deltaSeconds;
  if (candidate > mover.max || candidate < mover.min) {
    const wrapped = safeWrappedCoordinate(mover, collisions);
    if (wrapped !== null) setMoverCoordinate(mover, wrapped);
    return;
  }

  if (!coordinateIsClear(mover, candidate, collisions)) {
    mover.speed *= -1;
    orientLinearMover(mover);
    candidate = current + mover.speed * deltaSeconds;
  }

  if (coordinateIsClear(mover, candidate, collisions)) {
    setMoverCoordinate(mover, candidate);
  }
}

function placeMoverOnClearRoute(
  mover: LinearMover,
  collisions: readonly AxisAlignedRectangle[],
): void {
  const current = moverCoordinate(mover);
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
        setMoverCoordinate(mover, candidate);
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
  const pedestrians = createPedestrianLibrary();
  let disposed = false;
  const bobbing: BobbingObject[] = [];
  const palette = [0xe83e8c, 0x37b7d9, 0xf1be42, 0xdce2e5, 0x222831, 0x8b5cf6];
  const viceVehicleCount = reducedDensity ? 6 : 14;
  const viceCenter = REGION_WORLD.viceCity;
  const lanes = [-7.5, -3.6, 3.7, 7.6];
  const routeMin = -235;
  const routeMax = 18;
  const vehicleTypes: RoadVehicleType[] = ['sedan', 'convertible', 'pickup', 'sedan', 'police'];

  for (let index = 0; index < viceVehicleCount; index += 1) {
    const vehicle = createRoadVehicle(
      palette[index % palette.length] ?? 0xffffff,
      vehicleTypes[index % vehicleTypes.length] ?? 'sedan',
    );
    vehicle.name = 'moving-road-vehicle';
    vehicle.position.y = 0.27;
    linearMovers.push(
      arrivalRoute(
        {
          object: vehicle,
          axis: 'z',
          min: routeMin,
          max: routeMax,
          speed: (3.8 + (index % 4)) * (index % 4 < 2 ? -1 : 1),
          collisionRadius: 1.2,
          region: 'vice-city',
          enabled: true,
        },
        'vice-city',
        lanes[index % lanes.length]!,
        -18 - index * 13,
      ),
    );
    scene.add(vehicle);
  }

  const motorcycleCount = reducedDensity ? 4 : 8;
  for (let index = 0; index < motorcycleCount; index += 1) {
    const motorcycle = createMotorcycle(
      [0x8f2427, 0x16191c, 0x3f5457][index % 3] ?? 0x16191c,
      'cruiser',
      [0x9a573b, 0xb97a59, 0x74452f, 0xc98d6c][index % 4] ?? 0x9a573b,
    );
    motorcycle.name = 'moving-ambrosia-motorcycle';
    motorcycle.position.y = 0.27;
    motorcycle.scale.setScalar(0.94 + (index % 3) * 0.035);
    linearMovers.push(
      arrivalRoute(
        {
          object: motorcycle,
          axis: 'z',
          min: routeMin,
          max: routeMax,
          speed: 3.15 + (index % 3) * 0.12,
          collisionRadius: 0.55,
          region: 'ambrosia',
          enabled: true,
        },
        'ambrosia',
        index % 2 === 0 ? -1.35 : 1.35,
        -26 - Math.floor(index / 2) * 4.5,
      ),
    );
    scene.add(motorcycle);
  }

  const ambrosiaVehicleCount = reducedDensity ? 1 : 2;
  for (let index = 0; index < ambrosiaVehicleCount; index += 1) {
    const pickup = createRoadVehicle(index % 2 ? 0x33464d : 0xc7c0ad, 'pickup');
    pickup.name = 'moving-ambrosia-pickup';
    const headingSouth = index % 2 === 0;
    pickup.position.y = 0.27;
    linearMovers.push(
      arrivalRoute(
        {
          object: pickup,
          axis: 'z',
          min: routeMin,
          max: routeMax,
          speed: headingSouth ? -2.45 : 2.3,
          collisionRadius: 1.2,
          region: 'ambrosia',
          enabled: true,
        },
        'ambrosia',
        headingSouth ? -3.6 : 3.6,
        -52 - index * 18,
      ),
    );
    scene.add(pickup);
  }

  const pedestrianCount = reducedDensity ? 5 : 14;
  for (let index = 0; index < pedestrianCount; index += 1) {
    const actor = pedestrians.create({ variant: index, pose: 'walk' });
    const person = actor.root;
    person.name = 'moving-pedestrian';
    person.position.y = 0.155;
    linearMovers.push(
      arrivalRoute(
        {
          object: person,
          axis: 'z',
          min: routeMin,
          max: routeMax,
          speed: (0.72 + (index % 4) * 0.12) * (index % 2 ? -1 : 1),
          collisionRadius: 0.36,
          region: 'vice-city',
          enabled: true,
          pedestrian: actor,
          travelDistance: index * 0.137,
        },
        'vice-city',
        index % 2 ? -13.35 : 13.35,
        -10 - index * 14,
      ),
    );
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

  for (const mover of linearMovers) {
    orientLinearMover(mover);
    placeMoverOnClearRoute(mover, collisions);
  }

  const aircraft = helicopter();
  aircraft.name = 'moving-vice-city-helicopter';
  const helicopterRadiusX = 52;
  const helicopterRadiusZ = 38;
  aircraft.position.set(viceCenter.x + helicopterRadiusX, 63, viceCenter.z);
  scene.add(aircraft);

  return {
    update(deltaSeconds, elapsedSeconds, observer) {
      if (disposed) return;
      for (const mover of linearMovers) {
        if (observer) {
          const anchor = LIFE_REGION_ANCHORS[mover.region];
          mover.object.visible =
            mover.enabled &&
            Math.hypot(observer.x - anchor.x, observer.z - anchor.z) <= REGION_VISIBILITY_RADIUS;
        }
        const before = moverCoordinate(mover);
        if (mover.enabled) advanceLinearMover(mover, deltaSeconds, collisions);
        const displacement = Math.abs(moverCoordinate(mover) - before);
        // Route wrapping is a teleport, not a stride or wheel revolution.
        const travelled =
          displacement <= Math.abs(mover.speed * deltaSeconds) + 0.001 ? displacement : 0;
        mover.travelDistance = (mover.travelDistance ?? 0) + travelled;
        if (mover.object.visible) {
          if (mover.pedestrian) {
            mover.pedestrian.update({
              elapsedSeconds,
              distanceMetres: mover.travelDistance,
              speedMetresPerSecond: travelled > 0 ? Math.abs(mover.speed) : 0,
              distanceToCamera: observer
                ? Math.hypot(
                    observer.x - mover.object.position.x,
                    observer.z - mover.object.position.z,
                  )
                : 0,
            });
          } else setRoadVehicleTravelDistance(mover.object, mover.travelDistance);
        }
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
    dispose() {
      if (disposed) return;
      disposed = true;
      pedestrians.dispose();
      for (const mover of linearMovers) {
        mover.object.traverse((object) => {
          if (object instanceof THREE.InstancedMesh) object.dispose();
        });
      }
    },
  };
}
