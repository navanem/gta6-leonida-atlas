import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  LEONIDA_KEYS_WORLD,
  MOUNT_KALAGA_WORLD,
  PLACE_ENTRY_VIEWS,
  REGION_WORLD,
} from '../../src/features/street-leonida/walk-geography';
import { createWalkWorldLife } from '../../src/features/street-leonida/walk-life';
import { circleIntersectsRectangle } from '../../src/features/street-leonida/walk-engine';

describe('Street Leonida living world', () => {
  it('keeps traffic and walkers on the active arrival roads, including rotated Ambrosia', () => {
    const scene = new THREE.Scene();
    const life = createWalkWorldLife(scene, false);
    const viceTraffic = scene.children.filter((object) => object.name === 'moving-road-vehicle');
    const pedestrians = scene.children.filter((object) => object.name === 'moving-pedestrian');
    const ambrosiaTraffic = scene.children.filter((object) =>
      object.name.startsWith('moving-ambrosia-'),
    );
    const keyBoats = scene.children.filter((object) => object.name === 'moving-keys-boat');
    const helicopter = scene.children.find(
      (object) => object.name === 'moving-vice-city-helicopter',
    );

    const roadLocal = (object: THREE.Object3D, region: 'vice-city' | 'ambrosia') => {
      const view = PLACE_ENTRY_VIEWS[region]!;
      const direction = new THREE.Vector2(
        view.position.x - view.target.x,
        view.position.z - view.target.z,
      ).normalize();
      const offset = new THREE.Vector2(
        object.position.x - view.position.x,
        object.position.z - view.position.z,
      );
      return {
        x: offset.x * direction.y - offset.y * direction.x,
        z: offset.dot(direction),
      };
    };
    const assertAligned = () => {
      for (const object of viceTraffic) {
        const local = roadLocal(object, 'vice-city');
        expect(Math.abs(local.x)).toBeLessThanOrEqual(7.7);
        expect(Math.abs(local.x)).toBeGreaterThanOrEqual(3.5);
        expect(local.z).toBeGreaterThanOrEqual(-235.01);
        expect(local.z).toBeLessThanOrEqual(18.01);
      }
      for (const object of pedestrians) {
        const local = roadLocal(object, 'vice-city');
        expect(Math.abs(local.x)).toBeCloseTo(13.35, 4);
        expect(local.z).toBeGreaterThanOrEqual(-235.01);
        expect(local.z).toBeLessThanOrEqual(18.01);
      }
      for (const object of ambrosiaTraffic) {
        const local = roadLocal(object, 'ambrosia');
        expect(Math.abs(local.x)).toBeLessThanOrEqual(3.7);
        expect(Math.abs(local.x)).toBeGreaterThanOrEqual(1.2);
        expect(local.z).toBeGreaterThanOrEqual(-235.01);
        expect(local.z).toBeLessThanOrEqual(18.01);
      }
      for (const object of keyBoats) {
        expect(object.position.x).toBeGreaterThanOrEqual(LEONIDA_KEYS_WORLD.westernKeys.x);
        expect(object.position.x).toBeLessThanOrEqual(LEONIDA_KEYS_WORLD.easternKeys.x);
        expect(object.position.z).toBeGreaterThanOrEqual(LEONIDA_KEYS_WORLD.centralKeys.z - 13);
        expect(object.position.z).toBeLessThanOrEqual(LEONIDA_KEYS_WORLD.centralKeys.z + 5);
      }
      expect(helicopter?.position.x).toBeGreaterThanOrEqual(REGION_WORLD.viceCity.x - 52);
      expect(helicopter?.position.x).toBeLessThanOrEqual(REGION_WORLD.viceCity.x + 52);
      expect(helicopter?.position.z).toBeGreaterThanOrEqual(REGION_WORLD.viceCity.z - 38);
      expect(helicopter?.position.z).toBeLessThanOrEqual(REGION_WORLD.viceCity.z + 38);
    };

    assertAligned();
    for (let frame = 1; frame <= 120; frame += 1) {
      life.update(0.5, frame * 0.5);
      assertAligned();
    }
  });

  it('animates road traffic, pedestrians, boats and a helicopter', () => {
    const scene = new THREE.Scene();
    const life = createWalkWorldLife(scene, false);
    const car = scene.children.find((object) => object.name === 'moving-road-vehicle');
    const pedestrian = scene.children.find((object) => object.name === 'moving-pedestrian');
    const boat = scene.children.find((object) => object.name === 'moving-keys-boat');
    const helicopter = scene.children.find(
      (object) => object.name === 'moving-vice-city-helicopter',
    );

    expect(car).toBeDefined();
    expect(pedestrian).toBeDefined();
    expect(boat).toBeDefined();
    expect(helicopter).toBeDefined();

    const before = {
      car: car?.position.clone(),
      pedestrian: pedestrian?.position.clone(),
      boat: boat?.position.clone(),
      helicopter: helicopter?.position.clone(),
    };
    life.update(0.5, 8);

    expect(car?.position.equals(before.car ?? new THREE.Vector3())).toBe(false);
    expect(pedestrian?.position.equals(before.pedestrian ?? new THREE.Vector3())).toBe(false);
    expect(boat?.position.equals(before.boat ?? new THREE.Vector3())).toBe(false);
    expect(helicopter?.position.equals(before.helicopter ?? new THREE.Vector3())).toBe(false);
  });

  it('shows Vice City traffic at the boulevard arrival and aligns it with Catalan lanes', () => {
    const scene = new THREE.Scene();
    const life = createWalkWorldLife(scene, false);
    life.update(0.1, 1, PLACE_ENTRY_VIEWS['vice-city']!.position);
    const traffic = scene.children.filter((object) => object.name === 'moving-road-vehicle');

    expect(traffic.some((vehicle) => vehicle.visible)).toBe(true);
    expect(
      traffic.some(
        (vehicle) => Math.abs(vehicle.position.x - (REGION_WORLD.viceCity.x + 100)) <= 12,
      ),
    ).toBe(true);
  });

  it('reduces repeated moving objects for coarse-pointer devices', () => {
    const desktop = new THREE.Scene();
    const mobile = new THREE.Scene();
    createWalkWorldLife(desktop, false);
    createWalkWorldLife(mobile, true);

    expect(mobile.children.length).toBeLessThan(desktop.children.length);
  });

  it('renders each repeated pedestrian as one vertex-coloured mesh', () => {
    const scene = new THREE.Scene();
    createWalkWorldLife(scene, false);
    const pedestrians = scene.children.filter((object) => object.name === 'moving-pedestrian');

    expect(pedestrians).toHaveLength(14);
    for (const person of pedestrians) {
      const meshes: THREE.Mesh[] = [];
      person.traverse((object) => {
        if (object instanceof THREE.Mesh) meshes.push(object);
      });
      expect(meshes).toHaveLength(1);
      expect((meshes[0]!.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
      expect(person.userData.renderProfile).toBe('single-mesh-pedestrian');
    }
  });

  it('animates an Ambrosia motorcycle convoy and reduces it on coarse pointers', () => {
    const desktop = new THREE.Scene();
    const mobile = new THREE.Scene();
    const desktopLife = createWalkWorldLife(desktop, false);
    createWalkWorldLife(mobile, true);

    const desktopMotorcycles = desktop.children.filter(
      (object) => object.name === 'moving-ambrosia-motorcycle',
    );
    const mobileMotorcycles = mobile.children.filter(
      (object) => object.name === 'moving-ambrosia-motorcycle',
    );

    expect(desktopMotorcycles).toHaveLength(8);
    expect(mobileMotorcycles).toHaveLength(4);

    const before = desktopMotorcycles[0]?.position.clone();
    desktopLife.update(0.5, 8);

    expect(desktopMotorcycles[0]?.position.equals(before ?? new THREE.Vector3())).toBe(false);
  });

  it('keeps the Ambrosia arrival sightline clear while the opening view settles', () => {
    const scene = new THREE.Scene();
    const life = createWalkWorldLife(scene, false);
    const ambrosiaEntry = PLACE_ENTRY_VIEWS.ambrosia!.position;
    const arrival = new THREE.Vector2(ambrosiaEntry.x, ambrosiaEntry.z);
    const traffic = scene.children.filter((object) => object.name.startsWith('moving-ambrosia-'));

    for (let frame = 0; frame <= 8; frame += 1) {
      for (const object of traffic) {
        const distance = new THREE.Vector2(object.position.x, object.position.z).distanceTo(
          arrival,
        );
        expect(distance).toBeGreaterThanOrEqual(8);
      }
      life.update(0.4, frame * 0.4);
    }
  });

  it('orients every moving road vehicle in its direction of travel', () => {
    const scene = new THREE.Scene();
    const life = createWalkWorldLife(scene, false);
    const traffic = scene.children.filter(
      (object) =>
        object.name === 'moving-road-vehicle' || object.name.startsWith('moving-ambrosia-'),
    );
    const before = new Map(traffic.map((object) => [object, object.position.clone()]));

    life.update(0.25, 0.25);

    for (const object of traffic) {
      const displacement = object.position.clone().sub(before.get(object) ?? object.position);
      displacement.y = 0;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(object.quaternion);
      forward.y = 0;
      expect(displacement.normalize().dot(forward.normalize())).toBeGreaterThan(0.98);
    }
  });

  it('never lets moving traffic enter a solid world collision', () => {
    const scene = new THREE.Scene();
    const viceRoadX = REGION_WORLD.viceCity.x + 94 - 7.5;
    const obstacles = [
      {
        minX: viceRoadX - 1,
        maxX: viceRoadX + 1,
        minZ: REGION_WORLD.viceCity.z - 36,
        maxZ: REGION_WORLD.viceCity.z - 33.6,
      },
      {
        minX: viceRoadX - 1,
        maxX: viceRoadX + 1,
        minZ: REGION_WORLD.viceCity.z - 30.8,
        maxZ: REGION_WORLD.viceCity.z - 26.8,
      },
    ];
    const life = createWalkWorldLife(scene, false, obstacles);
    const traffic = scene.children.filter(
      (object) =>
        object.name === 'moving-road-vehicle' || object.name.startsWith('moving-ambrosia-'),
    );

    for (let frame = 0; frame < 240; frame += 1) {
      life.update(0.1, frame * 0.1);
      for (const object of traffic) {
        for (const obstacle of obstacles) {
          expect(
            circleIntersectsRectangle(
              { x: object.position.x, z: object.position.z },
              object.name.includes('motorcycle') ? 0.55 : 1.2,
              obstacle,
            ),
          ).toBe(false);
        }
      }
    }
  });

  it('hides life from unrelated regions instead of compressing the whole state into view', () => {
    const scene = new THREE.Scene();
    const life = createWalkWorldLife(scene, false);

    life.update(0.1, 1, MOUNT_KALAGA_WORLD.centre);

    expect(
      scene.children
        .filter((object) => object.name.startsWith('moving-ambrosia-'))
        .every((object) => !object.visible),
    ).toBe(true);
    expect(
      scene.children
        .filter((object) => object.name === 'moving-road-vehicle')
        .every((object) => !object.visible),
    ).toBe(true);
    expect(
      scene.children.find((object) => object.name === 'moving-vice-city-helicopter')?.visible,
    ).toBe(false);
  });
});
