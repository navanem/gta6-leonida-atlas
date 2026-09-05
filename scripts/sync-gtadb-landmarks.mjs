import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const GTADB_SOURCE = 'https://github.com/rolux/gtadb.org';
const GTADB_REVISION = '7c3f8c295d64254e6b6d269b77c6f84fc4339f9c';
const GTADB_LICENSE = 'CC BY 4.0';
const GTADB_PREFERRED_SOURCE = 'https://map.gtadb.org';
const GTADB_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
const GTADB_PRESENTATION_NOTICE =
  'transformed presentation · deterministic, pixel-aligned transform · community placement APPROXIMATE · approximate visualization scale';
const GTADB_ATTRIBUTION = `GTADB / Map GTA community reconstruction · preferred source ${GTADB_PREFERRED_SOURCE} · ${GTADB_LICENSE} ${GTADB_LICENSE_URL} · pinned revision ${GTADB_REVISION} · ${GTADB_PRESENTATION_NOTICE} · not an official Rockstar map`;
const GTADB_SNAPSHOT_SHA256 = 'dd70b15592ee1ef6c3bbd0ccfea0fe8eef3cb033284f89670be419172e26ab65';
const GTADB_SOURCE_PATH = 'map/data/6/landmarks.json';
const GTADB_RAW_URL = `https://raw.githubusercontent.com/rolux/gtadb.org/${GTADB_REVISION}/${GTADB_SOURCE_PATH}`;
const OUTPUT_PATH = fileURLToPath(
  new URL('../public/assets/street-leonida/maps/gtadb-landmarks-7c3f8c2.json', import.meta.url),
);
const UNKNOWN_NAME = /\?/;
const GTADB_LEVEL_TAG = /^l([1-5])$/i;
const UNCONFIRMED_TAG = /^un(?:confirmed|comfirmed)$/i;
const DEMOLISHED_TAG = /^demolished$/i;

function hasUnknownName(inGameAddress) {
  return inGameAddress.trim().length === 0 || UNKNOWN_NAME.test(inGameAddress);
}

function invalidLandmark(id, message) {
  throw new Error(`Invalid GTADB landmark ${id}: ${message}`);
}

function normalizePair(id, slot, value) {
  if (!Array.isArray(value)) invalidLandmark(id, `${slot} must be an array`);
  if (value.length === 0) return null;
  if (
    value.length !== 2 ||
    !value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
  ) {
    invalidLandmark(id, `${slot} must be empty or contain two finite numbers`);
  }
  return [value[0], value[1]];
}

function classifyEvidence(inGameAddress, inGameCoordinates, tags) {
  const levelTags = tags.flatMap((tag) => {
    const match = GTADB_LEVEL_TAG.exec(tag);
    return match ? [`L${match[1]}`] : [];
  });
  return {
    name: hasUnknownName(inGameAddress) ? 'UNKNOWN' : 'KNOWN',
    placement: inGameCoordinates === null ? 'UNPOSITIONED' : 'APPROXIMATE',
    tagSignals: {
      levelTags: [...new Set(levelTags)],
      unconfirmed: tags.some((tag) => UNCONFIRMED_TAG.test(tag)),
      demolished: tags.some((tag) => DEMOLISHED_TAG.test(tag)),
    },
  };
}

function normalizeLandmarks(source) {
  if (source === null || Array.isArray(source) || typeof source !== 'object') {
    throw new Error('GTADB source must be an object keyed by landmark identifier');
  }

  return Object.entries(source).map(([id, value]) => {
    if (!/^L\d+$/.test(id)) invalidLandmark(id, 'identifier must match L<number>');
    if (!Array.isArray(value) || value.length !== 9) {
      invalidLandmark(id, 'expected a nine-slot tuple');
    }

    const [
      inGameAddress,
      inGameCoordinates,
      inGamePhotoSize,
      realWorldAddress,
      realWorldCoordinates,
      realWorldPhotoSize,
      tags,
      color,
      editedAt,
    ] = value;
    if (typeof inGameAddress !== 'string') invalidLandmark(id, 'inGameAddress must be a string');
    if (typeof realWorldAddress !== 'string')
      invalidLandmark(id, 'realWorldAddress must be a string');
    if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
      invalidLandmark(id, 'tags must be an array of strings');
    }
    if (typeof color !== 'string') invalidLandmark(id, 'color must be a string');
    if (
      !Array.isArray(editedAt) ||
      editedAt.length !== 3 ||
      !editedAt.every((timestamp) => typeof timestamp === 'number' && Number.isFinite(timestamp))
    ) {
      invalidLandmark(id, 'editedAt must contain three finite timestamps');
    }

    const normalizedInGameCoordinates = normalizePair(id, 'inGameCoordinates', inGameCoordinates);
    const normalizedTags = [...tags];
    const evidence = classifyEvidence(inGameAddress, normalizedInGameCoordinates, normalizedTags);
    return {
      id,
      inGameAddress,
      inGameCoordinates: normalizedInGameCoordinates,
      inGamePhotoSize: normalizePair(id, 'inGamePhotoSize', inGamePhotoSize),
      realWorldAddress,
      realWorldCoordinates: normalizePair(id, 'realWorldCoordinates', realWorldCoordinates),
      realWorldPhotoSize: normalizePair(id, 'realWorldPhotoSize', realWorldPhotoSize),
      tags: normalizedTags,
      color,
      editedAt: [editedAt[0], editedAt[1], editedAt[2]],
      confidence: evidence.name === 'UNKNOWN' ? 'UNKNOWN' : 'SUPPORTED',
      evidence,
    };
  });
}

const response = await globalThis.fetch(GTADB_RAW_URL);
if (!response.ok)
  throw new Error(`GTADB download failed: ${response.status} ${response.statusText}`);

const rawText = await response.text();
const actualSha256 = createHash('sha256').update(rawText).digest('hex');
if (actualSha256 !== GTADB_SNAPSHOT_SHA256) {
  throw new Error(
    `GTADB SHA-256 mismatch: expected ${GTADB_SNAPSHOT_SHA256}, received ${actualSha256}`,
  );
}

const landmarks = normalizeLandmarks(JSON.parse(rawText));
const positionedCount = landmarks.filter(
  ({ inGameCoordinates }) => inGameCoordinates !== null,
).length;
const unknownNameCount = landmarks.filter(({ evidence }) => evidence.name === 'UNKNOWN').length;
const snapshot = {
  source: {
    repository: GTADB_SOURCE,
    preferredSource: GTADB_PREFERRED_SOURCE,
    revision: GTADB_REVISION,
    path: GTADB_SOURCE_PATH,
    rawUrl: GTADB_RAW_URL,
    license: GTADB_LICENSE,
    licenseUrl: GTADB_LICENSE_URL,
    sha256: GTADB_SNAPSHOT_SHA256,
    presentation: GTADB_PRESENTATION_NOTICE,
    attribution: GTADB_ATTRIBUTION,
  },
  counts: {
    recordCount: landmarks.length,
    positionedCount,
    unpositionedCount: landmarks.length - positionedCount,
    knownNameCount: landmarks.length - unknownNameCount,
    unknownNameCount,
  },
  landmarks,
};

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(
  `Saved ${snapshot.counts.recordCount} GTADB landmarks (${snapshot.counts.positionedCount} positioned, ${snapshot.counts.unpositionedCount} unpositioned, ${snapshot.counts.unknownNameCount} unknown names) to ${OUTPUT_PATH}`,
);
