import type * as THREE from "three";
import { createSceneryKit, type SceneryMaterials } from "./walk-scenery-kit";
import type { AxisAlignedRectangle } from "./walk-engine";
import type { WalkRenderRegion } from "./walk-region-streaming";

export interface SceneryFootprint {
  x: number;
  z: number;
  width: number;
  depth: number;
}
interface SceneryResult {
  collisions: AxisAlignedRectangle[];
  parcels: readonly SceneryFootprint[];
}
const attached = new WeakMap<THREE.Group, SceneryResult>();

/** Physical regional context inspired by Rockstar's regional descriptions and
 * public stills. It never adds a confirmed location or changes a reviewed anchor.
 * Each parcel is admitted as a whole against the original building footprints.
 */
export function addRegionalScenery(
  feature: THREE.Group,
  region: WalkRenderRegion,
  coarse: boolean,
  occupied: readonly SceneryFootprint[],
  materials: Partial<SceneryMaterials> = {},
): SceneryResult {
  const previous = attached.get(feature);
  if (previous) return previous;
  const kit = createSceneryKit(materials);
  const accepted: SceneryFootprint[] = [];
  const parcels: string[] = [];
  function parcel(
    id: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    build: () => void,
  ) {
    // Includes road, shoulder and a pedestrian safety margin in every region.
    if (Math.abs(x) - width / 2 < 16) return;
    if (
      [...occupied, ...accepted].some(
        (c) =>
          Math.abs(x - c.x) < (width + c.width) / 2 + 1.2 &&
          Math.abs(z - c.z) < (depth + c.depth) / 2 + 1.2,
      )
    )
      return;
    accepted.push({ x, z, width, depth });
    parcels.push(id);
    build();
  }
  function post(x: number, y: number, z: number, height: number) {
    kit.box("wood", [x, y + height / 2, z], [0.19, height, 0.19], 0, true);
  }
  function crate(x: number, y: number, z: number, width = 1.1) {
    kit.box("wood", [x, y + 0.5, z], [width, 1, 0.85], 0, true);
    for (const offset of [-0.32, 0.32])
      kit.box("metal", [x + offset, y + 0.5, z + 0.435], [0.035, 0.94, 0.035]);
    for (let i = 0; i < 4; i++)
      kit.box(
        "accent",
        [x - width * 0.36 + i * width * 0.24, y + 1.03, z],
        [width * 0.17, 0.16, 0.5],
        0,
        false,
        i % 2 ? 0xb4bf71 : 0xd19c65,
      );
  }
  function bench(x: number, y: number, z: number) {
    for (let i = 0; i < 4; i++)
      kit.box("wood", [x, y + 0.52, z - 0.23 + i * 0.15], [2.1, 0.08, 0.12]);
    for (const side of [-1, 1])
      kit.box(
        "metal",
        [x + side * 0.8, y + 0.23, z],
        [0.12, 0.46, 0.52],
        0,
        true,
      );
    kit.box("wood", [x, y + 0.96, z - 0.31], [2.1, 0.46, 0.08]);
  }
  function stall(x: number, z: number, seed: number) {
    for (const xx of [-2.3, 2.3])
      for (const zz of [-1.4, 1.4]) post(x + xx, 0.18, z + zz, 3.1);
    kit.box(
      "canvas",
      [x, 3.4, z],
      [5.2, 0.16, 3.5],
      0,
      false,
      seed % 2 ? 0x769d96 : 0xd7b476,
    );
    kit.box("wood", [x, 1.05, z], [4.5, 0.2, 1.3], 0, true);
    for (let i = 0; i < (coarse ? 3 : 5); i++)
      crate(x - 1.8 + i * 0.9, 1.18, z, 0.65);
  }
  function shop(
    x: number,
    z: number,
    width: number,
    color: number,
    shutter = false,
  ) {
    // Front is an actual recessed opening: back/side walls and a deep lintel.
    kit.box("plaster", [x, 2.1, z - 2.6], [width, 4.2, 0.35], 0, true, color);
    for (const side of [-1, 1])
      kit.box(
        "plaster",
        [x + side * (width / 2 - 0.18), 2.1, z],
        [0.36, 4.2, 5.5],
        0,
        true,
        color,
      );
    kit.box("plaster", [x, 3.75, z + 2.6], [width, 0.9, 0.42], 0, false, color);
    kit.box("glass", [x, 1.65, z + 2.1], [width - 0.75, 3.1, 0.15]);
    kit.box("concrete", [x, 0.12, z], [width + 0.4, 0.24, 6.1]);
    kit.box("concrete", [x, 4.24, z], [width + 0.6, 0.22, 5.9]);
    if (shutter)
      for (let y = 0.3; y < 3.15; y += coarse ? 0.32 : 0.18)
        kit.box(
          "metal",
          [x, y, z + 2.35],
          [width - 0.8, 0.12, 0.12],
          0,
          false,
          0xb7aca0,
        );
    else {
      kit.box("canvas", [x, 3.3, z + 3.5], [width + 0.2, 0.16, 2.2]);
      for (const side of [-1, 1])
        kit.box(
          "metal",
          [x + side * (width / 2 - 0.65), 1.6, z + 2.25],
          [0.07, 3.1, 0.1],
        );
      crate(x - width * 0.25, 0.2, z + 3.3, 0.7);
    }
  }
  function boat(x: number, z: number, size = 1) {
    // One waterline-relative transform for the entire scaled vessel.
    const hullY = 0.18 + 0.45 * size - 0.12;
    const y = (height: number) => hullY + (height - 0.55) * size;
    kit.hull([x, hullY, z], [2.35 * size, 0.9 * size, 6.8 * size]);
    kit.box("wood", [x, y(0.98), z], [1.86 * size, 0.12 * size, 5.4 * size]);
    kit.box(
      "plaster",
      [x, y(1.68), z - 0.4 * size],
      [1.7 * size, 1.3 * size, 2.4 * size],
    );
    kit.box(
      "glass",
      [x, y(1.9), z + 0.83 * size],
      [1.4 * size, 0.65 * size, 0.08 * size],
    );
    kit.box(
      "canvas",
      [x, y(2.5), z - 0.2 * size],
      [2.05 * size, 0.13 * size, 2.9 * size],
    );
    for (const side of [-1, 1])
      kit.beam(
        "metal",
        [x + side * 0.9 * size, y(1.2), z + size],
        [x + side * 0.9 * size, y(1.2), z + 2.6 * size],
        0.05 * size,
        0xffffff,
        true,
      );
    kit.box(
      "metal",
      [x, y(0.8), z - 3.2 * size],
      [0.65 * size, 0.8 * size, 0.7 * size],
    );
  }
  function dock(x: number, z: number, width: number, length: number) {
    const planks = coarse ? 12 : 22;
    for (let i = 0; i < planks; i++)
      kit.box(
        "wood",
        [x, 0.45, z - length / 2 + ((i + 0.5) * length) / planks],
        [width, 0.18, (length / planks) * 0.93],
      );
    for (const side of [-1, 1])
      for (let offset = -length / 2; offset <= length / 2; offset += 6) {
        kit.box(
          "wood",
          [x + side * (width / 2 - 0.16), 0.25, z + offset],
          [0.23, 2.1, 0.23],
          0,
          true,
        );
        kit.box(
          "metal",
          [x + side * (width / 2 - 0.16), 1.34, z + offset],
          [0.34, 0.11, 0.34],
        );
      }
  }

  if (region === "vice-city") {
    parcel("shaded-bakery-court", -45, 47, 28, 24, () => {
      kit.box("concrete", [-45, 0.09, 47], [27, 0.18, 23]);
      shop(-50, 40, 12, 0xe2b792);
      shop(-37.5, 40, 10, 0x9db8ad);
      for (let i = 0; i < 3; i++) {
        bench(-53 + i * 7, 0.2, 54);
        kit.box("concrete", [-53 + i * 7, 0.6, 58], [2.2, 1.0, 1.4], 0, true);
      }
      stall(-42, 50, 0);
    });
    parcel("open-market-court", 45, 50, 27, 25, () => {
      kit.box("ground", [45, 0.1, 50], [27, 0.18, 25]);
      for (let i = 0; i < 4; i++)
        stall(38 + (i % 2) * 12, 44 + Math.floor(i / 2) * 10, i);
      bench(45, 0.19, 60);
    });
  } else if (region === "leonida-keys") {
    parcel("marina-working-quay", 40, -42, 30, 34, () => {
      dock(31, -42, 4.2, 30);
      for (let i = 0; i < 3; i++) {
        const z = -52 + i * 10;
        kit.box("wood", [39, 0.44, z], [15, 0.19, 2.1]);
        boat(39, z + 4.5, 0.85 + i * 0.06);
        post(46, 0.15, z, 1.8);
      }
      crate(31, 0.6, -30);
      crate(31, 0.6, -35);
    });
    parcel("coastal-town-frontage", -43, 27, 27, 25, () => {
      kit.box("concrete", [-43, 0.05, 27], [27, 0.14, 24]);
      shop(-48, 22, 11, 0xc7d8b1);
      shop(-36.2, 22, 10.5, 0xdfb8a6);
      bench(-44, 0.16, 33);
      stall(-35, 34, 1);
    });
  } else if (region === "grassrivers") {
    parcel("working-dock-shelter", -38, -40, 26, 26, () => {
      dock(-38, -39, 11, 22);
      for (const x of [-42.4, -33.6])
        for (const z of [-46, -37]) post(x, 0.55, z, 4.0);
      kit.roof([-38, 4.65, -41.5], 11.5, 12, 1.2);
      for (let i = 0; i < 4; i++) {
        crate(-41 + i * 2, 0.6, -46);
        kit.box("wood", [-41 + i * 2, 0.78, -35], [1.6, 0.18, 1.2]);
      }
      boat(-29, -40, 0.72);
      kit.beam("metal", [-39, 4.2, -41], [-39, 1.7, -41], 0.06, 0xffffff, true);
      bench(-40, 0.55, -31);
    });
    parcel("wetland-boardwalk-spur", 35, 14, 24, 18, () => {
      dock(35, 14, 3.6, 16);
      dock(42, 9, 10, 3.6);
      for (let i = 0; i < 6; i++)
        kit.box("wood", [27 + i * 2.4, 0.32, 20], [0.22, 0.64, 0.22], 0, true);
      bench(42, 0.6, 10);
    });
  } else if (region === "port-gellhorn") {
    parcel("vacant-strip-court", -45, -18, 29, 25, () => {
      kit.box("concrete", [-45, 0.07, -18], [29, 0.14, 25]);
      for (let i = 0; i < 3; i++)
        shop(-54 + i * 9, -25, 8.4, i % 2 ? 0xa4aaa0 : 0xbd9a89, true);
      for (let i = 0; i < 4; i++) {
        kit.box(
          "concrete",
          [-55 + i * 6, 0.2, -10],
          [2.2, 0.25, 0.25],
          0,
          true,
        );
        crate(-54 + i * 4, 0.15, -15, 0.8);
      }
      bench(-39, 0.14, -9);
    });
    parcel("truck-stop-clearing", 45, 31, 26, 25, () => {
      kit.box("ground", [45, 0.035, 31], [26, 0.1, 25]);
      for (let i = 0; i < 4; i++) bench(36 + i * 5.5, 0.14, 37);
      for (const x of [37, 52]) for (const z of [24, 31]) post(x, 0.13, z, 3.4);
      kit.roof([44.5, 3.6, 27.5], 17, 9, 1.2);
      crate(40, 0.16, 26);
      crate(47, 0.16, 26);
    });
  } else if (region === "ambrosia") {
    parcel("refinery-loading-yard", 45, -42, 30, 31, () => {
      kit.box("concrete", [45, 0.05, -42], [30, 0.13, 31]);
      for (const x of [34, 55])
        for (const z of [-52, -32])
          kit.box("metal", [x, 3.3, z], [0.45, 6.6, 0.45], 0, true);
      for (const z of [-52, -32])
        kit.beam("metal", [34, 6.3, z], [55, 6.3, z], 0.5);
      for (let i = 0; i < 4; i++)
        kit.beam(
          "metal",
          [34 + i * 1.2, 5.5, -52],
          [34 + i * 1.2, 5.5, -32],
          0.42,
          0xd5d1bd,
          true,
        );
      for (let i = 0; i < 6; i++)
        crate(43 + (i % 3) * 3, 0.14, -43 + Math.floor(i / 3) * 9, 1.6);
      shop(49, -50, 11, 0xc0b69b, true);
    });
    parcel("field-service-structure", -42, 20, 26, 24, () => {
      kit.box("ground", [-42, 0.035, 20], [26, 0.1, 24]);
      for (const x of [-51, -33])
        for (const z of [14, 25]) post(x, 0.16, z, 3.7);
      kit.roof([-42, 3.95, 19.5], 20, 13, 1.5);
      for (let i = 0; i < 5; i++) crate(-49 + i * 3.5, 0.17, 16, 1.4);
      kit.beam("metal", [-51, 1.1, 29], [-32, 1.1, 29], 0.32, 0xffffff, true);
    });
  } else {
    parcel("trailhead-working-shelter", -30, 33, 27, 24, () => {
      kit.box("ground", [-30, 0.035, 33], [27, 0.1, 24]);
      for (const x of [-37, -23])
        for (const z of [25, 36]) post(x, 0.17, z, 3.1);
      kit.roof([-30, 3.45, 30.5], 16, 13, 1.65);
      bench(-34, 0.16, 28);
      bench(-26, 0.16, 34);
      crate(-35, 0.16, 36, 1.3);
      for (let i = 0; i < 8; i++)
        kit.box(
          "concrete",
          [-40 + i * 2.7, 0.3, 42],
          [1.2, 0.5, 0.8],
          i * 0.28,
          true,
        );
    });
    parcel("stream-access-dock", 26, -101, 18, 20, () => {
      dock(26, -101, 3.4, 16);
      bench(30, 0.55, -95);
      kit.box("accent", [31, 1.5, -105], [0.22, 3, 0.22], 0, true, 0xf2d155);
      for (let i = 0; i < 9; i++)
        kit.box("metal", [31.13, 0.35 + i * 0.3, -105], [0.035, 0.035, 0.16]);
      kit.hull([30, 0.315, -99], [0.72, 0.45, 4.2]);
      kit.hull([32, 0.315, -99], [0.72, 0.45, 4.2]);
    });
  }
  const built = kit.finish();
  built.group.name = `${region}-regional-scenery`;
  Object.assign(built.group.userData, {
    evidence: "APPROXIMATE",
    landmarkClaim: "NONE",
    reference: "Rockstar / Only in Leonida",
    parcels,
  });
  feature.add(built.group);
  const result = { collisions: built.collisions, parcels: accepted };
  attached.set(feature, result);
  return result;
}
