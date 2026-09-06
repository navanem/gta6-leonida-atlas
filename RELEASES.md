# Releases

Release history, newest first.

## v0.8.0 — 2026-09-06

**Released: deeper streets and researched regional scenes.**

The 3D explorer adds coherent local scenes around all six regional arrivals: a bakery court and market in Vice City, working marina in the Keys, stilt structures in Grassrivers, weathered retail in Port Gellhorn, an industrial service yard in Ambrosia, and trail shelter and stream access in Kalaga.

- Fifteen short discoveries link to official Rockstar descriptions and public images in place details, search and Evidence. Source observations remain unpositioned; regional travel uses existing reviewed arrivals.
- Window openings have real depth and view-dependent room interiors, with balconies, storefronts, roof setbacks and service details. Mapped urban roads gain curbs, gutters and drainage; rural roads keep softer verges.
- Five locally served CC0 photographic surface sets provide color, normal and roughness detail for asphalt, concrete, rock, wood and gravel. Source manifests retain licensing, dimensions and checksums.
- Contact shading, higher-resolution nearby shadows and restrained highlight glow improve depth. A direct-render fallback covers unavailable HDR targets or failed effect shaders.
- Shared GPU texture sources, spatial facade detail and leaner native forest geometry bound the extra rendering cost. Regional terrain clears the actual accepted scenery footprints.
- Evidence and regional travel work with native keyboard activation. Existing accounts, local workspaces, selected destinations and private deployment Analytics configuration are preserved.

Validation covers geometry, parcel occupancy, terrain clearance, source provenance, texture reuse and late disposal, rendering state and fallback, plus Chromium regional views and navigation. The test environment uses SwiftShader software rendering, so it does not establish hardware frame rates or real iOS graphics performance.

Research uses [Only in Leonida](https://www.rockstargames.com/VI/only-in-leonida) and its official public imagery. The catalogue also links the [Extended Look](https://www.rockstargames.com/VI/an-extended-look) without deriving unverified footage details. Decorative placements and unmeasured relief remain **APPROXIMATE**. This browser reconstruction retains visible simplifications; exact game models, dimensions and surveyed terrain are not available in the project.

## v0.7.0 — 2026-09-06

**Released: a fuller, living 3D Leonida.**

The explorer restores mapped road visibility and building occupancy, including the view behind Vice City's arrival. Ground-tile coverage is separate from visual detail: desktop/mobile retain 7×7/5×5 tile neighborhoods, while detailed facade geometry is limited to 300/220 metres.

- Rotated footprints, regional floor spacing, roofs, recessed windows and smoother source-road geometry replace repeated axis-aligned boxes and gaps.
- Hotel Dixon, the Sahara arena, waterfront towers and the mural viaduct have rebuilt volumes. Existing regional arrivals gain porches, pitched roofs, storefronts and service details.
- Original skinned pedestrians replace block figures and oversized life collages. Feet and tyres meet active street surfaces, and traffic follows the actual Vice City and rotated Ambrosia arrival frames.
- Native nearby foliage, continuous local Kalaga rock ridges, outdoor reflections, traveling water normals, shaded clouds and bounded night streetlights deepen the regional scenes.
- Coordinate provenance, source attribution, map data, local workspaces and deployment-only account/Analytics boundaries are preserved. Existing releases from v0.5.0 remain available in About.

Validation includes 503 unit/integration tests, TypeScript, ESLint, a production build, actual Chromium views of all six regions and additional landmark/actor captures. Geometry, contact, streaming and disposal checks are included. GPU measurements were obtained with software rendering; no hardware FPS guarantee is claimed.

The supplied game screenshots guide the visual interpretation. Original game models, exact building heights, comprehensive surveyed relief and rigged game characters were not supplied. New local details remain **APPROXIMATE**, and the result is a browser reconstruction with visible simplifications. See [visual verification](https://github.com/navanem/gta6-leonida-atlas/blob/v0.7.0/docs/visual-overhaul/VERIFICATION.md).

## v0.6.2 — 2026-09-06

**Released: public collaboration and security hardening.**

The repository is now public and ready for community forks, corrections and focused pull requests. Contribution guidelines, a code of conduct, issue forms, a pull-request template and a security policy define how to propose changes and report vulnerabilities. The default branch requires a pull request, a successful Quality check, resolved conversations and linear history; force pushes and branch deletion are blocked.

Continuous integration now uses SHA-pinned GitHub Actions with read-only default permissions. Dependabot groups compatible production, development and workflow updates, while keeping Node type definitions on the supported Node 22 major. Valid dependency updates were consolidated and tested without accepting unrelated lockfile downgrades.

GitHub private vulnerability reporting, dependency alerts, secret scanning, push protection and default CodeQL analysis are enabled. The initial CodeQL scan completed successfully with no findings, GitHub reported no unresolved secrets or dependency vulnerabilities, and the repository contained no workflow caches at publication time.

This maintenance release does not change public map data, coordinates, licensing, account boundaries or the application’s local-first behavior.

### Verification

Frozen installation, strict TypeScript, lint, 458 unit/integration tests and the production build passed. The existing browser suite passed in Chromium, including the public contribution changes. Git integrity and history scans found no corruption or recognized credential patterns; the local checkout and remote `main` matched before publication.

## v0.6.1 — 2026-09-05

**Released: visitor measurement and release history.**

The About page now lists the current and earlier versions with their dates, summaries and direct GitHub release links. The full changelog retains each version’s details.

Release history is retained from **v0.5.0** onward. The publication workflow preserves existing releases and restores missing historical entries using their original Git tags and version-specific notes. The newest version remains the latest release.

Audience measurement now asks visitors to allow or decline Analytics, with a changeable choice in About. Accepted visits use a dedicated random browser identifier instead of recreating one on every load. Declining stops measurement and removes the saved identifiers. The Google tag remains isolated from accounts, forms, searches and personal map data, and the instance measurement configuration stays outside GitHub.

This update preserves the working account service, local workspaces and selected 3D destinations. Analytics reports cover consenting visitors; delivery checks do not establish what is visible in a private Google Analytics dashboard.

### Verification

The isolated public fork passes installation, types, lint, 458 unit/integration tests and its browser suite (18 passed, two existing platform-specific skips). Release publication has 25 lifecycle tests. Desktop and mobile checks cover the release history and consent controls. Real Google SDK checks verify accepted page-view delivery and browser/session continuity; the complete scope is recorded in `docs/refactor/VERIFICATION.md`.

## v0.6.0 — 2026-09-05

**Released: account workspaces and selected 3D destinations.**

Live application: [Leonida Atlas](https://gta6state.com/gta6-leonida-atlas/).

### Selected map destination in 3D

Choosing Ambrosia, Leonida Keys or another positioned place before opening **3D explorer** now carries that destination into the actual world spawn. Reloading the explorer URL preserves it. Existing approach offsets and collision clearance remain; opening the explorer without a selection keeps its default entry. Rapid map/explorer transitions also cancel pending Leaflet zoom callbacks.

### Official accounts and independent forks

The official deployment supplies a separately maintained private account service and panel: registration with email, a unique username and password; sign-in by email or username; profile and password controls; recovery keys; account deletion; and explicit server backup save/restore. Email confirmation is disabled for now. Both email and username uniqueness are enforced by the server. Backups use revision checks to avoid silently overwriting another device's newer copy.

The public core adds an empty-by-default extension point and distinct local account workspaces. Accepted writes finish in their original workspace; stale reads, drafts and backup operations are guarded across identity changes. Guest data remains separate and is never automatically uploaded on sign-in.

A default fork still needs no account, server, CMS, API credentials or parent site. The private account implementation, database and configuration remain outside this repository. Google Analytics remains optional, deployment-configured and isolated from personal application data.

### Preserved map, data and licensing

The standalone React/Vite map retains local favorites, notes, collections, personal markers, validated portable backups, public offline caching and the optional Three.js explorer. GTADB / Map GTA data stays attributed under **CC BY 4.0**: all 2,198 records, including 2,091 positioned and 107 unpositioned entries, plus six regions. Community placements remain **APPROXIMATE** and absent coverage **UNKNOWN**.

Original source remains **AGPL-3.0-only**; third-party rights are unchanged. See [third-party notices](THIRD_PARTY_LICENSES.md) and the [verification record](docs/refactor/VERIFICATION.md) for test scope and browser limitations.

## v0.5.0 — 2026-09-05

**Released: standalone local-first Atlas.**

Live application: [Leonida Atlas](https://gta6state.com/gta6-leonida-atlas/).

### Map and local workspace

- A standalone React/Vite/TypeScript application replaces the Astro shell and build. Static hosting requires no CMS, parent website, account or private API.
- The calibrated Leaflet CRS.Simple map is the primary workspace, with search, intersecting category/evidence/favorite filters, ordered layers, zoom rules, bounded spatial clustering and source details.
- Dexie / IndexedDB stores favorites, notes, collections, personal markers and preferences. Schema upgrades, transactional saves, cross-tab updates and stale-draft checks protect local work.
- The personal marker editor supports creation, editing, coordinate moves and deletion with local-reference cleanup.
- Versioned JSON backups are validated before writes, previewed before import and merged atomically. Invalid, unsupported or oversized imports leave existing data intact.

### Independent hosting and optional features

- The production service worker preserves the app shell, catalogue and basemap after a complete online load. Optional 3D image assets are cached as visited with bounded eviction; a complete offline world download is not promised.
- The preserved Three.js reconstruction loads on demand. Desktop/touch controls, regional travel, source evidence, cleanup on return and a WebGL-unavailable fallback remain available.
- Public forks work as guests without credentials. Auth/user/sync contracts are optional integration points; no private user backend is distributed.
- Optional Google Analytics is configured outside public source and runs in an opaque sandbox isolated from notes, markers, collections and IndexedDB.
- Static output and a standalone Nginx container support root or subdirectory hosting. Historical project and regional URLs remain resolvable.

### Evidence and licensing

GTADB / Map GTA data remains pinned and attributed under **CC BY 4.0**. All 2,198 upstream records are retained: 2,091 positioned and 107 unpositioned, plus six regional entries. Missing coordinates remain missing. Community placements are **APPROXIMATE** and unsupported coverage remains **UNKNOWN**.

Original project source is **AGPL-3.0-only**. Rockstar references and other third-party material retain their own rights. See [LICENSE](LICENSE), [third-party notices](THIRD_PARTY_LICENSES.md) and [methodology](docs/METHODOLOGY.md).

### Verification

- Frozen installation, strict types, lint, unit/integration tests, static build and the isolated public-fork workflow passed.
- Desktop Chromium and mobile WebKit: **17 browser cases passed, one conditional WebKit offline-navigation skip**. Chromium verifies cached offline reopening; the WebKit limitation is not presented as a Safari offline-reload pass.
- An isolated `/atlas/` build verified the catalogue, map, marker reload, project links, historical regional routes, 3D resources and scoped service worker.
- The standalone Nginx container passed startup/configuration checks and the browser suite. Analytics isolation, offline-cache boundaries, dependency audit and peer checks passed.

The [verification record](docs/refactor/VERIFICATION.md) documents the executed checks, their scope and browser automation limits. It records pre-publication validation; production delivery is verified separately.
