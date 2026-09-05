import type { APIRoute } from 'astro';

import { parseStreetSearchRequest, streetError, streetJson } from '@features/street-leonida/api';
import { getStreetPlaces } from '@features/street-leonida/queries';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const parsed = parseStreetSearchRequest(url);
  if (!parsed.ok) return streetError(parsed.status);
  try {
    return streetJson(
      await getStreetPlaces(parsed.value, { signal: request.signal, timeoutMs: 5_000 }),
    );
  } catch {
    return streetError(502);
  }
};
