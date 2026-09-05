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

const STABLE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FIRST_RETAINED_VERSION = version('v0.5.0');

/** Each level-two version section becomes its own GitHub release body. */
export function parseReleaseNotes(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Release notes are required.');
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const sections = [];
  const seen = new Set();
  let section = null;
  let fence = null;
  function finish() {
    if (!section) return;
    if (!section.lines.slice(1).join('\n').trim())
      throw new Error(`Release notes for ${section.tag} must not be empty.`);
    sections.push({ tag: section.tag, body: section.lines.join('\n').trim() });
    section = null;
  }
  for (const line of lines) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      section?.lines.push(line);
      if (
        marker &&
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      )
        fence = null;
      continue;
    }
    if (marker) {
      fence = marker[1];
      section?.lines.push(line);
      continue;
    }
    if (/^##\s+/.test(line)) {
      finish();
      const heading = /^##[ \t]+(v[^\s]+)(?:[ \t]+.*)?$/.exec(line);
      if (!heading) continue;
      const tag = heading[1];
      if (!STABLE_TAG.test(tag)) throw new Error(`Invalid stable release heading: ${tag}.`);
      if (seen.has(tag)) throw new Error(`Duplicate release notes for ${tag}.`);
      seen.add(tag);
      if (compare(version(tag), FIRST_RETAINED_VERSION) >= 0) section = { tag, lines: [line] };
      continue;
    }
    section?.lines.push(line);
  }
  if (fence) throw new Error('Release notes contain an unclosed code fence.');
  finish();
  if (!sections.length) throw new Error('No release notes at or after v0.5.0 were found.');
  return sections.sort((left, right) => compare(version(right.tag), version(left.tag)));
}

/** Retains all releases and only creates releases for existing Git tags. */
export async function publishRelease({
  repository,
  tag,
  releaseNotes,
  token,
  fetchImpl = globalThis.fetch,
}) {
  const targetVersion = typeof tag === 'string' && STABLE_TAG.test(tag) ? version(tag) : null;
  if (repository !== RELEASE_REPOSITORY)
    throw new Error('Release publication is restricted to the Atlas repository.');
  if (!targetVersion || compare(targetVersion, FIRST_RETAINED_VERSION) < 0)
    throw new Error('A stable vMAJOR.MINOR.PATCH release tag at or after v0.5.0 is required.');
  if (typeof token !== 'string' || !token) throw new Error('GITHUB_TOKEN is required.');
  const sections = parseReleaseNotes(releaseNotes);
  if (sections[0].tag !== tag)
    throw new Error('The current tag must match the newest section in RELEASES.md.');

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
        throw new Error('GitHub returned an invalid release listing; publication stopped.');
      releases.push(...items);
      if (items.length < 100) {
        if (
          new Set(releases.map((item) => item.id)).size !== releases.length ||
          new Set(releases.map((item) => item.tag_name)).size !== releases.length
        )
          throw new Error('GitHub returned an ambiguous release listing; publication stopped.');
        return releases;
      }
    }
    throw new Error('Release pagination exceeded its safety limit; publication stopped.');
  }
  function requirePublished(item, requestedTag, id) {
    if (
      !published(item) ||
      item.tag_name !== requestedTag ||
      item.prerelease ||
      (id !== undefined && item.id !== id)
    )
      throw new Error(
        `Release ${requestedTag} is not the expected published stable release; drafts are never overwritten.`,
      );
    return item;
  }
  async function verifyTag(requestedTag) {
    const reference = await request('GET', `/git/ref/tags/${encodeURIComponent(requestedTag)}`);
    if (
      reference?.ref !== `refs/tags/${requestedTag}` ||
      !/^[a-f0-9]{40,64}$/i.test(reference?.object?.sha ?? '') ||
      !['commit', 'tag'].includes(reference?.object?.type)
    )
      throw new Error(`The existing release tag ${requestedTag} could not be verified.`);
  }
  const readRelease = (requestedTag, allow404 = false) =>
    request('GET', `/releases/tags/${encodeURIComponent(requestedTag)}`, undefined, allow404);
  const hasNewer = (releases) =>
    releases.some((item) => {
      const candidate = version(item.tag_name);
      return (
        published(item) && !item.prerelease && candidate && compare(candidate, targetVersion) > 0
      );
    });

  const initial = await listReleases();
  // Validate the complete plan before writing, including missing historical refs.
  for (const section of sections) {
    const existing = initial.find((item) => item.tag_name === section.tag);
    if (existing) requirePublished(existing, section.tag);
    if (!existing || section.tag === tag) await verifyTag(section.tag);
  }

  const created = [];
  const retained = [];
  for (const section of sections) {
    // Re-read after preflight to respect a release another publisher just created.
    const existing = await readRelease(section.tag, true);
    if (existing) {
      requirePublished(existing, section.tag);
      retained.push(section.tag);
      continue;
    }
    await verifyTag(section.tag);
    const result = await request('POST', '/releases', {
      tag_name: section.tag,
      name: `${section.tag} — Leonida Atlas local-first`,
      body: section.body,
      draft: false,
      prerelease: false,
      make_latest: 'false',
    });
    requirePublished(result, section.tag);
    requirePublished(await readRelease(section.tag), section.tag, result.id);
    created.push(section.tag);
  }

  // The repository-wide Actions concurrency group serializes this publisher.
  // Historical creation never changes latest, including on a partial retry.
  const current = requirePublished(await readRelease(tag), tag);
  const latest = await request('GET', '/releases/latest', undefined, true);
  if (latest !== null && !published(latest))
    throw new Error('GitHub returned an invalid latest release.');
  const refreshed = await listReleases();
  if (hasNewer(latest ? [...refreshed, latest] : refreshed))
    return {
      tag,
      created,
      retained,
      latest: false,
      skipped: 'A newer published version exists; the latest release was preserved.',
    };
  const payload = {
    name: `${tag} — Leonida Atlas local-first`,
    body: sections[0].body,
    make_latest: 'true',
  };
  if (latest?.id !== current.id || current.name !== payload.name || current.body !== payload.body) {
    // Recheck publication state immediately before updating this exact release ID.
    requirePublished(await readRelease(tag), tag, current.id);
    const updated = await request('PATCH', `/releases/${current.id}`, payload);
    requirePublished(updated, tag, current.id);
    requirePublished(await request('GET', '/releases/latest'), tag, current.id);
  }
  return { tag, created, retained, latest: true, skipped: null };
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
    releaseNotes: await readFile(new URL('../RELEASES.md', import.meta.url), 'utf8'),
  });
  console.log(
    result.skipped ??
      `Published ${result.tag}; created ${result.created.length} missing releases and retained release history.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
