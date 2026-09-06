import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gtadbToWorld } from "../../src/features/street-leonida/leonida-coordinates";
import { REVIEWED_GTADB_ANCHORS } from "../../src/features/street-leonida/leonida-evidence";
import { addRegionalArrivalForeground } from "../../src/features/street-leonida/walk-regional-arrivals";

const renderer = {
  capabilities: { getMaxAnisotropy: () => 8 },
} as THREE.WebGLRenderer;

describe("Street Leonida evidence-led arrival fidelity", () => {
  beforeEach(() => {
    vi.stubGlobal("document", {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    });
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(
      (asset) => {
        const texture = new THREE.Texture<HTMLImageElement>();
        texture.name = String(asset);
        return texture;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses one shared modern silhouette for every named arrival road vehicle", () => {
    const cases = [
      ["leonida-keys", "keys-arrival-car", "sedan", -3.2, -76],
      ["port-gellhorn", "port-arrival-car", "sedan", 3.6, -76],
      ["port-gellhorn", "port-arrival-pickup", "pickup", -4.4, -134],
      ["ambrosia", "ambrosia-arrival-tanker", "tanker", -3.8, -112],
      ["mount-kalaga", "kalaga-arrival-utility-truck", "utility", 3.2, -62],
    ] as const;

    for (const [region, name, type, expectedX, expectedZ] of cases) {
      const feature = addRegionalArrivalForeground(
        new THREE.Group(),
        [],
        region,
        false,
        renderer,
      );
      const vehicle = feature?.getObjectByName(name);
      if (!vehicle) throw new Error(`${name} missing`);
      const meshes: THREE.Mesh[] = [];
      vehicle.traverse((object) => {
        if (object instanceof THREE.Mesh) meshes.push(object);
      });

      expect(vehicle.position.x).toBeCloseTo(expectedX, 6);
      expect(vehicle.position.z).toBeCloseTo(expectedZ, 6);
      expect(vehicle.userData).toMatchObject({
        renderProfile: "single-mesh-detailed-vehicle",
        surfaceProfile: "sculpted-panelled-pbr",
        vehicleType: type,
        drawCalls: 1,
        materialOwnership: "region-owned",
      });
      expect(meshes).toHaveLength(1);
      expect(meshes[0]?.geometry).not.toBeInstanceOf(THREE.BoxGeometry);
      expect(meshes[0]?.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    }
  });

  it("keeps modern Vice City traffic instanced within three drawables and preserves its lanes", () => {
    const expectedXZ = [
      [-7.5, -18],
      [-3.6, -62],
      [3.7, -29],
      [7.6, -91],
      [-7.5, -128],
      [3.7, -168],
    ] as const;

    for (const [coarsePointer, expectedCount] of [
      [false, 6],
      [true, 4],
    ] as const) {
      const feature = addRegionalArrivalForeground(
        new THREE.Group(),
        [],
        "vice-city",
        coarsePointer,
        renderer,
      );
      const traffic = feature?.getObjectByName(
        "vice-city-arrival-traffic-silhouettes",
      );
      if (!traffic) throw new Error("Vice City traffic missing");
      const renderables: THREE.InstancedMesh[] = [];
      traffic.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          expect(object).toBeInstanceOf(THREE.InstancedMesh);
          expect(object.geometry).not.toBeInstanceOf(THREE.BoxGeometry);
          expect(object.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
          renderables.push(object as THREE.InstancedMesh);
        }
      });

      expect(traffic.userData).toMatchObject({
        renderProfile: "instanced-detailed-vehicles",
        surfaceProfile: "sculpted-panelled-pbr",
        vehicleType: "sedan",
        vehicleCount: expectedCount,
        materialOwnership: "region-owned",
      });
      expect(renderables.length).toBeGreaterThan(0);
      expect(renderables.length).toBeLessThanOrEqual(3);
      expect(renderables.every((mesh) => mesh.count === expectedCount)).toBe(
        true,
      );

      const transforms = renderables[0]!;
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      for (let index = 0; index < expectedCount; index += 1) {
        transforms.getMatrixAt(index, matrix);
        matrix.decompose(position, rotation, scale);
        expect(position.x).toBeCloseTo(expectedXZ[index]![0], 6);
        expect(position.z).toBeCloseTo(expectedXZ[index]![1], 6);
        const tyreBottom = Math.min(
          ...renderables.map((mesh) => {
            const instance = new THREE.Matrix4();
            mesh.getMatrixAt(index, instance);
            mesh.geometry.computeBoundingBox();
            return mesh.geometry.boundingBox!.clone().applyMatrix4(instance).min
              .y;
          }),
        );
        expect(tyreBottom).toBeCloseTo(0.27, 5);
      }
    }
  });

  it.each([false, true])(
    "keeps anonymous Keys palms outside the actual water rectangle (coarse=%s)",
    (coarse) => {
      const feature = addRegionalArrivalForeground(
        new THREE.Group(),
        [],
        "leonida-keys",
        coarse,
        renderer,
      )!;
      const water = feature.getObjectByName("keys-arrival-water") as THREE.Mesh;
      water.geometry.computeBoundingBox();
      water.updateMatrix();
      const waterBounds = water.geometry
        .boundingBox!.clone()
        .applyMatrix4(water.matrix);
      const palms = feature.children.find(
        (child) => child.name === "walk-native-palm",
      )!;
      const trunks = palms.getObjectByName(
        "palm-tapered-trunks",
      ) as THREE.InstancedMesh;
      expect(trunks.count).toBeGreaterThan(0);
      for (let index = 0; index < trunks.count; index++) {
        const matrix = new THREE.Matrix4();
        trunks.getMatrixAt(index, matrix);
        const position = new THREE.Vector3().setFromMatrixPosition(matrix);
        const inWater =
          position.x >= waterBounds.min.x &&
          position.x <= waterBounds.max.x &&
          position.z >= waterBounds.min.z &&
          position.z <= waterBounds.max.z;
        expect(inWater, `palm at ${position.x}, ${position.z}`).toBe(false);
      }
      feature.dispose();
    },
  );

  it.each([false, true])(
    "keeps Kalaga lowland trees above terrain while retaining elevated ridge pines (coarse=%s)",
    (coarse) => {
      const feature = addRegionalArrivalForeground(
        new THREE.Group(),
        [],
        "mount-kalaga",
        coarse,
        renderer,
      )!;
      feature.position.set(0, 0, 0);
      feature.rotation.set(0, 0, 0);
      feature.updateMatrixWorld(true);
      const canyon = feature.getObjectByName("kalaga-continuous-rock-ridges")!;
      const rock = canyon.getObjectByName("kalaga-photographic-rock-face")!;
      const ridgeTrunks = canyon.getObjectByName(
        "pine-tapered-trunks",
      ) as THREE.InstancedMesh;
      expect(ridgeTrunks.count).toBeGreaterThan(20);
      const generic = feature.children.find(
        (child) => child.name === "walk-native-pine",
      );
      const trunks = generic?.getObjectByName("pine-tapered-trunks") as
        THREE.InstancedMesh | undefined;
      if (trunks)
        for (let index = 0; index < trunks.count; index++) {
          const matrix = new THREE.Matrix4();
          trunks.getMatrixAt(index, matrix);
          const position = new THREE.Vector3().setFromMatrixPosition(matrix);
          const ray = new THREE.Raycaster(
            new THREE.Vector3(position.x, 100, position.z),
            new THREE.Vector3(0, -1, 0),
          );
          const ground = ray.intersectObject(rock, false)[0];
          if (ground)
            expect(
              position.y,
              `pine below terrain at ${position.x},${position.z}`,
            ).toBeGreaterThanOrEqual(ground.point.y - 0.06);
        }
      feature.dispose();
    },
  );

  it("builds a layered, non-landmark Vice City boulevard silhouette", () => {
    const parent = new THREE.Group();
    const feature = addRegionalArrivalForeground(
      parent,
      [],
      "vice-city",
      false,
      renderer,
    );
    if (!feature) throw new Error("Vice City arrival missing");

    expect(feature.name).toBe("vice-city-arrival-urban-boulevard");
    expect(feature.userData.evidence).toBe("APPROXIMATE");
    expect(feature.userData.landmarkClaim).toBe("NONE");
    expect(feature.userData.materialPalette).toEqual(
      expect.arrayContaining([
        "sun-worn asphalt",
        "pastel stucco",
        "coastal glass",
        "pale concrete",
      ]),
    );
    const shells = feature.getObjectByName("vice-city-arrival-facade-shells")!;
    const walls = shells.getObjectByName(
      "vice-city-arrival-facade-shells-walls-home",
    ) as THREE.InstancedMesh;
    expect(walls).toBeInstanceOf(THREE.InstancedMesh);
    expect(
      feature.getObjectByName("vice-city-arrival-facade-surface-panels"),
    ).toBeUndefined();
    expect(
      feature.getObjectByName("vice-city-arrival-window-rhythm"),
    ).toBeUndefined();
    // Ray through the actual opening must hit the inset interior, not a full core wall.
    feature.position.set(0, 0, 0);
    feature.rotation.set(0, 0, 0);
    feature.updateMatrixWorld(true);
    const matrix = new THREE.Matrix4();
    walls.getMatrixAt(0, matrix);
    const origin = new THREE.Vector3(0, 0, 3).applyMatrix4(matrix);
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(matrix);
    const hits = new THREE.Raycaster(origin, direction).intersectObjects(
      [shells, feature.getObjectByName("vice-city-arrival-art-deco-facades")!],
      true,
    );
    expect(hits.length).toBeGreaterThan(0);
    const local = hits[0]!.point.clone().applyMatrix4(matrix.clone().invert());
    expect(local.z).toBeCloseTo(-0.32, 3);
    expect((hits[0]!.object as THREE.Mesh).material).toBeInstanceOf(
      THREE.MeshStandardMaterial,
    );
    feature.dispose();
  });

  it("keeps four-sided facade cavities and nearby parcels in a bounded number of draws", () => {
    const feature = addRegionalArrivalForeground(
      new THREE.Group(),
      [],
      "vice-city",
      false,
      renderer,
    )!;
    const shells = feature.getObjectByName("vice-city-arrival-facade-shells")!;
    const interiors = shells.getObjectByName(
      "vice-city-arrival-facade-shells-interiors",
    ) as THREE.InstancedMesh;
    expect(interiors.count).toBeGreaterThan(500);
    let facadeDraws = 0,
      totalDraws = 0;
    shells.traverse((object) => {
      if (object instanceof THREE.Mesh) facadeDraws++;
    });
    feature.traverse((object) => {
      if (object instanceof THREE.Mesh) totalDraws++;
    });
    expect(facadeDraws).toBeLessThanOrEqual(10);
    expect(totalDraws).toBeLessThanOrEqual(50);
    expect(
      (
        feature.getObjectByName(
          "vice-city-arrival-art-deco-facades",
        ) as THREE.InstancedMesh
      ).count,
    ).toBe(10);
    feature.dispose();
  });

  it("keeps the Ambrosia arrival generic instead of duplicating or inventing a landmark", () => {
    const signCopy: string[] = [];
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: "",
          strokeStyle: "",
          lineWidth: 0,
          font: "",
          textBaseline: "",
          letterSpacing: "",
          fillRect: () => undefined,
          strokeRect: () => undefined,
          fillText: (copy: string) => signCopy.push(copy),
        }),
      }),
    });

    const feature = addRegionalArrivalForeground(
      new THREE.Group(),
      [],
      "ambrosia",
      false,
      renderer,
    );
    if (!feature) throw new Error("Ambrosia arrival missing");
    const market = feature.getObjectByName("ambrosia-arrival-roadside-market");
    const billboardPatina = feature.getObjectByName(
      "ambrosia-weathered-billboard-patina",
    ) as THREE.Mesh;
    const objectNames: string[] = [];
    feature.traverse(({ name }) => {
      if (name) objectNames.push(name);
    });

    expect(feature.userData.landmarkClaim).toBe("NONE");
    expect(market?.userData).toMatchObject({
      evidence: "APPROXIMATE",
      landmarkClaim: "NONE",
      infill: "APPROXIMATE",
    });
    expect(market?.userData.communityId).toBeUndefined();
    expect(billboardPatina).toBeInstanceOf(THREE.Mesh);
    expect(
      (billboardPatina.material as THREE.MeshStandardMaterial).map?.name,
    ).toContain("/textures/reference-led-surface-atlas.png");
    expect(objectNames.join(" ")).not.toMatch(/xero|gas-station|gas-pump/i);
    expect(signCopy.join(" ")).not.toMatch(
      /XERO|ROUTE 35|COUNTY SHERIFF|S-3|PUMP STATION|INDUSTRY RUNS DEEP|LEONIDA FOR ALL|WORK\s*•\s*FAMILY/i,
    );
  });

  it("places The Rusty Anchor at its own reviewed L325 coordinates, not at Watson Bay L544", () => {
    const feature = addRegionalArrivalForeground(
      new THREE.Group(),
      [],
      "leonida-keys",
      false,
      renderer,
    );
    if (!feature) throw new Error("Leonida Keys arrival missing");
    const landmark = feature.getObjectByName("keys-rusty-anchor");
    if (!landmark) throw new Error("The Rusty Anchor missing");
    const expected = gtadbToWorld(REVIEWED_GTADB_ANCHORS.L325.gtadb);
    const watsonBay = gtadbToWorld(REVIEWED_GTADB_ANCHORS.L544.gtadb);
    const actual = landmark.getWorldPosition(new THREE.Vector3());

    expect(actual.x).toBeCloseTo(expected.x, 5);
    expect(actual.z).toBeCloseTo(expected.z, 5);
    expect(
      actual.distanceTo(new THREE.Vector3(watsonBay.x, 0, watsonBay.z)),
    ).toBeGreaterThan(5_000);
    expect(landmark.userData).toMatchObject({
      communityId: "L325",
      nameEvidence: "KNOWN",
      placementEvidence: "APPROXIMATE",
      unconfirmed: false,
    });
  });

  it("builds The Rusty Anchor frontage from LK03-grounded volumes instead of flat stand-ins", () => {
    const feature = addRegionalArrivalForeground(
      new THREE.Group(),
      [],
      "leonida-keys",
      false,
      renderer,
    );
    if (!feature) throw new Error("Leonida Keys arrival missing");
    const landmark = feature.getObjectByName("keys-rusty-anchor");
    if (!landmark) throw new Error("The Rusty Anchor missing");

    expect(landmark.userData).toMatchObject({
      visualInterpretation: "APPROXIMATE",
      visualReference: "Rockstar / Leonida_Keys_03",
    });

    expect(
      feature.getObjectByName("keys-rusty-anchor-photoreal-facade"),
    ).toBeUndefined();
    expect(
      feature.getObjectByName("keys-rusty-anchor-yard-life"),
    ).toBeUndefined();
    expect(feature.getObjectByName("keys-rusty-anchor-crowd")).toBeUndefined();

    const roof = landmark.getObjectByName(
      "keys-rusty-anchor-pitched-metal-roof",
    ) as THREE.InstancedMesh;
    const shutters = landmark.getObjectByName(
      "keys-rusty-anchor-window-shutters",
    ) as THREE.InstancedMesh;
    const railing = landmark.getObjectByName(
      "keys-rusty-anchor-openwork-railing",
    ) as THREE.InstancedMesh;
    const tabletops = landmark.getObjectByName(
      "keys-rusty-anchor-picnic-tabletops",
    ) as THREE.InstancedMesh;
    const seats = landmark.getObjectByName(
      "keys-rusty-anchor-picnic-seats",
    ) as THREE.InstancedMesh;
    const palms = landmark
      .getObjectByName("keys-rusty-anchor-photo-palms-native")
      ?.getObjectByName("palm-tapered-trunks") as THREE.InstancedMesh;

    expect(
      landmark.getObjectByName("keys-rusty-anchor-central-gable"),
    ).toBeInstanceOf(THREE.Mesh);
    expect(
      landmark.getObjectByName("keys-rusty-anchor-central-chimney"),
    ).toBeInstanceOf(THREE.Mesh);
    expect(roof).toBeInstanceOf(THREE.InstancedMesh);
    expect(roof.count).toBe(2);
    const roofTransform = new THREE.Matrix4();
    roof.getMatrixAt(0, roofTransform);
    const roofRotation = new THREE.Quaternion();
    roofTransform.decompose(
      new THREE.Vector3(),
      roofRotation,
      new THREE.Vector3(),
    );
    expect(
      Math.abs(new THREE.Euler().setFromQuaternion(roofRotation).x),
    ).toBeGreaterThan(0.15);
    expect(shutters.count).toBeGreaterThanOrEqual(8);
    expect(railing.count).toBeGreaterThanOrEqual(12);
    expect(tabletops.count).toBe(3);
    expect(seats.count).toBe(6);
    expect(palms.count).toBe(3);
    expect(palms.geometry.attributes.position).toBeDefined();
    expect(landmark.getObjectByName("palm-individual-leaves")).toBeInstanceOf(
      THREE.InstancedMesh,
    );

    let renderableCount = 0;
    landmark.traverse((object) => {
      if (object instanceof THREE.Mesh) renderableCount += 1;
    });
    // Three native palms use separate shared trunk and crown draws.
    expect(renderableCount).toBeLessThanOrEqual(31);

    feature.updateMatrixWorld(true);
    const frontage = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(landmark.getWorldQuaternion(new THREE.Quaternion()))
      .setY(0)
      .normalize();
    expect(
      frontage.dot(new THREE.Vector3(0.627324739, 0, 0.778757831)),
    ).toBeGreaterThan(0.999);
  });

  it("keeps Port Gellhorn named venues on their individual GTADB anchors", () => {
    const signCopy: string[] = [];
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: "",
          strokeStyle: "",
          lineWidth: 0,
          font: "",
          textBaseline: "",
          letterSpacing: "",
          fillRect: () => undefined,
          strokeRect: () => undefined,
          fillText: (copy: string) => signCopy.push(copy),
        }),
      }),
    });
    const feature = addRegionalArrivalForeground(
      new THREE.Group(),
      [],
      "port-gellhorn",
      false,
      renderer,
    );
    if (!feature) throw new Error("Port Gellhorn arrival missing");

    const expectedAnchors = [
      ["port-starlet-motel", "L304", false],
      ["port-starlet-motel-sign", "L307", true],
      ["port-delights-cabaret", "L629", true],
    ] as const;
    for (const [name, anchorId, unconfirmed] of expectedAnchors) {
      const landmark = feature.getObjectByName(name);
      if (!landmark) throw new Error(`${name} missing`);
      const expected = gtadbToWorld(REVIEWED_GTADB_ANCHORS[anchorId].gtadb);
      const actual = landmark.getWorldPosition(new THREE.Vector3());

      expect(actual.x).toBeCloseTo(expected.x, 5);
      expect(actual.z).toBeCloseTo(expected.z, 5);
      expect(landmark.userData).toMatchObject({
        communityId: anchorId,
        nameEvidence: "KNOWN",
        placementEvidence: "APPROXIMATE",
        unconfirmed,
      });
    }
    const motel = feature.getObjectByName("port-starlet-motel");
    expect(motel?.userData.visualInterpretation).toBe("APPROXIMATE");
    expect(motel?.getObjectByName("port-motel-life-sprite")).toBeUndefined();
    expect(
      motel?.getObjectByName("port-starlet-motel-photoreal-facade"),
    ).toBeUndefined();
    const pitchedRoof = motel?.getObjectByName(
      "port-starlet-motel-pitched-roof",
    ) as THREE.InstancedMesh;
    const porchPiers = motel?.getObjectByName(
      "port-starlet-motel-porch-piers",
    ) as THREE.InstancedMesh;
    const windowFrames = motel?.getObjectByName(
      "port-starlet-motel-window-frames",
    ) as THREE.InstancedMesh;
    expect(pitchedRoof).toBeInstanceOf(THREE.InstancedMesh);
    expect(pitchedRoof.count).toBe(2);
    const roofTransform = new THREE.Matrix4();
    pitchedRoof.getMatrixAt(0, roofTransform);
    const rotation = new THREE.Quaternion();
    roofTransform.decompose(new THREE.Vector3(), rotation, new THREE.Vector3());
    expect(
      Math.abs(new THREE.Euler().setFromQuaternion(rotation).x),
    ).toBeGreaterThan(0.2);
    expect(porchPiers.count).toBeGreaterThanOrEqual(6);
    expect(windowFrames.count).toBeGreaterThanOrEqual(20);
    const cabaret = feature.getObjectByName("port-delights-cabaret");
    expect(cabaret?.userData).toMatchObject({
      communityId: "L629",
      placementEvidence: "APPROXIMATE",
      unconfirmed: true,
      visualInterpretation: "APPROXIMATE",
    });
    expect(
      cabaret?.getObjectByName("port-cabaret-recessed-entry"),
    ).toBeInstanceOf(THREE.Mesh);
    expect(
      cabaret?.getObjectByName("port-cabaret-vertical-fins"),
    ).toBeInstanceOf(THREE.InstancedMesh);
    expect(
      cabaret?.getObjectByName("port-cabaret-rooftop-volume"),
    ).toBeInstanceOf(THREE.Mesh);
    expect(signCopy.join(" ")).not.toMatch(
      /WIFI|POOL|OPEN LATE|NIGHT CABARET/i,
    );
    expect(signCopy.join(" ")).toMatch(/APPROXIMATE|UNCONFIRMED/i);
  });
});
