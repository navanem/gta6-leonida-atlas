# Leonida Atlas visual overhaul implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development; independent owners share this isolated worktree. Root alone integrates shared files and handles publication.

**Goal:** Deliver an immediately visible improvement across the six-region explorer, preserving source geography and interaction behavior.

**Architecture:** Extend the current streamed builders with shared geometric and material systems. Source cartography provides the reliable coarse layout; nearby authored context adds explicitly approximate architectural detail. Rendering and resource lifetimes remain centralized.

**Tech Stack:** TypeScript, React, Three.js 0.185.1, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-06-atlas-visual-overhaul-design.md`

## Global constraints

- Preserve reviewed coordinates, selected destinations and account/analytics isolation.
- Real 3D geometry and source-led appearance; no screenshot replacement of the explorer.
- All uncertain geometry remains APPROXIMATE.
- Shared/instanced geometry for repeated objects; disposal on unload and remount.
- Raw QA reports remain outside the repository. Selected actual screenshots and a sanitized verification record are published under `docs/visual-overhaul/`.
- No unrelated dependency upgrades or rewrites.

## Task 1 — Ground truth, coverage and regional building fabric

Files: `walk-cartography.ts`, new footprint/architecture helper as needed, terrain constants and hierarchy in `walk-region-builders.ts`; corresponding geometry tests. Root edits `walk-world.ts` options only after the owner returns its interface.

- [x] Separate `radius` from an explicit detail option; keep complete near-field occupancy on desktop and mobile and simplify distant detail instead of deleting half the footprints.
- [x] Infer orientation and dimensions from source pixels. Maintain conservative collision coverage and protected-arrival exclusion. Retain representable parts of large irregular components.
- [x] Choose consistent regional facade/floor/roof families, with shared instanced recesses, cornices, windows and roof fixtures. Use distance LOD for detail.
- [x] Reduce staircase road extraction and place roadside details using accumulated distance. Source coverage stays bounded and async work cancellable.
- [x] Place coarse terrain continuity below the source raster; test source visibility numerically at the reported Vice City arrival and another region.
- [x] Run geometry, travel, streaming and resource tests; report options for root integration.

Regression assertions must verify geometry, not descriptive metadata, for example:

```ts
expect(sourceGroundY).toBeGreaterThan(continuityGroundY);
expect(nearbyRetainedFootprints).toHaveLength(validSourceFootprints.length);
expect(orientedFootprintBoundsContainSourcePixels).toBe(true);
expect(
  buildingCollisions.some((rect) => overlaps(rect, protectedArrival)),
).toBe(false);
```

## Task 2 — Articulated people and grounded vehicles

Files: new `walk-pedestrians.ts`, `walk-life.ts`, `walk-vehicles.ts`, focused actor tests. Root applies static-actor call sites in other builders and centralized skeleton cleanup.

- [x] Produce a reusable pedestrian factory/controller with a real 3D silhouette, head/neck/jaw/hair, shoulders/waist, hands/shoes and multiple clothing/body palettes.
- [x] Use a single skinned mesh per actor with shared near/mid geometry (about 1800/450 triangles), distance-driven walking and varied idle poses. Keep clothing non-emissive and feet planted on the actual surface.
- [x] Replace moving life and supply narrow static-builder integration instructions for active arrivals and any legacy compatibility path.
- [x] Separate vehicle glass, rubber, metal, paint and clothing response without losing instanced parked vehicles. Fix tyre contact, direction and meaningful wheel motion.
- [x] Verify actual bone/foot transforms, height bounds, contact, resource disposal and traffic obstacles at current coordinates.

The owner supplies exact constructor/update/dispose signatures before root integrates. Tests exercise the returned object and animated transforms rather than checking cue strings.

## Task 3 — Landmark architecture and reusable detail kit

Files: `walk-vice-city.ts`, new reusable architectural kit, corresponding landmark tests. Root owns calls in `walk-regional-arrivals.ts` and other shared builders.

- [x] Model the supported waterfront hotel using stepped volumes, credible floor heights, recessed glazing, balcony bands, a terrace/podium and roof equipment.
- [x] Replace the arena's generic ellipse with a faceted shell and emissive panel seams, coherent glazing/base volumes and entrance treatment. Preserve its supported anchor and clearance.
- [x] Enrich viaducts/mural surfaces, waterfront frontage and skyline variants using existing assets and shared geometry.
- [x] Supply a reusable kit for porch/awning, storefront, roof, railing and facade details that root can apply to Keys/Port/Ambrosia/Grassrivers/Kalaga.
- [x] Test silhouette bounds, scale, source anchor preservation, road clearance and draw budgets.

## Task 4 — Surrounding context and rendering

Files: `walk-regional-arrivals.ts`, `walk-world.ts`, `walk-atmosphere.ts`, `walk-materials.ts`, focused new outdoor-light/water module if needed.

- [x] Extend the active arrival context around the player, beginning with the south-facing Vice City void; integrate sidewalks and source-supported connections without moving anchors or placing buildings in roads.
- [x] Apply region-specific frontage, vegetation layering and street furniture across all six arrivals, using the existing footprint and asset vocabulary.
- [x] Integrate the shared actor and architectural kits into actual runtime paths and dispose all new resources on region unload/unmount.
- [x] Replace indoor reflection cues with a bounded outdoor environment; tune readable contact shadows, sunlight/ambient balance and cloud/haze depth.
- [x] Give water spatially traveling normals/ripples and region-appropriate color/roughness; preserve shoreline/source masking and avoid screen-filling transparent layers.
- [x] Tune source coverage and distance detail using measured renderer counters rather than simply reducing pixel quality.

## Task 5 — Visual iteration, regression checks and delivery

- [x] Capture baseline and final six-region arrivals plus Vice City south, landmark details and people. Record the differing baseline/final viewports and framing; these are qualitative comparisons, not pixel-matched captures.
- [x] Inspect images for empty backdrops, architecture proportions, road connections, vegetation variety, contact, water, shadows and regional differentiation; fix observed defects.
- [x] Exercise selected-map arrival and distant travel in Chromium (Ambrosia to Keys); verify lifecycle, movement/collision and resource cleanup through regression tests.
- [ ] Complete and record the separate mobile/touch browser pass; desktop software rendering does not establish physical mobile GPU performance.
- [x] Run typecheck, lint, all unit tests, build and relevant browser tests. Record bounded renderer/performance evidence with the SwiftShader limitation.
- [x] Have an independent reviewer inspect final changes and visual comparisons; address actionable findings.
- [ ] Update version/release notes and actual screenshots only after validation, integrate through the repository's current GitHub checks, deploy the tested official build with private configuration preserved, and verify the live result.

Verification evidence: [visual-overhaul/VERIFICATION.md](../../visual-overhaul/VERIFICATION.md). Publication/live verification remains unchecked until the tested build is deployed and checked.
