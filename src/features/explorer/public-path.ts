/** Public files follow the configured static-host prefix, including on forks. */
export function publicPath(path: string, base = import.meta.env?.BASE_URL ?? '/'): string {
  const prefix = `/${base.replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '');
  return `${prefix}/${path.replace(/^\/+/, '')}`;
}

export function projectPath(page: string): string {
  return `${publicPath('')}?page=${encodeURIComponent(page)}`;
}
