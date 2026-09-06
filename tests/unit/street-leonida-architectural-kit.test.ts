import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createArchitecturalDetailKit } from '../../src/features/street-leonida/walk-architectural-kit';
import { collidesWithBuildings } from '../../src/features/street-leonida/walk-engine';

describe('batched architectural details', () => {
  it('rotates porch posts and their collisions together while retaining the central entry', () => {
    const kit = createArchitecturalDetailKit({
      palette: 'wetland',
      coarsePointer: false,
    });
    kit.addPorch({
      position: [10, 0.2, -20],
      rotationY: Math.PI / 2,
      width: 8,
      depth: 4,
      height: 3.2,
      railings: true,
    });
    const { group, collisions } = kit.finish();
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.min.x).toBeCloseTo(7.725, 3);
    expect(bounds.max.x).toBeCloseTo(12.275, 3);
    expect(bounds.min.z).toBeCloseTo(-24.275, 3);
    expect(bounds.max.z).toBeCloseTo(-15.725, 3);
    const rectangles = collisions.map((c) => ({
      minX: c.x - c.width / 2,
      maxX: c.x + c.width / 2,
      minZ: c.z - c.depth / 2,
      maxZ: c.z + c.depth / 2,
    }));
    expect(collidesWithBuildings({ x: 11.84, z: -23.84 }, 0, rectangles)).toBe(true);
    expect(collidesWithBuildings({ x: 12, z: -20 }, 0.8, rectangles)).toBe(false);
    for (const rect of rectangles) {
      expect(rect.minX).toBeGreaterThanOrEqual(bounds.min.x);
      expect(rect.maxX).toBeLessThanOrEqual(bounds.max.x);
      expect(rect.minZ).toBeGreaterThanOrEqual(bounds.min.z);
      expect(rect.maxZ).toBeLessThanOrEqual(bounds.max.z);
    }
  });
  it('builds pitched roof slopes with real rise, aligned ridge and finite bounds', () => {
    const kit = createArchitecturalDetailKit({
      palette: 'mountain',
      coarsePointer: false,
    });
    kit.addPitchedRoof({ position: [0, 4, 0], width: 12, depth: 8, rise: 2.5 });
    const { group, collisions } = kit.finish();
    const roof = group.getObjectByName('architecture-kit-roof') as THREE.InstancedMesh;
    expect(roof.count).toBe(2);
    const matrix = new THREE.Matrix4();
    const first = new THREE.Vector3();
    const second = new THREE.Vector3();
    roof.getMatrixAt(0, matrix);
    first.setFromMatrixPosition(matrix);
    roof.getMatrixAt(1, matrix);
    second.setFromMatrixPosition(matrix);
    expect(first.y).toBeCloseTo(5.25, 4);
    expect(second.y).toBeCloseTo(5.25, 4);
    expect(first.z).toBeCloseTo(-2.15, 4);
    expect(second.z).toBeCloseTo(2.15, 4);
    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.max.y).toBeGreaterThan(6.5);
    expect(bounds.max.y).toBeLessThan(6.8);
    expect(bounds.min.y).toBeGreaterThan(3.7);
    expect(collisions).toEqual([]);
  });
  it('batches a full frontage into shared geometry instead of adding one draw per detail', () => {
    const kit = createArchitecturalDetailKit({
      palette: 'weathered',
      coarsePointer: false,
    });
    for (let i = 0; i < 20; i++) {
      kit.addStorefront({ position: [i * 18, 0, 0], width: 12, height: 3.5 });
      kit.addPorch({
        position: [i * 18, 0.2, 8],
        width: 12,
        depth: 3,
        height: 3.5,
        railings: true,
      });
      kit.addPitchedRoof({
        position: [i * 18, 4, -4],
        width: 12,
        depth: 8,
        rise: 2,
      });
      kit.addRoofEquipment({ position: [i * 18, 7, -4], width: 8, depth: 5 });
    }
    const { group } = kit.finish();
    const meshes = group.children as THREE.InstancedMesh[];
    expect(meshes.every((mesh) => mesh instanceof THREE.InstancedMesh)).toBe(true);
    expect(meshes.length).toBeLessThanOrEqual(7);
    expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBe(1);
    expect(meshes.reduce((n, mesh) => n + mesh.count, 0)).toBeLessThan(4000);
    expect(meshes.every((mesh) => Number.isFinite(mesh.boundingSphere!.radius))).toBe(true);
    expect(kit.finish().group).toBe(group);
    expect(() => kit.addRoofEquipment({ position: [0, 0, 0], width: 8, depth: 4 })).toThrow(
      /already attached/,
    );
  });
  it('rejects non-finite dimensions before they can poison region culling bounds', () => {
    const kit = createArchitecturalDetailKit({
      palette: 'coastal',
      coarsePointer: true,
    });
    expect(() => kit.addStorefront({ position: [0, 0, 0], width: Infinity, height: 3 })).toThrow(
      RangeError,
    );
    expect(() => kit.addPorch({ position: [NaN, 0, 0], width: 8, height: 3, depth: 2 })).toThrow(
      RangeError,
    );
    expect(kit.finish().group.children).toHaveLength(0);
  });
});
