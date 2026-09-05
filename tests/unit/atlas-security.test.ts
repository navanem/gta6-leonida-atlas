import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const finalizer = resolve('scripts/finalize-build.mjs');
const base = '/atlas/';
const origin = 'https://atlas.example';
const measurementOrigin = 'https://measurement.example';
const testId = `G-${'0'.repeat(8)}`;
const temporaryDirectories: string[] = [];

it('keeps instance measurement identifiers out of public source and release documentation', async () => {
  const sources = (await readdir(resolve('src'), { recursive: true }))
    .filter((file) => /\.(?:ts|tsx)$/.test(file))
    .map((file) => join('src', file));
  for (const file of [...sources, 'README.md', 'RELEASES.md']) {
    const content = await readFile(file, 'utf8');
    expect(/G-[A-Z0-9]{6,20}/.test(content), `Instance analytics identifier in ${file}`).toBe(
      false,
    );
  }
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-security-'));
  temporaryDirectories.push(directory);
  const files: Record<string, string> = {
    'index.html': '<!doctype html><div id="root"></div>',
    'favicon.svg': '<svg/>',
    'assets/app-test.js': 'console.log("public app")',
    'assets/app-test.css': 'body{color:black}',
    'assets/gta6-leonida-atlas/basemap.svg': '<svg><title>Original</title></svg>',
    'assets/street-leonida/maps/gtadb-landmarks-7c3f8c2.json': '{"landmarks":[]}',
  };
  for (const [path, contents] of Object.entries(files)) {
    const destination = join(directory, 'dist', path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }
  return directory;
}

function finalize(directory: string, id = '') {
  // An explicit ID (including empty) avoids loading any real deployment env file.
  execFileSync(process.execPath, [finalizer], {
    cwd: directory,
    env: {
      ...process.env,
      ATLAS_OUT_DIR: 'dist',
      ATLAS_BASE_PATH: base,
      VITE_ANALYTICS_ID: id,
      VITE_ANALYTICS_ORIGIN: measurementOrigin,
      VITE_ANALYTICS_PARENT_ORIGIN: origin,
    },
    stdio: 'pipe',
    timeout: 15_000,
  });
}

interface FetchEvent {
  request: Request;
  respondWith(response: Promise<Response | undefined>): void;
}

function workerHarness(
  source: string,
  options: { cacheControl?: string; quotaFailure?: boolean; cacheOpenFailure?: boolean } = {},
) {
  const handlers = new Map<string, (event: FetchEvent) => void>();
  const fetches: string[] = [];
  const cachedUrls: string[] = [];
  const openedCaches: string[] = [];
  const context = {
    URL,
    self: {
      location: { origin },
      addEventListener: (type: string, listener: (event: FetchEvent) => void) =>
        handlers.set(type, listener),
    },
    caches: {
      open: async (name: string) => {
        openedCaches.push(name);
        if (options.cacheOpenFailure) throw new Error('Cache storage unavailable');
        return {
          match: async () => undefined,
          keys: async () => [],
          put: async (request: Request) => {
            if (options.quotaFailure) throw new Error('Quota exceeded');
            cachedUrls.push(request.url);
          },
        };
      },
    },
    fetch: async (request: Request) => {
      fetches.push(request.url);
      const response = new Response('Public network content', {
        headers: { 'cache-control': options.cacheControl ?? 'public, max-age=3600' },
      });
      Object.defineProperty(response, 'type', { value: 'basic' });
      return response;
    },
  };
  runInNewContext(source, context);
  return {
    fetches,
    cachedUrls,
    openedCaches,
    dispatch(path: string, headers?: Record<string, string>) {
      let response: Promise<Response | undefined> | undefined;
      const request = new Request(new URL(path, origin), { headers });
      handlers.get('fetch')!({
        request,
        respondWith: (value) => {
          response = value;
        },
      });
      return response;
    },
  };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('generated service worker privacy and availability', () => {
  let worker: string;
  beforeAll(async () => {
    const directory = await fixture();
    finalize(directory);
    worker = await readFile(join(directory, 'dist/sw.js'), 'utf8');
  });

  it('leaves analytics, authenticated requests, query URLs and unlisted resources outside caching', () => {
    const harness = workerHarness(worker);
    for (const path of [
      '/atlas/analytics.html',
      '/atlas/analytics-bootstrap.js',
      '/atlas/assets/app-test.js?private=token',
      '/atlas/assets/private.json',
      '/atlas/api/profile',
      '/other/assets/app-test.js',
      'https://external.example/file.js',
    ])
      expect(harness.dispatch(path)).toBeUndefined();
    expect(
      harness.dispatch('/atlas/assets/app-test.js', { authorization: 'Bearer test-only' }),
    ).toBeUndefined();
    expect(harness.fetches).toEqual([]);
    expect(harness.cachedUrls).toEqual([]);
  });

  it.each(['private, max-age=600', 'no-store'])(
    'returns %s responses without storing them',
    async (cacheControl) => {
      const harness = workerHarness(worker, { cacheControl });
      const response = await harness.dispatch('/atlas/assets/street-leonida/textures/test.jpg');
      expect(await response?.text()).toBe('Public network content');
      expect(harness.cachedUrls).toEqual([]);
    },
  );

  it.each([{ quotaFailure: true }, { cacheOpenFailure: true }])(
    'preserves network availability when browser caching fails: %j',
    async (options) => {
      const harness = workerHarness(worker, options);
      const response = await harness.dispatch('/atlas/assets/street-leonida/textures/test.jpg');
      expect(await response?.text()).toBe('Public network content');
      expect(harness.fetches).toHaveLength(1);
    },
  );

  it('caches public assets and changes the cache when only basemap bytes change', async () => {
    const directory = await fixture();
    finalize(directory);
    const before = workerHarness(await readFile(join(directory, 'dist/sw.js'), 'utf8'));
    await before.dispatch('/atlas/assets/gta6-leonida-atlas/basemap.svg');
    expect(before.cachedUrls).toEqual([`${origin}/atlas/assets/gta6-leonida-atlas/basemap.svg`]);
    await writeFile(
      join(directory, 'dist/assets/gta6-leonida-atlas/basemap.svg'),
      '<svg><title>Corrected coast</title></svg>',
    );
    finalize(directory);
    const after = workerHarness(await readFile(join(directory, 'dist/sw.js'), 'utf8'));
    await after.dispatch('/atlas/assets/gta6-leonida-atlas/basemap.svg');
    expect(after.openedCaches[0]).not.toBe(before.openedCaches[0]);
  });
});

function runBootstrap(
  source: string,
  options: {
    topLevel?: boolean;
    frameOrigin?: string;
    locationOrigin?: string;
    configure?: boolean;
  } = {},
) {
  const externalScripts: Array<{ src?: string }> = [];
  const messages: unknown[] = [];
  const cookieWrites: string[] = [];
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const host: {
    dataLayer?: Array<IArguments>;
    parent?: object;
    origin: string;
    addEventListener: (type: string, handler: (event: Record<string, unknown>) => void) => void;
    [key: string]: unknown;
  } = {
    origin: options.frameOrigin ?? measurementOrigin,
    addEventListener: (type, handler) => handlers.set(type, handler),
  };
  const inaccessibleParent = new Proxy(
    {},
    {
      get(_target, key) {
        if (key === 'postMessage')
          return (message: unknown, target: string) => {
            messages.push({ message, target });
          };
        throw new Error('The measurement frame cannot access its parent document or storage');
      },
    },
  );
  host.parent = options.topLevel ? host : inaccessibleParent;
  const document = {
    body: { style: {} },
    createElement: () => ({}),
    head: { appendChild: (script: { src?: string }) => externalScripts.push(script) },
  };
  Object.defineProperty(document, 'cookie', {
    get() {
      return '';
    },
    set(value: string) {
      cookieWrites.push(value);
    },
  });
  const context = {
    window: host,
    parent: host.parent,
    location: {
      origin: options.locationOrigin ?? measurementOrigin,
      href: `${measurementOrigin}/atlas/analytics.html?private-note=never-send`,
      search: '?private-note=never-send',
    },
    document,
  };
  for (const property of ['localStorage', 'indexedDB'])
    for (const target of [context, host])
      Object.defineProperty(target, property, {
        get() {
          throw new Error(`Bootstrap accessed ${property}`);
        },
      });
  runInNewContext(source, context);
  const dispatch = (data: unknown, overrides: Record<string, unknown> = {}) =>
    handlers.get('message')?.({ source: host.parent, origin, data, ...overrides });
  if (options.configure) dispatch({ type: 'atlas:analytics:configure', consent: 'granted' });
  return {
    document,
    host,
    externalScripts,
    messages,
    cookieWrites,
    dispatch,
    commands: () => host.dataLayer?.map((command) => Array.from(command)) ?? [],
  };
}

describe('optional analytics separate-origin isolation', () => {
  it('waits for exact consent from the verified parent before loading any Google script', async () => {
    const directory = await fixture();
    finalize(directory, testId);
    const bootstrap = runBootstrap(
      await readFile(join(directory, 'dist/analytics-bootstrap.js'), 'utf8'),
    );
    expect(bootstrap.messages).toEqual([
      { message: { type: 'atlas:analytics:ready' }, target: origin },
    ]);
    expect(bootstrap.externalScripts).toEqual([]);
    bootstrap.dispatch({ type: 'atlas:analytics:configure', consent: 'granted' }, { source: {} });
    bootstrap.dispatch(
      { type: 'atlas:analytics:configure', consent: 'granted' },
      { origin: 'https://attacker.example' },
    );
    bootstrap.dispatch({
      type: 'atlas:analytics:configure',
      consent: 'granted',
      notes: 'never-send',
    });
    bootstrap.dispatch({ type: 'atlas:analytics:configure', consent: 'denied' });
    expect(bootstrap.externalScripts).toEqual([]);
    bootstrap.dispatch({ type: 'atlas:analytics:configure', consent: 'granted' });
    bootstrap.dispatch({ type: 'atlas:analytics:configure', consent: 'granted' });
    expect(bootstrap.externalScripts).toHaveLength(1);
    expect(new URL(bootstrap.externalScripts[0]!.src!).origin).toBe(
      'https://www.googletagmanager.com',
    );
  });
  it('uses normal scoped SDK cookies and sanitized page locations without fabricated client/session IDs', async () => {
    const directory = await fixture();
    finalize(directory, testId);
    const bootstrap = runBootstrap(
      await readFile(join(directory, 'dist/analytics-bootstrap.js'), 'utf8'),
      { configure: true },
    );
    const config = bootstrap.commands().find((command) => command[0] === 'config')?.[2] as Record<
      string,
      unknown
    >;
    expect(config).toMatchObject({
      send_page_view: false,
      cookie_domain: 'none',
      cookie_path: base,
      cookie_prefix: 'atlas',
      cookie_flags: 'SameSite=Lax;Secure',
      page_location: `${origin}/atlas/`,
      page_referrer: '',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    expect(config).not.toHaveProperty('client_id');
    expect(config).not.toHaveProperty('session_id');
    expect(bootstrap.commands()[0]).toEqual([
      'consent',
      'default',
      {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]);
    expect(bootstrap.commands().filter((command) => command[0] === 'event')).toEqual([
      [
        'event',
        'page_view',
        { page_title: 'Leonida Atlas', page_location: `${origin}/atlas/`, page_referrer: '' },
      ],
    ]);
    expect(JSON.stringify(bootstrap.commands())).not.toContain('never-send');
    expect(bootstrap.document.body.style).toEqual({ minHeight: '10000px' });
  });
  it('withdraws consent without loading Google and clears only its namespaced host cookies', async () => {
    const directory = await fixture();
    finalize(directory, testId);
    const bootstrap = runBootstrap(
      await readFile(join(directory, 'dist/analytics-bootstrap.js'), 'utf8'),
    );
    bootstrap.dispatch({ type: 'atlas:analytics:revoke' });
    expect(bootstrap.host[`ga-disable-${testId}`]).toBe(true);
    expect(bootstrap.cookieWrites).toEqual([
      `atlas_ga=; Max-Age=0; Path=${base}; SameSite=Lax; Secure`,
      `atlas_ga_${testId.slice(2)}=; Max-Age=0; Path=${base}; SameSite=Lax; Secure`,
    ]);
    expect(bootstrap.messages.at(-1)).toEqual({
      message: { type: 'atlas:analytics:revoked' },
      target: origin,
    });
    bootstrap.dispatch({ type: 'atlas:analytics:configure', consent: 'granted' });
    expect(bootstrap.externalScripts).toEqual([]);
  });
  it.each([
    { name: 'direct helper page', topLevel: true },
    { name: 'opaque frame', frameOrigin: 'null' },
    { name: 'app-origin frame', frameOrigin: origin, locationOrigin: origin },
    {
      name: 'unexpected helper host',
      frameOrigin: 'https://attacker.example',
      locationOrigin: 'https://attacker.example',
    },
  ])('fails closed in a $name', async (options) => {
    const directory = await fixture();
    finalize(directory, testId);
    const bootstrap = runBootstrap(
      await readFile(join(directory, 'dist/analytics-bootstrap.js'), 'utf8'),
      { ...options, configure: true },
    );
    expect(bootstrap.messages).toEqual([]);
    expect(bootstrap.externalScripts).toEqual([]);
    expect(bootstrap.commands()).toEqual([]);
  });
  it('emits no enabled tag for an invalid measurement ID', async () => {
    const directory = await fixture();
    finalize(directory, 'invalid<script>');
    expect(
      runBootstrap(await readFile(join(directory, 'dist/analytics-bootstrap.js'), 'utf8'), {
        configure: true,
      }).commands(),
    ).toEqual([]);
  });
});
