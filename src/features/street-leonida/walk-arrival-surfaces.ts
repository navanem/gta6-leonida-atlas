import type * as THREE from "three";
import { createWalkSurfaceLibrary } from "./walk-surface-assets";

type ArrivalSurfaceKeys =
  | "asphalt"
  | "wornAsphalt"
  | "concrete"
  | "paleConcrete"
  | "weatheredConcrete"
  | "cream"
  | "coral"
  | "aqua"
  | "timber"
  | "darkTimber"
  | "sandstone"
  | "darkRock"
  | "sand";

/** Apply to the materials actually used by regional geometry, including shared scenery batches. */
export function applyArrivalPhotographicSurfaces(
  materials: Readonly<Record<ArrivalSurfaceKeys, THREE.MeshStandardMaterial>>,
  coarsePointer: boolean,
): { applyRock(material: THREE.MeshStandardMaterial): void; dispose(): void } {
  const surfaces = createWalkSurfaceLibrary({
    anisotropy: coarsePointer ? 4 : 8,
  });
  // Keep old asynchronous placeholders alive until the region is released, even
  // after their original material slots have been replaced with photographed maps.
  const originalMaps = new Set<THREE.Texture>();
  const keys: ArrivalSurfaceKeys[] = [
    "asphalt",
    "wornAsphalt",
    "concrete",
    "paleConcrete",
    "weatheredConcrete",
    "cream",
    "coral",
    "aqua",
    "timber",
    "darkTimber",
    "sandstone",
    "darkRock",
    "sand",
  ];
  for (const key of keys)
    if (materials[key].map) originalMaps.add(materials[key].map!);
  surfaces.apply(materials.asphalt, "asphalt", {
    groundTileMetres: 2.1,
    roughnessFloor: 0.8,
    color: 0xe3e3df,
    normalScale: 0.32,
  });
  surfaces.apply(materials.wornAsphalt, "asphalt", {
    groundTileMetres: 2.1,
    roughnessFloor: 0.8,
    color: 0xb4aea2,
    normalScale: 0.38,
  });
  for (const key of [
    "concrete",
    "paleConcrete",
    "weatheredConcrete",
    "cream",
    "coral",
    "aqua",
  ] as const) {
    surfaces.apply(materials[key], "concrete", {
      repeat: [2, 2],
      normalScale: 0.28,
    });
  }
  surfaces.apply(materials.timber, "wood", {
    repeat: [1, 2],
    color: 0xc1a27e,
    normalScale: 0.42,
  });
  surfaces.apply(materials.darkTimber, "wood", {
    repeat: [1, 2],
    color: 0x7d6a56,
    normalScale: 0.42,
  });
  surfaces.apply(materials.sandstone, "rock", {
    repeat: [3, 2],
    color: 0xc9b39d,
    normalScale: 0.3,
  });
  surfaces.apply(materials.darkRock, "rock", {
    repeat: [2, 2],
    color: 0x8d8b7b,
    normalScale: 0.35,
  });
  surfaces.apply(materials.sand, "gravel", {
    repeat: [12, 20],
    color: 0xe5d9b5,
    normalScale: 0.28,
  });
  let disposed = false;
  return {
    applyRock(material) {
      surfaces.apply(material, "rock", { repeat: [1, 1], normalScale: 0.3 });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      surfaces.dispose();
      for (const texture of originalMaps) texture.dispose();
      originalMaps.clear();
    },
  };
}
