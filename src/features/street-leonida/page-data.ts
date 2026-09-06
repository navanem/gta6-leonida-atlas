import { GTADB_LICENSE_URL, GTADB_PREFERRED_SOURCE, GTADB_REVISION } from './gtadb';
import { worldToGtadb } from './leonida-coordinates';
import { OFFICIAL_SOURCE_URLS } from './leonida-evidence';
import { PLACE_ENTRY_VIEWS } from './walk-geography';
import { RESEARCH_REGIONS, RESEARCH_REVIEWED_AT } from './leonida-research';
import type {
  PublicStreetList,
  PublicStreetMedia,
  PublicStreetPlace,
  PublicStreetPosition,
  PublicStreetSource,
  PublicStreetViewpoint,
  StreetPlaceCategory,
} from './types';

export type AtlasFocus =
  { kind: 'default' } | { kind: 'place'; slug: string } | { kind: 'viewpoint'; slug: string };

export interface AtlasPageData {
  places: PublicStreetPlace[];
  viewpoints: PublicStreetViewpoint[];
  initialPlace: PublicStreetPlace | null;
  initialViewpoint: PublicStreetViewpoint | null;
  dataUnavailable: boolean;
  focusFound: boolean;
}

interface LocalRegionRecord {
  readonly slug: keyof typeof PLACE_ENTRY_VIEWS;
  readonly name: string;
  readonly category: StreetPlaceCategory;
  readonly description: string;
  readonly visualDescription: string;
  readonly sourceUrl: string;
}

const gtadbSource: PublicStreetSource = {
  title: `GTADB / Map GTA community reconstruction, pinned revision ${GTADB_REVISION.slice(0, 7)}`,
  publisher: 'GTADB / Map GTA contributors',
  url: GTADB_PREFERRED_SOURCE,
  publishedAt: null,
  retrievedAt: '2026-09-05',
};

const rockstarSource = (url: string): PublicStreetSource => ({
  title: 'Grand Theft Auto VI official media',
  publisher: 'Rockstar Games',
  url,
  publishedAt: null,
  retrievedAt: RESEARCH_REVIEWED_AT,
});

const localMedia: PublicStreetMedia = {
  kind: 'STILL_IMAGE',
  deliveryMode: 'LOCAL_IMAGE',
  image: null,
  video: null,
  outboundUrl: null,
  pan: null,
};

const localRegions: readonly LocalRegionRecord[] = [
  {
    slug: 'vice-city',
    name: 'Vice City',
    category: 'CITY',
    description:
      'Officially named urban region represented in the Atlas with approximate GTADB-frame placement, beachfront density and skyline context.',
    visualDescription:
      'Pastel coastal city fabric, beach/water edge, palms, skyline massing and bright humid light.',
    sourceUrl: OFFICIAL_SOURCE_URLS.screenshots,
  },
  {
    slug: 'leonida-keys',
    name: 'Leonida Keys',
    category: 'REGION',
    description:
      'Officially named island region represented with approximate community placement, low islands, causeway language and turquoise coastal water.',
    visualDescription:
      'Low islands, shallow water, marina/causeway cues and mangrove/coastal scrub treatment.',
    sourceUrl: OFFICIAL_SOURCE_URLS.onlyInLeonida,
  },
  {
    slug: 'grassrivers',
    name: 'Grassrivers',
    category: 'NATURAL_AREA',
    description:
      'Officially named wetland region represented as approximate low-density marsh and waterway reconstruction.',
    visualDescription:
      'Marsh water, reeds, low horizon, wood structures and sparse wetland density.',
    sourceUrl: OFFICIAL_SOURCE_URLS.onlyInLeonida,
  },
  {
    slug: 'port-gellhorn',
    name: 'Port Gellhorn',
    category: 'CITY',
    description:
      'Officially named western/coastal settlement represented with approximate community placement and roadside motel/commercial character.',
    visualDescription:
      'Faded motels, low strip commerce, rougher roads, neon accents and coastal sprawl.',
    sourceUrl: OFFICIAL_SOURCE_URLS.onlyInLeonida,
  },
  {
    slug: 'ambrosia',
    name: 'Ambrosia',
    category: 'REGION',
    description:
      'Officially named industrial/agricultural region represented with approximate GTADB-frame placement and infrastructure context.',
    visualDescription:
      'Industrial/agricultural massing: silos, tanks, sheds, fields and utility infrastructure.',
    sourceUrl: OFFICIAL_SOURCE_URLS.onlyInLeonida,
  },
  {
    slug: 'mount-kalaga-national-park',
    name: 'Mount Kalaga',
    category: 'NATURAL_AREA',
    description:
      'Officially named northern wilderness region represented with approximate placement, relief, forest and winding-road context.',
    visualDescription:
      'Forested ridges, rock cuts, road curvature, riverside structure cues and a wilder atmosphere.',
    sourceUrl: OFFICIAL_SOURCE_URLS.onlyInLeonida,
  },
] as const;

function localPosition(slug: keyof typeof PLACE_ENTRY_VIEWS): PublicStreetPosition {
  const entry = PLACE_ENTRY_VIEWS[slug] ?? PLACE_ENTRY_VIEWS['vice-city'];
  if (!entry) throw new Error('Missing local Atlas entry view');
  const gtadb = worldToGtadb(entry.position);
  return {
    x: gtadb.x,
    y: gtadb.y,
    authority: 'COMMUNITY_SOURCE',
    confidence: 'LOW',
    precision: 'APPROXIMATE',
    label: 'Approximate position',
    source: gtadbSource,
  };
}

const localPlaces: readonly PublicStreetPlace[] = localRegions.map((region) => ({
  name: region.name,
  slug: region.slug,
  aliases: [],
  category: region.category,
  description: `${RESEARCH_REGIONS.find((research) => research.slug === region.slug)!.summary} Atlas placement and reconstructed geometry remain approximate.`,
  region: { name: region.name, slug: region.slug },
  relatedLocationSlug: null,
  position: localPosition(region.slug),
  labels: ['Official place name', 'Community-mapped position', 'Approximate position'],
  source: rockstarSource(region.sourceUrl),
}));

const localViewpoints: readonly PublicStreetViewpoint[] = localRegions.map((region) => ({
  slug: `${region.slug}-regional-entry`,
  title: `${region.name} regional entry`,
  place: { name: region.name, slug: region.slug },
  media: localMedia,
  source: rockstarSource(region.sourceUrl),
  labels: ['Official place name', 'Official media', 'Community-mapped position', 'Approximate position'],
  position: localPosition(region.slug),
  perspective: 'Regional arrival view',
  captureContext: `Local open-source catalogue. GTADB-derived position remains approximate; data source: ${GTADB_PREFERRED_SOURCE}; license: ${GTADB_LICENSE_URL}.`,
  visualDescription: region.visualDescription,
  coverageMessage: 'Coverage is regional and approximate; unknown detail is intentionally not filled.',
  links: [],
}));

export function getLocalStreetPlaces(): PublicStreetList<PublicStreetPlace> {
  return { items: [...localPlaces], total: localPlaces.length, page: 1, totalPages: 1 };
}

export function getLocalStreetViewpoints(): PublicStreetList<PublicStreetViewpoint> {
  return {
    items: [...localViewpoints],
    total: localViewpoints.length,
    page: 1,
    totalPages: 1,
  };
}

/** Load the complete app catalogue from bundled, source-attributed local data. */
export async function loadAtlasPageData(focus: AtlasFocus): Promise<AtlasPageData> {
  const places = [...localPlaces];
  const viewpoints = [...localViewpoints];

  let initialPlace: PublicStreetPlace | null = null;
  let initialViewpoint: PublicStreetViewpoint | null = null;
  let focusFound = true;

  if (focus.kind === 'place') {
    initialPlace = places.find((place) => place.slug === focus.slug) ?? null;
    focusFound = Boolean(initialPlace);
    initialViewpoint = viewpoints.find((viewpoint) => viewpoint.place.slug === initialPlace?.slug) ?? null;
  } else if (focus.kind === 'viewpoint') {
    initialViewpoint = viewpoints.find((viewpoint) => viewpoint.slug === focus.slug) ?? null;
    focusFound = Boolean(initialViewpoint);
    initialPlace = places.find((place) => place.slug === initialViewpoint?.place.slug) ?? null;
  } else {
    initialPlace = places.find((place) => place.slug === 'vice-city') ?? places[0] ?? null;
    initialViewpoint =
      viewpoints.find((viewpoint) => viewpoint.place.slug === initialPlace?.slug) ??
      viewpoints[0] ??
      null;
  }

  return {
    places,
    viewpoints,
    initialPlace,
    initialViewpoint,
    dataUnavailable: false,
    focusFound,
  };
}
