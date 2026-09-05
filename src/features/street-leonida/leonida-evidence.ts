import type { GtadbPoint, WorldPoint } from './leonida-coordinates';
import type { GtadbEvidenceFacets } from './gtadb';

export const EVIDENCE_LEVELS = ['CONFIRMED', 'SUPPORTED', 'APPROXIMATE', 'UNKNOWN'] as const;

export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export type StreetLeonidaRegionSlug =
  | 'vice-city'
  | 'leonida-keys'
  | 'grassrivers'
  | 'port-gellhorn'
  | 'ambrosia'
  | 'mount-kalaga-national-park';

/** First-party pages used to describe visible regional character, not precise geography. */
export const OFFICIAL_SOURCE_URLS = {
  onlyInLeonida: 'https://www.rockstargames.com/VI/only-in-leonida',
  screenshots: 'https://www.rockstargames.com/VI/media/screenshots',
  videos: 'https://www.rockstargames.com/VI/media/videos',
} as const;

/**
 * Features directly visible in the reviewed Rockstar media groups named in the design record.
 * These observations do not establish precise roads, footprints, coastlines, or elevations.
 */
export const OFFICIAL_VISIBLE_FEATURES: Readonly<
  Record<StreetLeonidaRegionSlug, readonly string[]>
> = {
  'vice-city': [
    'Beachfront boulevard and pastel Art Deco low-rise fabric',
    'Modern towers, bay and canal water, port infrastructure, and palms',
    'Bright haze and night neon',
  ],
  'leonida-keys': [
    'Low islands and long causeways',
    'Shallow turquoise water, marinas, and roadside low-rise development',
    'Mangrove and coastal scrub',
  ],
  grassrivers: [
    'Marsh, tannin water, and lily pads',
    'Airboats, flooded tracks, and piers or stilt structures',
    'Sparse wetland horizon',
  ],
  'port-gellhorn': [
    'Faded motels, closed attractions, and strip retail',
    'Trailers, rough roads, overhead utilities, and neon',
  ],
  ambrosia: [
    'Allied Crystal industrial complex and sugar or agricultural context',
    'Arterial, gas station, sheds, stacks, tanks, and power infrastructure',
  ],
  'mount-kalaga-national-park': [
    'Forested ridges, rock cuts, and a winding highway',
    'River, steel rail bridge, and isolated industrial structures',
  ],
};

export interface ReviewedGtadbAnchor {
  readonly label: string;
  readonly region: StreetLeonidaRegionSlug;
  readonly gtadb: GtadbPoint;
  /** Landmark-name or visual-association evidence only; never spatial accuracy. */
  readonly confidence: 'SUPPORTED' | 'UNKNOWN';
  /** Literal, independent evidence facets retained from the pinned GTADB record. */
  readonly evidence?: GtadbEvidenceFacets;
}

/** Every GTADB anchor placement remains a community estimate after the deterministic transform. */
export const GTADB_ANCHOR_PLACEMENT_EVIDENCE = 'APPROXIMATE' as const;

/**
 * Audited, literal subset of the pinned GTADB snapshot. Only these raw coordinate pairs may
 * seed compatibility geography. Real-world analogue coordinates never appear here.
 */
export const REVIEWED_GTADB_ANCHORS = {
  L32: {
    label: 'Hotel Dixon, Shore Dr, Vice Beach',
    region: 'vice-city',
    gtadb: { x: 1973.5, y: 737 },
    confidence: 'SUPPORTED',
  },
  L187: {
    label: 'Sahara Arena, Catalan Blvd, Downtown, Vice City',
    region: 'vice-city',
    gtadb: { x: -302.967335163014, y: 429.9274330647777 },
    confidence: 'SUPPORTED',
    evidence: {
      name: 'KNOWN',
      placement: 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
    },
  },
  L208: {
    label: 'Megamundo, Catalan Blvd, Downtown, Vice City',
    region: 'vice-city',
    gtadb: { x: -471.9069999999997, y: -297.61 },
    confidence: 'SUPPORTED',
  },
  L271: {
    label: 'Transportation feature, Mariana County',
    region: 'leonida-keys',
    gtadb: { x: -3740.295951471936, y: -7016.687381028809 },
    confidence: 'UNKNOWN',
  },
  L272: {
    label: 'Transportation feature, Mariana County',
    region: 'leonida-keys',
    gtadb: { x: -3768.4952972233496, y: -6989.189875086684 },
    confidence: 'UNKNOWN',
  },
  L304: {
    label: 'Starlet Motel, Kelly County',
    region: 'port-gellhorn',
    gtadb: { x: -5344.169189411038, y: 3526.8618516021365 },
    confidence: 'SUPPORTED',
    evidence: {
      name: 'KNOWN',
      placement: 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: false, demolished: true },
    },
  },
  L307: {
    label: 'Starlet Motel Sign, Kelly County (unconfirmed)',
    region: 'port-gellhorn',
    gtadb: { x: -5311, y: 3524.5 },
    confidence: 'SUPPORTED',
    evidence: {
      name: 'KNOWN',
      placement: 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: true, demolished: false },
    },
  },
  L310: {
    label: "Hank's Waffles, Port Gellhorn",
    region: 'port-gellhorn',
    gtadb: { x: -6190.705097588649, y: 4520.714992493181 },
    confidence: 'SUPPORTED',
  },
  L325: {
    label: 'The Rusty Anchor, Key Lento',
    region: 'leonida-keys',
    gtadb: { x: -2271.57, y: -5256.913 },
    confidence: 'SUPPORTED',
    evidence: {
      name: 'KNOWN',
      placement: 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
    },
  },
  L312: {
    label: 'Bridge, Port Gellhorn',
    region: 'port-gellhorn',
    gtadb: { x: -5932.225315161755, y: 4813.568713063137 },
    confidence: 'SUPPORTED',
  },
  L314: {
    label: 'Water Tower, Port Gellhorn',
    region: 'port-gellhorn',
    gtadb: { x: -6377.5, y: 4547.5 },
    confidence: 'SUPPORTED',
  },
  L399: {
    label: 'Allied Crystal Sugar Mill, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -3016.5107043822245, y: 3346.662355484881 },
    confidence: 'SUPPORTED',
    evidence: {
      name: 'KNOWN',
      placement: 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
    },
  },
  L400: {
    label: 'Allied Crystal Silo, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2666.133878625824, y: 3915.7116320880664 },
    confidence: 'SUPPORTED',
  },
  L401: {
    label: 'Allied Crystal Tank, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2977.056166412529, y: 3729.050761520994 },
    confidence: 'SUPPORTED',
  },
  L403: {
    label: 'Unidentified Ambrosia road-sequence feature',
    region: 'ambrosia',
    gtadb: { x: -2749.699753835951, y: 4323.049706949401 },
    confidence: 'UNKNOWN',
  },
  L404: {
    label: 'Unidentified Ambrosia road-sequence feature',
    region: 'ambrosia',
    gtadb: { x: -2735.5383823573056, y: 4296.786344329208 },
    confidence: 'UNKNOWN',
  },
  L405: {
    label: 'Unidentified Ambrosia road-sequence feature',
    region: 'ambrosia',
    gtadb: { x: -2721.6024904776123, y: 4265.645106385012 },
    confidence: 'UNKNOWN',
  },
  L406: {
    label: 'Xero Gas Station, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2706.7584168799162, y: 4235.8266820880035 },
    confidence: 'SUPPORTED',
    evidence: {
      name: 'KNOWN',
      placement: 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
    },
  },
  L407: {
    label: 'Unidentified demolished Ambrosia road-sequence feature',
    region: 'ambrosia',
    gtadb: { x: -2690.6742054879824, y: 4201.0527172717975 },
    confidence: 'UNKNOWN',
  },
  L530: {
    label: 'Mount Kalaga, Leonida',
    region: 'mount-kalaga-national-park',
    gtadb: { x: -3421.9823036223092, y: 6368.146163637521 },
    confidence: 'SUPPORTED',
  },
  L544: {
    label: 'Watson Bay Water Tower, Watson Bay',
    region: 'leonida-keys',
    gtadb: { x: -4960.480985674199, y: -3278.6224041633122 },
    confidence: 'SUPPORTED',
  },
  L594: {
    label: 'Unidentified utility feature, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2444.910983189574, y: 4198.580404492531 },
    confidence: 'UNKNOWN',
    evidence: {
      name: 'UNKNOWN',
      placement: 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
    },
  },
  L629: {
    label: 'Delights, Port Gellhorn (unconfirmed)',
    region: 'port-gellhorn',
    gtadb: { x: -6360.160353443459, y: 3590.852051282613 },
    confidence: 'SUPPORTED',
    evidence: {
      name: 'KNOWN',
      placement: 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: true, demolished: false },
    },
  },
  L888: {
    label: 'Radio Tower, Ambrosia (unconfirmed)',
    region: 'ambrosia',
    gtadb: { x: -2050.1361147653543, y: 3163.5188173313654 },
    confidence: 'SUPPORTED',
    evidence: {
      name: 'KNOWN',
      placement: 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: true, demolished: false },
    },
  },
  L921: {
    label: 'Allied Crystal Office Building, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2748.9748534915348, y: 3972.859087688468 },
    confidence: 'SUPPORTED',
  },
  L922: {
    label: 'Allied Crystal Warehouse, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2745.313152390602, y: 3803.0703073767345 },
    confidence: 'SUPPORTED',
  },
  L1000: {
    label: 'Lake Leonida, Leonard County',
    region: 'ambrosia',
    gtadb: { x: -1975.158607719366, y: 4731.927298577086 },
    confidence: 'SUPPORTED',
    evidence: {
      name: 'KNOWN',
      placement: 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
    },
  },
  L1049: {
    label: 'Allied Crystal Warehouse, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2730.60626608146, y: 3537.8790264214304 },
    confidence: 'SUPPORTED',
  },
  L1050: {
    label: 'Allied Crystal Warehouse, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2785.7549662979845, y: 3538.725949077165 },
    confidence: 'SUPPORTED',
  },
  L1051: {
    label: 'Allied Crystal Warehouse, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2862.4743115962974, y: 3480.3848787745624 },
    confidence: 'SUPPORTED',
  },
  L1052: {
    label: 'Allied Crystal Tank, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2651.34074944059, y: 3897.087872264607 },
    confidence: 'SUPPORTED',
  },
  L1053: {
    label: 'Allied Crystal Tank, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2627.896948390542, y: 3888.273365960404 },
    confidence: 'SUPPORTED',
  },
  L1065: {
    label: 'Sugar Fields, Ambrosia (unconfirmed)',
    region: 'ambrosia',
    gtadb: { x: -2060.372616795449, y: 3408.0846264475886 },
    confidence: 'SUPPORTED',
    evidence: {
      name: 'KNOWN',
      placement: 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: true, demolished: false },
    },
  },
  L1458: {
    label: 'Bridge, Grassrivers',
    region: 'grassrivers',
    gtadb: { x: -3498.9734553066246, y: -3552.623227653312 },
    confidence: 'SUPPORTED',
  },
  L1522: {
    label: 'Allied Crystal Tank, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2972.7922016870593, y: 3776.7436605886405 },
    confidence: 'SUPPORTED',
  },
  L1523: {
    label: 'Allied Crystal Tank, Ambrosia',
    region: 'ambrosia',
    gtadb: { x: -2941.8504401372807, y: 3813.427098794405 },
    confidence: 'SUPPORTED',
  },
} as const satisfies Readonly<Record<string, ReviewedGtadbAnchor>>;

export type ReviewedGtadbAnchorId = keyof typeof REVIEWED_GTADB_ANCHORS;

export interface ReviewedGtadbTravelApproach {
  /** Horizontal direction from the documented point toward the authored public-facing side. */
  readonly direction: WorldPoint;
  readonly standoffMetres: number;
  readonly evidence: 'APPROXIMATE';
  readonly rationale: string;
}

/**
 * Local camera approaches for modeled venue silhouettes. They alter only the visitor's safe
 * viewing position; the landmark group, atlas marker, and documented destination stay on the
 * unmodified GTADB transform.
 */
export const REVIEWED_GTADB_TRAVEL_APPROACHES = {
  L187: {
    direction: { x: 0, z: 1 },
    standoffMetres: 22,
    evidence: 'APPROXIMATE',
    rationale: 'Frames the Sahara Arena silhouette from outside its collision ellipse.',
  },
  L304: {
    direction: { x: -0.7808688094, z: -0.6246950476 },
    standoffMetres: 28,
    evidence: 'APPROXIMATE',
    rationale: 'Frames the evidence-led Starlet Motel frontage from outside its collision box.',
  },
  L307: {
    direction: { x: -0.7808688094, z: -0.6246950476 },
    standoffMetres: 18,
    evidence: 'APPROXIMATE',
    rationale: 'Frames the separate community-positioned Starlet sign without moving its marker.',
  },
  L325: {
    direction: { x: 0.627324739, z: 0.778757831 },
    standoffMetres: 22,
    evidence: 'APPROXIMATE',
    rationale: 'Frames The Rusty Anchor porch from outside its collision box.',
  },
  L629: {
    direction: { x: -0.7808688094, z: -0.6246950476 },
    standoffMetres: 22,
    evidence: 'APPROXIMATE',
    rationale: 'Frames the community-positioned Delights frontage without moving its marker.',
  },
} as const satisfies Partial<Record<ReviewedGtadbAnchorId, ReviewedGtadbTravelApproach>>;

export interface OfficialRegionSource {
  readonly title: string;
  readonly url: (typeof OFFICIAL_SOURCE_URLS)[keyof typeof OFFICIAL_SOURCE_URLS];
  readonly reviewedStillGroups: readonly string[];
}

export interface StreetLeonidaRegionManifest {
  readonly name: string;
  readonly officialIdentityEvidence: 'CONFIRMED';
  readonly communityPlacementEvidence: 'APPROXIMATE';
  readonly officialSources: readonly OfficialRegionSource[];
  readonly features: {
    readonly documented: readonly string[];
    readonly approximate: readonly string[];
    readonly unknown: readonly string[];
  };
  readonly reviewedAnchorIds: readonly ReviewedGtadbAnchorId[];
  readonly publicCaveat: string;
}

const officialSources = (
  reviewedStillGroups: readonly string[],
): readonly OfficialRegionSource[] => [
  {
    title: 'Rockstar Games — Only in Leonida',
    url: OFFICIAL_SOURCE_URLS.onlyInLeonida,
    reviewedStillGroups,
  },
  {
    title: 'Rockstar Games — GTA VI screenshots',
    url: OFFICIAL_SOURCE_URLS.screenshots,
    reviewedStillGroups,
  },
];

export const STREET_LEONIDA_REGION_MANIFESTS = {
  'vice-city': {
    name: 'Vice City',
    officialIdentityEvidence: 'CONFIRMED',
    communityPlacementEvidence: 'APPROXIMATE',
    officialSources: officialSources([
      'Vice_City_03',
      'Vice_City_06',
      'Vice_City_08',
      'Vice_City_09',
      'Vice_City_10',
      'Vice_City_11',
    ]),
    features: {
      documented: OFFICIAL_VISIBLE_FEATURES['vice-city'],
      approximate: ['Building footprints, secondary infill, and connecting roads'],
      unknown: ['Precise street graph, complete architecture, and canal or coastline geometry'],
    },
    reviewedAnchorIds: ['L32', 'L187', 'L208'],
    publicCaveat:
      'Official media establishes visual identity; GTADB/Map GTA placement is approximate.',
  },
  'leonida-keys': {
    name: 'Leonida Keys',
    officialIdentityEvidence: 'CONFIRMED',
    communityPlacementEvidence: 'APPROXIMATE',
    officialSources: officialSources([
      'Leonida_Keys_01',
      'Leonida_Keys_02',
      'Leonida_Keys_03',
      'Leonida_Keys_04',
      'Leonida_Keys_05',
    ]),
    features: {
      documented: OFFICIAL_VISIBLE_FEATURES['leonida-keys'],
      approximate: ['Sparse island continuity and simplified shore transitions'],
      unknown: ['Precise coastline, causeway alignment, settlement extent, and water depth'],
    },
    reviewedAnchorIds: ['L271', 'L272', 'L325', 'L544'],
    publicCaveat:
      'Official media establishes coastal character; reconstructed coast geometry is approximate.',
  },
  grassrivers: {
    name: 'Grassrivers',
    officialIdentityEvidence: 'CONFIRMED',
    communityPlacementEvidence: 'APPROXIMATE',
    officialSources: officialSources([
      'Grassrivers_01',
      'Grassrivers_02',
      'Grassrivers_03',
      'Grassrivers_04',
      'Grassrivers_05',
    ]),
    features: {
      documented: OFFICIAL_VISIBLE_FEATURES.grassrivers,
      approximate: ['Wetland cells and water-channel continuity around the reviewed bridge'],
      unknown: ['Precise channels, flooded-track routing, shoreline, and water depth'],
    },
    reviewedAnchorIds: ['L1458'],
    publicCaveat:
      'Official media establishes wetland character; reconstructed channels and continuity are approximate.',
  },
  'port-gellhorn': {
    name: 'Port Gellhorn',
    officialIdentityEvidence: 'CONFIRMED',
    communityPlacementEvidence: 'APPROXIMATE',
    officialSources: officialSources([
      'Port_Gellhorn_01',
      'Port_Gellhorn_02',
      'Port_Gellhorn_04',
      'Port_Gellhorn_06',
    ]),
    features: {
      documented: OFFICIAL_VISIBLE_FEATURES['port-gellhorn'],
      approximate: ['Low-rise access corridor between reviewed landmarks'],
      unknown: ['Precise harbour footprint, street graph, and block boundaries'],
    },
    reviewedAnchorIds: ['L304', 'L307', 'L310', 'L312', 'L314', 'L629'],
    publicCaveat:
      'Official media establishes regional character; harbour and road geometry is approximate.',
  },
  ambrosia: {
    name: 'Ambrosia',
    officialIdentityEvidence: 'CONFIRMED',
    communityPlacementEvidence: 'APPROXIMATE',
    officialSources: officialSources([
      'Ambrosia_01',
      'Ambrosia_02',
      'Ambrosia_03',
      'Ambrosia_04',
      'Ambrosia_05',
      'Ambrosia_06',
    ]),
    features: {
      documented: OFFICIAL_VISIBLE_FEATURES.ambrosia,
      approximate: ['Agricultural fields, access continuity, and secondary town fabric'],
      unknown: ['Precise field boundaries, road graph, and complete industrial footprints'],
    },
    reviewedAnchorIds: [
      'L399',
      'L400',
      'L401',
      'L403',
      'L404',
      'L405',
      'L406',
      'L407',
      'L594',
      'L888',
      'L921',
      'L922',
      'L1000',
      'L1049',
      'L1050',
      'L1051',
      'L1052',
      'L1053',
      'L1065',
      'L1522',
      'L1523',
    ],
    publicCaveat:
      'Official media establishes the industrial identity; GTADB/Map GTA placement, fields, and connections are approximate.',
  },
  'mount-kalaga-national-park': {
    name: 'Mount Kalaga National Park',
    officialIdentityEvidence: 'CONFIRMED',
    communityPlacementEvidence: 'APPROXIMATE',
    officialSources: officialSources([
      'Mount_Kalaga_National_Park_01',
      'Mount_Kalaga_National_Park_02',
      'Mount_Kalaga_National_Park_04',
      'Mount_Kalaga_National_Park_05',
      'Mount_Kalaga_National_Park_06',
    ]),
    features: {
      documented: OFFICIAL_VISIBLE_FEATURES['mount-kalaga-national-park'],
      approximate: ['Restrained local height field and sparse continuity terrain'],
      unknown: ['Precise peaks, elevation, river course, and road or rail alignment'],
    },
    reviewedAnchorIds: ['L530'],
    publicCaveat:
      'Official media establishes mountain character; reconstructed topography and alignments are approximate.',
  },
} as const satisfies Readonly<Record<StreetLeonidaRegionSlug, StreetLeonidaRegionManifest>>;

export type RegionLocalDatumPolicy =
  | {
      readonly kind: 'LOW';
      readonly evidence: 'APPROXIMATE';
      readonly rationale: string;
    }
  | {
      readonly kind: 'APPROXIMATE_HEIGHT_FIELD';
      readonly evidence: 'APPROXIMATE';
      readonly rationale: string;
    };

export const REGION_LOCAL_DATUM_POLICY: Readonly<
  Record<StreetLeonidaRegionSlug, RegionLocalDatumPolicy>
> = {
  'vice-city': {
    kind: 'LOW',
    evidence: 'APPROXIMATE',
    rationale:
      'The 2D GTADB evidence contains no elevation; official imagery supports low terrain.',
  },
  'leonida-keys': {
    kind: 'LOW',
    evidence: 'APPROXIMATE',
    rationale:
      'The 2D GTADB evidence contains no elevation; official imagery supports low islands.',
  },
  grassrivers: {
    kind: 'LOW',
    evidence: 'APPROXIMATE',
    rationale:
      'The 2D GTADB evidence contains no elevation; official imagery supports flat wetlands.',
  },
  'port-gellhorn': {
    kind: 'LOW',
    evidence: 'APPROXIMATE',
    rationale: 'The 2D GTADB evidence contains no elevation; no regional height field is inferred.',
  },
  ambrosia: {
    kind: 'LOW',
    evidence: 'APPROXIMATE',
    rationale: 'The 2D GTADB evidence contains no elevation; no regional height field is inferred.',
  },
  'mount-kalaga-national-park': {
    kind: 'APPROXIMATE_HEIGHT_FIELD',
    evidence: 'APPROXIMATE',
    rationale: 'Official imagery supports relief, but precise peaks and elevations remain unknown.',
  },
};

export interface RegionArrivalView {
  readonly targetAnchorId: ReviewedGtadbAnchorId;
  readonly adjustment: {
    readonly offsetMetres: WorldPoint;
    readonly lookAtOffsetMetres?: WorldPoint;
    readonly evidence: 'APPROXIMATE';
    readonly rationale: string;
  };
}

/** Collision-safe camera offsets; these never rewrite the source destination anchor. */
export const REGION_ARRIVAL_VIEWS: Readonly<Record<StreetLeonidaRegionSlug, RegionArrivalView>> = {
  'vice-city': {
    targetAnchorId: 'L208',
    adjustment: {
      offsetMetres: { x: 94, z: 56 },
      lookAtOffsetMetres: { x: 94, z: -48 },
      evidence: 'APPROXIMATE',
      rationale:
        'Mapped boulevard east of the documented destination, framed northbound with the landmark on the skyline.',
    },
  },
  'leonida-keys': {
    targetAnchorId: 'L544',
    adjustment: {
      offsetMetres: { x: 90, z: 120 },
      evidence: 'APPROXIMATE',
      rationale: 'Local camera clearance from the documented destination.',
    },
  },
  grassrivers: {
    targetAnchorId: 'L1458',
    adjustment: {
      offsetMetres: { x: -100, z: 80 },
      evidence: 'APPROXIMATE',
      rationale: 'Local camera clearance from the documented destination.',
    },
  },
  'port-gellhorn': {
    targetAnchorId: 'L310',
    adjustment: {
      offsetMetres: { x: -100, z: -80 },
      evidence: 'APPROXIMATE',
      rationale: 'Local camera clearance from the documented destination.',
    },
  },
  ambrosia: {
    targetAnchorId: 'L399',
    adjustment: {
      offsetMetres: { x: 100, z: -80 },
      evidence: 'APPROXIMATE',
      rationale: 'Local camera clearance from the documented destination.',
    },
  },
  'mount-kalaga-national-park': {
    targetAnchorId: 'L530',
    adjustment: {
      offsetMetres: { x: -100, z: -120 },
      evidence: 'APPROXIMATE',
      rationale: 'Local camera clearance from the documented destination.',
    },
  },
};
