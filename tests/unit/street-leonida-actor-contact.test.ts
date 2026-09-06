import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createWalkWorldLife } from '../../src/features/street-leonida/walk-life';
import { REGION_WORLD } from '../../src/features/street-leonida/walk-geography';
import { circleIntersectsRectangle } from '../../src/features/street-leonida/walk-engine';
import {
  createRoadVehicle,
  createRoadVehicleBatch,
  setRoadVehicleTravelDistance,
} from '../../src/features/street-leonida/walk-vehicles';
import { createViceCityDistrict } from '../../src/features/street-leonida/walk-vice-city';

describe('living actor contact and surfaces', () => {
  it('uses the shared rig in the legacy boulevard and releases its skeleton once', () => {
    const scene = new THREE.Scene();
    const district = createViceCityDistrict(scene, [], false);
    const person = scene.getObjectByName('catalan-street-pedestrian-1')!;
    const mesh = person.children[0] as THREE.SkinnedMesh;
    expect(mesh).toBeInstanceOf(THREE.SkinnedMesh);
    const release = vi.spyOn(mesh.skeleton, 'dispose');
    district.update(1);
    expect(person.position.y).toBeCloseTo(0.32, 5);
    district.dispose();
    district.dispose();
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('places articulated walkers on the sidewalk and faces them along their motion', () => {
    const scene = new THREE.Scene();
    const life = createWalkWorldLife(scene, false);
    const person = scene.children.find((object) => object.name === 'moving-pedestrian')!;
    expect(person.children[0]).toBeInstanceOf(THREE.SkinnedMesh);
    expect(person.position.y).toBeCloseTo(0.155, 5);
    const before = person.position.clone();
    life.update(0.1, 0.1);
    const motion = person.position.clone().sub(before).normalize();
    const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(person.quaternion);
    expect(motion.dot(facing)).toBeGreaterThan(0.99);
    life.dispose();
  });

  it('keeps tyre bottoms on the road surface instead of burying them', () => {
    const scene = new THREE.Scene();
    const life = createWalkWorldLife(scene, false);
    const car = scene.children.find((object) => object.name === 'moving-road-vehicle')!;
    expect(new THREE.Box3().setFromObject(car).min.y).toBeCloseTo(0.27, 5);
    life.dispose();
  });

  it('releases moving instance buffers exactly once when the explorer closes', () => {
    const scene = new THREE.Scene();
    const life = createWalkWorldLife(scene, false);
    const car = scene.children.find((object) => object.name === 'moving-road-vehicle')!;
    const mesh = car.children[0] as THREE.InstancedMesh;
    const release = vi.spyOn(mesh, 'dispose');
    life.dispose();
    life.dispose();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('uses real current-corridor obstacles and stops traffic entering them', () => {
    const x = REGION_WORLD.viceCity.x + 94 - 7.5;
    const z = REGION_WORLD.viceCity.z + 56 - 18;
    const obstacle = { minX: x - 1.5, maxX: x + 1.5, minZ: z - 9, maxZ: z - 6 };
    const scene = new THREE.Scene();
    const life = createWalkWorldLife(scene, false, [obstacle]);
    const car = scene.children.find((object) => object.name === 'moving-road-vehicle')!;
    const start = car.position.clone();
    let reversed = false;
    let previousZ = start.z;
    for (let frame = 0; frame < 120; frame++) {
      life.update(0.1, frame / 10);
      expect(
        circleIntersectsRectangle({ x: car.position.x, z: car.position.z }, 1.2, obstacle),
      ).toBe(false);
      if (car.position.z > previousZ && previousZ < start.z - 1) reversed = true;
      previousZ = car.position.z;
    }
    expect(reversed).toBe(true);
    life.dispose();
  });

  it('gives rubber, paint and glazing different physical responses in the same draw', () => {
    const mesh = createRoadVehicle(0x287cab, 'sedan').children[0] as THREE.Mesh;
    const colors = mesh.geometry.getAttribute('color');
    const surfaces = mesh.geometry.getAttribute('atlasSurface');
    expect(surfaces).toBeDefined();
    for (const [hex, roughness, metalness, coat] of [
      [0x111419, 0.84, 0, 0],
      [0x173445, 0.12, 0.05, 0.7],
      [0x287cab, 0.32, 0.38, 0.82],
    ]) {
      const color = new THREE.Color(hex!);
      let seen = false;
      for (let index = 0; index < colors.count; index++) {
        if (
          Math.abs(colors.getX(index) - color.r) > 0.0001 ||
          Math.abs(colors.getY(index) - color.g) > 0.0001 ||
          Math.abs(colors.getZ(index) - color.b) > 0.0001
        )
          continue;
        expect(surfaces.getX(index)).toBeCloseTo(roughness!, 3);
        expect(surfaces.getY(index)).toBeCloseTo(metalness!, 3);
        expect(surfaces.getZ(index)).toBeCloseTo(coat!, 3);
        seen = true;
      }
      expect(seen).toBe(true);
    }
  });

  it('updates wheel travel independently while retaining two instanced parked-car draws', () => {
    const a = createRoadVehicle(0x287cab, 'sedan');
    const b = createRoadVehicle(0x287cab, 'sedan');
    a.scale.setScalar(0.5);
    setRoadVehicleTravelDistance(a, 1.25);
    const first = a.children[0] as THREE.Mesh;
    const second = b.children[0] as THREE.Mesh;
    expect(first.geometry.getAttribute('atlasTravel').getX(0)).toBeCloseTo(2.5, 5);
    expect(second.geometry.getAttribute('atlasTravel').getX(0)).toBe(0);
    const wheel = first.geometry.getAttribute('atlasWheel');
    const movingVertices = Array.from({ length: wheel.count }, (_, index) =>
      wheel.getW(index),
    ).filter((radius) => radius > 0);
    expect(movingVertices.length).toBeGreaterThan(300);
    const parked = createRoadVehicleBatch(
      [
        { color: 0x445566, position: [0, 0.21, 0] },
        { color: 0x667788, position: [3, 0.21, 0] },
      ],
      'sedan',
      'test-parked',
    );
    expect(parked.children).toHaveLength(2);
    for (const child of parked.children) expect(child).toBeInstanceOf(THREE.InstancedMesh);
  });
});
