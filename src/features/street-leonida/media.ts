const YOUTUBE_EMBED_HOSTS = new Set(['youtube.com', 'www.youtube.com']);
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{6,64}$/;

export function normalizeAuthorizedEmbedUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const match = url.pathname.match(/^\/embed\/([^/]+)$/);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !YOUTUBE_EMBED_HOSTS.has(url.hostname.toLowerCase()) ||
      !match ||
      !YOUTUBE_VIDEO_ID.test(match[1] ?? '')
    ) {
      return null;
    }
    return `https://www.youtube.com/embed/${match[1]}`;
  } catch {
    return null;
  }
}

export function buildAuthorizedEmbedUrl(value: unknown, start: number, end: number): string | null {
  const normalized = normalizeAuthorizedEmbedUrl(value);
  if (
    !normalized ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start >= end
  ) {
    return null;
  }
  const url = new URL(normalized);
  url.searchParams.set('start', String(Math.floor(start)));
  url.searchParams.set('end', String(Math.ceil(end)));
  url.searchParams.set('playsinline', '1');
  return url.toString();
}

export function authorizedEmbedProvider(value: unknown): 'YouTube' | null {
  return normalizeAuthorizedEmbedUrl(value) ? 'YouTube' : null;
}
