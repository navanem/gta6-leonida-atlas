import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initializeAnalytics } from '../../src/app/analytics';

const finalizer = resolve('scripts/finalize-build.mjs');
const base = '/atlas/';
const origin = 'https://atlas.example';
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
    env: { ...process.env, ATLAS_OUT_DIR: 'dist', ATLAS_BASE_PATH: base, VITE_ANALYTICS_ID: id },
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

interface FrameDescription {
  tagName: string;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  hidden?: boolean;
  title?: string;
  referrerPolicy?: string;
  src?: string;
  setAttribute(name: string, value: string): void;
}

function analyticsDocument() {
  const appended: FrameDescription[] = [];
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('document', {
    querySelector: () => appended.find((node) => node.dataset.atlasAnalytics),
    createElement: (tagName: string): FrameDescription => ({
      tagName,
      dataset: {},
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
    }),
    body: { append: (node: FrameDescription) => appended.push(node) },
  });
  vi.stubEnv('DEV', false);
  vi.stubEnv('BASE_URL', base);
  return appended;
}

function runBootstrap(source: string, options: { topLevel?: boolean; frameOrigin?: string } = {}) {
  const externalScripts: Array<{ src?: string }> = [];
  const host: { dataLayer?: Array<IArguments>; parent?: object; origin: string } = {
    origin: options.frameOrigin ?? 'null',
  };
  // Comparing a parent WindowProxy is allowed; reading its document is not.
  const inaccessibleParent = new Proxy(
    {},
    {
      get() {
        throw new Error('Opaque frame cannot access the parent document or storage');
      },
    },
  );
  host.parent = options.topLevel ? host : inaccessibleParent;
  const document: {
    cookie?: string;
    createElement: () => object;
    head: { appendChild: (script: { src?: string }) => void };
  } = {
    createElement: () => ({}),
    head: { appendChild: (script) => externalScripts.push(script) },
  };
  // Model the native opaque-origin cookie accessor: direct access throws until
  // the emitted bootstrap installs its own empty, non-persisting facade.
  Object.setPrototypeOf(document, {
    get cookie() {
      throw new Error('Opaque origin cannot read cookies');
    },
    set cookie(_value: string) {
      throw new Error('Opaque origin cannot write cookies');
    },
  });
  const context = {
    window: host,
    parent: host.parent,
    crypto: { randomUUID },
    location: {
      origin,
      href: `${origin}/atlas/analytics.html?private-note=never-send`,
      search: '?private-note=never-send',
    },
    document,
  };
  for (const property of ['localStorage', 'indexedDB']) {
    for (const target of [context, host]) {
      Object.defineProperty(target, property, {
        get() {
          throw new Error(`Bootstrap accessed ${property}`);
        },
      });
    }
  }
  runInNewContext(source, context);
  return {
    document,
    externalScripts,
    commands: host.dataLayer?.map((command) => Array.from(command)) ?? [],
  };
}

describe('optional analytics isolation', () => {
  it('creates one opaque iframe with no referrer and no private URL parameters', () => {
    const appended = analyticsDocument();
    initializeAnalytics(testId);
    initializeAnalytics(testId);
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({
      tagName: 'iframe',
      hidden: true,
      referrerPolicy: 'no-referrer',
      src: '/atlas/analytics.html',
      attributes: { sandbox: 'allow-scripts' },
    });
  });

  it('loads no analytics for a fresh fork, development, invalid IDs or offline startup', () => {
    const appended = analyticsDocument();
    initializeAnalytics(undefined);
    initializeAnalytics('invalid<script>');
    vi.stubEnv('DEV', true);
    initializeAnalytics(testId);
    vi.stubEnv('DEV', false);
    vi.stubGlobal('navigator', { onLine: false });
    initializeAnalytics(testId);
    expect(appended).toEqual([]);
  });

  it('runs the emitted bootstrap with sanitized locations and a fresh transient client identity', async () => {
    const directory = await fixture();
    finalize(directory, testId);
    const bootstrap = await readFile(join(directory, 'dist/analytics-bootstrap.js'), 'utf8');
    const first = runBootstrap(bootstrap);
    const second = runBootstrap(bootstrap);
    const config = first.commands.find((command) => command[0] === 'config')?.[2] as Record<
      string,
      unknown
    >;
    const secondConfig = second.commands.find((command) => command[0] === 'config')?.[2] as Record<
      string,
      unknown
    >;
    expect(config).toMatchObject({
      send_page_view: false,
      page_location: `${origin}/atlas/`,
      page_referrer: '',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    expect(config.client_id).not.toBe(secondConfig.client_id);
    expect(first.commands.filter((command) => command[0] === 'event')).toEqual([
      [
        'event',
        'page_view',
        { page_title: 'Leonida Atlas', page_location: `${origin}/atlas/`, page_referrer: '' },
      ],
    ]);
    expect(JSON.stringify(first.commands)).not.toContain('never-send');
    expect(first.externalScripts).toHaveLength(1);
    expect(new URL(first.externalScripts[0]!.src!).origin).toBe('https://www.googletagmanager.com');
    finalize(directory, 'invalid<script>');
    expect(
      runBootstrap(await readFile(join(directory, 'dist/analytics-bootstrap.js'), 'utf8')).commands,
    ).toEqual([]);
  });

  it('allows cookieless measurement without enabling cookie reads, persistence or storage access', async () => {
    const directory = await fixture();
    finalize(directory, testId);
    const bootstrap = runBootstrap(
      await readFile(join(directory, 'dist/analytics-bootstrap.js'), 'utf8'),
    );
    expect(bootstrap.document.cookie).toBe('');
    bootstrap.document.cookie = '_ga=must-not-persist; Path=/';
    expect(bootstrap.document.cookie).toBe('');
    expect(
      Reflect.defineProperty(bootstrap.document, 'cookie', { value: 'replacement-cookie' }),
    ).toBe(false);
    expect(bootstrap.document.cookie).toBe('');
    expect(bootstrap.commands[0]).toEqual([
      'consent',
      'default',
      {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]);
    expect(
      bootstrap.commands.some((command) => command[0] === 'event' && command[1] === 'page_view'),
    ).toBe(true);
  });

  it.each([
    { name: 'direct page', topLevel: true, frameOrigin: origin },
    { name: 'unsandboxed frame', topLevel: false, frameOrigin: origin },
    { name: 'opaque top-level page', topLevel: true, frameOrigin: 'null' },
  ])('loads no Google tag in a $name', async (options) => {
    const directory = await fixture();
    finalize(directory, testId);
    const bootstrap = runBootstrap(
      await readFile(join(directory, 'dist/analytics-bootstrap.js'), 'utf8'),
      options,
    );
    expect(bootstrap.commands).toEqual([]);
    expect(bootstrap.externalScripts).toEqual([]);
  });
});
