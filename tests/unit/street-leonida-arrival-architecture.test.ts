import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addArrivalArchitecture } from '../../src/features/street-leonida/walk-arrival-architecture';
import { addRegionalArrivalForeground } from '../../src/features/street-leonida/walk-regional-arrivals';
import { collidesWithBuildings } from '../../src/features/street-leonida/walk-engine';
import type { WalkRenderRegion } from '../../src/features/street-leonida/walk-region-streaming';

const renderer = { capabilities: { getMaxAnisotropy: () => 8 } } as THREE.WebGLRenderer;
const regions: WalkRenderRegion[] = [
  'leonida-keys',
  'grassrivers',
  'port-gellhorn',
  'ambrosia',
  'mount-kalaga',
];
describe('arrival architecture attached to existing footprints', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(() => new THREE.Texture());
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(regions)('%s adds batched geometry and keeps the full entry road clear', (region) => {
    for (const coarse of [false, true]) {
      const feature = addRegionalArrivalForeground(
        new THREE.Group(),
        [],
        region,
        coarse,
        renderer,
      )!;
      const origin = feature.position.clone();
      const rotation = feature.rotation.y;
      const result = addArrivalArchitecture(feature, region, coarse);
      const details = feature.getObjectByName(`${region}-arrival-architecture`)!;
      expect(details).toBeDefined();
      expect(feature.position.equals(origin)).toBe(true);
      expect(feature.rotation.y).toBe(rotation);
      expect(details.userData.evidence).toBe('APPROXIMATE');
      const meshes: THREE.InstancedMesh[] = [];
      details.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) meshes.push(object);
      });
      expect(meshes.length).toBeGreaterThan(2);
      expect(meshes.length).toBeLessThanOrEqual(7);
      expect(meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBeLessThan(600);
      expect(meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBeGreaterThan(25);
      expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBe(1);
      expect(result.collisions.length).toBeGreaterThan(0);
      const roadHalfWidth = region === 'port-gellhorn' ? 9 : region === 'ambrosia' ? 7.5 : 7;
      for (let z = 10; z > -250; z -= 2) {
        for (const x of [-roadHalfWidth, 0, roadHalfWidth])
          expect(collidesWithBuildings({ x, z }, 0.5, result.collisions)).toBe(false);
      }
      expect(addArrivalArchitecture(feature, region, coarse)).toBe(result);
      feature.dispose();
    }
  });

  it('sets the stilt porch at the existing deck height and keeps its central doorway open', () => {
    const feature = addRegionalArrivalForeground(
      new THREE.Group(),
      [],
      'grassrivers',
      false,
      renderer,
    )!;
    const { collisions } = addArrivalArchitecture(feature, 'grassrivers', false);
    const details = feature.getObjectByName('grassrivers-arrival-architecture')!;
    const frame = details.getObjectByName('architecture-kit-frame') as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    let campPosts = 0;
    for (let index = 0; index < frame.count; index++) {
      frame.getMatrixAt(index, matrix);
      matrix.decompose(position, new THREE.Quaternion(), scale);
      if (position.x > 16 && position.x < 24 && position.z > -58 && scale.y > 2) {
        expect(position.y - scale.y / 2).toBeCloseTo(3.4, 4);
        campPosts++;
      }
    }
    expect(campPosts).toBeGreaterThanOrEqual(4);
    expect(collidesWithBuildings({ x: 20, z: -55.4 }, 0.8, collisions)).toBe(false);
    feature.dispose();
  });

  it('does not create a duplicate architecture layer in Vice City', () => {
    const feature = new THREE.Group();
    expect(addArrivalArchitecture(feature, 'vice-city', false).collisions).toEqual([]);
    expect(feature.children).toHaveLength(0);
  });
});
