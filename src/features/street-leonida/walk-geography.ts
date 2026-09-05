import type { WalkPoint } from './walk-engine';
import { GTADB_REVISION, GTADB_SOURCE } from './gtadb';
import {
  gtadbToWorld,
  worldToGtadb,
  type GtadbPoint,
  type WorldPoint,
} from './leonida-coordinates';
import {
  REGION_ARRIVAL_VIEWS,
  REVIEWED_GTADB_ANCHORS,
  type EvidenceLevel,
  type ReviewedGtadbAnchorId,
} from './leonida-evidence';

/** @deprecated Compatibility metadata; new code should consume the pinned GTADB snapshot. */
export const STATE_OF_LEONIDA_COMMUNITY_MAP = {
  sourceUrl: GTADB_SOURCE,
  localSource: 'gtadb-landmarks-7c3f8c2.json',
  assetUrl: '/assets/street-leonida/maps/gtadb-landmarks-7c3f8c2.json',
  version: GTADB_REVISION,
  versionDate: '2026-09-04',
  markerCount: 2198,
  positionedMarkerCount: 2091,
  unpositionedMarkerCount: 107,
  status: 'community-estimate',
} as const;

type CompatibilityGroup =
  | 'regions'
  | 'viceCityDistricts'
  | 'viceCityPois'
  | 'ambrosia'
  | 'portGellhorn'
  | 'grassrivers'
  | 'leonidaKeys'
  | 'mountKalaga';

interface CompatibilityAnchorDefinition {
  readonly sourceAnchorId: ReviewedGtadbAnchorId;
  readonly offsetMetres: WorldPoint;
  readonly evidence: EvidenceLevel;
  readonly rationale: string;
}

type SupportedReviewedGtadbAnchorId = {
  [
    Id in ReviewedGtadbAnchorId
  ]: (typeof REVIEWED_GTADB_ANCHORS)[Id]['confidence'] extends 'SUPPORTED' ? Id : never;
}[ReviewedGtadbAnchorId];

export interface CompatibilityAnchorDerivation extends CompatibilityAnchorDefinition {
  readonly sourceGtadb: GtadbPoint;
  readonly sourceWorld: WorldPoint;
  readonly world: WorldPoint;
}

function supportedLandmark(
  sourceAnchorId: SupportedReviewedGtadbAnchorId,
  rationale: string,
): CompatibilityAnchorDefinition {
  return {
    sourceAnchorId,
    offsetMetres: { x: 0, z: 0 },
    evidence: 'SUPPORTED',
    rationale,
  };
}

function approximate(
  sourceAnchorId: ReviewedGtadbAnchorId,
  offsetMetres: WorldPoint,
  rationale: string,
): CompatibilityAnchorDefinition {
  return { sourceAnchorId, offsetMetres, evidence: 'APPROXIMATE', rationale };
}

/**
 * Compatibility-only local layout. Every nonzero value is a metre offset from a reviewed raw
 * GTADB anchor, remains explicitly APPROXIMATE, and must not be read as an exact road or coast.
 */
const LOCATION_DEFINITIONS = {
  regions: {
    mountKalaga: approximate(
      'L530',
      { x: 0, z: 0 },
      'Regional focus aliases the reviewed Mount Kalaga landmark position.',
    ),
    portGellhorn: approximate(
      'L310',
      { x: 0, z: 0 },
      "Regional focus aliases the reviewed Hank's Waffles landmark position.",
    ),
    lakeLeonida: approximate(
      'L1000',
      { x: 0, z: 0 },
      'Named lake uses the reviewed L1000 point; shoreline and extent remain unknown.',
    ),
    ambrosia: approximate(
      'L399',
      { x: 0, z: 0 },
      'Regional focus aliases the reviewed Allied Crystal landmark position.',
    ),
    grassrivers: approximate(
      'L1458',
      { x: 0, z: 0 },
      'Regional focus aliases the reviewed Grassrivers bridge position.',
    ),
    viceCity: approximate(
      'L208',
      { x: 0, z: 0 },
      'Regional focus aliases the reviewed Megamundo landmark position.',
    ),
    leonidaKeys: approximate(
      'L544',
      { x: 0, z: 0 },
      'Regional focus aliases the reviewed Watson Bay water-tower position.',
    ),
    keyLento: approximate(
      'L325',
      { x: 0, z: 0 },
      'Locality focus uses The Rusty Anchor record; the Key Lento boundary remains unknown.',
    ),
    watsonBay: approximate(
      'L544',
      { x: 0, z: 0 },
      'Locality alias uses the reviewed Watson Bay water-tower position.',
    ),
  },
  viceCityDistricts: {
    downtown: approximate(
      'L208',
      { x: 0, z: 0 },
      'District focus aliases the reviewed Megamundo landmark position.',
    ),
    bayside: approximate('L208', { x: -350, z: -220 }, 'Coarse district layout offset.'),
    viceBeach: approximate(
      'L32',
      { x: 0, z: 0 },
      'District focus aliases the reviewed Hotel Dixon landmark position.',
    ),
    oceanBeach: approximate('L32', { x: -20, z: 260 }, 'Coarse beachfront layout offset.'),
    southBeach: approximate('L32', { x: -30, z: 520 }, 'Coarse beachfront layout offset.'),
    washingtonBeach: approximate('L32', { x: -90, z: 120 }, 'Coarse beachfront layout offset.'),
    littleCuba: approximate('L208', { x: -1_200, z: 300 }, 'Coarse district layout offset.'),
    laPerle: approximate('L208', { x: -900, z: -1_100 }, 'Coarse district layout offset.'),
    stockyard: approximate('L208', { x: -1_000, z: -2_200 }, 'Coarse district layout offset.'),
    rialtoIslands: approximate('L208', { x: 1_000, z: -700 }, 'Coarse island layout offset.'),
    venetianIslands: approximate('L208', { x: 1_250, z: -450 }, 'Coarse island layout offset.'),
    viceCityPort: approximate('L208', { x: 900, z: 550 }, 'Coarse port layout offset.'),
    internationalAirport: approximate(
      'L208',
      { x: -3_200, z: 650 },
      'Coarse airport layout offset.',
    ),
    leafLinks: approximate('L208', { x: 750, z: -1_200 }, 'Coarse district layout offset.'),
    crosstown: approximate('L208', { x: -300, z: -1_000 }, 'Coarse district layout offset.'),
    rockridge: approximate('L208', { x: -2_200, z: -1_300 }, 'Coarse district layout offset.'),
    belville: approximate('L208', { x: -1_400, z: -700 }, 'Coarse district layout offset.'),
    hamlet: approximate('L208', { x: -1_700, z: 150 }, 'Coarse district layout offset.'),
    catalanKey: approximate('L208', { x: 1_100, z: -900 }, 'Coarse island layout offset.'),
    daltonIsland: approximate('L208', { x: 1_300, z: 50 }, 'Coarse island layout offset.'),
    glorianaKey: approximate('L208', { x: 1_450, z: 650 }, 'Coarse island layout offset.'),
    tequestaRetreat: approximate('L208', { x: -400, z: -2_100 }, 'Coarse district layout offset.'),
    ekanfinaka: approximate('L208', { x: -1_500, z: -1_400 }, 'Coarse district layout offset.'),
  },
  viceCityPois: {
    victoryArms: approximate('L208', { x: -320, z: 120 }, 'Coarse POI compatibility offset.'),
    megamundoTower: supportedLandmark('L208', 'Landmark uses the reviewed Megamundo anchor.'),
    effluviaRooftopLounge: approximate(
      'L32',
      { x: -420, z: 120 },
      'Coarse POI compatibility offset.',
    ),
    jackOfHearts: approximate('L32', { x: -360, z: 300 }, 'Coarse POI compatibility offset.'),
    hotelDixon: supportedLandmark('L32', 'Landmark uses the reviewed Hotel Dixon anchor.'),
    zekesGadgets: approximate('L208', { x: -580, z: 90 }, 'Coarse POI compatibility offset.'),
    a1Fashions: approximate('L208', { x: -520, z: 60 }, 'Coarse POI compatibility offset.'),
    mamisMarket: approximate('L208', { x: -480, z: 40 }, 'Coarse POI compatibility offset.'),
    tishaWockaFleaMarket: approximate(
      'L32',
      { x: -520, z: 420 },
      'Coarse POI compatibility offset.',
    ),
    viceCityMetro: approximate('L208', { x: -60, z: 220 }, 'Coarse POI compatibility offset.'),
    saharaArena: supportedLandmark(
      'L187',
      'Named arena uses the reviewed Sahara Arena anchor; placement remains community-estimated.',
    ),
    ferrisWheelStudy: approximate(
      'L208',
      { x: 500, z: -700 },
      'Official media supports a wheel silhouette, not this exact placement or a district name.',
    ),
    tennisCourts: approximate('L208', { x: 780, z: -1_050 }, 'Coarse POI compatibility offset.'),
    observationTower: approximate('L208', { x: 650, z: -300 }, 'Coarse POI compatibility offset.'),
  },
  ambrosia: {
    town: approximate(
      'L399',
      { x: 0, z: 0 },
      'Town focus aliases the reviewed Allied Crystal Sugar Mill position.',
    ),
    refinery: supportedLandmark(
      'L399',
      'Landmark uses the reviewed Allied Crystal Sugar Mill anchor.',
    ),
    xeroStation: supportedLandmark(
      'L406',
      'Named Xero station uses its reviewed GTADB anchor; placement remains community-estimated.',
    ),
    unknownUtilityL594: approximate(
      'L594',
      { x: 0, z: 0 },
      'GTADB supplies an unknown-name utility record; no real-world analogue identity is inferred.',
    ),
    radioTower: approximate(
      'L888',
      { x: 0, z: 0 },
      'Named radio-tower record carries the upstream unconfirmed tag.',
    ),
    sugarFields: approximate(
      'L1065',
      { x: 0, z: 0 },
      'Named Sugar Fields record carries the upstream unconfirmed tag; field extent remains unknown.',
    ),
    lakeLeonida: approximate(
      'L1000',
      { x: 0, z: 0 },
      'Named lake uses the reviewed L1000 point; no shoreline or water surface is inferred.',
    ),
    freight: approximate('L399', { x: -500, z: -250 }, 'Coarse industrial support-area offset.'),
  },
  portGellhorn: {
    centre: approximate(
      'L310',
      { x: 0, z: 0 },
      "Regional centre aliases the reviewed Hank's Waffles landmark position.",
    ),
    hanksWaffles: supportedLandmark('L310', "Landmark uses the reviewed Hank's Waffles anchor."),
    docks: approximate(
      'L312',
      { x: -500, z: -100 },
      'Coarse dock-area offset; harbour extent is unknown.',
    ),
    coastalStrip: approximate('L310', { x: -100, z: 200 }, 'Coarse low-rise corridor offset.'),
    industrialArea: approximate('L314', { x: 350, z: -50 }, 'Coarse industrial-area offset.'),
    easternCountryside: approximate(
      'L310',
      { x: 1_200, z: 0 },
      'Coarse countryside continuity offset.',
    ),
  },
  grassrivers: {
    centre: approximate(
      'L1458',
      { x: 0, z: 0 },
      'Regional centre aliases the reviewed Grassrivers bridge position.',
    ),
    north: approximate('L1458', { x: 0, z: -900 }, 'Coarse wetland-cell offset.'),
    westernWetlands: approximate('L1458', { x: -1_400, z: 0 }, 'Coarse wetland-cell offset.'),
    centralWetlands: approximate('L1458', { x: 350, z: 250 }, 'Coarse wetland-cell offset.'),
    easternWetlands: approximate('L1458', { x: 1_600, z: 150 }, 'Coarse wetland-cell offset.'),
    southernMangroves: approximate('L1458', { x: 400, z: 1_200 }, 'Coarse wetland-cell offset.'),
  },
  leonidaKeys: {
    northernEntrance: approximate(
      'L271',
      { x: 0, z: 0 },
      'Entrance alias uses a reviewed but unidentified transportation position.',
    ),
    watsonBay: approximate(
      'L544',
      { x: 0, z: 0 },
      'Locality alias uses the reviewed Watson Bay water-tower position.',
    ),
    keyLento: approximate(
      'L325',
      { x: 0, z: 0 },
      'Locality focus uses The Rusty Anchor record; the Key Lento boundary remains unknown.',
    ),
    centralKeys: approximate('L544', { x: -800, z: 1_500 }, 'Coarse island-continuity offset.'),
    westernKeys: approximate('L544', { x: -2_000, z: 1_700 }, 'Coarse island-continuity offset.'),
    easternKeys: approximate('L544', { x: 1_200, z: 1_500 }, 'Coarse island-continuity offset.'),
    southernmostKeys: approximate(
      'L272',
      { x: 0, z: 0 },
      'Locality alias uses a reviewed but unidentified transportation position.',
    ),
  },
  mountKalaga: {
    centre: approximate(
      'L530',
      { x: 0, z: 0 },
      'Regional centre aliases the reviewed Mount Kalaga landmark position.',
    ),
    westernWilderness: approximate('L530', { x: -1_800, z: -100 }, 'Coarse terrain-cell offset.'),
    highlands: approximate('L530', { x: -250, z: -450 }, 'Coarse height-field focus offset.'),
    easternForest: approximate('L530', { x: 1_700, z: 100 }, 'Coarse terrain-cell offset.'),
    southernEntrance: approximate('L530', { x: 150, z: 1_100 }, 'Coarse terrain-cell offset.'),
    riverRockCutStudy: approximate(
      'L530',
      { x: 700, z: 450 },
      'Official media supports river and rock-cut cues; this local study placement is approximate.',
    ),
  },
} as const satisfies Readonly<
  Record<CompatibilityGroup, Readonly<Record<string, CompatibilityAnchorDefinition>>>
>;

const EXTRA_COMPATIBILITY_DEFINITIONS = {
  'places.leonida': approximate(
    'L32',
    { x: -3_947, z: 1_474 },
    'Legacy full-state overview target retained at the transform origin; not a place claim.',
  ),
  'legacyTranslations.portGellhorn': approximate(
    'L310',
    { x: 100, z: 80 },
    'Temporary local-scene assembly offset pending the metre-scale regional rebuild.',
  ),
  'legacyTranslations.grassrivers': approximate(
    'L1458',
    { x: 100, z: -60 },
    'Temporary local-scene assembly offset pending the metre-scale regional rebuild.',
  ),
  'legacyTranslations.leonidaKeys': approximate(
    'L544',
    { x: -20, z: -80 },
    'Temporary local-scene assembly offset pending the metre-scale regional rebuild.',
  ),
  'legacyTranslations.mountKalaga': approximate(
    'L530',
    { x: 30, z: 120 },
    'Temporary local-scene assembly offset pending the metre-scale regional rebuild.',
  ),
} as const satisfies Readonly<Record<string, CompatibilityAnchorDefinition>>;

function deriveCompatibilityAnchor(
  definition: CompatibilityAnchorDefinition,
): CompatibilityAnchorDerivation {
  const source = REVIEWED_GTADB_ANCHORS[definition.sourceAnchorId];
  const sourceWorld = gtadbToWorld(source.gtadb);
  return {
    ...definition,
    sourceGtadb: source.gtadb,
    sourceWorld,
    world: {
      x: sourceWorld.x + definition.offsetMetres.x,
      z: sourceWorld.z + definition.offsetMetres.z,
    },
  };
}

const flattenedLocationDefinitions = Object.entries(LOCATION_DEFINITIONS).flatMap(
  ([group, definitions]) =>
    Object.entries(definitions).map(
      ([key, definition]) => [`${group}.${key}`, definition] as const,
    ),
);

/** Complete audit trail for every compatibility position and translation. */
export const COMPATIBILITY_ANCHOR_DERIVATIONS: Readonly<
  Record<string, CompatibilityAnchorDerivation>
> = Object.fromEntries(
  [...flattenedLocationDefinitions, ...Object.entries(EXTRA_COMPATIBILITY_DEFINITIONS)].map(
    ([id, definition]) => [id, deriveCompatibilityAnchor(definition)],
  ),
);

function worldRecord<T extends Readonly<Record<string, CompatibilityAnchorDefinition>>>(
  group: CompatibilityGroup,
  definitions: T,
): { readonly [K in keyof T]: WalkPoint } {
  return Object.fromEntries(
    Object.keys(definitions).map((key) => [
      key,
      COMPATIBILITY_ANCHOR_DERIVATIONS[`${group}.${key}`]!.world,
    ]),
  ) as { readonly [K in keyof T]: WalkPoint };
}

export const REGION_WORLD = worldRecord('regions', LOCATION_DEFINITIONS.regions);
export const VICE_CITY_WORLD = worldRecord(
  'viceCityDistricts',
  LOCATION_DEFINITIONS.viceCityDistricts,
);
export const VICE_CITY_POI_WORLD = worldRecord('viceCityPois', LOCATION_DEFINITIONS.viceCityPois);
export const AMBROSIA_WORLD = worldRecord('ambrosia', LOCATION_DEFINITIONS.ambrosia);
export const PORT_GELLHORN_WORLD = worldRecord('portGellhorn', LOCATION_DEFINITIONS.portGellhorn);
export const GRASSRIVERS_WORLD = worldRecord('grassrivers', LOCATION_DEFINITIONS.grassrivers);
export const LEONIDA_KEYS_WORLD = worldRecord('leonidaKeys', LOCATION_DEFINITIONS.leonidaKeys);
export const MOUNT_KALAGA_WORLD = worldRecord('mountKalaga', LOCATION_DEFINITIONS.mountKalaga);

export const PLACE_ANCHORS: Readonly<Record<string, WalkPoint>> = {
  'mount-kalaga-national-park': REGION_WORLD.mountKalaga,
  'port-gellhorn': REGION_WORLD.portGellhorn,
  'lake-leonida': AMBROSIA_WORLD.lakeLeonida,
  ambrosia: AMBROSIA_WORLD.town,
  grassrivers: REGION_WORLD.grassrivers,
  'vice-city': REGION_WORLD.viceCity,
  'leonida-keys': REGION_WORLD.leonidaKeys,
  'key-lento': REGION_WORLD.keyLento,
  'watson-bay': REGION_WORLD.watsonBay,
  leonida: COMPATIBILITY_ANCHOR_DERIVATIONS['places.leonida']!.world,
};

function arrivalView(slug: keyof typeof REGION_ARRIVAL_VIEWS): {
  position: WalkPoint;
  target: WalkPoint;
} {
  const view = REGION_ARRIVAL_VIEWS[slug];
  const anchor = gtadbToWorld(REVIEWED_GTADB_ANCHORS[view.targetAnchorId].gtadb);
  const lookAtOffset = view.adjustment.lookAtOffsetMetres ?? { x: 0, z: 0 };
  return {
    position: {
      x: anchor.x + view.adjustment.offsetMetres.x,
      z: anchor.z + view.adjustment.offsetMetres.z,
    },
    target: {
      x: anchor.x + lookAtOffset.x,
      z: anchor.z + lookAtOffset.z,
    },
  };
}

export const PLACE_ENTRY_VIEWS: Readonly<
  Record<string, { position: WalkPoint; target: WalkPoint }>
> = {
  'vice-city': arrivalView('vice-city'),
  'leonida-keys': arrivalView('leonida-keys'),
  grassrivers: arrivalView('grassrivers'),
  'port-gellhorn': arrivalView('port-gellhorn'),
  ambrosia: arrivalView('ambrosia'),
  'mount-kalaga-national-park': arrivalView('mount-kalaga-national-park'),
};

/** @deprecated Translation shims for scene modules awaiting the regional metre-scale rewrite. */
export const LEGACY_REGION_TRANSLATIONS = {
  portGellhorn: COMPATIBILITY_ANCHOR_DERIVATIONS['legacyTranslations.portGellhorn']!.world,
  grassrivers: COMPATIBILITY_ANCHOR_DERIVATIONS['legacyTranslations.grassrivers']!.world,
  leonidaKeys: COMPATIBILITY_ANCHOR_DERIVATIONS['legacyTranslations.leonidaKeys']!.world,
  mountKalaga: COMPATIBILITY_ANCHOR_DERIVATIONS['legacyTranslations.mountKalaga']!.world,
} as const;

export interface LeonidaLocationAnchor {
  readonly id: string;
  readonly label: string;
  readonly group: CompatibilityGroup;
  readonly gtadb: GtadbPoint;
  /** @deprecated Compatibility alias; this is a GTADB point, not a normalized grid. */
  readonly grid: GtadbPoint;
  readonly world: WalkPoint;
  readonly evidence: EvidenceLevel;
  readonly sourceAnchorId: ReviewedGtadbAnchorId;
}

const LOCATION_LABEL_OVERRIDES: Readonly<Record<string, string>> = {
  'regions.mountKalaga': 'Mount Kalaga National Park',
  'regions.portGellhorn': 'Port Gellhorn',
  'regions.lakeLeonida': 'Lake Leonida',
  'regions.viceCity': 'Vice City',
  'regions.leonidaKeys': 'Leonida Keys',
  'regions.keyLento': 'Key Lento',
  'regions.watsonBay': 'Watson Bay',
  'viceCityDistricts.viceBeach': 'Vice Beach',
  'viceCityDistricts.oceanBeach': 'Ocean Beach',
  'viceCityDistricts.southBeach': 'South Beach',
  'viceCityDistricts.washingtonBeach': 'Washington Beach',
  'viceCityDistricts.littleCuba': 'Little Cuba / Little Havana',
  'viceCityDistricts.laPerle': 'La Perle / Little Haiti',
  'viceCityDistricts.viceCityPort': 'Vice City Port',
  'viceCityDistricts.internationalAirport': 'Vice City International Airport',
  'viceCityPois.megamundoTower': 'Megamundo',
  'viceCityPois.effluviaRooftopLounge': 'Effluvia Rooftop Lounge',
  'viceCityPois.jackOfHearts': 'Jack of Hearts',
  'viceCityPois.hotelDixon': 'Hotel Dixon',
  'viceCityPois.zekesGadgets': "Zeke's Gadgets",
  'viceCityPois.a1Fashions': 'A1 Fashions',
  'viceCityPois.mamisMarket': "Mami's Market",
  'viceCityPois.tishaWockaFleaMarket': 'Tisha-Wocka Flea Market',
  'viceCityPois.viceCityMetro': 'Vice City Metro',
  'viceCityPois.saharaArena': 'Sahara Arena',
  'viceCityPois.ferrisWheelStudy': 'Ferris wheel study (APPROXIMATE)',
  'viceCityPois.observationTower': 'Observation / Skydive Tower',
  'ambrosia.refinery': 'Allied Crystal Sugar Mill',
  'ambrosia.xeroStation': 'Xero Gas Station',
  'ambrosia.unknownUtilityL594': 'Unknown utility site',
  'ambrosia.radioTower': 'Radio Tower (unconfirmed)',
  'ambrosia.sugarFields': 'Sugar Fields',
  'ambrosia.lakeLeonida': 'Lake Leonida',
  'ambrosia.freight': 'Approximate industrial support area',
  'portGellhorn.centre': 'Port Gellhorn centre',
  'portGellhorn.hanksWaffles': "Hank's Waffles",
  'portGellhorn.coastalStrip': 'Coastal strip / motels',
  'portGellhorn.easternCountryside': 'Countryside east of Port Gellhorn',
  'grassrivers.centre': 'Grassrivers centre',
  'grassrivers.north': 'Northern Grassrivers',
  'leonidaKeys.northernEntrance': 'Northern Keys entrance',
  'leonidaKeys.keyLento': 'Key Lento',
  'leonidaKeys.watsonBay': 'Watson Bay',
  'leonidaKeys.centralKeys': 'Central Keys',
  'leonidaKeys.westernKeys': 'Western Keys',
  'leonidaKeys.easternKeys': 'Eastern Keys',
  'leonidaKeys.southernmostKeys': 'Southernmost Keys',
  'mountKalaga.centre': 'Mount Kalaga National Park centre',
  'mountKalaga.westernWilderness': 'Western wilderness',
  'mountKalaga.highlands': 'Mountains / highlands',
  'mountKalaga.easternForest': 'Eastern forest',
  'mountKalaga.southernEntrance': 'Southern entrance',
  'mountKalaga.riverRockCutStudy': 'River / rock-cut study (APPROXIMATE)',
};

function humanizeLocationKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\bPois?\b/gi, '')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const ALL_LOCATION_ANCHORS: readonly LeonidaLocationAnchor[] = Object.entries(
  LOCATION_DEFINITIONS,
).flatMap(([group, locations]) =>
  Object.keys(locations).map((key) => {
    const id = `${group}.${key}`;
    const derivation = COMPATIBILITY_ANCHOR_DERIVATIONS[id]!;
    const gtadb = worldToGtadb(derivation.world);
    return {
      id,
      label: LOCATION_LABEL_OVERRIDES[id] ?? humanizeLocationKey(key),
      group: group as CompatibilityGroup,
      gtadb,
      grid: gtadb,
      world: derivation.world,
      evidence: derivation.evidence,
      sourceAnchorId: derivation.sourceAnchorId,
    };
  }),
);

export interface LeonidaZoneProfile {
  name: string;
  detail: string;
}

const REGION_ZONE_PROFILES = [
  {
    anchors: [
      REVIEWED_GTADB_ANCHORS.L271,
      REVIEWED_GTADB_ANCHORS.L272,
      REVIEWED_GTADB_ANCHORS.L325,
      REVIEWED_GTADB_ANCHORS.L544,
    ].map(({ gtadb }) => gtadbToWorld(gtadb)),
    profile: { name: 'Leonida Keys', detail: 'Causeways · marinas · island waterfront' },
  },
  {
    anchors: [gtadbToWorld(REVIEWED_GTADB_ANCHORS.L530.gtadb)],
    profile: { name: 'Mount Kalaga', detail: 'Forest · river · rock cuts · winding roads' },
  },
  {
    anchors: [
      REVIEWED_GTADB_ANCHORS.L304,
      REVIEWED_GTADB_ANCHORS.L307,
      REVIEWED_GTADB_ANCHORS.L310,
      REVIEWED_GTADB_ANCHORS.L312,
      REVIEWED_GTADB_ANCHORS.L314,
      REVIEWED_GTADB_ANCHORS.L629,
    ].map(({ gtadb }) => gtadbToWorld(gtadb)),
    profile: { name: 'Port Gellhorn', detail: 'Motels · documented anchors · low-rise sprawl' },
  },
  {
    anchors: [
      REVIEWED_GTADB_ANCHORS.L399,
      REVIEWED_GTADB_ANCHORS.L406,
      REVIEWED_GTADB_ANCHORS.L594,
      REVIEWED_GTADB_ANCHORS.L888,
      REVIEWED_GTADB_ANCHORS.L1065,
    ].map(({ gtadb }) => gtadbToWorld(gtadb)),
    profile: {
      name: 'Ambrosia',
      detail: 'Allied Crystal Sugar Mill · agricultural context · industrial infrastructure',
    },
  },
  {
    anchors: [
      REVIEWED_GTADB_ANCHORS.L32,
      REVIEWED_GTADB_ANCHORS.L187,
      REVIEWED_GTADB_ANCHORS.L208,
    ].map(({ gtadb }) => gtadbToWorld(gtadb)),
    profile: { name: 'Vice City', detail: 'Downtown · islands · port · airport' },
  },
  {
    anchors: [gtadbToWorld(REVIEWED_GTADB_ANCHORS.L1458.gtadb)],
    profile: { name: 'Grassrivers', detail: 'Wetlands · airboats · sparse horizon' },
  },
] as const;

/** Nearest reviewed regional anchor; it makes no claim about an exact administrative boundary. */
export function getLeonidaZoneProfile(position: WalkPoint): LeonidaZoneProfile {
  const distanceToProfile = (candidate: (typeof REGION_ZONE_PROFILES)[number]): number =>
    Math.min(
      ...candidate.anchors.map((anchor) =>
        Math.hypot(position.x - anchor.x, position.z - anchor.z),
      ),
    );
  return REGION_ZONE_PROFILES.reduce((nearest, candidate) => {
    const nearestDistance = distanceToProfile(nearest);
    const candidateDistance = distanceToProfile(candidate);
    return candidateDistance < nearestDistance ? candidate : nearest;
  }).profile;
}

export const LEONIDA_ALIGNMENT_REVISION = `gtadb-${GTADB_REVISION.slice(0, 7)}-world-v1`;
