const projectPages = new Set([
  'about',
  'documentation',
  'credits',
  'contributing',
  'changelog',
  'licenses',
]);
export function resolveRoute(
  pathname: string,
  search: string,
): { view: 'map' | 'explorer' | 'project'; page: string; placeId: string | null } {
  const segments = pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(search);
  const tail = params.get('page') ?? segments.at(-1) ?? '';
  const placeIndex = segments.indexOf('place');
  const viewpointIndex = segments.indexOf('viewpoint');
  const oldSlug =
    placeIndex >= 0
      ? segments[placeIndex + 1]
      : viewpointIndex >= 0
        ? segments[viewpointIndex + 1]?.replace(/-regional-entry$/, '')
        : null;
  return {
    view: params.get('view') === '3d' ? 'explorer' : projectPages.has(tail) ? 'project' : 'map',
    page: tail,
    placeId: params.get('place') ?? (oldSlug ? `region:${oldSlug}` : null),
  };
}
