import type * as THREE from 'three';
import { createArchitecturalDetailKit, type ArchitecturalPalette } from './walk-architectural-kit';
import type { AxisAlignedRectangle } from './walk-engine';
import type { WalkRenderRegion } from './walk-region-streaming';

interface ArrivalArchitecture {
  collisions: AxisAlignedRectangle[];
}
const attached = new WeakMap<THREE.Group, ArrivalArchitecture>();
const palettes: Record<WalkRenderRegion, ArchitecturalPalette> = {
  'vice-city': 'coastal',
  'leonida-keys': 'coastal',
  grassrivers: 'wetland',
  'port-gellhorn': 'weathered',
  ambrosia: 'industrial',
  'mount-kalaga': 'mountain',
};

/**
 * Architectural depth for the existing anonymous arrival buildings. Dimensions
 * below follow addRegionalArrivalForeground; these are interpretations, not new
 * mapped landmarks. Positions and returned collision rectangles remain local to
 * feature, so the arrival builder applies its GTADB transform exactly once.
 */
export function addArrivalArchitecture(
  feature: THREE.Group,
  region: WalkRenderRegion,
  coarse: boolean,
): ArrivalArchitecture {
  const prior = attached.get(feature);
  if (prior) return prior;
  if (region === 'vice-city') return { collisions: [] };
  const kit = createArchitecturalDetailKit({ palette: palettes[region], coarsePointer: coarse });

  if (region === 'leonida-keys') {
    // Existing bait bar: 12 × 7 m, base 0, eaves 5.4; the named Rusty Anchor
    // retains its separate evidence-derived placement and bespoke roof.
    kit.addStorefront({
      position: [-21, 0.22, -57.32],
      width: 10.8,
      height: 3.7,
      canopyDepth: 0.7,
    });
    kit.addPorch({
      position: [-21, 0.22, -55.85],
      width: 11.8,
      depth: 2.7,
      height: 4.0,
      railings: true,
    });
    kit.addPitchedRoof({
      position: [-21, 5.45, -61],
      rotationY: 0.04,
      width: 12.5,
      depth: 7.5,
      rise: 1.35,
    });
  } else if (region === 'grassrivers') {
    // Existing fish camp has deck top y=3.4 and wall front z=-57.35.
    // Preserve its door/windows: only the structural shaded porch is added.
    kit.addPorch({
      position: [20, 3.4, -55.9],
      width: 7.2,
      depth: 2.6,
      height: 3.45,
      railings: true,
    });
    // Each outpost already has a pitched roof; attach to its actual deck.
    const outposts = [
      { x: 46, z: -126, width: 13, depth: 9 },
      { x: -43, z: -193, width: 15, depth: 10 },
    ].slice(0, coarse ? 1 : 2);
    for (const building of outposts) {
      kit.addPorch({
        position: [building.x, 2.86, building.z + building.depth / 2 + 1.2],
        width: building.width + 1.9,
        depth: 2.5,
        height: 3.25,
        railings: true,
      });
    }
  } else if (region === 'port-gellhorn') {
    // Ground colonnade fits below the existing motel balcony at y=4.65.
    kit.addPorch({ position: [-22, 0.22, -55.2], width: 25, depth: 2.25, height: 4.1 });
    kit.addRoofEquipment({ position: [-22, 10.6, -63.5], rotationY: 0.03, width: 20, depth: 7 });
    // End rooms gain deep window surrounds without obscuring existing doors.
    kit.addStorefront({
      position: [-35.18, 0.3, -62],
      rotationY: -Math.PI / 2,
      width: 8.8,
      height: 3.5,
      canopyDepth: 1.2,
    });
  } else if (region === 'ambrosia') {
    // Market building is centred (-25,-43), separate from pump canopy (-22,-31).
    kit.addStorefront({
      position: [-25, 0.22, -38.75],
      width: 16.1,
      height: 4.0,
      canopyDepth: 1.3,
    });
    kit.addPorch({ position: [-25, 0.22, -37.85], width: 16.5, depth: 1.65, height: 4.15 });
    kit.addPitchedRoof({ position: [-25, 5.08, -43], width: 17.6, depth: 8.6, rise: 1.7 });
    // Processing hall roof top y=12.7: ducts and screened equipment stay atop
    // the existing 28 × 18 m hall, clear of silos and the roadside loading lane.
    kit.addRoofEquipment({ position: [-24, 12.72, -70], rotationY: 0.03, width: 23, depth: 13 });
  } else {
    // Existing roadside shelter: 10 × 8 m, wall top y=5.2, yaw .08.
    // Its old cone roof is replaced by the arrival builder; these two planes
    // have a real ridge, sheet seams and open timber roof structure.
    kit.addPitchedRoof({
      position: [-19, 5.2, -48],
      rotationY: 0.08,
      width: 10.8,
      depth: 8.8,
      rise: 2.5,
    });
    // Full open front lets the existing offset doorway at x=-15.9 remain clear.
    kit.addPorch({ position: [-19, 0.22, -42.75], width: 10.4, depth: 2.55, height: 4.25 });
  }

  const built = kit.finish();
  built.group.name = `${region}-arrival-architecture`;
  built.group.userData.evidence = 'APPROXIMATE';
  built.group.userData.landmarkClaim = 'NONE';
  built.group.userData.materialOwnership = 'region-owned';
  feature.add(built.group);
  const result = {
    collisions: built.collisions.map((c) => ({
      minX: c.x - c.width / 2,
      maxX: c.x + c.width / 2,
      minZ: c.z - c.depth / 2,
      maxZ: c.z + c.depth / 2,
    })),
  };
  attached.set(feature, result);
  return result;
}
