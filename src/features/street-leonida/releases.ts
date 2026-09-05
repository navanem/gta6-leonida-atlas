export interface LeonidaAtlasRelease {
  readonly version: `v${number}.${number}.${number}`;
  readonly date: string;
  readonly title: string;
  readonly summary: string;
  readonly status: 'public' | 'in-preparation';
  readonly highlights: readonly string[];
  readonly verification: readonly string[];
}

/** The public changelog intentionally contains only the current release. */
export const LEONIDA_ATLAS_RELEASES: readonly LeonidaAtlasRelease[] = [
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
] as const;

export const latestLeonidaAtlasRelease = LEONIDA_ATLAS_RELEASES[0]!;
