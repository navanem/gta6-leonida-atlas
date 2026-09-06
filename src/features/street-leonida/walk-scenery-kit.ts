import * as THREE from "three";
import type { AxisAlignedRectangle } from "./walk-engine";

export type ScenerySurface =
  | "plaster"
  | "concrete"
  | "wood"
  | "metal"
  | "glass"
  | "ground"
  | "accent"
  | "canvas";
export type SceneryMaterials = Record<
  ScenerySurface,
  THREE.MeshStandardMaterial
>;
type Vec3 = readonly [number, number, number];
type Shape = "box" | "pipe" | "hull";

function createHull(): THREE.BufferGeometry {
  const vertices: number[] = [],
    indices: number[] = [];
  // Three closed V-hull rings: a narrow submerged keel, chine and broad gunwale.
  for (let ring = 0; ring < 3; ring++)
    for (let index = 0; index < 12; index++) {
      const angle = (index * Math.PI) / 6;
      const radius = [0.3, 0.78, 1][ring]!;
      const z = Math.cos(angle) * 0.5;
      const bowTaper = z > 0 ? 1 - z * 0.65 : 1;
      vertices.push(
        Math.sin(angle) * 0.5 * radius * bowTaper,
        ring * 0.5 - 0.5,
        z * (ring === 0 ? 0.8 : 1),
      );
    }
  for (let ring = 0; ring < 2; ring++)
    for (let i = 0; i < 12; i++) {
      const a = ring * 12 + i,
        b = ring * 12 + ((i + 1) % 12),
        c = a + 12,
        d = b + 12;
      indices.push(a, b, c, b, d, c);
    }
  for (let i = 1; i < 11; i++) {
    indices.push(0, i + 1, i);
    indices.push(24, 24 + i, 25 + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Region-owned instancing across complete parcels, with source materials shared by reference. */
export function createSceneryKit(source: Partial<SceneryMaterials> = {}) {
  const batches = new Map<
    string,
    {
      shape: Shape;
      surface: ScenerySurface;
      matrices: THREE.Matrix4[];
      colors: number[];
    }
  >();
  const collisions: AxisAlignedRectangle[] = [];
  let finished:
    false | { group: THREE.Group; collisions: AxisAlignedRectangle[] } = false;
  function add(
    shape: Shape,
    surface: ScenerySurface,
    position: Vec3,
    size: Vec3,
    rotation: THREE.Quaternion,
    solid = false,
    color = 0xffffff,
  ) {
    if (finished) throw new Error("Scenery kit is already attached.");
    if (
      ![...position, ...size].every(Number.isFinite) ||
      size.some((n) => n <= 0)
    )
      throw new RangeError("Invalid scenery transform.");
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      rotation,
      new THREE.Vector3(...size),
    );
    const key = `${shape}-${surface}`;
    const batch = batches.get(key) ?? {
      shape,
      surface,
      matrices: [],
      colors: [],
    };
    batch.matrices.push(matrix);
    batch.colors.push(color);
    batches.set(key, batch);
    if (solid) {
      const bounds = new THREE.Box3(
        new THREE.Vector3(-0.5, -0.5, -0.5),
        new THREE.Vector3(0.5, 0.5, 0.5),
      ).applyMatrix4(matrix);
      collisions.push({
        minX: bounds.min.x,
        maxX: bounds.max.x,
        minZ: bounds.min.z,
        maxZ: bounds.max.z,
      });
    }
  }
  const yaw = (angle: number) =>
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  function box(
    surface: ScenerySurface,
    position: Vec3,
    size: Vec3,
    rotationY = 0,
    solid = false,
    color = 0xffffff,
  ) {
    add("box", surface, position, size, yaw(rotationY), solid, color);
  }
  function beam(
    surface: ScenerySurface,
    start: Vec3,
    end: Vec3,
    width: number,
    color = 0xffffff,
    round = false,
  ) {
    const a = new THREE.Vector3(...start),
      b = new THREE.Vector3(...end),
      delta = b.clone().sub(a);
    const center = a.add(b).multiplyScalar(0.5);
    add(
      round ? "pipe" : "box",
      surface,
      center.toArray(),
      [width, delta.length(), width],
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize(),
      ),
      false,
      color,
    );
  }
  function roof(position: Vec3, width: number, depth: number, rise: number) {
    // A timber ridge and exposed rafters support the two genuinely sloping sheets.
    const [x, y, z] = position;
    for (const side of [-1, 1]) {
      add(
        "box",
        "metal",
        [x, y + rise / 2, z + (side * depth) / 4],
        [width + 0.6, 0.13, Math.hypot(depth / 2, rise)],
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          side * Math.atan2(rise, depth / 2),
        ),
      );
      for (let xx = -width / 2; xx <= width / 2; xx += 2.4)
        beam(
          "wood",
          [x + xx, y + rise - 0.13, z],
          [x + xx, y - 0.13, z + (side * depth) / 2],
          0.14,
        );
    }
    beam(
      "wood",
      [x - width / 2, y + rise - 0.2, z],
      [x + width / 2, y + rise - 0.2, z],
      0.18,
    );
  }
  function finish() {
    if (finished) return finished;
    const group = new THREE.Group();
    const geometries: Partial<Record<Shape, THREE.BufferGeometry>> = {};
    const materials: Partial<SceneryMaterials> = { ...source };
    const colors: Record<ScenerySurface, number> = {
      plaster: 0xe3d4bc,
      concrete: 0xb9b5a8,
      wood: 0x91816a,
      metal: 0x64716e,
      glass: 0x284b59,
      ground: 0xa7a28b,
      accent: 0x5c9892,
      canvas: 0xc8ac76,
    };
    for (const [key, batch] of batches) {
      const geometry =
        geometries[batch.shape] ??
        (geometries[batch.shape] =
          batch.shape === "box"
            ? new THREE.BoxGeometry(1, 1, 1)
            : batch.shape === "pipe"
              ? new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
              : createHull());
      const material =
        materials[batch.surface] ??
        (materials[batch.surface] = new THREE.MeshStandardMaterial({
          color: colors[batch.surface],
          roughness: batch.surface === "glass" ? 0.22 : 0.85,
          metalness: batch.surface === "metal" ? 0.35 : 0,
        }));
      const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        batch.matrices.length,
      );
      mesh.name = `scenery-${key}`;
      for (let i = 0; i < batch.matrices.length; i++) {
        mesh.setMatrixAt(i, batch.matrices[i]!);
        mesh.setColorAt(i, new THREE.Color(batch.colors[i]!));
      }
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    finished = { group, collisions };
    return finished;
  }
  return {
    box,
    beam,
    roof,
    hull: (position: Vec3, size: Vec3, rotationY = 0) =>
      add("hull", "plaster", position, size, yaw(rotationY)),
    finish,
  };
}
