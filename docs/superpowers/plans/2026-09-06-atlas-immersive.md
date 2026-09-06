# Leonida immersive environments implementation plan

> For agentic workers: use subagent-driven development for independent components and review integration before delivery.

**Goal:** Ship a researched, visibly richer v0.8.0 across all six 3D regions.
**Architecture:** Extend existing Three.js streaming with shared facade shells, regional scenery, sourced materials and a bounded color/depth postprocess. Preserve map/evidence and deployment boundaries.
**Tech Stack:** TypeScript, Three.js 0.185.1, Vite, Vitest, Playwright, existing Docker deployment.
**Spec:** ../specs/2026-09-06-atlas-immersive-design.md

## Global constraints
Preserve reviewed coordinates; label decorative placements APPROXIMATE. No private Analytics values or accounts code in the public diff. No new runtime dependency. Retain releases from v0.5.0. Browser plugin is unavailable: use installed Playwright Chromium and record software-renderer limitations.

### 1. Verified public context
- [x] Create isolated worktree and verify baseline: 503 tests.
- [x] Check official Rockstar regions and new public material; retain primary URLs and checked dates.
- [x] Add a typed claim catalog and expose useful regional facts through existing evidence UI, keeping existence and placement certainty separate.
- [x] Test referenced region/anchor validity, primary-source provenance and integration.

### 2. Architectural depth and local detail
Files: walk-facade-shell.ts, walk-window-interiors.ts, walk-building-fabric.ts, walk-cartography.ts, walk-road-geometry.ts and focused tests.
Interface: createFacadeShellKit().create(specs,name) returns root,setDetail,dispose; spec front-bottom position,rotationY,width,height,seed,style,optional floors/bayWidth/color/storefront/balconies. Preserve fabric API and add setView(position,nearDistance) for spatial detail.
- [x] Test rotated facade bounds, core clearance, deterministic room variants and disposal before integration.
- [x] Implement recessed jambs/view-dependent interiors, regional roof/storefront variants, spatial near detail and source-aware verges.
- [x] Verify desktop/touch facade view and source footprints.

### 3. Coherent regional scenery
Files: walk-regional-scenery.ts, walk-scenery-kit.ts, walk-native-vegetation.ts, walk-regional-arrivals.ts and focused tests.
Interface: addRegionalScenery(feature,region,coarsePointer,occupied) returns local collisions and accepted parcel footprints; existing region traversal owns geometry/material disposal. Connect facade shells to authored Vice fronts.
- [x] Implement distinct connected parcels in six regions from verified context, preserving entry/road clearance.
- [x] Add batched roots/reeds/shoreline and improve forest geometry efficiency.
- [x] Test collision, occupancy, finite geometry and bounded instances; inspect real views.

### 4. Surface materials and local shading
Files: walk-surface-assets.ts, walk-arrival-surfaces.ts, walk-postprocessing.ts, walk-world.ts; locally served surface assets and attribution.
- [x] Acquire a bounded set of verified CC0 photographs/normal/roughness textures and record provenance.
- [x] Implement async local upgrades with generated fallback, shared source handling and disposal; verify failure and late-load behavior.
- [x] Test target sizing and depth reconstruction, then implement one-scene-render contact shading and proper output color conversion.
- [x] Wire resize/render/disposal, inspect shaded geometry and nighttime/highlight behavior; fix observed artifacts.

### 5. Integration verification
- [x] Inspect baseline/candidate all six regions and reverse/near views; iterate on concrete visual defects.
- [x] Run full tests, typecheck, lint, production build and browser regression, including selected destination and touch movement.
- [x] Independently review geometry, rendering lifecycle, source claims and private-content boundaries.

### 6. Production and release

Delivery procedure; publication and live checks provide the completion record.

- Update version/release catalog/About to v0.8.0; preserve earlier history.
- Build and verify official candidate including private accounts and Analytics configuration.
- Integrate reviewed public changes, deploy web only, verify live bytes/health and unchanged account/parent services.
- Publish GitHub v0.8.0 release, confirm checks and release history, and return concise completion with actual screenshots/evidence and limits.
