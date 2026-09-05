# Releases

## v0.5.0 — 2026-09-05

**Released: standalone local-first Atlas.** The public changelog contains only the current release.

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
