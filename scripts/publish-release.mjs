import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE_REPOSITORY = 'navanem/gta6-leonida-atlas';

function version(tag) {
  const match =
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(
      tag,
    );
  if (!match) return null;
  const prerelease = match[4]?.split('.') ?? [];
  if (prerelease.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0')))
    return null;
  return { core: [match[1], match[2], match[3]].map((value) => BigInt(value)), prerelease };
}

function compare(left, right) {
  for (let index = 0; index < 3; index++) {
    if (left.core[index] !== right.core[index])
      return left.core[index] > right.core[index] ? 1 : -1;
  }
  if (!left.prerelease.length || !right.prerelease.length)
    return Number(!left.prerelease.length) - Number(!right.prerelease.length);
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index++) {
    const a = left.prerelease[index],
      b = right.prerelease[index];
    if (a === b) continue;
    if (a === undefined || b === undefined) return a === undefined ? -1 : 1;
    const aNumeric = /^\d+$/.test(a),
      bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return BigInt(a) > BigInt(b) ? 1 : -1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a > b ? 1 : -1;
  }
  return 0;
}

function validRelease(item) {
  return (
    item &&
    Number.isSafeInteger(item.id) &&
    item.id > 0 &&
    typeof item.tag_name === 'string' &&
    typeof item.draft === 'boolean' &&
    typeof item.prerelease === 'boolean' &&
    (item.published_at === null || typeof item.published_at === 'string')
  );
}

function published(item) {
  return (
    validRelease(item) &&
    !item.draft &&
    typeof item.published_at === 'string' &&
    Number.isFinite(Date.parse(item.published_at))
  );
}

/** Uses only release endpoints: Git references and repository history are never modified. */
export async function publishRelease({
  repository,
  tag,
  body,
  token,
  fetchImpl = globalThis.fetch,
}) {
  const targetVersion = typeof tag === 'string' ? version(tag) : null;
  if (repository !== RELEASE_REPOSITORY)
    throw new Error('Release publication is restricted to the Atlas repository.');
  if (!targetVersion || !tag.startsWith('v') || targetVersion.prerelease.length)
    throw new Error('A stable vMAJOR.MINOR.PATCH release tag is required.');
  if (typeof token !== 'string' || !token) throw new Error('GITHUB_TOKEN is required.');
  if (typeof body !== 'string' || !body.trim())
    throw new Error('The release body must not be empty.');

  const root = `/repos/${repository}`;
  async function request(method, path, data, allow404 = false) {
    let response;
    try {
      response = await fetchImpl(`https://api.github.com${root}${path}`, {
        method,
        redirect: 'error',
        signal: globalThis.AbortSignal.timeout(30_000),
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2026-03-10',
          'Content-Type': 'application/json',
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
    } catch {
      throw new Error(`GitHub API ${method} ${path} request failed.`);
    }
    if (allow404 && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub API ${method} ${path} failed (${response.status}).`);
    if (response.status === 204) return null;
    try {
      return await response.json();
    } catch {
      throw new Error(`GitHub API ${method} ${path} returned invalid JSON.`);
    }
  }
  async function listReleases() {
    const releases = [];
    for (let page = 1; page <= 100; page++) {
      const items = await request('GET', `/releases?per_page=100&page=${page}`);
      if (!Array.isArray(items) || items.some((item) => !validRelease(item)))
        throw new Error('GitHub returned an invalid release listing; pruning is disabled.');
      releases.push(...items);
      if (items.length < 100) return releases;
    }
    throw new Error('Release pagination exceeded its safety limit; pruning is disabled.');
  }
  const hasNewer = (releases) =>
    releases.some((item) => {
      const candidate = version(item.tag_name);
      return published(item) && candidate && compare(candidate, targetVersion) > 0;
    });
  const isOlder = (item) => {
    const candidate = version(item.tag_name);
    return published(item) && candidate && compare(candidate, targetVersion) < 0;
  };
  async function verifyRelease(id) {
    const item = await request('GET', `/releases/tags/${encodeURIComponent(tag)}`);
    if (!published(item) || item.tag_name !== tag || item.id !== id || item.prerelease)
      throw new Error('The new published release could not be verified; pruning is disabled.');
    return item;
  }

  // Ref lookup prevents the release API from silently creating a missing Git tag.
  const reference = await request('GET', `/git/ref/tags/${encodeURIComponent(tag)}`);
  if (reference?.ref !== `refs/tags/${tag}`) throw new Error('The release tag does not exist.');
  const initial = await listReleases();
  if (hasNewer(initial)) return { tag, deleted: [], skipped: 'A newer published version exists.' };
  const existing = initial.find((item) => item.tag_name === tag);
  const payload = {
    tag_name: tag,
    name: `${tag} — Leonida Atlas local-first`,
    body,
    draft: false,
    prerelease: false,
    make_latest: 'true',
  };
  const unchanged =
    published(existing) &&
    !existing.prerelease &&
    existing.name === payload.name &&
    existing.body === body;
  const current = unchanged
    ? existing
    : await request(
        existing ? 'PATCH' : 'POST',
        existing ? `/releases/${existing.id}` : '/releases',
        payload,
      );
  if (!validRelease(current))
    throw new Error('Publication returned an invalid release; pruning is disabled.');
  await verifyRelease(current.id);

  const refreshed = await listReleases();
  if (hasNewer(refreshed))
    return { tag, deleted: [], skipped: 'A newer version appeared; older releases were retained.' };
  const deleted = [];
  for (const candidate of refreshed.filter((item) => item.id !== current.id && isOlder(item))) {
    // Re-read each candidate: a draft or retagged release must not be deleted from an old listing.
    const latest = await request('GET', `/releases/${candidate.id}`, undefined, true);
    if (!latest) continue;
    if (!validRelease(latest)) throw new Error('A release changed unexpectedly; pruning stopped.');
    if (hasNewer([latest]))
      return { tag, deleted, skipped: 'A newer version appeared; pruning stopped.' };
    if (latest.id !== candidate.id || latest.id === current.id || !isOlder(latest)) continue;
    // If someone removed the replacement, keep the remaining historical releases.
    await verifyRelease(current.id);
    await request('DELETE', `/releases/${latest.id}`, undefined, true);
    deleted.push(latest.tag_name);
  }
  return { tag, deleted, skipped: null };
}

async function main() {
  if (
    process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.GITHUB_EVENT_NAME !== 'push' ||
    process.env.GITHUB_REF_TYPE !== 'tag'
  )
    throw new Error('Run release publication only from the tag-push GitHub Actions workflow.');
  const tag = process.env.GITHUB_REF_NAME;
  const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  if (tag !== `v${metadata.version}` || process.env.GITHUB_REF !== `refs/tags/${tag}`)
    throw new Error('The pushed tag must match package.json.');
  const result = await publishRelease({
    repository: process.env.GITHUB_REPOSITORY,
    tag,
    token: process.env.GITHUB_TOKEN,
    body: await readFile(new URL('../RELEASES.md', import.meta.url), 'utf8'),
  });
  console.log(
    result.skipped ??
      `Published ${result.tag}; removed ${result.deleted.length} older releases. Git tags and history were retained.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
