import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createPedestrianLibrary } from '../../src/features/street-leonida/walk-pedestrians';

const point = (root: THREE.Object3D, name: string) => {
  root.updateMatrixWorld(true);
  const bone = root.getObjectByName(name);
  if (!bone) throw new Error(`Missing articulated joint ${name}`);
  return bone.getWorldPosition(new THREE.Vector3());
};

describe('anatomical pedestrians', () => {
  it('renders a human-sized complete silhouette in one bounded skinned draw', () => {
    const library = createPedestrianLibrary();
    for (const detail of ['near', 'mid'] as const) {
      const actor = library.create({ variant: 2, height: 1.78, detail });
      const meshes: THREE.Mesh[] = [];
      actor.root.traverse((object) => {
        if (object instanceof THREE.Mesh) meshes.push(object);
      });
      expect(meshes).toEqual([actor.mesh]);
      expect(actor.mesh).toBeInstanceOf(THREE.SkinnedMesh);
      actor.mesh.computeBoundingBox();
      const bounds = actor.mesh.boundingBox!;
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.002);
      expect(bounds.max.y).toBeGreaterThan(1.65);
      expect(bounds.max.y).toBeLessThan(1.95);
      expect(bounds.getSize(new THREE.Vector3()).x).toBeGreaterThan(0.45);
      expect((actor.mesh.geometry.index?.count ?? 0) / 3).toBeLessThanOrEqual(
        detail === 'near' ? 1800 : 460,
      );
      for (const side of ['left', 'right']) {
        const wrist = point(actor.root, `${side}-wrist`);
        const ankle = point(actor.root, `${side}-ankle`);
        expect(wrist.y).toBeGreaterThan(0.75);
        expect(wrist.y).toBeLessThan(1.15);
        expect(ankle.y).toBeCloseTo((0.065 * 1.78) / 1.8, 3);
      }
      const material = actor.mesh.material as THREE.MeshStandardMaterial;
      expect(material.emissive.getHex()).toBe(0);
      expect(material.metalness).toBe(0);
      expect(material.roughness).toBeGreaterThan(0.75);
    }
    library.dispose();
  });

  it('shares geometry within a library but isolates independently unloadable regions', () => {
    const a = createPedestrianLibrary();
    const b = createPedestrianLibrary();
    const first = a.create({ variant: 1 });
    const second = a.create({ variant: 1 });
    const neighbour = b.create({ variant: 1 });
    expect(first.mesh.geometry).toBe(second.mesh.geometry);
    expect(first.mesh.skeleton).not.toBe(second.mesh.skeleton);
    expect(first.mesh.geometry).not.toBe(neighbour.mesh.geometry);
    const geometryDisposed = vi.fn();
    const neighbourDisposed = vi.fn();
    first.mesh.geometry.addEventListener('dispose', geometryDisposed);
    neighbour.mesh.geometry.addEventListener('dispose', neighbourDisposed);
    const skeletonDisposed = vi.spyOn(first.mesh.skeleton, 'dispose');
    first.dispose();
    expect(skeletonDisposed).toHaveBeenCalledTimes(1);
    expect(geometryDisposed).not.toHaveBeenCalled();
    a.dispose();
    a.dispose();
    expect(skeletonDisposed).toHaveBeenCalledTimes(1);
    expect(geometryDisposed).toHaveBeenCalledTimes(1);
    expect(neighbourDisposed).not.toHaveBeenCalled();
    neighbour.update({
      elapsedSeconds: 1,
      distanceMetres: 0.3,
      speedMetresPerSecond: 1,
    });
    expect(Number.isFinite(point(neighbour.root, 'left-ankle').y)).toBe(true);
    b.dispose();
  });

  it('plants the stance foot in world space while the body travels forward', () => {
    const library = createPedestrianLibrary();
    const actor = library.create({ variant: 0, height: 1.8, pose: 'walk' });
    actor.root.position.y = 0.32;
    actor.update({
      elapsedSeconds: 1,
      distanceMetres: 0.12,
      speedMetresPerSecond: 1,
    });
    const before = point(actor.root, 'left-ankle');
    actor.root.position.z -= 0.04;
    actor.update({
      elapsedSeconds: 1.04,
      distanceMetres: 0.16,
      speedMetresPerSecond: 1,
    });
    const after = point(actor.root, 'left-ankle');
    expect(after.z).toBeCloseTo(before.z, 4);
    expect(after.y).toBeCloseTo(0.385, 4);
    for (let index = 0; index < 60; index++) {
      actor.update({
        elapsedSeconds: index / 30,
        distanceMetres: index / 60,
        speedMetresPerSecond: 1,
      });
      const feet = ['left', 'right'].map((side) => point(actor.root, `${side}-ankle`).y);
      expect(Math.min(...feet)).toBeCloseTo(0.385, 4);
      expect(Math.min(...feet)).toBeGreaterThanOrEqual(0.384);
    }
    library.dispose();
  });

  it('drives walking from distance rather than making paused people walk in place', () => {
    const library = createPedestrianLibrary();
    const actor = library.create({ pose: 'walk' });
    actor.update({
      elapsedSeconds: 0,
      distanceMetres: 0.24,
      speedMetresPerSecond: 1,
    });
    const foot = point(actor.root, 'right-ankle');
    actor.update({
      elapsedSeconds: 20,
      distanceMetres: 0.24,
      speedMetresPerSecond: 1,
    });
    expect(point(actor.root, 'right-ankle').distanceTo(foot)).toBeLessThan(0.00001);
    actor.update({
      elapsedSeconds: 20,
      distanceMetres: 0.42,
      speedMetresPerSecond: 1,
    });
    expect(point(actor.root, 'right-ankle').distanceTo(foot)).toBeGreaterThan(0.08);
    library.dispose();
  });

  it('changes real body geometry and clothing colors between deterministic variants', () => {
    const library = createPedestrianLibrary();
    const a = library.create({ variant: 0 });
    const b = library.create({ variant: 3 });
    expect(Array.from(a.mesh.geometry.getAttribute('position').array)).not.toEqual(
      Array.from(b.mesh.geometry.getAttribute('position').array),
    );
    expect(Array.from(a.mesh.geometry.getAttribute('color').array)).not.toEqual(
      Array.from(b.mesh.geometry.getAttribute('color').array),
    );
    const weights = a.mesh.geometry.getAttribute('skinWeight');
    for (let index = 0; index < weights.count; index++) {
      expect(
        weights.getX(index) + weights.getY(index) + weights.getZ(index) + weights.getW(index),
      ).toBeCloseTo(1, 5);
    }
    library.dispose();
  });
});
