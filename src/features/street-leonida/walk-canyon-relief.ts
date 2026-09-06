import * as THREE from 'three';
import { createNativeVegetation, type VegetationPlacement } from './walk-native-vegetation';

/** Local visual interpretation of the rock-cut reference; it does not change mapped elevations. */
export function createCanyonRelief(
  coarse: boolean,
  configureSurface?: (material: THREE.MeshStandardMaterial) => void,
  parcelClearings: readonly { x: number; z: number; width: number; depth: number }[] = [],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'kalaga-continuous-rock-ridges';
  group.userData.evidence = 'APPROXIMATE';
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const trees: VegetationPlacement[] = [];
  const columns = [0, 5, 8, 17, 30, 51, 85, 128];
  const rows = coarse ? 28 : 48;
  const color = new THREE.Color();
  for (const side of [-1, 1]) {
    const offset = positions.length / 3;
    for (let row = 0; row <= rows; row++) {
      const z = 75 - (row / rows) * 360;
      // The documented roadside shelter keeps its flat clearing.
      const clearing = side < 0 ? Math.exp(-Math.pow((z + 48) / 26, 2)) * 16 : 0;
      let inner = 17.5 + clearing + Math.sin(z * 0.022) * 2.5;
      // Keep each admitted trail parcel on flat ground. The plateau extends past
      // the lot before tapering into the ridge, so coarse triangles cannot bridge
      // across a building corner. These clearings remain approximate authoring.
      for (const parcel of parcelClearings) {
        if (Math.sign(parcel.x) !== side) continue;
        const beyondLot = Math.max(0, Math.abs(z - parcel.z) - parcel.depth / 2 - 14);
        const feather = 1 - THREE.MathUtils.smoothstep(beyondLot, 0, 26);
        const lotEdge = Math.abs(parcel.x) + parcel.width / 2 + 3;
        inner = Math.max(inner, THREE.MathUtils.lerp(inner, lotEdge, feather));
      }
      for (let col = 0; col < columns.length; col++) {
        const x = side * (inner + columns[col]!);
        const envelope = Math.min(1, columns[col]! / 15);
        const ridge = 29 + Math.sin(z * 0.033) * 8 + Math.sin(z * 0.113 + col * 1.9) * 3.4;
        const y = 0.045 + envelope * (ridge + col * 1.25);
        positions.push(x, y, z);
        uvs.push(Math.hypot(columns[col]!, y) / 6, z / 6);
        const moss = col > 3;
        color
          .setHex(moss ? 0x67704c : 0xa77c58)
          .multiplyScalar(0.8 + Math.sin(row * 9.7 + col * 1.3) * 0.12 + col * 0.025);
        colors.push(color.r, color.g, color.b);
        if (col >= 3 && col <= 6 && row % (coarse ? 4 : 3) === col % 3)
          trees.push([x, z, 8 + (row % 7), y]);
        if (row < rows && col < columns.length - 1) {
          const a = offset + row * columns.length + col,
            b = a + columns.length;
          if (side < 0) indices.push(a, a + 1, b, a + 1, b + 1, b);
          else indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.98,
    side: THREE.DoubleSide,
  });
  const ridges = new THREE.Mesh(geometry, material);
  ridges.name = 'kalaga-photographic-rock-face';
  configureSurface?.(material);
  ridges.castShadow = ridges.receiveShadow = true;
  group.add(ridges, createNativeVegetation('pine', trees, 'mid'));
  return group;
}
