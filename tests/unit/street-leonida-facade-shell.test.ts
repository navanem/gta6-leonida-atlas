import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  createFacadeShellKit,
  type FacadeShellSpec,
} from '../../src/features/street-leonida/walk-facade-shell';

const facade: FacadeShellSpec = {
  position: [0, 0, 0],
  rotationY: 0,
  width: 12,
  height: 10.5,
  floors: 3,
  bayWidth: 4,
  seed: 0.42,
  style: 'coastal',
  color: 0xdac7b6,
};

function meshes(root: THREE.Object3D): THREE.InstancedMesh[] {
  const result: THREE.InstancedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) result.push(object);
  });
  return result;
}

describe('Recessed facade shells', () => {
  it('leaves real openings through the wall with interior planes behind structural jambs', () => {
    const kit = createFacadeShellKit();
    const resource = kit.create([facade], 'shell');
    resource.root.updateMatrixWorld(true);
    const interior = resource.root.getObjectByName('shell-interiors') as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    interior.getMatrixAt(4, matrix);
    const center = new THREE.Vector3().setFromMatrixPosition(matrix);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(center.x, center.y, 3),
      new THREE.Vector3(0, 0, -1),
    );
    const opening = ray.intersectObject(resource.root, true)[0]!;
    expect(opening.object).toBe(interior);
    expect(opening.point.z).toBeLessThanOrEqual(-0.28);
    ray.set(new THREE.Vector3(-5.95, center.y, 3), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(resource.root, true)[0]!.point.z).toBeCloseTo(0, 4);
    resource.dispose();
    kit.dispose();
  });

  it('uses opaque view-dependent room shading with shared material and bounded geometry', () => {
    const kit = createFacadeShellKit();
    const first = kit.create(
      [facade, { ...facade, position: [20, 0, 0], seed: 0.91, storefront: true }],
      'first',
    );
    const second = kit.create([{ ...facade, position: [40, 0, 0] }], 'second');
    const a = first.root.getObjectByName('first-interiors') as THREE.InstancedMesh;
    const b = second.root.getObjectByName('second-interiors') as THREE.InstancedMesh;
    expect(a.material).toBe(b.material);
    const material = a.material as THREE.MeshStandardMaterial;
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.customProgramCacheKey()).toContain('interior');
    expect(meshes(first.root).length).toBeLessThanOrEqual(12);
    const triangles = meshes(first.root).reduce(
      (sum, mesh) =>
        sum +
        ((mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3) *
          mesh.count,
      0,
    );
    expect(triangles).toBeLessThan(3500);
    expect(a.count).toBeGreaterThanOrEqual(18);
    first.dispose();
    second.dispose();
    kit.dispose();
  });

  it('keeps structural openings when decorative close detail is hidden and disposes instance buffers once', () => {
    const kit = createFacadeShellKit();
    const resource = kit.create([{ ...facade, balconies: true, storefront: true }], 'lod');
    const interior = resource.root.getObjectByName('lod-interiors') as THREE.InstancedMesh;
    const release = vi.spyOn(interior, 'dispose');
    const geometry = interior.geometry;
    resource.setDetail(false);
    expect(interior.visible).toBe(true);
    expect(interior.geometry).toBe(geometry);
    expect(resource.root.getObjectByName('lod-near')?.visible).toBe(false);
    resource.setDetail(true);
    expect(resource.root.getObjectByName('lod-near')?.visible).toBe(true);
    resource.dispose();
    resource.dispose();
    expect(release).toHaveBeenCalledOnce();
    kit.dispose();
  });
});
