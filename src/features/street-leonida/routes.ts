/** Builds a same-site redirect target while retaining the incoming request query. */
export function legacyAtlasRedirectTarget(requestUrl: URL, destinationPath: string): string {
  return `${destinationPath}${requestUrl.search}`;
}
