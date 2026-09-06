import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { addRegionalScenery } from "../../src/features/street-leonida/walk-regional-scenery";
import { addRegionalArrivalForeground } from "../../src/features/street-leonida/walk-regional-arrivals";
import type { WalkRenderRegion } from "../../src/features/street-leonida/walk-region-streaming";

const regions: WalkRenderRegion[] = [
  "vice-city",
  "leonida-keys",
  "grassrivers",
  "port-gellhorn",
  "ambrosia",
  "mount-kalaga",
];
describe("source-informed regional scenery parcels", () => {
  it("attaches meaningful parcels to all six real arrival builders", () => {
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => null }),
    });
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(
      () => new THREE.Texture(),
    );
    try {
      for (const region of regions) {
        const renderer = {
          capabilities: { getMaxAnisotropy: () => 8 },
        } as THREE.WebGLRenderer;
        const feature = addRegionalArrivalForeground(
          new THREE.Group(),
          [],
          region,
          false,
          renderer,
        )!;
        const scenery = feature.getObjectByName(`${region}-regional-scenery`)!;
        expect(scenery.userData.parcels.length, region).toBeGreaterThanOrEqual(
          1,
        );
        expect(scenery.children.length, region).toBeGreaterThan(3);
        if (region === "leonida-keys" || region === "grassrivers") {
          feature.position.set(0, 0, 0);
          feature.rotation.set(0, 0, 0);
          const { parcels } = addRegionalScenery(feature, region, false, []);
          const fleet = feature.getObjectByName(
            region === "leonida-keys"
              ? "keys-marina-fleet"
              : "grassrivers-dock-fleet",
          )!;
          feature.updateMatrixWorld(true);
          for (const vessel of fleet.children) {
            const bounds = new THREE.Box3().setFromObject(vessel);
            for (const parcel of parcels) {
              const overlaps =
                bounds.min.x < parcel.x + parcel.width / 2 &&
                bounds.max.x > parcel.x - parcel.width / 2 &&
                bounds.min.z < parcel.z + parcel.depth / 2 &&
                bounds.max.z > parcel.z - parcel.depth / 2;
              expect(
                overlaps,
                `${region}: ${vessel.name} intersects new quay`,
              ).toBe(false);
            }
          }
        }
        feature.dispose();
      }
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
  it.each(regions)(
    "%s retains entry clearance and shares detailed geometry",
    (region) => {
      for (const coarse of [false, true]) {
        const feature = new THREE.Group();
        feature.position.set(173, 0, -264);
        feature.rotation.y = 0.7;
        const { collisions } = addRegionalScenery(feature, region, coarse, []);
        expect(feature.position.x).toBe(173);
        expect(feature.rotation.y).toBe(0.7);
        const scenery = feature.getObjectByName(`${region}-regional-scenery`)!;
        expect(scenery).toBeDefined();
        const meshes: THREE.InstancedMesh[] = [];
        scenery.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            expect(object).toBeInstanceOf(THREE.InstancedMesh);
            meshes.push(object as THREE.InstancedMesh);
          }
        });
        expect(meshes.length).toBeGreaterThan(3);
        expect(meshes.length).toBeLessThanOrEqual(18);
        const triangles = meshes.reduce(
          (sum, m) =>
            sum +
            ((m.geometry.index?.count ??
              m.geometry.getAttribute("position").count) /
              3) *
              m.count,
          0,
        );
        expect(triangles).toBeGreaterThan(500);
        expect(triangles).toBeLessThan(coarse ? 25000 : 65000);
        expect(collisions.length).toBeGreaterThan(2);
        for (const c of collisions) {
          expect(c.minX < -15 || c.maxX > 15).toBe(true);
          expect(c.maxX <= -15 || c.minX >= 15).toBe(true);
        }
        expect(scenery.userData.evidence).toBe("APPROXIMATE");
        expect(scenery.userData.landmarkClaim).toBe("NONE");
      }
    },
  );
  it("skips an occupied parcel instead of intersecting existing buildings", () => {
    const feature = new THREE.Group();
    const occupied = [{ x: 0, z: 0, width: 1000, depth: 1000 }];
    const { collisions } = addRegionalScenery(
      feature,
      "port-gellhorn",
      false,
      occupied,
    );
    expect(collisions).toEqual([]);
    const meshes: THREE.Mesh[] = [];
    feature.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o);
    });
    expect(meshes).toEqual([]);
  });
  it.each(["leonida-keys", "grassrivers", "mount-kalaga"] as const)(
    "%s keeps every hull below the local waterline at varied scales",
    (region) => {
      const feature = new THREE.Group();
      addRegionalScenery(feature, region, false, []);
      const hull = feature.getObjectByName(
        "scenery-hull-plaster",
      ) as THREE.InstancedMesh;
      hull.geometry.computeBoundingBox();
      for (let i = 0; i < hull.count; i++) {
        const matrix = new THREE.Matrix4();
        hull.getMatrixAt(i, matrix);
        const bounds = hull.geometry.boundingBox!.clone().applyMatrix4(matrix);
        expect(bounds.min.y).toBeLessThan(0.18);
        expect(bounds.min.y).toBeGreaterThanOrEqual(0);
        expect(bounds.max.y).toBeGreaterThan(0.18);
      }
    },
  );
  it("makes marina hulls from curved closed geometry instead of boxes", () => {
    const feature = new THREE.Group();
    addRegionalScenery(feature, "leonida-keys", false, []);
    const hull = feature.getObjectByName(
      "scenery-hull-plaster",
    ) as THREE.InstancedMesh;
    expect(hull).toBeInstanceOf(THREE.InstancedMesh);
    expect(hull.count).toBeGreaterThanOrEqual(3);
    expect(hull.geometry).not.toBeInstanceOf(THREE.BoxGeometry);
    expect(hull.geometry.getAttribute("normal").count).toBe(
      hull.geometry.getAttribute("position").count,
    );
    expect(hull.geometry.getAttribute("normal").getZ(12)).toBeGreaterThan(0.5);
  });
});
