import * as THREE from 'three';

export type PedestrianPose = 'walk' | 'idle' | 'phone';
export interface PedestrianOptions {
  variant?: number;
  height?: number;
  pose?: PedestrianPose;
  detail?: 'near' | 'mid';
}
export interface PedestrianFrame {
  elapsedSeconds: number;
  distanceMetres?: number;
  speedMetresPerSecond?: number;
  distanceToCamera?: number;
}
export interface PedestrianActor {
  readonly root: THREE.Group;
  readonly mesh: THREE.SkinnedMesh;
  update(frame: PedestrianFrame): void;
  dispose(): void;
}
export interface PedestrianLibrary {
  create(options?: PedestrianOptions): PedestrianActor;
  dispose(): void;
}

type Point = readonly [number, number, number];
type Section = readonly [y: number, halfWidth: number, halfDepth: number, z?: number];
const JOINTS: readonly [name: string, parent: number, position: Point][] = [
  ['pelvis', -1, [0, 0.945, 0]],
  ['spine', 0, [0, 1.14, 0]],
  ['chest', 1, [0, 1.41, 0]],
  ['neck', 2, [0, 1.55, 0]],
  ['head', 3, [0, 1.64, 0]],
  ['left-shoulder', 2, [-0.235, 1.4, 0]],
  ['left-elbow', 5, [-0.235, 1.14, 0]],
  ['left-wrist', 6, [-0.235, 0.895, 0]],
  ['right-shoulder', 2, [0.235, 1.4, 0]],
  ['right-elbow', 8, [0.235, 1.14, 0]],
  ['right-wrist', 9, [0.235, 0.895, 0]],
  ['left-hip', 0, [-0.105, 0.945, 0]],
  ['left-knee', 11, [-0.105, 0.495, 0]],
  ['left-ankle', 12, [-0.105, 0.065, 0]],
  ['right-hip', 0, [0.105, 0.945, 0]],
  ['right-knee', 14, [0.105, 0.495, 0]],
  ['right-ankle', 15, [0.105, 0.065, 0]],
];

// Original geometric characters. The existing scene collage guides the clothing
// palette; it is not projected onto a plane or presented as a character model.
const OUTFITS = [
  {
    skin: 0x975d42,
    top: 0xe7dcc6,
    lower: 0x365470,
    hair: 0x252019,
    shoe: 0xe0ddd1,
  },
  {
    skin: 0xc48b65,
    top: 0x416c62,
    lower: 0xb6a27b,
    hair: 0x38251c,
    shoe: 0x362f2c,
  },
  {
    skin: 0x704633,
    top: 0xab4f53,
    lower: 0x28333e,
    hair: 0x201c1b,
    shoe: 0xd8d6cc,
  },
  {
    skin: 0xd3a17e,
    top: 0x577387,
    lower: 0x344a62,
    hair: 0x765138,
    shoe: 0x34363a,
  },
  {
    skin: 0x815641,
    top: 0x292e38,
    lower: 0xc1a579,
    hair: 0x2b201b,
    shoe: 0xb7a28d,
  },
  {
    skin: 0xb9805b,
    top: 0xc18c46,
    lower: 0x394848,
    hair: 0x392b25,
    shoe: 0xddd9d0,
  },
];

class CharacterGeometry {
  private positions: number[] = [];
  private colors: number[] = [];
  private joints: number[] = [];
  private weights: number[] = [];
  private indices: number[] = [];

  loft(
    sections: readonly Section[],
    x: number,
    colorHex: number,
    joint: number,
    segments: number,
    articulation?: {
      pivot: number;
      lowerJoint: number;
      lowerColor?: number;
      colorBoundary?: number;
    },
  ): void {
    const start = this.positions.length / 3;
    for (const [y, width, depth, z = 0] of sections) {
      const color = new THREE.Color(
        articulation?.lowerColor !== undefined && y < (articulation.colorBoundary ?? 0)
          ? articulation.lowerColor
          : colorHex,
      );
      const upperWeight = articulation
        ? THREE.MathUtils.smoothstep(y, articulation.pivot - 0.045, articulation.pivot + 0.045)
        : 1;
      for (let index = 0; index < segments; index++) {
        const angle = (index / segments) * Math.PI * 2;
        this.positions.push(x + Math.cos(angle) * width, y, z + Math.sin(angle) * depth);
        // Small geometric ambient shading preserves a readable underside without
        // adding another material, texture, or draw call to every garment.
        const shade = 0.94 + 0.06 * Math.cos(angle + 0.8);
        this.colors.push(color.r * shade, color.g * shade, color.b * shade);
        this.joints.push(joint, articulation?.lowerJoint ?? 0, 0, 0);
        this.weights.push(upperWeight, 1 - upperWeight, 0, 0);
      }
    }
    for (let ring = 0; ring < sections.length - 1; ring++) {
      for (let side = 0; side < segments; side++) {
        const a = start + ring * segments + side;
        const b = start + ring * segments + ((side + 1) % segments);
        this.indices.push(a, a + segments, b, b, a + segments, b + segments);
      }
    }
    for (let side = 1; side < segments - 1; side++) {
      this.indices.push(start, start + side, start + side + 1);
      const end = start + (sections.length - 1) * segments;
      this.indices.push(end, end + side + 1, end + side);
    }
  }

  finish(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.joints, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.weights, 4));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

function characterGeometry(
  variant: number,
  detail: 'near' | 'mid',
  phone: boolean,
): THREE.BufferGeometry {
  const look = OUTFITS[variant % OUTFITS.length]!;
  const near = detail === 'near';
  const radial = near ? 10 : 4;
  const small = near ? 6 : 4;
  const model = new CharacterGeometry();
  const broad =
    (variant % 3 === 1 ? 1.1 : variant % 3 === 2 ? 0.93 : 1) * (variant >= 3 ? 1.045 : 1);
  const shorts = variant % 3 === 1;
  const sleeveless = variant % 3 === 2;
  const sections = (full: readonly Section[]) =>
    near ? full : [full[0]!, full[Math.floor(full.length / 2)]!, full.at(-1)!];
  model.loft(
    sections([
      [0.94, 0.155 * broad, 0.115],
      [1.03, 0.17 * broad, 0.13],
      [1.13, 0.15 * broad, 0.112],
      [1.29, 0.2 * broad, 0.135],
      [1.4, 0.235 * broad, 0.115],
      [1.46, 0.155 * broad, 0.095],
    ]),
    0,
    look.top,
    2,
    radial,
  );
  model.loft(
    [
      [0.87, 0.16 * broad, 0.115],
      [0.97, 0.165 * broad, 0.12],
    ],
    0,
    look.lower,
    0,
    radial,
  );
  model.loft(
    [
      [1.44, 0.053, 0.05],
      [1.585, 0.052, 0.053],
    ],
    0,
    look.skin,
    3,
    small,
  );
  model.loft(
    sections([
      [1.565, 0.047, 0.047, -0.014],
      [1.605, 0.077, 0.075, -0.012],
      [1.67, 0.096, 0.084],
      [1.735, 0.091, 0.082, 0.004],
      [1.78, 0.053, 0.055, 0.008],
    ]),
    0,
    look.skin,
    4,
    radial,
  );
  model.loft(
    sections([
      [1.69, 0.096, 0.07, 0.031],
      [1.75, 0.099, 0.087, 0.008],
      [1.8, 0.051, 0.05, 0.012],
    ]),
    0,
    look.hair,
    4,
    radial,
  );

  for (const side of [-1, 1]) {
    const shoulder = side < 0 ? 5 : 8;
    const hip = side < 0 ? 11 : 14;
    const armX = side * 0.235;
    const legX = side * 0.105;
    model.loft(
      near
        ? [
            [0.89, 0.035, 0.036],
            [1.01, 0.046, 0.051],
            [1.115, 0.045, 0.047],
            [1.14, 0.047, 0.049],
            [1.18, 0.053, 0.056],
            [1.225, 0.062, 0.066],
            [1.23, 0.064, 0.069],
            [1.34, 0.069, 0.077],
            [1.425, 0.055, 0.059],
          ]
        : [
            [0.89, 0.035, 0.036],
            [1.14, 0.047, 0.049],
            [1.425, 0.055, 0.059],
          ],
      armX,
      sleeveless ? look.skin : look.top,
      shoulder,
      radial,
      {
        pivot: 1.14,
        lowerJoint: shoulder + 1,
        lowerColor: look.skin,
        colorBoundary: 1.23,
      },
    );
    model.loft(
      sections([
        [0.8, 0.032, 0.026, -0.006],
        [0.845, 0.043, 0.029],
        [0.91, 0.029, 0.027],
      ]),
      armX,
      look.skin,
      shoulder + 2,
      small,
    );
    model.loft(
      near
        ? [
            [0.09, 0.042, 0.046],
            [0.27, 0.059, 0.063],
            [0.455, 0.062, 0.066],
            [0.495, 0.063, 0.068],
            [0.535, 0.067, 0.07],
            [0.54, 0.07, 0.074],
            [0.69, 0.079 * broad, 0.08],
            [0.87, 0.088 * broad, 0.098],
            [0.965, 0.082 * broad, 0.096],
          ]
        : [
            [0.09, 0.042, 0.046],
            [0.495, 0.063, 0.068],
            [0.965, 0.082 * broad, 0.096],
          ],
      legX,
      look.lower,
      hip,
      radial,
      {
        pivot: 0.495,
        lowerJoint: hip + 1,
        lowerColor: shorts ? look.skin : look.lower,
        colorBoundary: 0.54,
      },
    );
    model.loft(
      sections([
        [0, 0.061, 0.139, -0.058],
        [0.035, 0.065, 0.145, -0.058],
        [0.09, 0.056, 0.128, -0.049],
        [0.125, 0.039, 0.064, -0.004],
      ]),
      legX,
      look.shoe,
      hip + 2,
      radial,
    );
    if (near) {
      model.loft(
        [
          [1.626, 0.017, 0.014],
          [1.672, 0.018, 0.021],
          [1.69, 0.009, 0.013],
        ],
        side * 0.098,
        look.skin,
        4,
        small,
      );
      model.loft(
        [
          [1.676, 0.016, 0.008, -0.082],
          [1.688, 0.017, 0.007, -0.083],
        ],
        side * 0.04,
        0x27231f,
        4,
        4,
      );
      // Flat sole / collar / pocket details belong to the same skinned draw.
      model.loft(
        [
          [0.003, 0.063, 0.142, -0.058],
          [0.019, 0.063, 0.142, -0.058],
        ],
        legX,
        0xaaa89f,
        hip + 2,
        radial,
      );
      if (side < 0 && !sleeveless) {
        const pocket = new THREE.Color(look.top).multiplyScalar(0.83).getHex();
        model.loft(
          [
            [1.255, 0.037, 0.003, -0.12],
            [1.326, 0.04, 0.003, -0.116],
          ],
          side * 0.075,
          pocket,
          2,
          4,
        );
      }
    }
  }
  if (near) {
    model.loft(
      [
        [1.641, 0.015, 0.013, -0.101],
        [1.665, 0.018, 0.023, -0.105],
        [1.699, 0.009, 0.006, -0.083],
      ],
      0,
      look.skin,
      4,
      6,
    );
    model.loft(
      [
        [1.615, 0.027, 0.007, -0.083],
        [1.624, 0.026, 0.007, -0.088],
      ],
      0,
      0x794a3b,
      4,
      4,
    );
    if (variant % 3 === 1) {
      model.loft(
        [
          [1.742, 0.111, 0.144, -0.038],
          [1.76, 0.107, 0.141, -0.035],
        ],
        0,
        look.lower,
        4,
        10,
      );
    } else if (variant % 3 === 2) {
      model.loft(
        [
          [1.48, 0.035, 0.036, 0.115],
          [1.61, 0.048, 0.049, 0.11],
          [1.73, 0.04, 0.046, 0.075],
        ],
        0,
        look.hair,
        4,
        8,
      );
    }
  }
  if (phone) {
    model.loft(
      [
        [0.825, 0.039, 0.012, -0.043],
        [0.967, 0.039, 0.012, -0.043],
      ],
      0.245,
      0x20282a,
      10,
      4,
    );
    model.loft(
      [
        [0.838, 0.032, 0.002, -0.057],
        [0.954, 0.032, 0.002, -0.057],
      ],
      0.245,
      0x719399,
      10,
      4,
    );
  }
  return model.finish();
}

function skeleton(): THREE.Skeleton {
  const bones = JOINTS.map(([name, parent, position]) => {
    const bone = new THREE.Bone();
    bone.name = name;
    const origin = parent < 0 ? [0, 0, 0] : JOINTS[parent]![2];
    bone.position.set(position[0] - origin[0]!, position[1] - origin[1]!, position[2] - origin[2]!);
    return bone;
  });
  JOINTS.forEach(([, parent], index) => {
    if (parent >= 0) bones[parent]!.add(bones[index]!);
  });
  bones[0]!.updateMatrixWorld(true);
  return new THREE.Skeleton(bones);
}

function poseLeg(
  bones: readonly THREE.Bone[],
  index: number,
  ankleY: number,
  ankleZ: number,
): void {
  const hipY = bones[0]!.position.y;
  const upperLength = 0.45;
  const lowerLength = 0.43;
  const downward = hipY - ankleY;
  const length = Math.min(upperLength + lowerLength - 0.000001, Math.hypot(downward, ankleZ));
  const direction = Math.atan2(-ankleZ, downward);
  const thigh =
    direction +
    Math.acos(
      THREE.MathUtils.clamp(
        (upperLength ** 2 + length ** 2 - lowerLength ** 2) / (2 * upperLength * length),
        -1,
        1,
      ),
    );
  const knee =
    Math.acos(
      THREE.MathUtils.clamp(
        (upperLength ** 2 + lowerLength ** 2 - length ** 2) / (2 * upperLength * lowerLength),
        -1,
        1,
      ),
    ) - Math.PI;
  bones[index]!.rotation.x = thigh;
  bones[index + 1]!.rotation.x = knee;
  bones[index + 2]!.rotation.x = -thigh - knee;
}

function footTarget(cycle: number): { y: number; z: number } {
  const stride = 0.86;
  const stance = 0.54;
  const phase = ((cycle % 1) + 1) % 1;
  const reach = (stride * stance) / 2;
  if (phase < stance) return { y: 0.065, z: -reach + phase * stride };
  const swing = (phase - stance) / (1 - stance);
  const eased = swing * swing * (3 - 2 * swing);
  return {
    y: 0.065 + Math.sin(swing * Math.PI) * 0.1,
    z: reach * (1 - 2 * eased),
  };
}

export function createPedestrianLibrary(): PedestrianLibrary {
  const geometries = new Map<string, THREE.BufferGeometry>();
  const actors = new Set<PedestrianActor>();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0,
  });
  material.name = 'street-leonida/pedestrian/matte-clothing-and-skin';
  let disposed = false;
  const geometryFor = (variant: number, detail: 'near' | 'mid', phone = false) => {
    const key = `${variant}:${detail}:${phone}`;
    let geometry = geometries.get(key);
    if (!geometry) {
      geometry = characterGeometry(variant, detail, phone);
      geometries.set(key, geometry);
    }
    return geometry;
  };
  return {
    create(options = {}) {
      if (disposed) throw new Error('Cannot create a pedestrian from a disposed library.');
      const variant = Math.abs(Math.trunc(options.variant ?? 0)) % OUTFITS.length;
      const height = THREE.MathUtils.clamp(
        options.height ?? 1.69 + (variant % 4) * 0.055,
        1.55,
        1.95,
      );
      const pose = options.pose ?? 'idle';
      const rig = skeleton();
      const mesh = new THREE.SkinnedMesh(
        geometryFor(variant, options.detail ?? 'near', pose === 'phone'),
        material,
      );
      mesh.name = 'pedestrian-mesh';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.add(rig.bones[0]!);
      mesh.bind(rig);
      // Bounds include the raised arm and forward stride, preventing pose clipping.
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 1.16);
      const root = new THREE.Group();
      root.add(mesh);
      root.scale.setScalar(height / 1.8);
      root.userData.renderProfile = 'single-mesh-pedestrian';
      let released = false;
      const actor: PedestrianActor = {
        root,
        mesh,
        update(frame) {
          if (released || disposed) return;
          const time = Number.isFinite(frame.elapsedSeconds) ? frame.elapsedSeconds : 0;
          const distance = Number.isFinite(frame.distanceMetres) ? frame.distanceMetres! : 0;
          const walking = pose === 'walk' && (frame.speedMetresPerSecond ?? 1) > 0.015;
          const cycle = distance / root.scale.y / 0.86;
          if (frame.distanceToCamera !== undefined) {
            mesh.geometry = geometryFor(
              variant,
              frame.distanceToCamera > 45 ? 'mid' : (options.detail ?? 'near'),
              pose === 'phone',
            );
          }
          const bones = rig.bones;
          bones[0]!.position.y = walking ? 0.905 : 0.94;
          for (const [index, offset] of [
            [11, 0],
            [14, 0.5],
          ] as const) {
            const target = walking
              ? footTarget(cycle + offset)
              : { y: 0.065, z: index === 11 ? -0.015 : 0.015 };
            poseLeg(bones, index, target.y, target.z);
          }
          const swing = walking
            ? Math.sin(cycle * Math.PI * 2) * 0.32
            : Math.sin(time * 0.7 + variant) * 0.018;
          bones[1]!.rotation.y = walking ? -Math.sin(cycle * Math.PI * 2) * 0.045 : 0;
          bones[2]!.rotation.y = walking
            ? Math.sin(cycle * Math.PI * 2) * 0.055
            : Math.sin(time * 0.25 + variant) * 0.025;
          bones[4]!.rotation.y = Math.sin(time * 0.24 + variant * 1.9) * (walking ? 0.04 : 0.16);
          bones[5]!.rotation.set(swing + 0.035, 0, -0.11);
          bones[8]!.rotation.set(-swing + 0.035, 0, 0.11);
          bones[6]!.rotation.x = -0.12;
          bones[9]!.rotation.x = -0.12;
          if (pose === 'phone') {
            bones[8]!.rotation.x = 0.64;
            bones[9]!.rotation.x = 1.55;
            bones[4]!.rotation.x = 0.13;
          } else if (!walking && variant >= 3) {
            bones[8]!.rotation.z = 0.3;
            bones[9]!.rotation.z = -0.95;
          } else {
            bones[9]!.rotation.z = 0;
          }
          root.updateMatrixWorld(true);
          rig.update();
        },
        dispose() {
          if (released) return;
          released = true;
          rig.dispose();
          actors.delete(actor);
        },
      };
      actors.add(actor);
      actor.update({ elapsedSeconds: 0, speedMetresPerSecond: 0 });
      return actor;
    },
    dispose() {
      if (disposed) return;
      for (const actor of [...actors]) actor.dispose();
      for (const geometry of geometries.values()) geometry.dispose();
      geometries.clear();
      material.dispose();
      disposed = true;
    },
  };
}
