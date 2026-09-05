import type { APIRoute } from 'astro';

import { parseStreetSlug, streetError, streetJson } from '@features/street-leonida/api';
import { getStreetPlaceBySlug, getStreetViewpoints } from '@features/street-leonida/queries';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const parsed = parseStreetSlug(params.slug);
  if (!parsed.ok) return streetError(parsed.status);
  try {
    const options = { signal: request.signal, timeoutMs: 5_000 };
    const place = await getStreetPlaceBySlug(parsed.value, options);
    if (!place) return streetError(404);
    const viewpoints = await getStreetViewpoints({ placeSlug: parsed.value, limit: 50 }, options);
    return streetJson({ place, viewpoints: viewpoints.items });
  } catch {
    return streetError(502);
  }
};
