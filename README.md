# Leonida Atlas

A standalone, local-first interactive community map of GTA VI's Leonida. Explore the map, search public places, organize favorites and collections, write notes, and create personal markers without an account. The existing approximate 3D explorer remains available as an optional module.

Current release: **v0.6.0 — 5 September 2026**. See the [release notes](RELEASES.md).

This is an independent fan project, not an official Rockstar map. Community positions are **APPROXIMATE**; missing geography remains **UNKNOWN**. The pinned public catalogue contains 2,198 GTADB records (2,091 positioned and 107 unpositioned), plus six regional entries. Unpositioned records remain searchable and never acquire invented coordinates.

## Run independently

Requirements: Node.js 22.12+ and pnpm 10+. The lockfile is tested with pnpm 11.3.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
# http://127.0.0.1:4330
```

No environment file, account, database server, CMS, private API, parent website or cloud resource is required.

```sh
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm build
pnpm start
pnpm test:e2e
```

`pnpm start` previews the static production output at `http://127.0.0.1:4330`. Install Playwright browsers with `pnpm exec playwright install chromium webkit` when needed. Run `VITE_ANALYTICS_ID='' pnpm build` before the no-network/fork E2E suite if your local build normally enables Analytics.

`pnpm test:fork` copies an explicit public-source allowlist to a temporary directory, excludes all environment files and credentials, installs with the frozen lockfile, runs types/lint/unit/build, and exercises desktop Chromium and mobile WebKit against an isolated production preview on port 4331. It creates no account, cloud database or deployment.

## Stack and boundaries

- **Vite + React + strict TypeScript:** static app, focused lazy feature panels, original URLs retained.
- **Leaflet CRS.Simple:** fictional GTADB game coordinates, calibrated existing basemap, touch/keyboard navigation, zoom rules, layer ordering and spatial clustering. No external tile provider or map key.
- **Zustand:** separate domain, map, UI, personal-data and persistence stores. Map movement stays inside the map adapter.
- **Dexie / IndexedDB:** transactional repositories and a real version 1 → 2 upgrade path. Rich user data never uses localStorage.
- **Three.js:** existing reconstruction loaded only when opening the 3D explorer. Its calibrated algorithms and assets are preserved.

```text
src/app/                 Shell, routing, optional isolated Analytics
src/domain/              Places, layers, filters, personal-data contracts
src/data/                Validated bundled public catalogue adapter
src/features/map/        CRS adapter, spatial index, clusters, layer rules
src/features/library/    Favorites, collections, notes, settings, backups
src/features/editor/     Personal marker create/edit/move/delete
src/features/explorer/   React adapter for the preserved optional 3D engine
src/features/project/    About, documentation, credits and license pages
src/features/street-leonida/  Preserved evidence, coordinate and 3D algorithms
src/stores/              Scoped application state and serialized local writes
src/db/                  IndexedDB repositories, upgrades, backup validation
src/plugins/             Trusted internal module registry
src/capabilities/        Optional UI extension and isolated guest/account workspaces
```

## Local data and offline use

Favorites, notes, collections, personal markers and preferences are stored in the `leonida-atlas` IndexedDB database on this browser origin. A save is reported as successful only after its transaction commits. Storage failures keep the public map usable and expose a retry state; the app never silently resets data or claims an in-memory fallback is durable.

The production service worker caches the app shell, public catalogue and calibrated basemap after the first complete online load. The app can then reopen offline, including its editor and backups. Optional 3D textures are cached as visited, with bounded eviction; a complete 3D world download is not promised. Private responses, authenticated requests, APIs, Analytics and external URLs are excluded. Service workers require HTTPS or localhost. A new release activates after old tabs close.

Browser storage can be cleared or evicted. Settings can request persistent storage, and **Backup → Export backup** creates a portable JSON file. Export periodically and before changing hosting origin.

Backups are versioned (`format: leonida-atlas`, `version: 2`), capped at 10 MiB, validated before writes, and previewed before merging. Version 1 backups migrate. Imports merge atomically: favorites are combined, newer notes/markers/collections win, and imported display preferences apply. Unsupported schemas, duplicate IDs, invalid coordinates and dangling personal references are rejected without partial changes. Local limits ensure newly saved data remains exportable and restorable.

Collections use transactional member/rename operations. Notes and edited markers check the revision from which the draft was created. Other tabs refresh through BroadcastChannel. A conflicting note keeps its draft visible instead of overwriting a newer saved version. Personal markers are never published or added to the public dataset.

## Public data and map extensions

The source snapshot is `public/assets/street-leonida/maps/gtadb-landmarks-7c3f8c2.json`. It is pinned and attributed to **GTADB / Map GTA contributors, CC BY 4.0**. Preserve evidence facets and stable upstream `L…` identifiers. Regional IDs use `region:<slug>`; personal markers use `custom:<uuid>`.

`src/data/catalogue.ts` maps public records into the domain. Add reviewed public POI data through an additional bundled data source, with stable IDs, explicit provenance and `position: null` for unknown placement. Never use a real-world analogue's coordinates as in-game placement. See [methodology](docs/METHODOLOGY.md) and [third-party licenses](THIRD_PARTY_LICENSES.md).

Register a `LayerDefinition` in `src/features/map/layers.ts` or through `atlasRegistry.registerLayer()` before mounting the app. A layer specifies its source, category, order, visibility, zoom limits, color, radius and interaction policy. Place records reference its ID. Map rendering applies those rules consistently.

`src/plugins/registry.ts` exposes typed registration for layers, sources, filters, actions, panels, tools and events. Registration returns a disposal function and duplicate IDs are rejected. Modules are trusted source code bundled with the app, not downloaded executable plugins. Source/filter/layer registries feed the core; actions/panels/tools are explicit integration points for app modules. See [architecture and extension guide](docs/refactor/ARCHITECTURE.md).

## Accounts, cloud and forks

**The public repository works without an account system. The official instance's user infrastructure is separate and optional.**

A stranger who forks, installs, builds and hosts this repository gets a functioning map, editor, local favorites/collections/notes/markers, and import/export. Auth and cloud sync are off. No user backend is deployed, no user database is created, no private endpoint is called, and no access to the official instance's users is granted.

The official deployment supplies a separate account panel: registration with email, a unique username and password; sign-in by email or username; profile/security controls; and explicit server backup save/restore. Email verification is currently disabled. A personal recovery key provides password recovery until email delivery is configured. Guest data is never automatically uploaded or merged on sign-in.

`src/capabilities/extension.ts` defines the optional UI contract. At build time, an operator may set `ATLAS_PRIVATE_ENTRY` to an absolute path to a separately maintained React component. The default `GuestExtension` renders nothing and makes no request. The component receives guarded workspace-switch, export/import and deletion callbacks; the public core serializes transitions and keeps each account in a distinct IndexedDB database. The original guest database is preserved. Local namespaces prevent accidental mixing; server authorization remains essential.

Private account code, session handling, server credentials and deployment configuration belong outside this public repository. `AuthProvider`, `UserProvider` and `SyncProvider` contracts remain available for other integrations. Feature flags cannot grant backend authorization. Server credentials must never use a `VITE_` variable.

## Google Analytics

Analytics is retained as an optional production capability. `VITE_ANALYTICS_ID` defaults to empty. Keep an instance's public measurement ID in ignored `.env.local` or hosting build settings; the repository example contains no real ID. Development mode does not load Analytics.

The tag runs in a dedicated **opaque sandboxed iframe** with no `allow-same-origin`, no referrer and no messages carrying application data. It cannot access the app's DOM, IndexedDB, search history, notes, markers or collections. Its page location is the static Atlas root and its client ID is temporary. This counts anonymous visits; it deliberately does not provide persistent cross-session user attribution or personalized feature analytics. Enabling GA does not enable accounts or cloud sync.

## Static deployment

Production: [Leonida Atlas](https://gta6state.com/gta6-leonida-atlas/), served by an independent Nginx container.

Deploy `dist/` to a static host. The app uses only local public assets. Known historical project and regional detail paths receive static index files, and `_redirects` provides SPA fallback on supporting hosts. Other hosts should rewrite unknown paths to `index.html`.

```sh
# Root hosting
pnpm build
# Subdirectory hosting
ATLAS_BASE_PATH=/my-atlas/ pnpm build
```

`ATLAS_BASE_PATH` is a build-process variable, not a secret; its example is a shell command because Vite reads it before loading dotenv. Assets, project links, 3D resources and offline scope honor the base. Deep-link queries use `?place=region:vice-city`; `?view=3d` opens the explorer and `?page=credits` opens documentation.

A separate static container is also provided:

```sh
docker build -t leonida-atlas .
docker run --rm -p 8080:8080 leonida-atlas
```

The container serves only the app with security headers. No database or user backend is included. Optional analytics can be supplied as the public `VITE_ANALYTICS_ID` build argument. Never pass server secrets as build arguments.

Run the Atlas on its own static hosting target. Keep the parent website deployment separate; this package does not require it.

An existing Traefik proxy can route a dedicated path to this container using [the production deployment guide](deploy/README.md). The instance hostname, route and Analytics identifier stay in ignored configuration. The release workflow validates a pushed version tag, publishes its notes, and removes older published releases only after the replacement is verified. Git history and tags are retained.

## License

Source code: **AGPL-3.0-only** ([LICENSE](LICENSE)). GTADB-derived data: **CC BY 4.0**, attributed separately. Rockstar Games / Take-Two names and media belong to their owners. This project is not affiliated with or endorsed by them.

See [decision log](docs/refactor/DECISIONS.md), [verification record](docs/refactor/VERIFICATION.md), [security policy](SECURITY.md), and [releases](RELEASES.md).
