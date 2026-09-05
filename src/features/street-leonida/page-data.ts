import { getAllStreetPlaces, getAllStreetViewpoints } from './queries';
import type { PublicStreetPlace, PublicStreetViewpoint } from './types';

const DEFAULT_VIEWPOINT_SLUG = 'vice-city-waterfront-daytime';

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

/** Load a complete app catalogue without replacing unavailable CMS data with invented content. */
export async function loadAtlasPageData(focus: AtlasFocus): Promise<AtlasPageData> {
  try {
    const [placeResult, viewpointResult] = await Promise.all([
      getAllStreetPlaces(),
      getAllStreetViewpoints(),
    ]);
    const places = placeResult.items;
    const viewpoints = viewpointResult.items;

    let initialPlace: PublicStreetPlace | null = null;
    let initialViewpoint: PublicStreetViewpoint | null = null;
    let focusFound = true;

    if (focus.kind === 'place') {
      initialPlace = places.find((place) => place.slug === focus.slug) ?? null;
      focusFound = Boolean(initialPlace);
      initialViewpoint =
        viewpoints.find((viewpoint) => viewpoint.place.slug === initialPlace?.slug) ?? null;
    } else if (focus.kind === 'viewpoint') {
      initialViewpoint = viewpoints.find((viewpoint) => viewpoint.slug === focus.slug) ?? null;
      focusFound = Boolean(initialViewpoint);
      initialPlace = places.find((place) => place.slug === initialViewpoint?.place.slug) ?? null;
    } else {
      initialViewpoint =
        viewpoints.find((viewpoint) => viewpoint.slug === DEFAULT_VIEWPOINT_SLUG) ??
        viewpoints[0] ??
        null;
      initialPlace =
        places.find((place) => place.slug === initialViewpoint?.place.slug) ?? places[0] ?? null;
    }

    return {
      places,
      viewpoints,
      initialPlace,
      initialViewpoint,
      dataUnavailable: false,
      focusFound,
    };
  } catch {
    return {
      places: [],
      viewpoints: [],
      initialPlace: null,
      initialViewpoint: null,
      dataUnavailable: true,
      focusFound: true,
    };
  }
}
