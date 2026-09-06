export interface LeonidaAtlasRelease {
  readonly version: `v${number}.${number}.${number}`;
  readonly date: string;
  readonly title: string;
  readonly summary: string;
  readonly status: 'public' | 'in-preparation';
  readonly highlights: readonly string[];
  readonly verification: readonly string[];
}

/** Retained public history starts at v0.5.0; the newest release stays first. */
export const LEONIDA_ATLAS_RELEASES: readonly LeonidaAtlasRelease[] = [
  {
    version: 'v0.7.0',
    date: '2026-09-06',
    title: 'A fuller, living 3D Leonida',
    summary:
      'Restored mapped streets and buildings, articulated pedestrians and richer architecture, vegetation, terrain, water and lighting across six regions.',
    status: 'public',
    highlights: [
      'Source roads remain visible above approximate terrain. Mapped building occupancy is preserved on desktop and mobile, with rotated footprints, regional floor and roof patterns, and nearby facade detail.',
      'Hotel Dixon, the Sahara arena, waterfront towers and the mural viaduct have rebuilt volumes. Regional porches, storefronts, roofs and service details add depth to the existing arrivals.',
      'Original articulated characters replace block figures and flat life collages. Walking feet and vehicle tyres follow the active street surfaces; Vice City and Ambrosia traffic use their selected arrival frames.',
      'Nearby trees use three-dimensional trunks and leaves, with photographic vegetation retained in the distance. Kalaga gains continuous local rock ridges and elevated forest.',
      'Outdoor image-based lighting, properly shaded clouds, traveling water normals and bounded streetlight pools improve the six regional atmospheres.',
      'GTADB positions and attribution remain intact. Unmeasured architecture and local relief stay APPROXIMATE; this is a browser reconstruction, not the original game world or its assets.',
    ],
    verification: [
      '503 unit and integration tests passed, including streaming, geometry, contact, source-coordinate, actor and water lifecycle checks. TypeScript, ESLint and the production build passed.',
      'Chromium rendered all six regions and a reverse Vice City view without reported application or shader errors. Additional isolated captures checked the rebuilt landmarks, actors and clouds.',
      'Draw calls and triangles were recorded. The test machine uses SwiftShader software rendering, so these checks do not establish a hardware frame-rate guarantee.',
    ],
  },
  {
    version: 'v0.6.2',
    date: '2026-09-06',
    title: 'Public collaboration and security hardening',
    summary:
      'Community contribution workflows, protected pull requests, validated dependency updates and continuous security scanning.',
    status: 'public',
    highlights: [
      'The public repository now includes contribution guidelines, a code of conduct, issue forms, a pull-request template and private vulnerability reporting.',
      'The main branch requires a successful Quality check and resolved conversations, keeps linear history, and blocks force pushes and branch deletion.',
      'Dependabot groups compatible updates, keeps Node type definitions on Node 22 and avoids unrelated lockfile downgrades.',
      'GitHub Actions use pinned revisions and read-only default permissions. Secret scanning, push protection and CodeQL continuously inspect the repository.',
      'Public map data, coordinates, licensing, account boundaries and local-first behavior are unchanged.',
    ],
    verification: [
      'Frozen installation, strict TypeScript, lint, 458 unit/integration tests and the production build passed.',
      'The Chromium browser suite passed after the public collaboration and dependency updates.',
      'CodeQL completed both analyses with no findings. GitHub reported no unresolved secrets or dependency vulnerabilities, and Git integrity checks found no corruption.',
    ],
  },
  {
    version: 'v0.6.1',
    date: '2026-09-05',
    title: 'Visitor measurement and release history',
    summary: 'Consent-based visitor measurement and an About page with every release since v0.5.0.',
    status: 'public',
    highlights: [
      'Visitors can allow or decline audience measurement and change their choice in About. Accepted visits use a separate random browser identifier; personal Atlas data stays isolated from Analytics.',
      'About lists the current version and earlier releases, with dates and a short description of each update.',
      'The changelog retains the complete history from v0.5.0, ordered from newest to oldest.',
      'GitHub publication preserves existing releases and restores missing historical entries without replacing the latest version.',
    ],
    verification: [
      'TypeScript, lint, release-history rendering and publication lifecycle tests passed.',
      'About and changelog links were checked in desktop and mobile browsers.',
      'Google accepted consented test visits with stable browser and session identifiers. Consent withdrawal, origin isolation and cross-tab changes were checked; the private Analytics dashboard is outside this verification.',
    ],
  },
  {
    version: 'v0.6.0',
    date: '2026-09-05',
    title: 'Account workspaces and selected 3D destinations',
    summary:
      'Isolated account workspaces and a private official account service, with the selected map destination preserved when entering the 3D explorer.',
    status: 'public',
    highlights: [
      'React, Vite and strict TypeScript replace the Astro shell and build. Static hosting requires no CMS, parent website, account or private API.',
      'The calibrated Leaflet CRS.Simple map supports search, intersecting filters, ordered layers, zoom rules, bounded spatial clustering and source details.',
      'Dexie / IndexedDB stores favorites, notes, collections, markers and preferences with schema upgrades, transactional saves, cross-tab updates and stale-draft protection.',
      'The personal marker editor supports create, edit, move and delete. Versioned backups are validated and previewed before an atomic merge.',
      'Offline caching preserves the app shell, public catalogue and basemap after a complete online load. Optional 3D assets are cached as visited with bounded storage.',
      'Selected map coordinates now initialize the 3D world. Ambrosia, Leonida Keys and individual places keep their destinations; rapid map/explorer transitions clean up pending map animations.',
      'Local guest and account workspaces stay separate. Queued writes, stale reads and backup operations cannot silently cross an account transition.',
      'The existing Three.js reconstruction loads on demand, with desktop and touch controls, regional travel, evidence panels and a fallback when WebGL is unavailable.',
      'The official instance supplies email/username registration, secure sessions and explicit server backups through a separate private service. Public forks remain fully usable as guests; Analytics stays isolated and deployment-configured.',
      'GTADB / Map GTA attribution and CC BY 4.0 data licensing are retained: 2,198 source records, including 2,091 positioned and 107 unpositioned entries, plus six regions. Community placement remains APPROXIMATE and absent coverage UNKNOWN.',
    ],
    verification: [
      'Frozen installation, strict types, lint, unit/integration tests, static build and isolated public-fork checks passed.',
      'Desktop Chromium and mobile WebKit exercise map and local-data flows. WebKit offline-navigation is explicitly skipped when its automation runtime fails; Chromium verifies offline reopening and selected 3D spawning.',
      'An isolated subdirectory build verified map data, saved markers, project links, historical routes, 3D assets and service-worker scope. The standalone Nginx container passed the browser suite.',
      'Dependency audit and peer checks passed. Analytics isolation and emitted offline-worker boundaries were verified; the full scope and limitations are in docs/refactor/VERIFICATION.md.',
    ],
  },
  {
    version: 'v0.5.0',
    date: '2026-09-05',
    title: 'Standalone local-first Atlas',
    summary:
      'A standalone map workspace with local favorites, notes, collections, personal markers and portable backups, plus an optional 3D explorer.',
    status: 'public',
    highlights: [
      'React, Vite and strict TypeScript replace the Astro shell and build. Static hosting requires no CMS, parent website, account or private API.',
      'The calibrated Leaflet CRS.Simple map supports search, intersecting filters, ordered layers, zoom rules, bounded spatial clustering and source details.',
      'Dexie / IndexedDB stores favorites, notes, collections, markers and preferences with schema upgrades, transactional saves, cross-tab updates and stale-draft protection.',
      'The personal marker editor supports create, edit, move and delete. Versioned backups are validated and previewed before an atomic merge.',
      'Offline caching preserves the app shell, public catalogue and basemap after a complete online load. Optional 3D assets are cached as visited with bounded storage.',
      'The existing Three.js reconstruction loads on demand, with desktop and touch controls, regional travel, evidence panels and a fallback when WebGL is unavailable.',
      'Public forks work as guests without credentials. Account and cloud-sync contracts remain optional; Analytics is isolated and enabled only by deployment configuration.',
      'GTADB / Map GTA attribution and CC BY 4.0 data licensing are retained: 2,198 source records, including 2,091 positioned and 107 unpositioned entries, plus six regions. Community placement remains APPROXIMATE and absent coverage UNKNOWN.',
    ],
    verification: [
      'Frozen installation, strict types, lint, unit/integration tests, static build and isolated public-fork checks passed.',
      'Desktop Chromium and mobile WebKit passed 17 browser cases; one WebKit offline-navigation case is explicitly skipped when its automation runtime fails. Chromium verifies offline reopening.',
      'An isolated subdirectory build verified map data, saved markers, project links, historical routes, 3D assets and service-worker scope. The standalone Nginx container passed the browser suite.',
      'Dependency audit and peer checks passed. Analytics isolation and emitted offline-worker boundaries were verified; the full scope and limitations are in docs/refactor/VERIFICATION.md.',
    ],
  },
] as const;

export const latestLeonidaAtlasRelease = LEONIDA_ATLAS_RELEASES[0]!;
