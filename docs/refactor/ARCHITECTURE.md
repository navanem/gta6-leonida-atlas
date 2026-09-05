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

Public capabilities contain only interfaces and guest/no-sync behavior. An official private entry can call `resolveCapabilities(privateFactory)` and compose its own account panel around the same public core. A failing factory resolves to guest. The private service must own authentication, sessions, authorization, rate limits and per-user sync isolation. Never assume hiding a button protects an API.

Private sync must export a validated local backup and validate received data before transactional merging. Cloud failure must leave local work intact. The public repository contains neither such a backend nor configured endpoints; its cloud/account UI stays absent. No automatic infrastructure provisioning occurs.

## Migration inventory

- **Keep:** pinned catalogue and licensed basemap, evidence facets, reversible coordinate transforms, 3D world/region/material algorithms and meaningful algorithm tests.
- **Refactor:** 3D lifecycle into a lazy React adapter, base-aware public URLs, original project content and historical routes, shell/accessibility tests.
- **Replace:** Astro shell/build/layouts with Vite+React, modal-only map with permanent Leaflet feature, single shared mutable UI with scoped stores.
- **Add:** Dexie versioned local data, typed domain, map/editor/library interfaces, validated backup merge, trusted extension points, optional isolated analytics, offline worker, independent container and fork regression script.
- **Delete:** obsolete Astro components/styles/config, unused parent SEO/URL/content helpers and old API utilities. Pre-existing CMS-removal changes were preserved.

There is no migration of pre-existing personal favorites or notes: the original application had no such persistent stores. Version1 compatibility is implemented and tested for the public local schema and backup format so future upgrades have a concrete migration path.
