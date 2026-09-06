import * as THREE from 'three';
import { createWindowInteriorMaterial } from './walk-window-interiors';
import { createWalkSurfaceLibrary } from './walk-surface-assets';

export interface FacadeShellSpec {
  /** Bottom centre of the facade; its outward normal is local +Z. */
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly width: number;
  readonly height: number;
  readonly floors?: number;
  readonly bayWidth?: number;
  readonly seed: number;
  readonly style: 'coastal' | 'urban' | 'weathered' | 'industrial' | 'timber';
  readonly color?: number;
  readonly storefront?: boolean;
  readonly balconies?: boolean;
}
export interface FacadeShellResource {
  readonly root: THREE.Group;
  readonly instanceCount: number;
  setDetail(near: boolean): void;
  dispose(): void;
}

type Vec3 = readonly [number, number, number];
type OpeningKind = 'home' | 'shop' | 'door' | 'industrial';
interface Opening {
  left: number;
  right: number;
  bottom: number;
  top: number;
}
const OPENINGS: Record<OpeningKind, Opening> = {
  home: { left: -0.31, right: 0.31, bottom: -0.26, top: 0.28 },
  shop: { left: -0.405, right: 0.405, bottom: -0.37, top: 0.29 },
  door: { left: -0.19, right: 0.19, bottom: -0.49, top: 0.24 },
  industrial: { left: -0.34, right: 0.34, bottom: -0.03, top: 0.28 },
};

/** Eight quads form a wall bay and the four real sides of its recessed opening. */
function openingGeometry(opening: Opening, frame: boolean): THREE.BufferGeometry {
  const vertices: number[] = [];
  const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3) =>
    vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
  const rect = (x0: number, y0: number, x1: number, y1: number, z: number) =>
    quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]);
  const { left: l, right: r, bottom: b, top: t } = opening;
  const outer = frame
    ? { l: l - 0.024, r: r + 0.024, b: b - 0.018, t: t + 0.018 }
    : { l: -0.5, r: 0.5, b: -0.5, t: 0.5 };
  const front = frame ? 0.028 : 0,
    back = frame ? -0.025 : -0.3;
  rect(outer.l, outer.b, l, outer.t, front);
  rect(r, outer.b, outer.r, outer.t, front);
  rect(l, outer.b, r, b, front);
  rect(l, t, r, outer.t, front);
  quad([l, b, back], [l, t, back], [l, t, front], [l, b, front]);
  quad([r, b, front], [r, t, front], [r, t, back], [r, b, back]);
  quad([l, b, front], [r, b, front], [r, b, back], [l, b, back]);
  quad([l, t, back], [r, t, back], [r, t, front], [l, t, front]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const uv: number[] = [];
  for (let i = 0; i < vertices.length; i += 3) uv.push(vertices[i]! + 0.5, vertices[i + 1]! + 0.5);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

interface Placement {
  matrix: THREE.Matrix4;
  color: number;
}

/** Shared shell parts for anonymous infill and authored frontages. An opaque
 * building core must end at least .45m behind the facade to leave the holes clear. */
export function createFacadeShellKit(options: { resourceOwnership?: 'kit' | 'region' } = {}) {
  const geometries = Object.fromEntries(
    Object.entries(OPENINGS).map(([kind, opening]) => [
      kind,
      { wall: openingGeometry(opening, false), frame: openingGeometry(opening, true) },
    ]),
  ) as Record<OpeningKind, { wall: THREE.BufferGeometry; frame: THREE.BufferGeometry }>;
  const plane = new THREE.PlaneGeometry(1, 1);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const wall = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.87 });
  const frame = new THREE.MeshStandardMaterial({
    color: 0xb6b4a8,
    roughness: 0.6,
    metalness: 0.12,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.73,
    metalness: 0.04,
  });
  const rail = new THREE.MeshStandardMaterial({
    color: 0x545955,
    roughness: 0.53,
    metalness: 0.45,
  });
  const interiors = createWindowInteriorMaterial();
  wall.name = 'street-leonida/facade/shell-plaster';
  const surfaces = createWalkSurfaceLibrary({ anisotropy: 8 });
  surfaces.apply(wall, 'concrete', { repeat: [1, 1], normalScale: 0.24 });
  let disposed = false;
  const active = new Set<FacadeShellResource>();

  return {
    create(specs: readonly FacadeShellSpec[], name: string): FacadeShellResource {
      if (disposed) throw new Error('Facade shell kit has been disposed');
      const root = new THREE.Group();
      root.name = name;
      root.userData.evidence = 'APPROXIMATE';
      const near = new THREE.Group();
      near.name = `${name}-near`;
      root.add(near);
      const bays: Record<OpeningKind, Placement[]> = {
        home: [],
        shop: [],
        door: [],
        industrial: [],
      };
      const portals: Placement[] = [],
        accents: Placement[] = [],
        rails: Placement[] = [];
      const pose = new THREE.Object3D();
      const put = (
        target: Placement[],
        spec: FacadeShellSpec,
        position: Vec3,
        size: Vec3,
        color = 0xffffff,
      ) => {
        const c = Math.cos(spec.rotationY),
          s = Math.sin(spec.rotationY);
        pose.position.set(
          spec.position[0] + position[0] * c + position[2] * s,
          spec.position[1] + position[1],
          spec.position[2] - position[0] * s + position[2] * c,
        );
        pose.rotation.set(0, spec.rotationY, 0);
        pose.scale.set(...size);
        pose.updateMatrix();
        target.push({ matrix: pose.matrix.clone(), color });
      };
      for (const spec of specs) {
        if (!(spec.width > 0 && spec.height > 0) || !Number.isFinite(spec.width + spec.height))
          continue;
        const floors = Math.max(1, Math.min(36, Math.round(spec.floors ?? spec.height / 3.4)));
        const floorHeight = spec.height / floors;
        const columns = Math.max(
          1,
          Math.min(32, Math.round(spec.width / (spec.bayWidth ?? 3.4 + spec.seed * 0.7))),
        );
        const bayWidth = spec.width / columns;
        const accentColor =
          spec.style === 'coastal'
            ? 0x578b80
            : spec.style === 'industrial'
              ? 0x877650
              : spec.style === 'timber'
                ? 0x6b6450
                : 0x79614e;
        for (let floor = 0; floor < floors; floor++) {
          for (let column = 0; column < columns; column++) {
            const shop = floor === 0 && spec.storefront;
            const kind: OpeningKind = shop
              ? column === Math.floor(columns / 2)
                ? 'door'
                : 'shop'
              : spec.style === 'industrial'
                ? 'industrial'
                : 'home';
            const opening = OPENINGS[kind];
            const x = -spec.width / 2 + (column + 0.5) * bayWidth;
            const y = (floor + 0.5) * floorHeight;
            put(bays[kind], spec, [x, y, 0], [bayWidth, floorHeight, 1], spec.color ?? 0xd3cabc);
            put(
              portals,
              spec,
              [
                x + ((opening.left + opening.right) * bayWidth) / 2,
                y + ((opening.bottom + opening.top) * floorHeight) / 2,
                -0.32,
              ],
              [
                (opening.right - opening.left) * bayWidth + 0.004,
                (opening.top - opening.bottom) * floorHeight + 0.004,
                1,
              ],
            );
            // Bay-sized awnings and occasional open balconies break the repeated grid.
            if (shop && column % 3 !== 2) {
              put(
                accents,
                spec,
                [x, floorHeight - 0.42, 0.65],
                [bayWidth * 0.91, 0.13, 1.45],
                accentColor,
              );
              put(
                accents,
                spec,
                [x, floorHeight - 0.57, 1.35],
                [bayWidth * 0.91, 0.22, 0.1],
                accentColor,
              );
            }
            if (
              spec.balconies &&
              floor > 0 &&
              (floor + column + Math.floor(spec.seed * 7)) % 3 === 0
            ) {
              const balconyY = floor * floorHeight + 0.05;
              const balconyWidth = bayWidth * 0.89;
              put(
                accents,
                spec,
                [x, balconyY, 0.6],
                [balconyWidth, 0.14, 1.35],
                spec.color ?? 0xc7c7b7,
              );
              put(rails, spec, [x, balconyY + 1.05, 1.22], [balconyWidth, 0.065, 0.065]);
              for (const side of [-1, 1]) {
                put(
                  rails,
                  spec,
                  [x + (side * balconyWidth) / 2, balconyY + 1.05, 0.63],
                  [0.065, 0.065, 1.2],
                );
              }
              const uprights = Math.max(3, Math.ceil(balconyWidth / 0.65));
              for (let i = 0; i < uprights; i++)
                put(
                  rails,
                  spec,
                  [
                    x - balconyWidth / 2 + (i * balconyWidth) / (uprights - 1),
                    balconyY + 0.54,
                    1.22,
                  ],
                  [0.045, 1.02, 0.045],
                );
            }
          }
        }
      }
      let instanceCount = 0;
      const batch = (
        parent: THREE.Group,
        label: string,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        placements: Placement[],
        castShadow = false,
      ) => {
        if (!placements.length) return;
        const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
        mesh.name = `${name}-${label}`;
        const tint = new THREE.Color();
        placements.forEach(({ matrix, color }, index) => {
          mesh.setMatrixAt(index, matrix);
          if (color !== 0xffffff || material === wall || material === accent)
            mesh.setColorAt(index, tint.setHex(color));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        parent.add(mesh);
        instanceCount += mesh.count;
      };
      for (const kind of Object.keys(bays) as OpeningKind[]) {
        batch(root, `walls-${kind}`, geometries[kind].wall, wall, bays[kind], true);
        batch(near, `frames-${kind}`, geometries[kind].frame, frame, bays[kind]);
      }
      batch(root, 'interiors', plane, interiors, portals);
      batch(near, 'awnings-balconies', box, accent, accents, true);
      batch(near, 'open-rails', box, rail, rails);
      let released = false;
      const resource: FacadeShellResource = {
        root,
        instanceCount,
        setDetail(value) {
          if (!released) near.visible = value;
        },
        dispose() {
          if (released) return;
          released = true;
          if (options.resourceOwnership !== 'region') {
            root.traverse((object) => {
              if (object instanceof THREE.InstancedMesh) object.dispose();
            });
          }
          root.removeFromParent();
          active.delete(resource);
        },
      };
      active.add(resource);
      return resource;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      surfaces.dispose();
      for (const resource of [...active]) resource.dispose();
      if (options.resourceOwnership !== 'region') {
        for (const pair of Object.values(geometries)) {
          pair.wall.dispose();
          pair.frame.dispose();
        }
        for (const resource of [plane, box, wall, frame, accent, rail, interiors])
          resource.dispose();
      }
    },
  };
}
