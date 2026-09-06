import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createNativeVegetation } from "../../src/features/street-leonida/walk-native-vegetation";

function triangles(group: THREE.Group): number {
  let count = 0;
  group.traverse((object) => {
    if (object instanceof THREE.Mesh)
      count +=
        (object.geometry.index?.count ??
          object.geometry.getAttribute("position").count) / 3;
  });
  return count;
}
describe("regional native tree geometry", () => {
  it.each(["cypress", "pine"] as const)(
    "%s keeps a full 3D crown within near/mid geometry budgets",
    (kind) => {
      const near = createNativeVegetation(kind, [[0, 0, 10]], "near");
      const mid = createNativeVegetation(kind, [[0, 0, 10]], "mid");
      expect(triangles(near)).toBeLessThanOrEqual(
        kind === "cypress" ? 5888 : 1800,
      );
      expect(triangles(mid)).toBeLessThanOrEqual(
        kind === "cypress" ? 2000 : 750,
      );
      expect(triangles(mid)).toBeLessThan(triangles(near));
      for (const group of [near, mid]) {
        expect(group.children).toHaveLength(2);
        expect(
          group.children.every((child) => child instanceof THREE.InstancedMesh),
        ).toBe(true);
        const bounds = new THREE.Box3().setFromObject(group);
        expect(bounds.max.y).toBeGreaterThan(8.5);
        expect(bounds.max.y).toBeLessThan(11);
        expect(bounds.max.x - bounds.min.x).toBeGreaterThan(2);
        expect(bounds.max.x - bounds.min.x).toBeLessThan(7);
      }
    },
  );
  it("builds cypress foliage from small dense sprays rather than metre-wide folded leaves", () => {
    const tree = createNativeVegetation("cypress", [[0, 0, 10]], "near");
    const mesh = tree.getObjectByName(
      "cypress-individual-leaves",
    ) as THREE.InstancedMesh;
    const p = mesh.geometry.getAttribute("position");
    let largestTriangleArea = 0;
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i);
      const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      largestTriangleArea = Math.max(
        largestTriangleArea,
        b.sub(a).cross(c.sub(a)).length() / 2,
      );
    }
    // At a 10m tree height no individual leaf triangle can exceed 120cm².
    expect(largestTriangleArea).toBeLessThan(0.00012);
    expect(p.count / 3).toBeGreaterThan(3000);
  });

  it("models cypress buttress roots at the supplied ground height", () => {
    const group = createNativeVegetation(
      "cypress",
      [[12, -8, 10, 3.5]],
      "near",
    );
    const trunk = group.getObjectByName(
      "cypress-tapered-trunks",
    ) as THREE.InstancedMesh;
    const position = trunk.geometry.getAttribute("position");
    let widestBase = 0;
    for (let i = 0; i < position.count; i++)
      if (position.getY(i) < 0.11)
        widestBase = Math.max(
          widestBase,
          Math.hypot(position.getX(i), position.getZ(i)),
        );
    expect(widestBase).toBeGreaterThan(0.11);
    expect(new THREE.Box3().setFromObject(group).min.y).toBeCloseTo(3.5, 4);
  });
  it("retains all tree placements in two draws and no texture-backed foliage planes", () => {
    const positions = Array.from(
      { length: 70 },
      (_, i) => [i * 9, -i * 7, 9 + (i % 3)] as const,
    );
    const group = createNativeVegetation("palm", positions);
    for (const child of group.children as THREE.InstancedMesh[]) {
      expect(child.count).toBe(70);
      expect(child.geometry).not.toBeInstanceOf(THREE.PlaneGeometry);
      expect((child.material as THREE.MeshStandardMaterial).map).toBeNull();
    }
    expect(triangles(group)).toBeLessThan(1800);
  });
  it("uses dense narrow palm leaflets rather than broad hanging cards", () => {
    const group = createNativeVegetation("palm", [[0, 0, 10]]);
    const crown = group.getObjectByName(
      "palm-individual-leaves",
    ) as THREE.InstancedMesh;
    const p = crown.geometry.getAttribute("position");
    const aspectRatios: number[] = [];
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i);
      const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      const longestSquared = Math.max(
        a.distanceToSquared(b),
        b.distanceToSquared(c),
        c.distanceToSquared(a),
      );
      aspectRatios.push(
        b.clone().sub(a).cross(c.clone().sub(a)).length() / longestSquared,
      );
    }
    aspectRatios.sort((a, b) => a - b);
    expect(aspectRatios[Math.floor(aspectRatios.length / 2)]).toBeLessThan(
      0.18,
    );
    expect(p.count / 3).toBeGreaterThan(900);
  });
  it("gives palms a vertically varied drooping crown instead of a horizontal umbrella", () => {
    const group = createNativeVegetation("palm", [[0, 0, 10]]);
    const crown = group.getObjectByName(
      "palm-individual-leaves",
    ) as THREE.InstancedMesh;
    crown.geometry.computeBoundingBox();
    const bounds = crown.geometry.boundingBox!;
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(0.33);
    expect(bounds.min.y).toBeGreaterThan(0.5);
    expect(triangles(group)).toBeLessThan(1800);
  });
});
