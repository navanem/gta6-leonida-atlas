import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type NativeVegetationKind = "palm" | "cypress" | "pine" | "cane";
export type VegetationPlacement = readonly [
  x: number,
  z: number,
  height: number,
  groundY?: number,
];
type Detail = "near" | "mid";

function palmFrondPoint(frond: number, t: number): THREE.Vector3 {
  const angle = frond * 2.39996;
  const radius = t * (0.29 + (frond % 4) * 0.028);
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    0.83 +
      Math.sin(t * Math.PI) * (0.16 + (frond % 3) * 0.035) -
      t * t * t * (0.24 + (frond % 4) * 0.045),
    Math.sin(angle) * radius,
  );
}

interface CypressBranch {
  start: THREE.Vector3;
  end: THREE.Vector3;
  seed: number;
}

function cypressBranches(detail: Detail): CypressBranch[] {
  const branches: CypressBranch[] = [];
  const tiers = detail === "near" ? 7 : 5;
  const arms = detail === "near" ? 5 : 4;
  for (let tier = 0; tier < tiers; tier++) {
    const t = tier / (tiers - 1);
    for (let arm = 0; arm < arms; arm++) {
      const seed = tier * 17 + arm * 7;
      const angle = (arm * Math.PI * 2) / arms + tier * 2.39996;
      const radius =
        (0.075 + Math.sin((t * 0.85 + 0.08) * Math.PI) * 0.17) *
        (0.87 + Math.sin(seed * 2.13) * 0.13);
      const y = 0.3 + t * 0.64 + Math.sin(seed * 1.67) * 0.032;
      branches.push({
        start: new THREE.Vector3(0, y, 0),
        end: new THREE.Vector3(
          Math.cos(angle) * radius,
          y - 0.018 + t * 0.033 + Math.sin(seed * 2.71) * 0.024,
          Math.sin(angle) * radius,
        ),
        seed,
      });
    }
  }
  return branches;
}

function leafGeometry(
  kind: NativeVegetationKind,
  detail: Detail,
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const leaf = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    width: number,
    tilt: number,
    folded = true,
  ) => {
    const axis = direction.clone().normalize();
    const side = new THREE.Vector3(-axis.z, 0, axis.x)
      .normalize()
      .multiplyScalar(width)
      .applyAxisAngle(axis, tilt);
    const middle = origin.clone().addScaledVector(direction, 0.48);
    const tip = origin.clone().add(direction);
    const ridge = middle.clone().add(new THREE.Vector3(0, width * 0.35, 0));
    const l = middle.clone().add(side),
      r = middle.clone().sub(side);
    for (const triangle of folded
      ? [
          [origin, l, ridge],
          [origin, ridge, r],
          [l, tip, ridge],
          [ridge, tip, r],
        ]
      : [
          [origin, l, tip],
          [origin, tip, r],
        ])
      vertices.push(...triangle.flatMap((v) => v.toArray()));
  };
  if (kind === "palm") {
    const stations = detail === "near" ? 22 : 12;
    for (let frond = 0; frond < 11; frond++) {
      const angle = frond * 2.39996;
      const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      for (let station = 0; station < stations; station++) {
        const t = (station + 1) / (stations + 1);
        const origin = palmFrondPoint(frond, t);
        for (const sign of [-1, 1]) {
          const direction = new THREE.Vector3(
            -radial.z * sign,
            -0.24,
            radial.x * sign,
          ).multiplyScalar(Math.sin(t * Math.PI) * 0.12);
          direction.addScaledVector(radial, 0.038);
          leaf(
            origin,
            direction,
            0.004 + Math.sin(t * Math.PI) * 0.0055,
            sign * 0.3,
            false,
          );
        }
      }
    }
  } else if (kind === "cypress") {
    // Cypress foliage is arranged as feather-like sprays on slender branchlets.
    // Small paired blades retain gaps and depth without whole-crown image cards.
    const sprigs = detail === "near" ? 5 : 3;
    const pairs = detail === "near" ? 6 : 4;
    for (const branch of cypressBranches(detail)) {
      const main = branch.end.clone().sub(branch.start);
      const radial = main.clone().normalize();
      const lateral = new THREE.Vector3(-radial.z, 0, radial.x).normalize();
      for (let sprig = 0; sprig < sprigs; sprig++) {
        const t = 0.27 + (sprig / (sprigs - 1)) * 0.68;
        const origin = branch.start.clone().addScaledVector(main, t);
        const sign = (sprig + branch.seed) % 2 ? -1 : 1;
        const twig = radial
          .clone()
          .multiplyScalar(0.048 + Math.sin(branch.seed + sprig) * 0.012)
          .addScaledVector(
            lateral,
            sign * (0.052 + Math.sin(sprig * 2.7) * 0.013),
          );
        twig.y = -0.01 + Math.sin(branch.seed * 1.3 + sprig) * 0.072;
        const side = new THREE.Vector3(-twig.z, 0, twig.x)
          .normalize()
          .applyAxisAngle(
            twig.clone().normalize(),
            Math.sin(branch.seed * 1.8 + sprig) * 0.95,
          );
        leaf(origin, twig, 0.00065, 0, false);
        for (let pair = 0; pair < pairs; pair++) {
          const along = (pair + 0.8) / (pairs + 0.4);
          for (const rank of [-1, 1]) {
            const base = origin
              .clone()
              .addScaledVector(twig, along + rank * 0.018);
            const blade = side
              .clone()
              .multiplyScalar(
                rank * (0.012 + Math.sin(along * Math.PI) * 0.022),
              )
              .addScaledVector(twig, 0.1);
            blade.y += Math.sin(branch.seed + pair * 2.3) * 0.003;
            leaf(
              base,
              blade,
              0.003 + Math.sin(along * Math.PI) * 0.0015,
              Math.sin(branch.seed + sprig) * 0.5,
              false,
            );
          }
        }
      }
    }
  } else if (kind === "cane") {
    for (let stalk = 0; stalk < 7; stalk++)
      for (let level = 0; level < 5; level++) {
        const angle = stalk * 2.4 + level;
        leaf(
          new THREE.Vector3(
            Math.cos(stalk) * 0.06,
            0.24 + level * 0.14,
            Math.sin(stalk) * 0.06,
          ),
          new THREE.Vector3(
            Math.cos(angle) * 0.23,
            0.16,
            Math.sin(angle) * 0.23,
          ),
          0.018,
          0.6,
        );
      }
  } else {
    const tiers = detail === "near" ? 7 : 5;
    const branches = detail === "near" ? 5 : 3;
    const sprays = detail === "near" ? 7 : 5;
    for (let tier = 0; tier < tiers; tier++) {
      const y = 0.35 + (tier / (tiers - 1)) * 0.59;
      const radius = 0.28 * (1 - (tier / tiers) * 0.78);
      for (let branch = 0; branch < branches; branch++) {
        const angle = (branch * Math.PI * 2) / branches + tier * 1.71;
        const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        for (let spray = 0; spray < sprays; spray++) {
          const t = 0.22 + (spray / sprays) * 0.8;
          const origin = radial.clone().multiplyScalar(t * radius);
          origin.y = y + Math.sin(spray * 1.7) * 0.018 - t * 0.035;
          const direction = radial.clone().multiplyScalar(0.07);
          direction.y = 0.012;
          direction.applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            Math.sin(spray * 2.4) * 0.9,
          );
          leaf(origin, direction, 0.03, Math.sin(tier * 2.4 + spray) * 1.1);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Two region-owned draws per planting; real branches, fronds and buttress roots. */
export function createNativeVegetation(
  kind: NativeVegetationKind,
  positions: readonly VegetationPlacement[],
  detail: Detail = "near",
): THREE.Group {
  const group = new THREE.Group();
  group.name = `walk-native-${kind}`;
  if (!positions.length) return group;
  const parts: THREE.BufferGeometry[] = [];
  function branch(
    start: THREE.Vector3,
    end: THREE.Vector3,
    bottom: number,
    top: number,
    sides = 5,
  ) {
    const vector = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(
      top,
      bottom,
      vector.length(),
      sides,
      1,
    );
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        vector.normalize(),
      ),
    );
    geometry.translate(...start.clone().add(end).multiplyScalar(0.5).toArray());
    parts.push(geometry);
  }
  const trunk = new THREE.CylinderGeometry(
    kind === "palm" ? 0.009 : 0.005,
    kind === "cypress" ? 0.045 : 0.021,
    kind === "palm" ? 0.83 : 0.95,
    7,
    4,
  );
  trunk.translate(0, kind === "palm" ? 0.415 : 0.475, 0);
  parts.push(trunk);
  if (kind === "cypress")
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.39996;
      // Root ends stay on the ground; the taper rises into the flared trunk.
      branch(
        new THREE.Vector3(
          Math.cos(angle) * 0.13,
          0.014,
          Math.sin(angle) * 0.13,
        ),
        new THREE.Vector3(0, 0.13, 0),
        0.014,
        0.026,
      );
    }
  if (kind === "palm")
    for (let i = 0; i < 11; i++) {
      const segments = detail === "near" ? 4 : 3;
      for (let segment = 0; segment < segments; segment++)
        branch(
          palmFrondPoint(i, segment / segments),
          palmFrondPoint(i, (segment + 1) / segments),
          0.004 * (1 - segment / segments) + 0.0005,
          0.004 * (1 - (segment + 1) / segments) + 0.0005,
          4,
        );
    }
  if (kind === "cypress")
    for (const limb of cypressBranches(detail))
      branch(limb.start, limb.end, 0.005, 0.0009, 4);
  if (kind === "pine") {
    const tiers = detail === "near" ? 6 : 4;
    for (let i = 0; i < tiers; i++)
      for (let j = 0; j < (detail === "near" ? 4 : 3); j++) {
        const a = i * 1.71 + (j * Math.PI) / 2;
        const y = 0.36 + (i / tiers) * 0.55;
        const radius = 0.25 * (1 - (i / tiers) * 0.7);
        branch(
          new THREE.Vector3(0, y, 0),
          new THREE.Vector3(
            Math.cos(a) * radius,
            y - 0.025,
            Math.sin(a) * radius,
          ),
          0.006,
          0.0015,
          4,
        );
      }
  }
  const wood = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  const foliage = leafGeometry(kind, detail);
  const bark = new THREE.MeshStandardMaterial({
    color: kind === "palm" ? 0x85715a : 0x625849,
    roughness: 0.94,
  });
  const green = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  bark.name = `street-leonida/native-vegetation/${kind}/bark`;
  green.name = `street-leonida/native-vegetation/${kind}/foliage`;
  const stems = new THREE.InstancedMesh(wood, bark, positions.length);
  const crowns = new THREE.InstancedMesh(foliage, green, positions.length);
  stems.name = `${kind}-tapered-trunks`;
  crowns.name = `${kind}-individual-leaves`;
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  positions.forEach(([x, z, height, groundY], index) => {
    transform.position.set(x, groundY ?? 0.055, z);
    transform.rotation.set(0, index * 2.39996, 0);
    transform.scale.setScalar(height);
    transform.updateMatrix();
    stems.setMatrixAt(index, transform.matrix);
    crowns.setMatrixAt(index, transform.matrix);
    color.setHSL(
      kind === "cypress" ? 0.23 : 0.27,
      0.3 + (index % 4) * 0.045,
      0.14 + (index % 5) * 0.014,
    );
    crowns.setColorAt(index, color);
  });
  stems.castShadow =
    crowns.castShadow =
    stems.receiveShadow =
    crowns.receiveShadow =
      true;
  stems.computeBoundingSphere();
  crowns.computeBoundingSphere();
  group.add(stems, crowns);
  return group;
}
