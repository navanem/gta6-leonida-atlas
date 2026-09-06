import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createViceCityDistrict } from '../../src/features/street-leonida/walk-vice-city';
import {
  collidesWithBuildings,
  type AxisAlignedRectangle,
} from '../../src/features/street-leonida/walk-engine';

function district(coarsePointer = false) {
  const scene = new THREE.Scene();
  const collisions: AxisAlignedRectangle[] = [];
  createViceCityDistrict(scene, collisions, coarsePointer, {
    renderCatalanBoulevard: false,
  });
  scene.updateMatrixWorld(true);
  return { scene, collisions };
}
function feature(scene: THREE.Scene, name: string) {
  const object = scene.getObjectByName(name);
  if (!object) throw new Error(`Missing landmark ${name}`);
  return object;
}
function renderBudget(root: THREE.Object3D) {
  let calls = 0;
  let triangles = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    calls += Array.isArray(object.material) ? object.geometry.groups.length : 1;
    triangles +=
      ((object.geometry.index?.count ?? object.geometry.attributes.position!.count) / 3) *
      (object instanceof THREE.InstancedMesh ? object.count : 1);
  });
  return { calls, triangles };
}

describe('source-anchored landmark reconstruction', () => {
  it.each([false, true])(
    'keeps credible stepped hotel floors and the exact L32 arrival clear (touch=%s)',
    (touch) => {
      const { scene, collisions } = district(touch);
      const hotel = feature(scene, 'vice-city-hotel-waterfront');
      expect(hotel.position.x).toBe(3947);
      expect(hotel.position.z).toBe(-1474);
      const size = new THREE.Box3().setFromObject(hotel).getSize(new THREE.Vector3());
      expect(size.y).toBeGreaterThanOrEqual(26);
      expect(size.x).toBeGreaterThanOrEqual(28);
      const floors = hotel.getObjectByName('hotel-balconies') as THREE.InstancedMesh;
      expect(floors).toBeInstanceOf(THREE.InstancedMesh);
      const matrix = new THREE.Matrix4();
      const widths: number[] = [];
      const levels: number[] = [];
      for (let index = 0; index < floors.count; index++) {
        floors.getMatrixAt(index, matrix);
        widths.push(new THREE.Vector3().setFromMatrixScale(matrix).x);
        levels.push(new THREE.Vector3().setFromMatrixPosition(matrix).y);
      }
      expect(new Set(widths).size).toBeGreaterThanOrEqual(3);
      levels.sort((a, b) => a - b);
      for (let index = 1; index < levels.length; index++)
        expect(levels[index]! - levels[index - 1]!).toBeGreaterThanOrEqual(2.8);
      expect(collidesWithBuildings({ x: 3947, z: -1474 }, 0.8, collisions)).toBe(false);
      expect(renderBudget(hotel).calls).toBeLessThanOrEqual(32);
      expect(renderBudget(hotel).triangles).toBeLessThanOrEqual(30000);
    },
  );
  it('gives the arena a venue-scale faceted shell without blocking the existing 22m approach', () => {
    const { scene, collisions } = district();
    const arena = feature(scene, 'vice-city-arena');
    expect(arena.position.x).toBeCloseTo(-605.934670326028, 8);
    expect(arena.position.z).toBeCloseTo(-859.8548661295554, 8);
    const size = new THREE.Box3().setFromObject(arena).getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThanOrEqual(48);
    expect(size.y).toBeGreaterThanOrEqual(16);
    expect(size.z).toBeLessThan(40);
    const shell = arena.getObjectByName('sahara-arena-faceted-shell') as THREE.Mesh;
    expect(shell).toBeInstanceOf(THREE.Mesh);
    const normals = shell.geometry.getAttribute('normal');
    const uniqueNormals = new Set(
      Array.from(
        { length: normals.count },
        (_, i) =>
          `${normals.getX(i).toFixed(2)},${normals.getY(i).toFixed(2)},${normals.getZ(i).toFixed(2)}`,
      ),
    );
    expect(uniqueNormals.size).toBeGreaterThanOrEqual(12);
    expect(
      collidesWithBuildings({ x: arena.position.x, z: arena.position.z + 22 }, 0.8, collisions),
    ).toBe(false);
    expect(
      collidesWithBuildings({ x: arena.position.x + 18, z: arena.position.z }, 0.8, collisions),
    ).toBe(true);
    expect(renderBudget(arena).calls).toBeLessThanOrEqual(24);
    expect(renderBudget(arena).triangles).toBeLessThanOrEqual(18000);
  });
  it('keeps separate waterfront towers out of the supported Megamundo footprint', () => {
    const { scene } = district();
    const towers = feature(scene, 'vice-city-rounded-waterfront-towers');
    const central = new THREE.Box3().setFromObject(feature(scene, 'vice-city-megamundo-tower'));
    for (const name of ['vice-city-rounded-tower-1', 'vice-city-rounded-tower-2']) {
      const tower = towers.getObjectByName(name)!;
      const bounds = new THREE.Box3().setFromObject(tower);
      expect(bounds.intersectsBox(central)).toBe(false);
      expect(bounds.getSize(new THREE.Vector3()).x).toBeGreaterThan(12);
    }
  });
  it('keeps the anonymous Art Deco frontage outside the enlarged hotel and forecourt', () => {
    const { scene } = district();
    const hotel = new THREE.Box3().setFromObject(feature(scene, 'vice-city-hotel-waterfront'));
    const frontage = new THREE.Box3().setFromObject(feature(scene, 'vice-city-art-deco-strip'));
    expect(hotel.intersectsBox(frontage)).toBe(false);
    expect(frontage.min.x - hotel.max.x).toBeGreaterThan(8);
  });
});
