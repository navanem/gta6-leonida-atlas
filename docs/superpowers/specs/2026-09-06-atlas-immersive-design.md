# Leonida immersive environments — v0.8.0 design

## Existing state and chosen approach
The v0.7.0 baseline passes 503 tests. It retains reliable community map footprints, reviewed arrival anchors, six streamed regions, native articulated actors and batched architecture. Foreground streets still have repeated flat facades; available surface textures read as noise, and joints lack local shading. Region identity needs complete small parcels and waterfront edges.

Preserve this architecture and improve its rendering and content together. A replacement engine would discard working map alignment and lifecycle controls. Adding decorative objects alone leaves the main facade and surface weaknesses visible. The chosen approach combines a reusable architectural shell, verified regional context, coherent scenery parcels, photographed CC0 surface materials, and bounded depth-based contact shading.

## Interfaces and ownership
- A reusable facade shell accepts local front-bottom placement, yaw, dimensions, seed, style, and optional storefront/balcony choices. Facades have recessed jambs and opaque view-dependent interiors. Authored Vice City cores retreat behind their shell. Streamed buildings keep their source footprint and yaw; local detail is culled separately from base occupancy.
- Regional scenery adds connected waterfront/roadside parcels to existing approximate scene envelopes. New solids participate in collisions and vegetation exclusions. Existing reviewed named coordinates remain unchanged.
- Public research is stored as concise paraphrased claims with primary URLs, checked dates, and explicit scope. Confirmed existence does not imply confirmed placement. Evidence panels expose these distinctions.
- Photographed surfaces are served locally, with source/license metadata. Color maps use sRGB; normal and roughness maps remain linear. Existing generated materials provide the loading/error fallback and resource ownership remains explicit.
- A render pipeline captures color and depth in one scene render, evaluates bounded contact shading, and composites to the display with one tone/color conversion. Reduced touch settings retain readable rendering. Resize and disposal cover all targets; unsupported configurations fall back once to direct rendering.

## Visual goals by region
Vice City: varied recessed storefronts and balcony fronts, shaded shop courts and readable street materials. Keys: connected quay, marina slips and proper boat hulls. Grassrivers: stilt dock groups, rooted cypress and reeds. Port Gellhorn: worn commercial forecourt and nighttime light contact. Ambrosia: sugar-industry pipework/loading context and rural roadside grain. Kalaga: timber trail context, rock surfaces and geometry-efficient forest edges.

## Constraints
No invented confirmed locations or use of leaked material. Keep accounts, consent and deployment-only Analytics configuration intact and out of public commits. Keep history from v0.5.0. Reuse Three.js 0.185.1; no new runtime dependencies. Small shared assets and batched geometry; no high-cost transparent transmission or scene rerender solely for normals. Do not equate software Chromium timings with hardware FPS or claim game-level fidelity.

## Validation
Capture identical viewport/pose baseline and candidate in all six regions; inspect close-range surfaces and facades, reverse views, touch viewport and travel interactions. Test facade transforms/clearance, data provenance, target sizing/color/depth/lifecycle, async texture fallback/disposal and source occupancy. Run full unit, typecheck, lint, production build, browser regression and official container checks. Only publish after visual correction and independent review.
