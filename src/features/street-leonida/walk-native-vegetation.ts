import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type NativeVegetationKind = 'palm' | 'cypress' | 'pine' | 'cane';
export type VegetationPlacement = readonly [x: number, z: number, height: number, groundY?: number];

function leafGeometry(kind: NativeVegetationKind, detail: 'near' | 'mid'): THREE.BufferGeometry {
  const vertices: number[] = [];
  const triangle = (a: number[], b: number[], c: number[]) => vertices.push(...a, ...b, ...c);
  const leaf = (origin: THREE.Vector3, direction: THREE.Vector3, width: number) => {
    const side = new THREE.Vector3(-direction.z, 0, direction.x).normalize().multiplyScalar(width);
    // Vary leaf normals so the crown remains visible at pedestrian eye height.
    side.applyAxisAngle(
      direction.clone().normalize(),
      Math.sin(origin.x * 437 + origin.y * 193 + origin.z * 283) * 1.25,
    );
    const middle = origin.clone().addScaledVector(direction, 0.48);
    const tip = origin.clone().add(direction);
    const ridge = middle.clone().add(new THREE.Vector3(0, width * 0.28, 0));
    const l = middle.clone().add(side),
      r = middle.clone().sub(side);
    triangle(origin.toArray(), l.toArray(), ridge.toArray());
    triangle(origin.toArray(), ridge.toArray(), r.toArray());
    triangle(l.toArray(), tip.toArray(), ridge.toArray());
    triangle(ridge.toArray(), tip.toArray(), r.toArray());
  };
  if (kind === 'palm') {
    for (let frond = 0; frond < 11; frond++) {
      const angle = frond * 2.39996;
      const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      for (let station = 1; station <= 16; station++) {
        const t = station / 17;
        const center = radial.clone().multiplyScalar(t * 0.38);
        center.y = 0.84 + Math.sin(t * Math.PI) * 0.105 - t * t * 0.075;
        for (const side of [-1, 1]) {
          const spread = new THREE.Vector3(-radial.z * side, -0.022, radial.x * side);
          spread.multiplyScalar(Math.sin(t * Math.PI) * 0.115);
          spread.addScaledVector(radial, 0.026);
          leaf(center, spread, 0.014 * Math.sin(t * Math.PI) + 0.002);
        }
      }
    }
  } else if (kind === 'cane') {
    for (let stalk = 0; stalk < 9; stalk++) {
      const a = stalk * 2.4;
      for (let level = 0; level < 5; level++) {
        const y = 0.28 + level * 0.13;
        leaf(
          new THREE.Vector3(Math.cos(a) * 0.065, y, Math.sin(a) * 0.065),
          new THREE.Vector3(Math.cos(a + level) * 0.22, 0.15, Math.sin(a + level) * 0.22),
          0.013,
        );
      }
    }
  } else {
    for (let cluster = 0; cluster < 22; cluster++) {
      const a = cluster * 2.39996;
      const y = 0.36 + (cluster / 22) * 0.59;
      const radius = kind === 'pine' ? (1 - y) * 0.37 : Math.sin((y - 0.25) * Math.PI) * 0.23;
      const center = new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius);
      for (let n = 0; n < (detail === 'near' ? 64 : 24); n++) {
        const b = n * 2.39996 + a;
        const seed = Math.sin(cluster * 91.7 + n * 27.1) * 0.5 + 0.5;
        const origin = center
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(b) * seed * 0.09,
              (seed - 0.5) * 0.11,
              Math.sin(b) * seed * 0.09,
            ),
          );
        leaf(
          origin,
          new THREE.Vector3(Math.cos(b) * 0.055, (seed - 0.3) * 0.045, Math.sin(b) * 0.055),
          kind === 'pine' ? 0.021 : 0.028,
        );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Native geometry at pedestrian distance; photographic impostors remain in the distant region layer. */
export function createNativeVegetation(
  kind: NativeVegetationKind,
  positions: readonly VegetationPlacement[],
  detail: 'near' | 'mid' = 'near',
): THREE.Group {
  const group = new THREE.Group();
  group.name = `walk-native-${kind}`;
  if (!positions.length) return group;
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(
    kind === 'palm' ? 0.012 : 0.008,
    kind === 'cypress' ? 0.04 : 0.022,
    kind === 'palm' ? 0.84 : 0.91,
    7,
    3,
  );
  trunk.translate(0, kind === 'palm' ? 0.42 : 0.455, 0);
  parts.push(trunk);
  if (kind === 'cypress' || kind === 'pine') {
    for (let i = 0; i < 10; i++) {
      const branch = new THREE.CylinderGeometry(0.002, 0.008, 0.2, 5);
      branch.rotateZ(Math.PI / 3);
      branch.translate(0.075, 0.38 + i * 0.048, 0);
      branch.rotateY(i * 2.4);
      parts.push(branch);
    }
  }
  const wood = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  const foliage = leafGeometry(kind, detail);
  const bark = new THREE.MeshStandardMaterial({
    color: kind === 'palm' ? 0x84745b : 0x686354,
    roughness: 0.96,
  });
  const green = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });
  const stems = new THREE.InstancedMesh(wood, bark, positions.length);
  const crowns = new THREE.InstancedMesh(foliage, green, positions.length);
  stems.name = `${kind}-tapered-trunks`;
  crowns.name = `${kind}-individual-leaves`;
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  positions.forEach(([x, z, height, groundY], index) => {
    transform.position.set(x, groundY ?? 0.055, z);
    transform.rotation.set(0, index * 2.39996, kind === 'palm' ? Math.sin(index * 4.7) * 0.045 : 0);
    transform.scale.setScalar(height);
    transform.updateMatrix();
    stems.setMatrixAt(index, transform.matrix);
    crowns.setMatrixAt(index, transform.matrix);
    color.setHSL(
      kind === 'cypress' ? 0.24 : 0.26,
      0.24 + (index % 4) * 0.045,
      0.18 + (index % 5) * 0.017,
    );
    crowns.setColorAt(index, color);
  });
  stems.castShadow = crowns.castShadow = true;
  stems.receiveShadow = crowns.receiveShadow = true;
  stems.computeBoundingSphere();
  crowns.computeBoundingSphere();
  group.add(stems, crowns);
  return group;
}
