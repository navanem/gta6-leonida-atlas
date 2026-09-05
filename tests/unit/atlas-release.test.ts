import { describe, expect, it } from 'vitest';
import { publishRelease } from '../../scripts/publish-release.mjs';

const repository = 'navanem/gta6-leonida-atlas';
const body = '# Current release\n\nLocal-first Atlas.';
const tag = 'v0.5.0';
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
  name: tag_name,
  body: '',
});

function github(
  initial: Release[],
  options: {
    publishFails?: boolean;
    verificationFails?: boolean;
    afterPublish?: (releases: Release[]) => void;
    beforeRead?: (release: Release, releases: Release[]) => void;
  } = {},
) {
  const releases = structuredClone(initial);
  const deleted: number[] = [];
  const mutations: string[] = [];
  let calls = 0;
  const response = (value: unknown, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(value), { status });
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    calls++;
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(`/repos/${repository}`, '');
    if (url.origin !== 'https://api.github.com') throw new Error('Unexpected API origin');
    if (method === 'GET' && path === `/git/ref/tags/${tag}`)
      return response({ ref: `refs/tags/${tag}`, object: { sha: 'a'.repeat(40) } });
    if (method === 'GET' && path === '/releases') {
      const start = (Number(url.searchParams.get('page') ?? 1) - 1) * 100;
      return response(releases.slice(start, start + 100));
    }
    if (method === 'GET' && path.startsWith('/releases/tags/')) {
      if (options.verificationFails) return response({}, 404);
      const found = releases.find(
        (item) => item.tag_name === decodeURIComponent(path.slice('/releases/tags/'.length)),
      );
      return response(found ?? {}, found ? 200 : 404);
    }
    if (method === 'POST' && path === '/releases') {
      mutations.push('publish');
      if (options.publishFails) return response({}, 500);
      const payload = JSON.parse(String(init?.body));
      const created = {
        ...release(Math.max(0, ...releases.map((item) => item.id)) + 1, payload.tag_name),
        ...payload,
      };
      releases.push(created);
      options.afterPublish?.(releases);
      return response(created, 201);
    }
    const id = Number(path.match(/^\/releases\/(\d+)$/)?.[1]);
    const found = releases.find((item) => item.id === id);
    if (method === 'GET' && found) {
      options.beforeRead?.(found, releases);
      return response(found);
    }
    if (method === 'PATCH' && found) {
      mutations.push('update');
      if (options.publishFails) return response({}, 500);
      Object.assign(found, JSON.parse(String(init?.body)), {
        published_at: '2026-09-05T12:00:00Z',
      });
      options.afterPublish?.(releases);
      return response(found);
    }
    if (method === 'DELETE' && found) {
      mutations.push('delete');
      deleted.push(found.id);
      releases.splice(releases.indexOf(found), 1);
      return response(null, 204);
    }
    return response({}, 404);
  };
  return {
    releases,
    deleted,
    mutations,
    fetchImpl,
    get calls() {
      return calls;
    },
  };
}

function publish(api: ReturnType<typeof github>, overrides: Record<string, unknown> = {}) {
  return publishRelease({
    repository,
    tag,
    body,
    token: 'test-only-token',
    fetchImpl: api.fetchImpl,
    ...overrides,
  });
}

describe('GitHub release publication and pruning', () => {
  it('publishes and verifies the new release before removing only older published semantic versions', async () => {
    const api = github([
      release(1, 'v0.4.0'),
      release(2, 'v0.5.0-rc.1'),
      release(3, 'v0.3.0', true),
      release(4, 'nightly'),
      release(5, 'v0.9.0', true),
      release(6, 'v0.5.0+archive'),
    ]);
    await publish(api);
    expect(api.deleted.sort()).toEqual([1, 2]);
    expect(api.mutations[0]).toBe('publish');
    expect(api.releases.find((item) => item.tag_name === tag)).toMatchObject({
      name: 'v0.5.0 — Leonida Atlas local-first',
      body,
      draft: false,
      prerelease: false,
    });
    expect(api.releases.map((item) => item.id)).toEqual([3, 4, 5, 6, 7]);
  });

  it('preserves every old release when publication fails', async () => {
    const api = github([release(1, 'v0.4.0')], { publishFails: true });
    await expect(publish(api)).rejects.toThrow(/500/);
    expect(api.deleted).toEqual([]);
    expect(api.releases.map((item) => item.tag_name)).toEqual(['v0.4.0']);
  });

  it('preserves old releases if the new release cannot be independently verified', async () => {
    const api = github([release(1, 'v0.4.0')], { verificationFails: true });
    await expect(publish(api)).rejects.toThrow();
    expect(api.deleted).toEqual([]);
  });

  it('does not publish or prune an old tag when a newer published version already exists', async () => {
    const api = github([release(1, 'v0.4.0'), release(2, 'v0.6.0-rc.1')]);
    await publish(api);
    expect(api.mutations).toEqual([]);
    expect(api.releases).toHaveLength(2);
  });

  it('stops pruning when a newer release appears during publication', async () => {
    const api = github([release(1, 'v0.4.0')], {
      afterPublish: (releases) => releases.push(release(99, 'v0.6.0')),
    });
    await publish(api);
    expect(api.deleted).toEqual([]);
    expect(api.releases.map((item) => item.tag_name)).toEqual(['v0.4.0', tag, 'v0.6.0']);
  });

  it.each(['draft', 'newer'])(
    'preserves a candidate changed to %s after listing',
    async (change) => {
      const api = github([release(1, 'v0.4.0')], {
        beforeRead: (item) => {
          if (item.id !== 1) return;
          if (change === 'draft') {
            item.draft = true;
            item.published_at = null;
          } else item.tag_name = 'v0.7.0';
        },
      });
      await publish(api);
      expect(api.deleted).toEqual([]);
      expect(api.releases.some((item) => item.id === 1)).toBe(true);
    },
  );

  it('updates the current release and is idempotent on a completed rerun', async () => {
    const api = github([release(1, 'v0.4.0'), release(2, tag)]);
    await publish(api);
    await publish(api);
    expect(api.mutations).toEqual(['update', 'delete']);
    expect(api.releases).toHaveLength(1);
    expect(api.releases[0]).toMatchObject({ tag_name: tag, body });
  });

  it('checks all pages before pruning and preserves a newer release on page two', async () => {
    const api = github([
      ...Array.from({ length: 100 }, (_, index) => release(index + 1, `nightly-${index}`)),
      release(101, 'v0.8.0'),
    ]);
    await publish(api);
    expect(api.mutations).toEqual([]);
    expect(api.releases).toHaveLength(101);
  });

  it.each([
    { repository: 'someone/fork' },
    { token: '' },
    { tag: 'v0.5.0-beta' },
    { tag: '../other' },
    { body: '' },
  ])('rejects an unsafe or incomplete invocation before any API call: %j', async (overrides) => {
    const api = github([release(1, 'v0.4.0')]);
    await expect(publish(api, overrides)).rejects.toThrow();
    expect(api.calls).toBe(0);
  });
});
