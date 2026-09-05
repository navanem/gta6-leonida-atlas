/** Optional instance ID; official values belong only in ignored deployment configuration. */
export function validAnalyticsId(value: unknown): value is string {
  return typeof value === 'string' && /^G-[A-Z0-9]{6,20}$/.test(value);
}
export type AnalyticsConsent = 'unknown' | 'granted' | 'denied';
const subscribers = new Set<() => void>();
let available = false;
let initialized = false;
let consent: AnalyticsConsent = 'unknown';
let consentPersisted = false;
let analyticsOrigin = '';
let frame: HTMLIFrameElement | null = null;
let framePurpose: 'measure' | 'cleanup' | null = null;
let cleanupPending = false;
let cleanupTimeout: ReturnType<typeof setTimeout> | undefined;
const key = (name: string) => `leonida-atlas:analytics:${import.meta.env.BASE_URL}:${name}`;
function read(name: string): string | null {
  try {
    return localStorage.getItem(key(name));
  } catch {
    return null;
  }
}
function write(name: string, value: string) {
  try {
    localStorage.setItem(key(name), value);
    return true;
  } catch {
    /* Consent remains effective for this page when storage is unavailable. */
    return false;
  }
}
function erase(name: string) {
  try {
    localStorage.removeItem(key(name));
  } catch {
    /* Storage may be unavailable. */
  }
}
function storedConsent(): AnalyticsConsent {
  const saved = read('consent');
  return saved === 'granted' || saved === 'denied' ? saved : 'unknown';
}
function httpsOrigin(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.origin === value.replace(/\/$/, '')
      ? url.origin
      : '';
  } catch {
    return '';
  }
}
function notify() {
  for (const subscriber of subscribers) subscriber();
}
function removeFrame() {
  if (cleanupTimeout) clearTimeout(cleanupTimeout);
  cleanupTimeout = undefined;
  frame?.remove();
  frame = null;
  framePurpose = null;
}
function markCleanup() {
  cleanupPending = true;
  write('cleanup', 'pending');
}
function sendCleanup() {
  if (!frame) return;
  framePurpose = 'cleanup';
  frame.contentWindow?.postMessage({ type: 'atlas:analytics:revoke' }, analyticsOrigin);
  if (!cleanupTimeout)
    cleanupTimeout = setTimeout(() => {
      removeFrame();
    }, 3000);
}
function synchronizeWithdrawal() {
  if (consent !== 'granted') return;
  const saved = storedConsent();
  if (saved === 'denied' || (consentPersisted && saved === 'unknown')) {
    consent = saved;
    consentPersisted = saved !== 'unknown';
    markCleanup();
    notify();
  }
}
function ensureFrame() {
  if (!available) return;
  synchronizeWithdrawal();
  if (frame) {
    if (cleanupPending) sendCleanup();
    return;
  }
  if (!navigator.onLine || (consent !== 'granted' && !cleanupPending)) return;
  const next = document.createElement('iframe');
  next.dataset.atlasAnalytics = 'true';
  // Keep real document geometry: display:none makes the SDK interpret 0/0 as
  // reaching its scroll threshold. The helper remains invisible and unfocusable.
  next.setAttribute(
    'style',
    'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none',
  );
  next.setAttribute('aria-hidden', 'true');
  next.tabIndex = -1;
  next.title = cleanupPending
    ? 'Atlas analytics preference cleanup'
    : 'Consented anonymous Atlas visit measurement';
  // A distinct, dedicated origin is required. Google never shares the app origin.
  next.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  next.referrerPolicy = 'no-referrer';
  next.src = `${analyticsOrigin}${import.meta.env.BASE_URL}analytics.html`;
  frame = next;
  framePurpose = cleanupPending ? 'cleanup' : 'measure';
  document.body.append(next);
}
function receiveMessage(event: MessageEvent) {
  if (
    !frame ||
    event.origin !== analyticsOrigin ||
    event.source !== frame.contentWindow ||
    !event.data ||
    typeof event.data !== 'object' ||
    Array.isArray(event.data) ||
    Object.keys(event.data).length !== 1
  )
    return;
  synchronizeWithdrawal();
  if (event.data.type === 'atlas:analytics:ready') {
    if (cleanupPending || consent !== 'granted') {
      sendCleanup();
      return;
    }
    if (framePurpose === 'measure')
      frame.contentWindow?.postMessage(
        { type: 'atlas:analytics:configure', consent: 'granted' },
        analyticsOrigin,
      );
  } else if (event.data.type === 'atlas:analytics:revoked' && framePurpose === 'cleanup') {
    cleanupPending = false;
    erase('cleanup');
    removeFrame();
    ensureFrame();
  }
}
function receiveStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== key('consent')) return;
  const next = storedConsent();
  const changed = consent !== next;
  if (consent === 'granted' && next !== 'granted') markCleanup();
  consent = next;
  consentPersisted = next !== 'unknown';
  cleanupPending ||= read('cleanup') === 'pending';
  ensureFrame();
  if (changed) notify();
}
export function initializeAnalytics(measurementId: unknown): void {
  const configuredOrigin = httpsOrigin(import.meta.env.VITE_ANALYTICS_ORIGIN);
  const parentOrigin = httpsOrigin(import.meta.env.VITE_ANALYTICS_PARENT_ORIGIN);
  available =
    !import.meta.env.DEV &&
    validAnalyticsId(measurementId) &&
    Boolean(
      configuredOrigin &&
      parentOrigin &&
      configuredOrigin !== parentOrigin &&
      parentOrigin === window.location.origin,
    );
  if (!available) {
    removeFrame();
    return;
  }
  analyticsOrigin = configuredOrigin;
  if (!initialized) {
    initialized = true;
    consent = storedConsent();
    consentPersisted = consent !== 'unknown';
    cleanupPending = read('cleanup') === 'pending';
    window.addEventListener('message', receiveMessage);
    window.addEventListener('storage', receiveStorage);
    window.addEventListener('online', ensureFrame);
  }
  ensureFrame();
}
export function analyticsAvailable(): boolean {
  return available;
}
export function getAnalyticsConsent(): AnalyticsConsent {
  return consent;
}
export function subscribeAnalyticsConsent(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}
export function setAnalyticsConsent(value: Exclude<AnalyticsConsent, 'unknown'>): void {
  if (!available || (value !== 'granted' && value !== 'denied')) return;
  const changed = consent !== value;
  if (value === 'denied') markCleanup();
  consent = value;
  consentPersisted = write('consent', value);
  ensureFrame();
  if (changed) notify();
}
