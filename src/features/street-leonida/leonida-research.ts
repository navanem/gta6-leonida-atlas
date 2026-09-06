import type { Place } from "../../domain/types";
import {
  REVIEWED_GTADB_ANCHORS,
  type StreetLeonidaRegionSlug,
} from "./leonida-evidence";

export interface ResearchSource {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly evidence: "official-text" | "official-image" | "official-video";
  readonly publishedAt: string | null;
  readonly retrievedAt: string;
}

export interface RegionDiscovery {
  readonly id: string;
  readonly region: StreetLeonidaRegionSlug;
  readonly title: string;
  readonly summary: string;
  readonly sourceIds: readonly string[];
  /** A regional observation is never a new map coordinate or a promise of a modeled POI. */
  readonly placement: "UNPOSITIONED";
  readonly travelRegion: StreetLeonidaRegionSlug;
}

export const RESEARCH_REVIEWED_AT = "2026-09-06";

function source(
  id: string,
  title: string,
  path: string,
  evidence: ResearchSource["evidence"],
  publishedAt: string | null = null,
): ResearchSource {
  return Object.freeze({
    id,
    title,
    url: `https://www.rockstargames.com/VI/${path}`,
    evidence,
    publishedAt,
    retrievedAt: RESEARCH_REVIEWED_AT,
  });
}

function still(id: string, title: string, filename: string): ResearchSource {
  // These are outbound citations, never hotlinked images or redistributed game assets.
  // The current gallery does not publish dates for individual images.
  return source(id, title, `_next/static/media/${filename}`, "official-image");
}

export const RESEARCH_SOURCES: Readonly<Record<string, ResearchSource>> =
  Object.freeze({
    leonida: source(
      "leonida",
      "Rockstar — Only in Leonida",
      "only-in-leonida",
      "official-text",
    ),
    "vice-city-05": still(
      "vice-city-05",
      "Rockstar — Vice City 05",
      "Vice_City_05.0~r~o0jzpp4a-.jpg",
    ),
    "keys-02": still(
      "keys-02",
      "Rockstar — Leonida Keys 02",
      "Leonida_Keys_02.0~ptk-53gl0lq.jpg",
    ),
    "keys-04": still(
      "keys-04",
      "Rockstar — Leonida Keys 04",
      "Leonida_Keys_04.0hce1rw1s8pd9.jpg",
    ),
    "keys-05": still(
      "keys-05",
      "Rockstar — Leonida Keys 05",
      "Leonida_Keys_05.0yerhvjhto-h..jpg",
    ),
    "keys-06": still(
      "keys-06",
      "Rockstar — Leonida Keys 06",
      "Leonida_Keys_06.0eapr3hbeyewx.jpg",
    ),
    "grassrivers-06": still(
      "grassrivers-06",
      "Rockstar — Grassrivers 06",
      "Grassrivers_06.0bdeicllwisnc.jpg",
    ),
    "port-gellhorn-05": still(
      "port-gellhorn-05",
      "Rockstar — Port Gellhorn 05",
      "Port_Gellhorn_05.0nsv0ou54n-t3.jpg",
    ),
    "ambrosia-01": still(
      "ambrosia-01",
      "Rockstar — Ambrosia 01",
      "Ambrosia_01.0rqphs0gazkm..jpg",
    ),
    "ambrosia-04": still(
      "ambrosia-04",
      "Rockstar — Ambrosia 04",
      "Ambrosia_04.0.2cefoguu-tt.jpg",
    ),
    "kalaga-05": still(
      "kalaga-05",
      "Rockstar — Mount Kalaga National Park 05",
      "Mount_Kalaga_National_Park_05.0_~vto-o2zxok.jpg",
    ),
    "kalaga-06": still(
      "kalaga-06",
      "Rockstar — Mount Kalaga National Park 06",
      "Mount_Kalaga_National_Park_06.166ouq5pjd7h0.jpg",
    ),
    "trailer-2": source(
      "trailer-2",
      "Grand Theft Auto VI Trailer 2",
      "trailer-2",
      "official-video",
      "2025-05-06",
    ),
    "extended-look": source(
      "extended-look",
      "Grand Theft Auto VI: An Extended Look",
      "an-extended-look",
      "official-video",
      "2026-08-27",
    ),
  });

export const RESEARCH_REGIONS = Object.freeze([
  {
    slug: "vice-city",
    name: "Vice City",
    summary:
      "Rockstar names Ocean Beach, Little Cuba, Tisha-Wocka and VC Port, giving the city distinct beach, neighborhood, market and cruise-port identities.",
  },
  {
    slug: "leonida-keys",
    name: "Leonida Keys",
    summary:
      "An island chain with everyday roadside life, boating gatherings and reef wildlife in Rockstar’s public images.",
  },
  {
    slug: "grassrivers",
    name: "Grassrivers",
    summary:
      "Rockstar describes mangrove wetlands; its images also reveal weathered working shelters among the waterways.",
  },
  {
    slug: "port-gellhorn",
    name: "Port Gellhorn",
    summary:
      "A former holiday destination with vacant commercial space, inexpensive motels and informal outdoor gatherings.",
  },
  {
    slug: "ambrosia",
    name: "Ambrosia",
    summary:
      "The Allied Crystal sugar refinery anchors local employment; public images show crop fields and riders wearing Final Chapter patches.",
  },
  {
    slug: "mount-kalaga-national-park",
    name: "Mount Kalaga National Park",
    summary:
      "A northern wilderness with off-road trails, shaded streams, wildlife and kayaking in Rockstar’s public material.",
  },
] as const satisfies readonly {
  readonly slug: StreetLeonidaRegionSlug;
  readonly name: string;
  readonly summary: string;
}[]);

function discovery(
  region: StreetLeonidaRegionSlug,
  id: string,
  title: string,
  summary: string,
  ...sourceIds: string[]
): RegionDiscovery {
  return Object.freeze({
    id,
    region,
    title,
    summary,
    sourceIds: Object.freeze(sourceIds),
    placement: "UNPOSITIONED",
    travelRegion: region,
  });
}

export const REGION_DISCOVERIES: readonly RegionDiscovery[] = Object.freeze([
  discovery(
    "vice-city",
    "little-cuba-bakeries",
    "Little Cuba’s bakeries",
    "Rockstar identifies Little Cuba through its busy panaderías. The bakery culture is documented; individual storefront names and locations are not supplied.",
    "leonida",
  ),
  discovery(
    "vice-city",
    "tisha-wocka-market",
    "Tisha-Wocka flea market",
    "The official city description names a flea market selling imitation brands. It does not establish a street address or market layout.",
    "leonida",
  ),
  discovery(
    "vice-city",
    "vc-port-cruises",
    "VC Port and cruise tourism",
    "Rockstar calls the cruise-ship hub VC Port. That role is confirmed, while terminal footprints and the port’s boundaries remain unestablished.",
    "leonida",
  ),
  discovery(
    "vice-city",
    "ocean-beach-life",
    "Ocean Beach and beach life",
    "Ocean Beach is named for its Art Deco hotels and pale sand. A Vice City beach image adds a lifeguard hut, jogging and games of catch.",
    "leonida",
    "vice-city-05",
  ),
  discovery(
    "leonida-keys",
    "keys-everyday-life",
    "Iguanas and island streets",
    "Public stills show iguanas on a roadside and coastal rock. A street scene includes a bicycle, mobility scooter and small roadside businesses.",
    "keys-02",
    "keys-06",
  ),
  discovery(
    "leonida-keys",
    "keys-underwater-life",
    "Life below the surface",
    "A reef scene shows divers, coral, fish, an eel and a sea turtle. The image establishes underwater life, not a surveyed dive-site position.",
    "keys-04",
  ),
  discovery(
    "leonida-keys",
    "keys-boat-gathering",
    "A gathering on the water",
    "Different boat types gather with passengers, inflatable floats and passing jet skis. These are observed social and boating details, not a named marina.",
    "keys-05",
  ),
  discovery(
    "grassrivers",
    "grassrivers-working-shelter",
    "Working shelters in the wetlands",
    "A public still shows an open shelter with exposed rafters, chains, stacked pallets and corrugated roofing. Its name and exact site are unknown.",
    "grassrivers-06",
  ),
  discovery(
    "port-gellhorn",
    "gellhorn-tourism-decline",
    "A former holiday economy",
    "Rockstar describes lost tourism, closed attractions and empty shopping strips. These explain the worn commercial setting without confirming any particular abandoned attraction.",
    "leonida",
  ),
  discovery(
    "port-gellhorn",
    "gellhorn-bonfire",
    "An outdoor gathering",
    "One night scene shows a bonfire, folding chairs, coolers and parked trucks. It documents a social setting rather than a permanent named campsite.",
    "port-gellhorn-05",
  ),
  discovery(
    "ambrosia",
    "ambrosia-bikers",
    "Final Chapter riders",
    "Final Chapter and Ambrosia are readable on riders’ vest patches. Rockstar separately describes a local biker gang alongside refinery employment.",
    "ambrosia-01",
    "leonida",
  ),
  discovery(
    "ambrosia",
    "ambrosia-crop-fields",
    "Fields, fire and industry",
    "A sunset image shows rows of crops, narrow fire fronts, water channels and distant industrial stacks. It does not explain what caused the fires.",
    "ambrosia-04",
  ),
  discovery(
    "mount-kalaga-national-park",
    "kalaga-backwoods-trails",
    "Backwoods trails",
    "Rockstar places the park near Leonida’s northern border and describes hunting, fishing and off-road trails. Exact trail routes are not published.",
    "leonida",
  ),
  discovery(
    "mount-kalaga-national-park",
    "kalaga-stream-wildlife",
    "Wildlife at the stream",
    "A cougar and deer appear beside a shaded stream with exposed roots and fallen leaves. This supports varied forest-edge habitat beyond pine-covered ridges.",
    "kalaga-05",
  ),
  discovery(
    "mount-kalaga-national-park",
    "kalaga-river-kayak",
    "Kayaking beneath the rail bridge",
    "A kayaker passes a yellow flood-depth gauge beside a steel railway bridge. These visible river details do not fix its course or water level.",
    "kalaga-06",
  ),
]);

export function getRegionDiscoveries(
  slug: StreetLeonidaRegionSlug,
): readonly RegionDiscovery[] {
  return REGION_DISCOVERIES.filter((discovery) => discovery.region === slug);
}

export function getResearchForPlace(place: Pick<Place, "id" | "evidence">) {
  if (place.evidence !== "approximate") return null;
  const directRegion = RESEARCH_REGIONS.find(
    (region) => place.id === `region:${region.slug}`,
  );
  const anchor = Object.hasOwn(REVIEWED_GTADB_ANCHORS, place.id)
    ? REVIEWED_GTADB_ANCHORS[place.id as keyof typeof REVIEWED_GTADB_ANCHORS]
    : null;
  const region =
    directRegion ??
    (anchor?.confidence === "SUPPORTED"
      ? RESEARCH_REGIONS.find((region) => region.slug === anchor.region)
      : undefined);
  return region
    ? { region, discoveries: getRegionDiscoveries(region.slug) }
    : null;
}
