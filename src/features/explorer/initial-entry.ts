import type { Place } from '../../domain/types';
import { CANONICAL_BOUNDS, gtadbToWorld } from '../street-leonida/leonida-coordinates';
import { getLeonidaZoneProfile, PLACE_ENTRY_VIEWS } from '../street-leonida/walk-geography';
import { getLocalStreetPlaces } from '../street-leonida/page-data';
import type { WalkMapTravelDetail } from '../street-leonida/walk-map';

const regions = getLocalStreetPlaces().items;

/** Region chooses context/heading only. A selected POI always retains its own source coordinates. */
export function resolveExplorerEntry(place?: Place | null) {
  const raw = place?.position;
  const valid =
    raw &&
    Number.isFinite(raw.x) &&
    Number.isFinite(raw.y) &&
    raw.x >= CANONICAL_BOUNDS.west &&
    raw.x <= CANONICAL_BOUNDS.east &&
    raw.y >= CANONICAL_BOUNDS.south &&
    raw.y <= CANONICAL_BOUNDS.north;
  if (!place || !valid) {
    return {
      regionSlug: 'vice-city',
      regionName: 'Vice City',
      position: PLACE_ENTRY_VIEWS['vice-city']!.position,
      destination: undefined as WalkMapTravelDetail | undefined,
    };
  }
  const position = gtadbToWorld(raw);
  const explicitRegion =
    place.layerId === 'regions'
      ? regions.find((region) => place.id === `region:${region.slug}`)
      : undefined;
  const region =
    explicitRegion ??
    regions.find((region) => region.name === getLeonidaZoneProfile(position).name);
  const destination: WalkMapTravelDetail = {
    ...position,
    id: place.id,
    label: place.title,
    source: place.layerId === 'regions' ? 'region' : /^L\d+$/.test(place.id) ? 'gtadb' : 'map',
  };
  return {
    regionSlug: region?.slug ?? 'vice-city',
    regionName: region?.name ?? 'Leonida',
    position,
    destination,
  };
}
