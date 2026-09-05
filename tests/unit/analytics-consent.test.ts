import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const id = `G-${'0'.repeat(8)}`;
const base = '/atlas/';
interface FrameMock {
  tag: string;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  src?: string;
  referrerPolicy?: string;
  contentWindow: { postMessage: ReturnType<typeof vi.fn> };
  setAttribute(key: string, value: string): void;
  remove(): void;
}
function environment(storage = new Map<string, string>()) {
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const frames: FrameMock[] = [];
  const window = {
    location: { origin: 'https://atlas.example' },
    addEventListener: (name: string, handler: (event: Record<string, unknown>) => void) =>
      handlers.set(name, handler),
    removeEventListener: (name: string) => handlers.delete(name),
  };
  vi.stubGlobal('window', window);
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      const frame: FrameMock = {
        tag,
        dataset: {},
        attributes: {},
        contentWindow: { postMessage: vi.fn() },
        setAttribute: (key: string, value: string) => {
          frame.attributes[key] = value;
        },
        remove: () => {
          const index = frames.indexOf(frame);
          if (index >= 0) frames.splice(index, 1);
        },
      };
      return frame;
    },
    body: { append: (frame: FrameMock) => frames.push(frame) },
  });
  vi.stubEnv('DEV', false);
  vi.stubEnv('BASE_URL', base);
  vi.stubEnv('VITE_ANALYTICS_ORIGIN', 'https://measurement.example');
  vi.stubEnv('VITE_ANALYTICS_PARENT_ORIGIN', 'https://atlas.example');
  const ready = (frame = frames[0]!, overrides: Record<string, unknown> = {}) =>
    handlers.get('message')?.({
      origin: 'https://measurement.example',
      source: frame.contentWindow,
      data: { type: 'atlas:analytics:ready' },
      ...overrides,
    });
  const revoked = (frame = frames[0]!) =>
    ready(frame, { data: { type: 'atlas:analytics:revoked' } });
  return { storage, handlers, frames, ready, revoked };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('explicit analytics consent and isolated identity', () => {
  it('starts unknown with no frame, Google request or measurement identity before consent', async () => {
    const env = environment();
    const api = await import('../../src/app/analytics');
    api.initializeAnalytics(id);
    expect(api.analyticsAvailable()).toBe(true);
    expect(api.getAnalyticsConsent()).toBe('unknown');
    expect(env.frames).toHaveLength(0);
    expect(env.storage.size).toBe(0);
  });
  it('grants only after user choice and sends only consent to the verified separate origin', async () => {
    const env = environment();
    const api = await import('../../src/app/analytics');
    api.initializeAnalytics(id);
    api.setAnalyticsConsent('granted');
    api.initializeAnalytics(id);
    expect(env.frames).toHaveLength(1);
    const frame = env.frames[0]!;
    expect(frame.attributes.sandbox).toBe('allow-scripts allow-same-origin');
    expect(frame.referrerPolicy).toBe('no-referrer');
    expect(frame.src).toBe('https://measurement.example/atlas/analytics.html');
    env.ready(frame, { origin: 'https://attacker.example' });
    env.ready(frame, { source: {} });
    env.ready(frame, { data: { type: 'atlas:analytics:ready', private: 'never-send' } });
    expect(frame.contentWindow.postMessage).not.toHaveBeenCalled();
    env.ready();
    const [payload, target] = frame.contentWindow.postMessage.mock.calls[0]!;
    expect(target).toBe('https://measurement.example');
    expect(payload).toEqual({ type: 'atlas:analytics:configure', consent: 'granted' });
  });
  it('restores only the consent choice across reloads without handling SDK cookies or app data', async () => {
    const first = environment();
    let api = await import('../../src/app/analytics');
    api.initializeAnalytics(id);
    api.setAnalyticsConsent('granted');
    vi.resetModules();
    const second = environment(first.storage);
    api = await import('../../src/app/analytics');
    api.initializeAnalytics(id);
    second.ready();
    expect(api.getAnalyticsConsent()).toBe('granted');
    expect(second.frames[0]!.contentWindow.postMessage.mock.calls[0]![0]).toEqual({
      type: 'atlas:analytics:configure',
      consent: 'granted',
    });
    expect([...second.storage.values()]).toEqual(['granted']);
  });
  it('revoking removes the iframe and generated IDs while preserving Atlas data', async () => {
    const env = environment(new Map([['atlas-personal-note', 'keep']]));
    const api = await import('../../src/app/analytics');
    api.initializeAnalytics(id);
    api.setAnalyticsConsent('granted');
    const old = env.frames[0]!;
    api.setAnalyticsConsent('denied');
    env.ready(old);
    expect(old.contentWindow.postMessage).toHaveBeenLastCalledWith(
      { type: 'atlas:analytics:revoke' },
      'https://measurement.example',
    );
    env.revoked(old);
    old.contentWindow.postMessage.mockClear();
    env.ready(old);
    expect(env.frames).toHaveLength(0);
    expect(old.contentWindow.postMessage).not.toHaveBeenCalled();
    expect([...env.storage.values()].sort()).toEqual(['denied', 'keep']);
    expect(api.getAnalyticsConsent()).toBe('denied');
  });
  it('explicitly declining also clears old helper cookies when the parent choice is unknown', async () => {
    const env = environment();
    const api = await import('../../src/app/analytics');
    api.initializeAnalytics(id);
    api.setAnalyticsConsent('denied');
    env.ready();
    expect(env.frames[0]!.contentWindow.postMessage).toHaveBeenCalledWith(
      { type: 'atlas:analytics:revoke' },
      'https://measurement.example',
    );
    env.revoked();
    expect(env.frames).toHaveLength(0);
    expect([...env.storage.values()]).toEqual(['denied']);
  });
  it('honors a cross-tab revocation and never recreates its frame on an online event', async () => {
    const env = environment();
    const api = await import('../../src/app/analytics');
    api.initializeAnalytics(id);
    api.setAnalyticsConsent('granted');
    const key = [...env.storage.keys()].find((key) => key.endsWith(':consent'))!;
    env.storage.set(key, 'denied');
    env.handlers.get('storage')?.({ key, newValue: 'denied' });
    env.handlers.get('online')?.({});
    env.revoked();
    expect(api.getAnalyticsConsent()).toBe('denied');
    expect(env.frames).toHaveLength(0);
  });
  it.each(['denied', null])(
    'honors a persisted withdrawal (%s) before a queued storage event arrives',
    async (value) => {
      const env = environment();
      const api = await import('../../src/app/analytics');
      api.initializeAnalytics(id);
      api.setAnalyticsConsent('granted');
      const consentKey = [...env.storage.keys()].find((key) => key.endsWith(':consent'))!;
      if (value === null) env.storage.delete(consentKey);
      else env.storage.set(consentKey, value);
      env.ready();
      expect(env.frames[0]!.contentWindow.postMessage).toHaveBeenCalledWith(
        { type: 'atlas:analytics:revoke' },
        'https://measurement.example',
      );
      expect(
        env.frames[0]!.contentWindow.postMessage.mock.calls.some(
          ([payload]) => payload.type === 'atlas:analytics:configure',
        ),
      ).toBe(false);
      expect(api.getAnalyticsConsent()).toBe(value ?? 'unknown');
      env.revoked();
    },
  );
  it('preserves an explicit per-page grant when browser preference storage is unavailable', async () => {
    const env = environment();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Storage blocked');
      },
      setItem: () => {
        throw new Error('Storage blocked');
      },
      removeItem: () => {},
    });
    const api = await import('../../src/app/analytics');
    api.initializeAnalytics(id);
    api.setAnalyticsConsent('granted');
    env.ready();
    expect(env.frames[0]!.contentWindow.postMessage).toHaveBeenCalledWith(
      { type: 'atlas:analytics:configure', consent: 'granted' },
      'https://measurement.example',
    );
  });
  it('does not load while offline but retries an already granted choice when online', async () => {
    const env = environment();
    vi.stubGlobal('navigator', { onLine: false });
    const api = await import('../../src/app/analytics');
    api.initializeAnalytics(id);
    api.setAnalyticsConsent('granted');
    expect(env.frames).toHaveLength(0);
    vi.stubGlobal('navigator', { onLine: true });
    env.handlers.get('online')?.({});
    expect(env.frames).toHaveLength(1);
  });
  it('is unavailable for a fresh fork or development and never generates IDs there', async () => {
    const env = environment();
    const api = await import('../../src/app/analytics');
    api.initializeAnalytics('invalid');
    api.setAnalyticsConsent('granted');
    expect(api.analyticsAvailable()).toBe(false);
    expect(env.storage.size).toBe(0);
    expect(env.frames).toHaveLength(0);
    vi.stubEnv('DEV', true);
    api.initializeAnalytics(id);
    expect(api.analyticsAvailable()).toBe(false);
  });
  it('fails closed if helper origin is missing, equals the app, or the parent does not match', async () => {
    const env = environment();
    const api = await import('../../src/app/analytics');
    for (const origin of [
      '',
      'https://atlas.example',
      'http://measurement.example',
      'https://measurement.example/private',
    ]) {
      vi.stubEnv('VITE_ANALYTICS_ORIGIN', origin);
      api.initializeAnalytics(id);
      expect(api.analyticsAvailable()).toBe(false);
    }
    vi.stubEnv('VITE_ANALYTICS_ORIGIN', 'https://measurement.example');
    vi.stubEnv('VITE_ANALYTICS_PARENT_ORIGIN', 'https://other.example');
    api.initializeAnalytics(id);
    expect(api.analyticsAvailable()).toBe(false);
    expect(env.frames).toHaveLength(0);
  });
  it('finishes a pending withdrawal when online without ever granting the cleanup frame', async () => {
    const env = environment();
    vi.stubGlobal('navigator', { onLine: false });
    const api = await import('../../src/app/analytics');
    api.initializeAnalytics(id);
    api.setAnalyticsConsent('granted');
    api.setAnalyticsConsent('denied');
    expect(env.frames).toHaveLength(0);
    vi.stubGlobal('navigator', { onLine: true });
    env.handlers.get('online')?.({});
    env.ready();
    expect(env.frames[0]!.contentWindow.postMessage).toHaveBeenCalledWith(
      { type: 'atlas:analytics:revoke' },
      'https://measurement.example',
    );
    env.revoked();
    expect(env.frames).toHaveLength(0);
    expect([...env.storage.values()]).toEqual(['denied']);
  });
  it('notifies consent UI subscribers and supports unsubscribe without duplicated frames', async () => {
    const env = environment();
    const api = await import('../../src/app/analytics');
    api.initializeAnalytics(id);
    const listener = vi.fn();
    const stop = api.subscribeAnalyticsConsent(listener);
    api.setAnalyticsConsent('granted');
    api.setAnalyticsConsent('granted');
    expect(env.frames).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    api.setAnalyticsConsent('denied');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
