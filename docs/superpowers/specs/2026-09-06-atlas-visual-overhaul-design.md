# Leonida Atlas visual overhaul

The requested outcome is a visibly richer, coherent, navigable environment across all six regions. The supplied screenshots are the primary art direction: dense white waterfront architecture, mural viaducts and a faceted arena in Vice City; bridges and marinas in the Keys; humid wetlands; distressed roadside neon in Port Gellhorn; commercial and industrial Ambrosia; forested rock cuts and railway infrastructure in Kalaga.

## Existing architecture and evidence

React/Vite hosts a Three.js 0.185.1 explorer. `walk-world.ts` owns the renderer, movement and lifecycle. `walk-region-builders.ts` streams six independently disposable regions. `walk-cartography.ts` loads the source raster and derives local buildings and roads. `walk-regional-arrivals.ts` provides the active close-range compositions; Vice City and Ambrosia also have dedicated builders. The older `walk-architecture.ts` path is active only for Keys, Port Gellhorn and Kalaga.

Coordinates remain `x = 2 × GTADB.x`, `z = -2 × GTADB.y`; reviewed anchors and travel approaches are unchanged. Modeled geography remains an APPROXIMATE community reconstruction. A reference image establishes appearance, not an exact unrecorded position. The repository has color/vegetation/facade assets but no licensed rigged people or architectural GLB models. Existing images should be reused; geometry remains real navigable geometry, not a replacement screenshot.

## Prioritized defects

1. Large opaque continuity ground at y=0.085 covers source cartography at y=0.055, including the default Vice City arrival. Restore the source/continuity layer order while retaining close authored paving.
2. Radius=1 mistakenly also selects low detail, dropping half of desktop building footprints and reducing road extraction to 16 m steps. Separate coverage, detail and distance LOD. Preserve valid nearby footprints, occupancy and orientation.
3. The Vice City arrival is composed north of the player; its road ends 28 m behind the arrival. Other arrivals are also small isolated vignettes. Build a coherent surrounding context, with road clearance, varied frontage and regional vegetation.
4. Landmark silhouettes and floor heights are inconsistent: an eight-level hotel is only 12 m tall and the arena resembles an ellipse. Give major landmarks dedicated geometry, retaining their supported anchors and collision clearance.
5. People have unarticulated cylinder/block bodies, inaccurate proportions and poor ground contact. Use a shared articulated pedestrian with varied proportions and clothing, and integrate every active path.
6. Water changes color instead of showing traveling surface detail; indoor reflection lighting, weak clouds and uniform materials flatten the scene. Improve outdoor illumination, shadows, water normals and grounded surface detail.

## Implementation boundaries

- Cartography owner: footprint/road extraction and generated regional architecture, terrain continuity layer ordering. Preserve async cancellation, cache bounds, protected arrival and collision semantics.
- Character owner: shared rigged pedestrian, moving life, vehicle surface separation and contact; hand off narrow static-actor and skeleton lifecycle calls.
- Landmark owner: dedicated hotel, arena, mural and waterfront structures in `walk-vice-city.ts`, plus a reusable architectural detail kit for root integration in other active builders.
- Root: `walk-world.ts`, atmospheric/material/water improvements, active six-region arrival context, cross-module integration and final visual review.

Use shared geometries/materials, instanced static detail and bounded spatial/distance visibility. Do not increase density by adding thousands of independent meshes. Do not change account, analytics or local-data boundaries.

## Validation and completion

Before/after captures use the same eye-level camera and region controls, including the south-facing Vice City view from the user's report. Review all six regions, landmark approach views, characters, desktop and touch-sized views. Record real draw calls, triangles and frame timings with renderer/hardware limitations identified; no unsupported FPS claim. Check roads/ground contact, z-fighting, texture loading, collision clearance, travel selection, unloading and console health.

Run meaningful geometry/lifecycle regression tests, the existing typecheck/lint/unit/build checks and browser navigation tests. Unit baseline is 458 passing tests. The existing mobile WebKit test that removes IndexedDB already fails in 0.6.1 and 0.6.2 and is not a visual-change regression.

Release only the validated source and actual render captures. Keep private configuration outside GitHub and preserve release history from v0.5.0. Report the remaining absence of original game models or exact surveyed geometry without presenting approximate reconstruction as a game-asset reproduction.
