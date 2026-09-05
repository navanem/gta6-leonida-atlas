# v0.5.0 pre-publication verification — 2026-09-05

This record captures local and isolated-host verification for v0.5.0 before publication. The subsequent publication instruction authorizes a GitHub push, release and independent production deployment; those external outcomes are recorded separately after verification. The pre-existing CMS-removal work was preserved.

## Executed checks

| Check                  | Result             | Evidence / scope                                                                                                                                                                                    |
| ---------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen installation    | PASS               | `pnpm install --frozen-lockfile`; pnpm 11.3.0, Node 22.                                                                                                                                             |
| Types and lint         | PASS               | `pnpm typecheck`, `pnpm lint`; strict application types and preserved algorithms.                                                                                                                   |
| Unit/integration       | PASS               | `pnpm test:unit`; domain/map algorithms, Dexie transactions/upgrades, backup validation, stale-write rejection, draft races, capabilities, emitted SW/Analytics. **398 tests across 41 files**.     |
| Static build           | PASS               | `pnpm build`; 27 historical route entries, 40 offline core files.                                                                                                                                   |
| Public fork            | PASS               | `pnpm test:fork`; explicit source allowlist copied outside the checkout, no env files/credentials, isolated frozen install → types → lint → tests → build → browser flows.                          |
| Desktop/mobile browser | PASS with one skip | Chromium + mobile WebKit: 17 passed, one conditional WebKit offline-navigation skip. Same result on the independent Nginx container.                                                                |
| Subdirectory hosting   | PASS               | Isolated `/atlas/` production build: catalogue, map, marker reload, six project links, historical region route, 3D textures and correctly scoped offline worker.                                    |
| Container              | PASS               | `docker build`, Nginx configuration check, actual container startup and the full browser suite on localhost:4344. An invalid legacy-style cache regex found during startup was removed.             |
| Analytics runtime      | PASS               | Actual emitted production bootstrap under Nginx CSP: page-view request generated; static root URL only, empty referrer, no private query. Measurement requests intercepted with HTTP 204 during QA. |
| Dependency audit       | PASS               | Full `pnpm audit --json`: zero info/low/moderate/high/critical findings. `pnpm peers check`: no peer issues. Sharp updated to 0.35.4; native image decode/resize/WebP smoke passed.                 |
| Git/runtime boundary   | PASS               | Private env ignored, no real Analytics ID in eligible source files, no user exports/keys staged or tracked, `git diff --check`; no Astro/Payload runtime dependency or parent API.                  |

The browser plugin was unavailable in this environment, so Playwright Chromium and WebKit were used directly with the installed browser cache.

## Functional coverage

- Public map and exact game-coordinate transforms; all 2,198 upstream records retained, including 107 searchable records with no position; six regional entries.
- Search, intersecting evidence/category/favorite filters, layer visibility, zoom behavior, bounded spatial clusters and selected-place detail.
- Marker creation, edit, coordinate move, category/icon metadata, deletion and cascading local references.
- Favorites, renamed collections, note persistence after reload, cross-tab updates and stale-draft protection.
- Backup export, invalid import rejection without changes, preview/cancel and transactional merge.
- Blocked IndexedDB keeps the public map available and never reports a successful save. Invalid upgrades and oversized writes roll back.
- Chromium reloads the cached app/catalogue/basemap offline, preserving local markers and preferences. Both browsers save notes offline and retain them after reconnect/reload.
- Keyboard search and dialog focus; mobile sidebar, bottom detail panel and touch controls.
- Optional 3D desktop/mobile: world movement, map travel, destination selection, evidence panel, escape/cleanup, and usable fallback when WebGL is unavailable. Fourteen image resources were verified under `/atlas/` with no escaped asset URL.

## Browser limitation

The full offline reload case is conditionally skipped only when Playwright WebKit throws its internal navigation error. It is **not** claimed as a Safari offline-reload pass. Chromium verifies the cached reload, including a failed uncached network request. The WebKit offline note-save/reconnect flow passes. Playwright's emulated `navigator.onLine` can also report true after an offline reload; the test proves network unavailability directly instead of relying on that flag.

## Security and data boundaries

A final source scan also removed two historical changelog mentions of the instance identifier; a regression test now covers source and release documentation. The official measurement identifier is kept in ignored `.env.local`; `.env.example` has an empty default. A public fork performs no Analytics request and enables no account/cloud service. A production build with a supplied public ID necessarily contains that ID in its emitted client artifact; source configuration stays outside Git.

Analytics executes only inside an opaque sandbox (`allow-scripts`, no `allow-same-origin`). It has no parent DOM or IndexedDB access. Consent storage is denied; its cookie facade always reads empty and discards writes. No personal data is posted into the frame, and only the static Atlas root is used as page location. Direct or non-opaque execution is rejected by the bootstrap.

The public core contains guest behavior and optional auth/user/sync contracts. No private backend, account UI, session service or multi-device sync deployment was available to integrate or test. Those remain a separately configured private capability. Local data is independent of that capability.

## Performance and visual inspection

The initial app JavaScript is approximately 510 kB raw / 158 kB gzip. The preserved optional 3D world chunk is approximately 802 kB / 221 kB gzip and causes Vite's chunk-size warning; it is loaded on demand by the app. The offline installer caches built modules in the background. Optional 3D image assets are fetched as needed and their cache is bounded. Search renders pages of 50 results; the map's spatial grouping bounds rendered markers to 360. Viewport movement does not rerender the whole application.

The existing source asset directory is about 49 MB; the first map view does not load the entire directory. The basemap is about 864 kB and stays local. No external tile service, web-font provider or user API is needed.

The UI was inspected against `interface-concept.png` at desktop and mobile sizes:

1. Dominant map, left search/library sidebar, optional right detail panel preserved.
2. Navy/turquoise palette, condensed Oswald brand and readable Inter controls retained.
3. Explore/Layers/Saved navigation and persistent local-save status implemented.
4. Search, note, collection and editor flows use real controls and keyboard focus; mobile uses drawers and a bottom detail panel.
5. Intentional deviation: the concept's invented geography/attribution was discarded; the existing calibrated GTADB map and accurate CC BY attribution remain. Clusters reflect the real dataset density.

## Local evidence files

QA artifacts are outside Git and contain synthetic test data only:

- `/tmp/atlas-fork-final.log`: successful isolated fork install/build/browser run.
- `/tmp/atlas-nginx-e2e-final.log`: 17 passing browser cases, one explicit WebKit skip.
- `/tmp/atlas-subpath-report.json`: detailed `/atlas/` navigation, assets and offline request audit.
- `/tmp/atlas-analytics-runtime-report.json`: sanitized Analytics isolation/runtime result, with no measurement ID.
- `/tmp/atlas-full-audit-final.json`: full dependency audit.
- `/tmp/atlas-docker-final.log`: standalone container build.
- `/tmp/atlas-qa-chromium-initial-map.png`, `/tmp/atlas-qa-mobile-safari-initial-map.png`, `/tmp/atlas-qa-chromium-offline.png`: rendered UI/offline captures.
- `/tmp/atlas-subpath-3d.png`: preserved optional 3D explorer under a deployment prefix.

## Publication handoff

Production was verified on 2026-09-05 at [Leonida Atlas](https://gta6state.com/gta6-leonida-atlas/), using a healthy dedicated Nginx container behind the existing proxy. The bare path redirects to its trailing-slash URL; the old app, about, changelog and Street Leonida URLs resolve correctly. Nginx resolves static route index files without redirecting visitors outside the Atlas prefix.

The live Chromium check passed map rendering, personal marker save/reload, current-only changelog, scoped service worker and Analytics isolation with collection requests intercepted during QA. No browser or HTTP errors occurred. The parent homepage and Tools response hashes, container ID and image ID were unchanged. A separate mobile preflight verified selection layout, 3D rendering and fourteen prefixed image requests.

Final publication checks passed strict types, lint and **412 unit/integration tests in 42 files**, including fourteen tests of the GitHub release lifecycle. The tag workflow validates the source again before publishing [v0.5.0](https://github.com/navanem/gta6-leonida-atlas/releases/tag/v0.5.0); older release records are removed only after the replacement is verified. Git tags and source history remain available.

Instance configuration is in ignored `.env.production.local`. Rollback metadata and pre-publication release records were saved outside Git. The production service joins only the existing proxy network and has no CMS/database connection.
