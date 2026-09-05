import type { APIRoute } from 'astro';

import { parseStreetSlug, streetError, streetJson } from '@features/street-leonida/api';
import { getStreetViewpointBySlug } from '@features/street-leonida/queries';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const parsed = parseStreetSlug(params.slug);
  if (!parsed.ok) return streetError(parsed.status);
  try {
    const viewpoint = await getStreetViewpointBySlug(parsed.value, {
      signal: request.signal,
      timeoutMs: 5_000,
    });
    return viewpoint ? streetJson({ viewpoint }) : streetError(404);
  } catch {
    return streetError(502);
  }
};
