import { describe, expect, it } from 'vitest';
import { parseReleaseNotes, publishRelease } from '../../scripts/publish-release.mjs';

const repository = 'navanem/gta6-leonida-atlas';
const tag = 'v0.6.1';
const notes =
  '# Releases\n\n## v0.6.1 — 2026-09-05\n\nCurrent fixes.\n\n### Details\n\nCurrent detail.\n\n## v0.6.0\n\nAccount workspaces.\n\n## v0.5.0\n\nStandalone local map.\n';
interface Release {
  id: number;
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  name: string;
  body: string;
}
const release = (id: number, tag_name: string, draft = false): Release => ({
  id,
  tag_name,
  draft,
  prerelease: tag_name.includes('-'),
  published_at: draft ? null : '2026-09-05T12:00:00Z',
  name: `${tag_name} preserved title`,
  body: `${tag_name} preserved notes`,
});
type Mutation = { method: string; tag: string; body: Record<string, unknown> };
function github(
  initial: Release[],
  options: {
    refs?: string[];
    latest?: string;
    failCreate?: Set<string>;
    failVerification?: Set<string>;
    afterCreate?: (releases: Release[], created: Release) => void;
    malformedList?: boolean;
  } = {},
) {
  const releases = structuredClone(initial);
  const refs = new Set(options.refs ?? ['v0.6.1', 'v0.6.0', 'v0.5.0']);
  const calls: string[] = [];
  const mutations: Mutation[] = [];
  let latest = options.latest;
  const response = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status });
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (
      url.origin !== 'https://api.github.com' ||
      !url.pathname.startsWith(`/repos/${repository}/`)
    )
      throw new Error('Unexpected repository or API origin');
    const method = init?.method ?? 'GET';
    const path = url.pathname.slice(`/repos/${repository}`.length);
    calls.push(`${method} ${path}${url.search}`);
    if (method === 'GET' && path.startsWith('/git/ref/tags/')) {
      const requested = decodeURIComponent(path.slice('/git/ref/tags/'.length));
      return response(
        refs.has(requested)
          ? { ref: `refs/tags/${requested}`, object: { sha: 'a'.repeat(40), type: 'commit' } }
          : {},
        refs.has(requested) ? 200 : 404,
      );
    }
    if (method === 'GET' && path === '/releases') {
      if (options.malformedList) return response([{}]);
      const start = (Number(url.searchParams.get('page') ?? 1) - 1) * 100;
      return response(releases.slice(start, start + 100));
    }
    if (method === 'GET' && path === '/releases/latest') {
      const found = releases.find((item) => item.tag_name === latest);
      return response(found ?? {}, found ? 200 : 404);
    }
    if (method === 'GET' && path.startsWith('/releases/tags/')) {
      const requested = decodeURIComponent(path.slice('/releases/tags/'.length));
      if (
        options.failVerification?.has(requested) &&
        releases.some((item) => item.tag_name === requested)
      )
        return response({}, 500);
      const found = releases.find((item) => item.tag_name === requested);
      return response(found ?? {}, found ? 200 : 404);
    }
    if (method === 'POST' && path === '/releases') {
      const body = JSON.parse(String(init?.body));
      mutations.push({ method, tag: body.tag_name, body });
      if (options.failCreate?.has(body.tag_name)) return response({}, 500);
      const created = {
        ...release(Math.max(0, ...releases.map((item) => item.id)) + 1, body.tag_name),
        ...body,
      };
      releases.push(created);
      if (body.make_latest === 'true') latest = created.tag_name;
      options.afterCreate?.(releases, created);
      return response(created, 201);
    }
    const found = releases.find(
      (item) => item.id === Number(path.match(/^\/releases\/(\d+)$/)?.[1]),
    );
    if (method === 'PATCH' && found) {
      const body = JSON.parse(String(init?.body));
      mutations.push({ method, tag: found.tag_name, body });
      Object.assign(found, body);
      if (body.make_latest === 'true') latest = found.tag_name;
      return response(found);
    }
    throw new Error(`Unexpected API operation ${method} ${path}`);
  };
  return {
    releases,
    refs,
    calls,
    mutations,
    fetchImpl,
    get latest() {
      return latest;
    },
  };
}
function publish(api: ReturnType<typeof github>, overrides: Record<string, unknown> = {}) {
  return publishRelease({
    repository,
    tag,
    releaseNotes: notes,
    token: 'test-only-token',
    fetchImpl: api.fetchImpl,
    ...overrides,
  });
}

describe('version-specific release notes', () => {
  it('splits stable releases at level-two headings and keeps each version’s own notes', () => {
    const parsed = parseReleaseNotes(
      `${notes}\n## v0.4.0\n\nLegacy notes.\n\n## Unreleased\n\nFuture work.`,
    );
    expect(parsed.map((item: { tag: string }) => item.tag)).toEqual(['v0.6.1', 'v0.6.0', 'v0.5.0']);
    expect(parsed[0].body).toContain('### Details');
    expect(parsed[0].body).not.toContain('Account workspaces');
    expect(parsed[1].body).toContain('Account workspaces');
    expect(parsed[1].body).not.toContain('Standalone');
    expect(parsed[2].body).toContain('Standalone local map');
    expect(parsed[2].body).not.toContain('Legacy');
  });
  it('does not interpret fenced code as a release heading', () => {
    const parsed = parseReleaseNotes(
      '## v0.6.1\n\nExample:\n```md\n## v99.0.0\n```\n\n## v0.5.0\n\nOriginal.',
    );
    expect(parsed.map((item: { tag: string }) => item.tag)).toEqual(['v0.6.1', 'v0.5.0']);
    expect(parsed[0].body).toContain('## v99.0.0');
  });
  it.each([
    '## v0.6.1\n\n',
    `${notes}\n## v0.6.1\n\nDuplicate.`,
    '## v0.6.01\n\nInvalid.',
    '# Changelog\n\nNo releases.',
  ])('rejects empty, duplicate, malformed or absent release sections', (input) => {
    expect(() => parseReleaseNotes(input)).toThrow();
  });
});

describe('retained GitHub releases and historical backfill', () => {
  it('restores missing v0.5.0, retains v0.6.0 byte-for-byte, and publishes the current section as latest', async () => {
    const historical = release(1, 'v0.6.0');
    const legacy = release(2, 'v0.4.0');
    const api = github([historical, legacy], { latest: 'v0.6.0' });
    const result = await publish(api);
    expect(api.releases.find((item) => item.tag_name === 'v0.6.0')).toEqual(historical);
    expect(api.releases.find((item) => item.tag_name === 'v0.4.0')).toEqual(legacy);
    expect(api.releases.find((item) => item.tag_name === tag)?.body).toContain('Current fixes.');
    expect(api.releases.find((item) => item.tag_name === tag)?.body).not.toContain(
      'Standalone local map.',
    );
    expect(api.releases.find((item) => item.tag_name === 'v0.5.0')?.body).toContain(
      'Standalone local map.',
    );
    expect(
      api.mutations
        .filter((item) => item.method === 'POST')
        .map((item) => [item.tag, item.body.make_latest]),
    ).toEqual([
      [tag, 'false'],
      ['v0.5.0', 'false'],
    ]);
    expect(api.latest).toBe(tag);
    expect(result.created).toEqual([tag, 'v0.5.0']);
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
  });
  it('preflights every missing historical tag before publishing anything', async () => {
    const api = github([release(1, 'v0.6.0')], { refs: [tag, 'v0.6.0'] });
    await expect(publish(api)).rejects.toThrow(/v0.5.0|404/);
    expect(api.mutations).toEqual([]);
    expect(api.releases).toHaveLength(1);
  });
  it('requires the current tag to exist even when its release already exists', async () => {
    const api = github([release(1, tag), release(2, 'v0.6.0'), release(3, 'v0.5.0')], {
      refs: ['v0.6.0', 'v0.5.0'],
    });
    await expect(publish(api)).rejects.toThrow();
    expect(api.mutations).toEqual([]);
  });
  it.each([tag, 'v0.5.0'])('never overwrites an existing draft for %s', async (collision) => {
    const api = github([release(1, collision, true)]);
    await expect(publish(api)).rejects.toThrow(/draft|published/i);
    expect(api.mutations).toEqual([]);
  });
  it('backfills an older rerun without changing a newer latest or existing historical body', async () => {
    const newer = release(1, 'v0.7.0');
    const archived = release(2, tag);
    const api = github([newer, archived], { latest: newer.tag_name });
    await publish(api);
    expect(api.latest).toBe('v0.7.0');
    expect(api.releases.find((item) => item.id === 2)).toEqual(archived);
    expect(
      api.mutations.every((item) => item.method === 'POST' && item.body.make_latest === 'false'),
    ).toBe(true);
    expect(api.releases.map((item) => item.tag_name)).toEqual(['v0.7.0', tag, 'v0.6.0', 'v0.5.0']);
  });
  it('checks all pages for newer releases before selecting latest', async () => {
    const api = github(
      [
        ...Array.from({ length: 100 }, (_, index) => release(index + 1, `nightly-${index}`)),
        release(101, 'v0.8.0'),
        release(102, 'v0.6.0'),
      ],
      { latest: 'v0.6.0' },
    );
    await publish(api);
    expect(api.latest).toBe('v0.6.0');
    expect(api.calls.some((call) => call.endsWith('page=2'))).toBe(true);
    expect(api.mutations.some((item) => item.body.make_latest === 'true')).toBe(false);
  });

  it('preserves newer prereleases while promoting the newest stable release', async () => {
    const preview = release(1, 'v0.7.0-beta.1');
    const api = github([preview, release(2, 'v0.6.0')], { latest: 'v0.6.0' });
    await publish(api);
    expect(api.latest).toBe(tag);
    expect(api.releases.find((item) => item.id === preview.id)).toEqual(preview);
  });
  it('does not promote the current tag if a newer release appears during backfill', async () => {
    const api = github([], {
      afterCreate: (releases, created) => {
        if (created.tag_name === tag) releases.push(release(99, 'v0.7.0'));
      },
    });
    await publish(api);
    expect(api.mutations.some((item) => item.body.make_latest === 'true')).toBe(false);
  });
  it('retries a partial backfill without altering the successful releases', async () => {
    const failCreate = new Set(['v0.5.0']);
    const api = github([release(1, 'v0.6.0')], { latest: 'v0.6.0', failCreate });
    await expect(publish(api)).rejects.toThrow(/500/);
    expect(api.latest).toBe('v0.6.0');
    expect(api.releases.find((item) => item.tag_name === tag)).toBeDefined();
    const createdBody = api.releases.find((item) => item.tag_name === tag)?.body;
    failCreate.clear();
    await publish(api);
    await publish(api);
    expect(api.latest).toBe(tag);
    expect(api.releases).toHaveLength(3);
    expect(api.releases.find((item) => item.tag_name === tag)?.body).toBe(createdBody);
    expect(api.mutations.filter((item) => item.method === 'POST' && item.tag === tag)).toHaveLength(
      1,
    );
    expect(api.mutations.filter((item) => item.method === 'PATCH')).toHaveLength(1);
  });
  it('preserves all releases and withholds latest promotion after verification failure', async () => {
    const api = github([release(1, 'v0.6.0')], {
      latest: 'v0.6.0',
      failVerification: new Set([tag]),
    });
    await expect(publish(api)).rejects.toThrow(/500/);
    expect(api.latest).toBe('v0.6.0');
    expect(api.releases.some((item) => item.tag_name === tag)).toBe(true);
    expect(api.mutations.some((item) => item.method === 'PATCH')).toBe(false);
  });
  it('rejects malformed API listings without making changes', async () => {
    const api = github([], { malformedList: true });
    await expect(publish(api)).rejects.toThrow(/listing/i);
    expect(api.mutations).toEqual([]);
  });
  it.each([
    { repository: 'someone/fork' },
    { token: '' },
    { tag: 'v0.6.1-beta' },
    { tag: '../other' },
    { releaseNotes: '' },
    { tag: 'v0.5.0' },
    { releaseNotes: '## v0.5.0\n\nOld notes.' },
  ])('rejects invalid scope, tag or notes before API calls: %j', async (overrides) => {
    const api = github([]);
    await expect(publish(api, overrides)).rejects.toThrow();
    expect(api.calls).toHaveLength(0);
  });
});
