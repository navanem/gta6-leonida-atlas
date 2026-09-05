/** Optional public GA measurement ID; the official value lives in ignored deployment config. */
export function validAnalyticsId(value: unknown): value is string {
  return typeof value === 'string' && /^G-[A-Z0-9]{6,20}$/.test(value);
}

export function initializeAnalytics(measurementId: unknown): void {
  if (import.meta.env.DEV || !navigator.onLine) return;
  if (!validAnalyticsId(measurementId) || document.querySelector('[data-atlas-analytics]')) return;
  // An opaque sandbox keeps Enhanced Measurement away from app URLs, forms,
  // IndexedDB, history, favorites and notes. No user data is posted into the frame.
  const frame = document.createElement('iframe');
  frame.dataset.atlasAnalytics = 'true';
  frame.hidden = true;
  frame.title = 'Anonymous Atlas visit measurement';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  frame.src = `${import.meta.env.BASE_URL}analytics.html`;
  document.body.append(frame);
}
