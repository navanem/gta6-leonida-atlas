# Architecture and extension guide

The production entry is `src/main.tsx`. The React app replaces Astro completely; the parent site's CMS, SEO helpers, analytics identity and API routes are not runtime dependencies.

## Data flow

UI → scoped Zustand stores → serialized local operation → Dexie repository transaction → refreshed user snapshot → saved status. Public catalogue loading is separate from personal data. Map viewport updates do not publish every pointer movement into React's app state.

- **Map:** raw game X/Y become Leaflet `[y,x]` with CRS.Simple. The retained basemap's world transform is `x = rawX*2`, `SVG y = -rawY*2`; its raw bounds are X −16000…4000, Y −8000…12000. No Earth projection is involved.
- **Spatial work:** index records by grid cell, query only viewport cells, cluster by pixel-space grid with a bounded marker budget. Six regions and selected points remain discoverable. Unpositioned records stay in search. At dense zooms performance grouping can override the preference and reports that condition.
- **Filters:** `filterPlaces()` intersects category, evidence, favorites, collection and personal-only criteria. Search normalizes case/accents and requires every search term to match title, category, description, region, tags or saved notes. Results render in pages of 50 instead of thousands of DOM rows.
- **Selection:** stable IDs connect search, map, details, personal data and deep links. Personal IDs have a reserved namespace; public data remains immutable.
- **Drafts:** notes reconcile clean state with updates from imports/other tabs. Dirty conflicts preserve the draft. Marker forms retain their opening revision. Repository compare-and-set rejects stale updates. Collection member operations re-read inside a write transaction.
- **Offline:** generated release worker hashes all core bytes, pins the shell/catalogue/basemap, and caches a bounded set of visited public 3D assets. Cache failures do not discard successful network responses. Sensitive/unknown requests bypass caching.

## Add an internal module

Import a trusted local module from the application entry before rendering. The registry has no remote code loader.

```ts
import { atlasRegistry } from './src/plugins/registry';

const disposeLayer = atlasRegistry.registerLayer({
  id: 'research',
  name: 'Research',
  category: 'community',
  visible: true,
  order: 15,
  source: 'research-data',
  minZoom: -4,
  style: { color: '#73cbbb', radius: 6 },
  interactive: true,
});
const disposeSource = atlasRegistry.registerDataSource({
  id: 'research-data',
  load: async () => (await import('./public-research-data')).places,
});
// Each returned Place needs layerId: 'research' and explicit evidence/provenance.
```

The source, layer and filter registries feed the core. `registerFilter({id,matches})` adds an intersection predicate. Changes to the registered set are configured at bootstrap; runtime visibility/order live in the map store. IDs must be unique. Dispose registrations when unmounting an optional module. Internal actions/tools/panels can use their typed registries and be mounted by their module's React view. `selection`, `saved`, and `error` events have typed payloads and listener disposal; listener failure cannot interrupt a local save.

## Optional private users

The build alias `virtual:atlas-account` resolves to an empty public component by default. Operators can set the process environment variable `ATLAS_PRIVATE_ENTRY` to a private React entry implementing `AccountExtensionProps`. No configured endpoint, account service or private UI is bundled into a default fork. React and React DOM are deduplicated across the core and extension.

The controller is mounted once beside the application across all routes. Its `entryTarget` is a route-owned sidebar slot; private implementations portal only their entry button, keeping session listeners and dialogs mounted during 3D navigation.

The extension receives `workspaceId`, `workspaceReady`, and guarded `switchWorkspace`, `deleteWorkspace`, `exportBackup` and `importBackup` callbacks. A transition immediately hides the previous snapshot and closes its drafts; accepted writes finish in their original database before the next namespace opens. Old read completions cannot overwrite a newer save or another account. Saves finishing during a transition suppress callbacks from the previous UI. Deletion uses the same queue and refuses the active database. Guest data remains in `leonida-atlas`; account namespaces use validated opaque IDs.

The private service owns registration, sessions, authorization, rate limits, recovery and per-user backup isolation. The official panel uses explicit save/restore with server revision checks, not automatic conflict-prone upload. Both directions validate the backup schema. Its authenticated requests bind the expected account ID to the current server session; stale tabs cannot save one account's snapshot into another account. No server secret belongs in a `VITE_` variable.

The extension must refresh session identity after login/logout or cross-tab changes and reject stale asynchronous results. It must treat local namespace separation as UI/data integrity, not an authorization boundary against scripts running in the same origin. Server failure must preserve local work and leave the public map usable.

## Migration inventory

- **Keep:** pinned catalogue and licensed basemap, evidence facets, reversible coordinate transforms, 3D world/region/material algorithms and meaningful algorithm tests.
- **Refactor:** 3D lifecycle into a lazy React adapter, base-aware public URLs, original project content and historical routes, shell/accessibility tests.
- **Replace:** Astro shell/build/layouts with Vite+React, modal-only map with permanent Leaflet feature, single shared mutable UI with scoped stores.
- **Add:** Dexie versioned local data, typed domain, map/editor/library interfaces, validated backup merge, trusted extension points, optional isolated analytics, offline worker, independent container and fork regression script.
- **Delete:** obsolete Astro components/styles/config, unused parent SEO/URL/content helpers and old API utilities. Pre-existing CMS-removal changes were preserved.

There is no migration of pre-existing personal favorites or notes: the original application had no such persistent stores. Version1 compatibility is implemented and tested for the public local schema and backup format so future upgrades have a concrete migration path.
