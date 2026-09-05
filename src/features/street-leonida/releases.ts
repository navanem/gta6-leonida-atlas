export interface LeonidaAtlasRelease {
  readonly version: `v${number}.${number}.${number}`;
  readonly date: string;
  readonly title: string;
  readonly summary: string;
  readonly status: 'public' | 'in-preparation';
  readonly highlights: readonly string[];
  readonly verification: readonly string[];
}

export const LEONIDA_ATLAS_RELEASES: readonly LeonidaAtlasRelease[] = [
  {
    version: 'v0.3.0',
    date: '2026-09-05',
    title: 'Explore-first app, corrected fullscreen map and analytics',
    summary:
      'The standalone app now opens directly into Explore 3D, while the Map button opens a full-screen atlas with a true 100% fit, current position and click-to-travel.',
    status: 'public',
    highlights: [
      'App entry changed to Explore 3D first; the map remains one deliberate fullscreen module opened from Map.',
      'Corrected map fit reporting so the initial atlas view reads 100% instead of a misleading zoom value.',
      'Added current-position visibility, map click-to-travel and deterministic GTADB-frame arrival coordinates.',
      'Integrated Google tag G-YMBZ44B01J into the standalone app and Atlas project layouts.',
      'Completed the western low-evidence panel as an UNKNOWN / APPROXIMATE continuation without inventing confirmed GTA VI detail.',
    ],
    verification: [
      'Lint, typecheck and unit tests are run before release.',
      'Atlas Playwright coverage verifies Explore-first entry, fullscreen Map, mobile drawer behavior and map travel.',
    ],
  },
  {
    version: 'v0.2.0',
    date: '2026-09-05',
    title: 'Data-derived Leonida basemap and project pages',
    summary:
      'The old schematic map was replaced by an original, generalized basemap derived from pinned GTADB / Map GTA community source material.',
    status: 'public',
    highlights: [
      'Added the public project route /gta6-leonida-atlas and app route /gta6-leonida-atlas/app.',
      'Added About, Documentation, Credits, Contributing, Changelog and Licenses pages for the open-source preparation phase.',
      'Rendered 2,198 GTADB catalogue entries with positioned, unpositioned and uncertain states clearly separated.',
      'Legacy /tools/street-leonida routes now redirect permanently to the Atlas project and app deep links.',
      'All map geometry and placement language remains APPROXIMATE; unknown names and unmapped source coverage remain UNKNOWN.',
    ],
    verification: [
      'Local build generated the Atlas project pages and standalone app routes.',
      'HTTPS checks verify new routes, basemap asset delivery and legacy redirects.',
    ],
  },
  {
    version: 'v0.1.0',
    date: '2026-09-05',
    title: 'Street Leonida visual reconstruction foundation',
    summary:
      'The first Atlas foundation upgraded Street Leonida from a simple tool into a source-led 3D reconstruction with distinct regional identities.',
    status: 'public',
    highlights: [
      'Improved subtropical light, haze, material roughness and region-specific ground treatment.',
      'Added stronger silhouettes for Vice City, Leonida Keys, Grassrivers, Port Gellhorn, Ambrosia and Mount Kalaga.',
      'Replaced boxy old vehicle treatments with more believable road-scale silhouettes and traffic props.',
      'Kept the 2D map and 3D world aligned on the established GTADB coordinate transform.',
      'Preserved unsupported or low-evidence areas as APPROXIMATE / UNKNOWN instead of presenting them as confirmed landmarks.',
    ],
    verification: [
      'Manual desktop and mobile visual QA covered multiple regions.',
      'Unit coverage protects coordinates, map travel, rendering contracts and source-bound uncertainty labels.',
    ],
  },
] as const;

export const latestLeonidaAtlasRelease = LEONIDA_ATLAS_RELEASES[0]!;
