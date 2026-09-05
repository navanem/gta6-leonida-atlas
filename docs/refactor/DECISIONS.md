# Atlas local-first decision log — 2026-09-05

- Work in the existing Atlas checkout on `codex/atlas-local-first-20260905` → preserve the pre-existing uncommitted CMS removal → no changes to the parent website or its deployment.
- React + Vite + strict TypeScript → map application state and standalone static hosting → replace Astro shell/config, retain useful typed algorithms and assets.
- Leaflet CRS.Simple adapter → maintained keyboard/touch/drag lifecycle with exact GTADB game coordinates → reuse calibrated basemap, no geographical reprojection, no external tiles. Existing SVG engine stays with optional 3D.
- Zustand stores by responsibility → targeted subscriptions, no viewport rerenders of the entire app → domain/UI/map/user/persistence remain distinct.
- Dexie IndexedDB repositories → durable structured data, transactions and schema upgrades → local saves precede UI success; no localStorage rich-data fallback that falsely promises persistence.
- Versioned validated portable backups → protect existing local data → preview before merge, transactional import, unsupported schemas and oversized files rejected.
- Typed internal registry → layers/actions/filters/tools/data sources/panels can extend a small core → no remote executable plugins.
- Guest capability defaults → forks need no credentials → auth/sync interfaces only; official private adapters live in a separate private service/package; no endpoint or analytics inherited.
- Lazy optional existing Three explorer → preserve useful reconstruction → no Three in initial map bundle; deterministic coordinate/evidence tests retained.
- Existing source-derived geography is authoritative input → no generated map assets → UI concept is a chrome/layout reference only; exact GTADB attribution replaces the concept's invented attribution.
- Root and historical Atlas URLs → preserve bookmarks → Vite app route resolver plus generated static route entries; configurable public base path.
- Deployment separation → Atlas has its own static build and standalone container → production hosting remains independent of the parent website service.

## Baseline

At refactor start, 303 tests / 32 files passed. The catalogue contained 2,198 GTADB records, 2,091 positioned and 107 unpositioned. The working tree already included CMS/API removal changes; those edits were preserved as inputs to the refactor.

## Implementation and verification ledger

- [x] Domain/state/map: typed catalogue, composable filters, layer ordering/zoom rules, spatial clustering, selection and editor events.
- [x] Persistence: v1→v2 upgrade, repositories, notes/favorites/collections/markers/preferences, validated transactional merge, recovery errors.
- [x] Shell: map-first React app, sidebar/search/library/details/editor/settings/backup, responsive keyboard flows.
- [x] Legacy: optional 3D and project pages adapted; Astro runtime/build removed.
- [x] Extensibility and capability interfaces, no automatic cloud side effects.
- [x] Verify types/lint/unit/integration/browser/offline/mobile/fork/subpath/build/security; inspect bundle and Git; update docs. See VERIFICATION.md for evidence and limitations.

## Delivery constraints

- Preserve Google Analytics → the user explicitly requested it → enable it only through ignored local/hosting configuration; isolate its script from personal application data.
- Publication authorization updated → the user approved production publication, a GitHub push and a current release → release-facing files retain history from v0.5.0 onward; external results are recorded after verification.
- Real accounts requested → deploy a dedicated private user service and panel on the existing host, outside the public repository; no CMS coupling or new paid/cloud resource.
- Email + unique username + password → user requested no email confirmation for now; enforce normalized uniqueness on the server and provide personal recovery keys.
- Separate local namespaces and explicit server backups → preserve guest work, prevent cross-account mixing, reject stale server revisions.
- Selected map destination → carry the place ID and validated coordinates into the actual 3D spawn; retain documented approach offsets and the default entry only when no place is selected.

- Retain release history from v0.5.0 → updated user preference → restore the historical GitHub release, keep earlier entries, and show dates, summaries and version links in About as well as Changelog.
- Repair visitor measurement → the previous iframe sent only denied-consent pings with a new identity per load, and Google's SDK aborts consented events from an opaque origin → load Google only after an explicit visitor choice in a dedicated, separate-origin helper, keep normal scoped measurement cookies after acceptance and offer withdrawal in About. The browser origin boundary excludes all account and personal Atlas data; source/origin-checked messages carry only consent.
