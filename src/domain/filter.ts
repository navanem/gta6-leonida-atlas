import type { Collection, Filters, Place, PlaceNote } from './types';

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** All filters intersect. Unpositioned entries remain searchable. */
export function filterPlaces(
  places: Place[],
  filters: Filters,
  favoriteIds: string[],
  notes: PlaceNote[],
  collections: Collection[],
): Place[] {
  const favorites = new Set(favoriteIds);
  const members = filters.collectionId
    ? new Set(collections.find((c) => c.id === filters.collectionId)?.placeIds ?? [])
    : null;
  const noteIndex = new Map(notes.map((n) => [n.placeId, n.text]));
  const terms = normalizeSearch(filters.query).split(/\s+/).filter(Boolean);
  return places.filter((place) => {
    if (filters.category !== 'all' && filters.category !== place.category) return false;
    if (filters.favoritesOnly && !favorites.has(place.id)) return false;
    if (filters.personalOnly && place.evidence !== 'personal') return false;
    if (filters.evidence !== 'all' && filters.evidence !== place.evidence) return false;
    if (members && !members.has(place.id)) return false;
    if (!terms.length) return true;
    const haystack = normalizeSearch(
      [
        place.title,
        place.category,
        place.region,
        place.description,
        ...place.tags,
        noteIndex.get(place.id) ?? '',
      ].join(' '),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
