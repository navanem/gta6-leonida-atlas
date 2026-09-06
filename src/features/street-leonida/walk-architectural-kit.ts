import * as THREE from 'three';

type Vec3 = readonly [number, number, number];
export type ArchitecturalPalette = 'coastal' | 'weathered' | 'industrial' | 'wetland' | 'mountain';
interface Placement {
  position: Vec3;
  rotationY?: number;
}
export interface PorchDetail extends Placement {
  width: number;
  depth: number;
  height: number;
  railings?: boolean;
}
export interface StorefrontDetail extends Placement {
  width: number;
  height: number;
  canopyDepth?: number;
}
export interface PitchedRoofDetail extends Placement {
  width: number;
  depth: number;
  rise: number;
}
export interface RoofEquipmentDetail extends Placement {
  width: number;
  depth: number;
}
export interface ArchitecturalCollision {
  x: number;
  z: number;
  width: number;
  depth: number;
}
export interface ArchitecturalKitResult {
  group: THREE.Group;
  collisions: ArchitecturalCollision[];
}
type Surface = 'plaster' | 'frame' | 'glass' | 'roof' | 'metal' | 'accent' | 'timber';
const COLORS: Record<ArchitecturalPalette, Record<Surface, number>> = {
  coastal: {
    plaster: 0xe8e3d3,
    frame: 0xe2ded2,
    glass: 0x315967,
    roof: 0x6b9090,
    metal: 0x65767b,
    accent: 0x4d9696,
    timber: 0xa69d7c,
  },
  weathered: {
    plaster: 0xbeb5a2,
    frame: 0xcac3ae,
    glass: 0x394d50,
    roof: 0x73695a,
    metal: 0x666760,
    accent: 0xa26e68,
    timber: 0x82735a,
  },
  industrial: {
    plaster: 0xb6b4a9,
    frame: 0x777d7b,
    glass: 0x355360,
    roof: 0x667576,
    metal: 0x657078,
    accent: 0xb49552,
    timber: 0x82735a,
  },
  wetland: {
    plaster: 0x9b9f8c,
    frame: 0x858b74,
    glass: 0x324749,
    roof: 0x697d78,
    metal: 0x667068,
    accent: 0x6b8a7c,
    timber: 0x7d765d,
  },
  mountain: {
    plaster: 0xb9ae96,
    frame: 0x8e8166,
    glass: 0x3a5356,
    roof: 0x697374,
    metal: 0x67716d,
    accent: 0x64796b,
    timber: 0x847355,
  },
};

/**
 * Region-owned, local-coordinate architectural detail. Front is +Z. The caller
 * supplies an existing footprint; this kit never invents a landmark position.
 * Repeated details share one box geometry and at most seven material batches.
 */
export function createArchitecturalDetailKit(options: {
  palette: ArchitecturalPalette;
  coarsePointer: boolean;
}) {
  const batches = new Map<Surface, THREE.Matrix4[]>();
  const collisions: ArchitecturalCollision[] = [];
  let result: ArchitecturalKitResult | undefined;
  let count = 0;
  const rotation = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  function pose(spec: Placement, dimensions: readonly number[]) {
    if (result) throw new Error('Architectural kit is already attached.');
    if (
      ![...spec.position, spec.rotationY ?? 0].every(Number.isFinite) ||
      !dimensions.every((n) => Number.isFinite(n) && n > 0)
    )
      throw new RangeError('Architectural dimensions and placement must be finite and positive.');
    return new THREE.Matrix4().compose(
      new THREE.Vector3(...spec.position),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotationY ?? 0),
      new THREE.Vector3(1, 1, 1),
    );
  }
  function box(
    surface: Surface,
    placement: THREE.Matrix4,
    center: Vec3,
    size: Vec3,
    pitch = 0,
    yaw = 0,
    solid = false,
  ) {
    if (++count > 8000)
      throw new RangeError('Architectural kit exceeds its regional instance budget.');
    rotation.set(pitch, yaw, 0);
    quaternion.setFromEuler(rotation);
    const matrix = new THREE.Matrix4()
      .compose(position.set(...center), quaternion, scale.set(...size))
      .premultiply(placement);
    const batch = batches.get(surface) ?? [];
    batch.push(matrix);
    batches.set(surface, batch);
    if (solid) {
      const bounds = new THREE.Box3(
        new THREE.Vector3(-0.5, -0.5, -0.5),
        new THREE.Vector3(0.5, 0.5, 0.5),
      ).applyMatrix4(matrix);
      collisions.push({
        x: (bounds.min.x + bounds.max.x) / 2,
        z: (bounds.min.z + bounds.max.z) / 2,
        width: bounds.max.x - bounds.min.x,
        depth: bounds.max.z - bounds.min.z,
      });
    }
  }
  function porch(spec: PorchDetail) {
    const placement = pose(spec, [spec.width, spec.depth, spec.height]);
    const { width: w, depth: d, height: h } = spec;
    box('timber', placement, [0, -0.09, 0], [w, 0.18, d]);
    box('roof', placement, [0, h, 0], [w + 0.55, 0.18, d + 0.55]);
    box('accent', placement, [0, h - 0.2, d / 2 + 0.12], [w + 0.3, 0.35, 0.16]);
    const posts = Math.max(2, Math.min(12, Math.ceil(w / 4) + 1));
    for (let i = 0; i < posts; i++) {
      const x = -w / 2 + 0.16 + (i * (w - 0.32)) / (posts - 1);
      // Preserve a human-width central entry; do not place a post in its opening.
      if (Math.abs(x) < 1.05 && posts > 2) continue;
      for (const side of [-1, 1])
        box('frame', placement, [x, h / 2, side * (d / 2 - 0.16)], [0.17, h, 0.17], 0, 0, true);
    }
    const rafters = options.coarsePointer ? 4 : 7;
    for (let i = 0; i < rafters; i++)
      box(
        'timber',
        placement,
        [-w / 2 + 0.25 + (i * (w - 0.5)) / (rafters - 1), h - 0.23, 0],
        [0.1, 0.2, d + 0.45],
      );
    if (spec.railings) {
      for (const side of [-1, 1]) {
        box('frame', placement, [side * (w / 2 - 0.08), 0.65, 0], [0.1, 1.15, d], 0, 0, true);
        const span = Math.max(0.2, (w - 2.2) / 2);
        const x = side * (1.1 + span / 2);
        for (const y of [0.22, 1.1])
          box('frame', placement, [x, y, d / 2 - 0.1], [span, 0.09, 0.1]);
        const uprightCount = Math.max(
          2,
          Math.min(20, Math.ceil(span / (options.coarsePointer ? 1.05 : 0.65))),
        );
        for (let i = 0; i < uprightCount; i++)
          box(
            'frame',
            placement,
            [x - span / 2 + (i * span) / (uprightCount - 1), 0.65, d / 2 - 0.1],
            [0.07, 0.94, 0.07],
          );
        box('frame', placement, [x, 0.65, d / 2 - 0.1], [span, 0.05, 0.1], 0, 0, true);
      }
    }
  }
  function storefront(spec: StorefrontDetail) {
    const placement = pose(spec, [spec.width, spec.height, spec.canopyDepth ?? 1.3]);
    const { width: w, height: h } = spec;
    const doorHeight = Math.min(2.45, h - 0.65);
    const bayHeight = doorHeight - 0.35;
    const columns = Math.max(
      1,
      Math.min(12, Math.floor((w - 1.8) / (options.coarsePointer ? 6 : 4))),
    );
    const sideWidth = Math.max(0.4, (w - 1.8) / 2);
    const bayWidth = sideWidth / columns;
    box('glass', placement, [0, doorHeight / 2, -0.09], [1.3, doorHeight, 0.12]);
    for (const x of [-0.71, 0.71])
      box('frame', placement, [x, doorHeight / 2, 0.01], [0.1, doorHeight + 0.1, 0.18]);
    box('frame', placement, [0, doorHeight + 0.06, 0.01], [1.5, 0.12, 0.18]);
    box('metal', placement, [0.43, 1.05, 0.11], [0.045, 0.46, 0.045]);
    for (const side of [-1, 1])
      for (let i = 0; i < columns; i++) {
        const x = side * (0.9 + bayWidth * (i + 0.5));
        box(
          'glass',
          placement,
          [x, 0.35 + bayHeight / 2, -0.08],
          [bayWidth - 0.13, bayHeight, 0.1],
        );
        box('plaster', placement, [x, 0.16, 0], [bayWidth, 0.3, 0.3]);
        for (const dx of [-bayWidth / 2, bayWidth / 2])
          box(
            'frame',
            placement,
            [x + dx, doorHeight / 2 + 0.12, 0.025],
            [0.09, doorHeight + 0.3, 0.22],
          );
        box('frame', placement, [x, 0.4, 0.06], [bayWidth, 0.1, 0.32]);
      }
    const canopy = spec.canopyDepth ?? 1.3;
    box('accent', placement, [0, h - 0.42, 0.13], [w + 0.25, 0.65, 0.24]);
    box('roof', placement, [0, h - 0.8, canopy / 2], [w + 0.3, 0.12, canopy], 0.12);
    box('frame', placement, [0, h - 0.93, canopy], [w + 0.3, 0.2, 0.09]);
  }
  function pitchedRoof(spec: PitchedRoofDetail) {
    const placement = pose(spec, [spec.width, spec.depth, spec.rise]);
    const halfDepth = spec.depth / 2 + 0.3;
    const slope = Math.atan2(spec.rise, halfDepth);
    const length = Math.hypot(halfDepth, spec.rise);
    for (const side of [-1, 1]) {
      box(
        'roof',
        placement,
        [0, spec.rise / 2, (side * halfDepth) / 2],
        [spec.width + 0.6, 0.14, length],
        side * slope,
      );
      box('frame', placement, [0, -0.05, side * halfDepth], [spec.width + 0.65, 0.22, 0.12]);
      const seams = options.coarsePointer ? 5 : 9;
      for (let i = 0; i < seams; i++)
        box(
          'metal',
          placement,
          [
            -spec.width / 2 + (i * spec.width) / (seams - 1),
            spec.rise / 2 + 0.085,
            (side * halfDepth) / 2,
          ],
          [0.04, 0.035, length],
          side * slope,
        );
      for (const end of [-1, 1])
        box(
          'timber',
          placement,
          [(end * spec.width) / 2, spec.rise / 2 - 0.18, (side * halfDepth) / 2],
          [0.14, 0.18, length],
          side * slope,
        );
    }
    box('metal', placement, [0, spec.rise + 0.12, 0], [spec.width + 0.7, 0.13, 0.2]);
  }
  function roofEquipment(spec: RoofEquipmentDetail) {
    const placement = pose(spec, [spec.width, spec.depth]);
    const units = Math.max(1, Math.min(5, Math.floor(spec.width / 7)));
    for (let i = 0; i < units; i++) {
      const x = (i - (units - 1) / 2) * Math.min(4, spec.width / units);
      const z = (i % 2 ? 1 : -1) * Math.min(1.2, spec.depth / 4);
      box('metal', placement, [x, 0.7, z], [1.45, 1.25, 1.25]);
      box('frame', placement, [x, 0.11, z], [1.7, 0.22, 1.5]);
      box('roof', placement, [x, 1.35, z], [1.55, 0.12, 1.35]);
      for (let vent = 0; vent < (options.coarsePointer ? 3 : 6); vent++)
        box('glass', placement, [x, 0.35 + vent * 0.14, z + 0.635], [1.18, 0.065, 0.025]);
    }
  }
  return {
    addPorch: porch,
    addStorefront: storefront,
    addPitchedRoof: pitchedRoof,
    addRoofEquipment: roofEquipment,
    finish(): ArchitecturalKitResult {
      if (result) return result;
      const group = new THREE.Group();
      group.name = 'regional-architectural-details';
      // Only instantiated resources are created; the streamed parent owns disposal.
      if (batches.size) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        for (const [surface, transforms] of batches) {
          const material = new THREE.MeshStandardMaterial({
            color: COLORS[options.palette][surface],
            roughness: surface === 'glass' ? 0.24 : surface === 'metal' ? 0.58 : 0.84,
            metalness: surface === 'metal' ? 0.5 : surface === 'glass' ? 0.18 : 0,
          });
          material.name = `architecture-kit-${options.palette}-${surface}`;
          const instances = new THREE.InstancedMesh(geometry, material, transforms.length);
          transforms.forEach((matrix, index) => instances.setMatrixAt(index, matrix));
          instances.name = `architecture-kit-${surface}`;
          instances.instanceMatrix.needsUpdate = true;
          instances.castShadow = surface !== 'glass';
          instances.receiveShadow = true;
          instances.computeBoundingBox();
          instances.computeBoundingSphere();
          group.add(instances);
        }
      }
      result = { group, collisions };
      return result;
    },
  };
}
