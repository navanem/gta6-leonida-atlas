import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  GTADB_ATTRIBUTION,
  GTADB_LICENSE_URL,
  GTADB_LICENSE,
  GTADB_PINNED_DATA_URL,
  GTADB_PREFERRED_SOURCE,
  GTADB_REVISION,
  GTADB_SNAPSHOT_SHA256,
  GTADB_SOURCE,
  GTADB_PRESENTATION_NOTICE,
  classifyGtadbEvidence,
  classifyGtadbConfidence,
  classifyGtadbUncertaintyReasons,
  getGtadbCatalogueStats,
  isPositionedGtadbLandmark,
  normalizeGtadbCatalogue,
  type GtadbLandmark,
} from '@features/street-leonida/gtadb';

const completeTuple = [
  'Sunset Hotel, Vice City',
  [101.25, -202.5],
  [640, 480],
  '101 Ocean Drive, Miami Beach, FL, USA',
  [25.781, -80.13],
  [1280, 960],
  ['hotel', 'documented'],
  'ff7a66',
  [1_700_000_001, 1_700_000_002, 1_700_000_003],
] as const;

describe('GTADB catalogue normalization', () => {
  it('preserves every named upstream tuple slot with its real semantics (catches positional-slot remapping)', () => {
    const catalogue = normalizeGtadbCatalogue({ L42: completeTuple });

    expect(catalogue).toEqual([
      {
        id: 'L42',
        inGameAddress: 'Sunset Hotel, Vice City',
        inGameCoordinates: [101.25, -202.5],
        inGamePhotoSize: [640, 480],
        realWorldAddress: '101 Ocean Drive, Miami Beach, FL, USA',
        realWorldCoordinates: [25.781, -80.13],
        realWorldPhotoSize: [1280, 960],
        tags: ['hotel', 'documented'],
        color: 'ff7a66',
        editedAt: [1_700_000_001, 1_700_000_002, 1_700_000_003],
        confidence: 'SUPPORTED',
        evidence: {
          name: 'KNOWN',
          placement: 'APPROXIMATE',
          tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
        },
      },
    ]);
  });

  it('normalizes empty coordinate and photo-dimension slots to null (catches empty-array-as-position)', () => {
    const [landmark] = normalizeGtadbCatalogue({
      L91: ['Unplaced note, Leonida', [], [], '', [], [], [], 'abc123', [0, 0, 0]],
    });

    expect(landmark).toMatchObject({
      inGameCoordinates: null,
      inGamePhotoSize: null,
      realWorldCoordinates: null,
      realWorldPhotoSize: null,
      evidence: { name: 'KNOWN', placement: 'UNPOSITIONED' },
    });
    expect(isPositionedGtadbLandmark(landmark!)).toBe(false);
  });

  it('rejects malformed tuples instead of silently filling missing upstream data (catches permissive tuple parsing)', () => {
    expect(() => normalizeGtadbCatalogue({ L7: ['only one slot'] })).toThrow(
      'Invalid GTADB landmark L7: expected a nine-slot tuple',
    );
  });

  it('keeps question-mark landmark names UNKNOWN without turning unrelated tags into name certainty', () => {
    expect(classifyGtadbConfidence('?, Vice Beach', [])).toBe('UNKNOWN');
    expect(classifyGtadbConfidence('Parsons Hotel?, Shore Dr', ['unconfirmed'])).toBe('UNKNOWN');
    expect(classifyGtadbConfidence('', [])).toBe('UNKNOWN');
    expect(classifyGtadbConfidence('   ', [])).toBe('UNKNOWN');

    for (const tag of ['L1', 'L2', 'L3', 'L4', 'L5', 'demolished', 'unconfirmed']) {
      expect(classifyGtadbConfidence('Named community landmark', [tag])).toBe('SUPPORTED');
    }
  });

  it('keeps name, placement, level, unconfirmed, and demolished signals as separate facets', () => {
    expect(
      classifyGtadbEvidence(
        'Named community landmark',
        [101.25, -202.5],
        ['L1', 'l5', 'uncomfirmed', 'demolished'],
      ),
    ).toEqual({
      name: 'KNOWN',
      placement: 'APPROXIMATE',
      tagSignals: {
        levelTags: ['L1', 'L5'],
        unconfirmed: true,
        demolished: true,
      },
    });
    expect(classifyGtadbEvidence('?, Vice Beach', null, [])).toEqual({
      name: 'UNKNOWN',
      placement: 'UNPOSITIONED',
      tagSignals: {
        levelTags: [],
        unconfirmed: false,
        demolished: false,
      },
    });
  });

  it('classifies every source uncertainty signal cumulatively without degrading name evidence', () => {
    expect(classifyGtadbUncertaintyReasons('Named community landmark', [])).toEqual([]);
    expect(classifyGtadbUncertaintyReasons('?, Vice Beach', [])).toEqual(['unknown-name']);
    expect(classifyGtadbUncertaintyReasons('', [])).toEqual(['unknown-name']);
    expect(classifyGtadbUncertaintyReasons('   ', [])).toEqual(['unknown-name']);
    expect(classifyGtadbUncertaintyReasons('Named community landmark', ['unconfirmed'])).toEqual([
      'unconfirmed',
    ]);
    expect(classifyGtadbUncertaintyReasons('Named community landmark', ['uncomfirmed'])).toEqual([
      'unconfirmed',
    ]);
    expect(classifyGtadbUncertaintyReasons('Named community landmark', ['may-not-exist'])).toEqual([
      'may-not-exist',
    ]);
    expect(classifyGtadbUncertaintyReasons('Named community landmark', ['maynot exist'])).toEqual([
      'may-not-exist',
    ]);
    expect(classifyGtadbUncertaintyReasons('Named community landmark', ['cancelled'])).toEqual([
      'cancelled',
    ]);
    expect(classifyGtadbUncertaintyReasons('Named community landmark', ['fictional'])).toEqual([
      'fictional',
    ]);
    expect(classifyGtadbUncertaintyReasons('Named community landmark', ['demolished'])).toEqual([
      'demolished',
    ]);
    expect(
      classifyGtadbUncertaintyReasons('Named community landmark', ['duplicate-of-1142']),
    ).toEqual(['duplicate']);
    expect(
      classifyGtadbUncertaintyReasons('Named community landmark', [
        'duplicate-of-1142',
        'uncomfirmed',
        'fictional',
        'maynot exist',
      ]),
    ).toEqual(['unconfirmed', 'may-not-exist', 'fictional', 'duplicate']);

    expect(
      classifyGtadbEvidence(
        'Named community landmark',
        [101.25, -202.5],
        ['unconfirmed', 'fictional'],
      ).name,
    ).toBe('KNOWN');
    expect(classifyGtadbConfidence('Named community landmark', ['unconfirmed', 'fictional'])).toBe(
      'SUPPORTED',
    );
  });

  it('derives positioned and explicit name-status statistics without a combined uncertainty count', () => {
    const catalogue = normalizeGtadbCatalogue({
      L1: completeTuple,
      L2: ['?, Vice Beach', [3, 4], [], '', [], [], ['unconfirmed'], '000000', [0, 0, 0]],
      L3: ['Unplaced', [], [], '', [], [], [], 'ffffff', [0, 0, 0]],
    });

    expect(getGtadbCatalogueStats(catalogue)).toEqual({
      recordCount: 3,
      positionedCount: 2,
      unpositionedCount: 1,
      knownNameCount: 2,
      unknownNameCount: 1,
    });
    expect(isPositionedGtadbLandmark(catalogue[0]!)).toBe(true);
  });

  it('pins the GTADB provenance values (catches source revision or license substitution)', () => {
    expect({
      GTADB_SOURCE,
      GTADB_PREFERRED_SOURCE,
      GTADB_PINNED_DATA_URL,
      GTADB_REVISION,
      GTADB_LICENSE,
      GTADB_LICENSE_URL,
      GTADB_PRESENTATION_NOTICE,
      GTADB_ATTRIBUTION,
      GTADB_SNAPSHOT_SHA256,
    }).toEqual({
      GTADB_SOURCE: 'https://github.com/rolux/gtadb.org',
      GTADB_PREFERRED_SOURCE: 'https://map.gtadb.org',
      GTADB_PINNED_DATA_URL:
        'https://github.com/rolux/gtadb.org/blob/5c1d69ff864623d181da5457afaacd00b623e1a4/map/data/6/landmarks.json',
      GTADB_REVISION: '5c1d69ff864623d181da5457afaacd00b623e1a4',
      GTADB_LICENSE: 'CC BY 4.0',
      GTADB_LICENSE_URL: 'https://creativecommons.org/licenses/by/4.0/',
      GTADB_PRESENTATION_NOTICE:
        'transformed presentation · deterministic, pixel-aligned transform · community placement APPROXIMATE · approximate visualization scale',
      GTADB_ATTRIBUTION:
        'GTADB / Map GTA community reconstruction · preferred source https://map.gtadb.org · CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ · pinned revision 5c1d69ff864623d181da5457afaacd00b623e1a4 · transformed presentation · deterministic, pixel-aligned transform · community placement APPROXIMATE · approximate visualization scale · not an official Rockstar map',
      GTADB_SNAPSHOT_SHA256: '2209a4ff385815cad4d1f217248daaae3e29d029c34c137ce870eee1e8181083',
    });
  });

  it('ships the complete, attributed normalized snapshot (catches partial or unpinned sync output)', () => {
    const snapshotPath = new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-5c1d69f.json',
      import.meta.url,
    );
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
      source: Record<string, string>;
      counts: ReturnType<typeof getGtadbCatalogueStats>;
      landmarks: GtadbLandmark[];
    };

    expect(snapshot.source).toMatchObject({
      repository: GTADB_SOURCE,
      revision: GTADB_REVISION,
      license: GTADB_LICENSE,
      preferredSource: GTADB_PREFERRED_SOURCE,
      licenseUrl: GTADB_LICENSE_URL,
      sha256: GTADB_SNAPSHOT_SHA256,
      presentation: GTADB_PRESENTATION_NOTICE,
      attribution: GTADB_ATTRIBUTION,
    });
    expect(snapshot.counts).toEqual({
      recordCount: 3_431,
      positionedCount: 3_340,
      unpositionedCount: 91,
      knownNameCount: 948,
      unknownNameCount: 2_483,
    });
    expect(snapshot.landmarks).toHaveLength(3_431);

    expect(
      snapshot.landmarks
        .filter(({ inGameAddress }) => !inGameAddress.trim())
        .map(({ id, confidence, evidence }) => ({ id, confidence, name: evidence.name })),
    ).toEqual([]);
    expect(snapshot.landmarks.find(({ id }) => id === 'L1')).toMatchObject({
      confidence: 'UNKNOWN',
      evidence: {
        name: 'UNKNOWN',
        placement: 'APPROXIMATE',
        tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
      },
    });
    expect(snapshot.landmarks.find(({ id }) => id === 'L130')).toMatchObject({
      confidence: 'SUPPORTED',
      evidence: {
        name: 'KNOWN',
        tagSignals: { unconfirmed: true, demolished: false },
      },
    });
    expect(snapshot.landmarks.find(({ id }) => id === 'L172')).toMatchObject({
      confidence: 'SUPPORTED',
      evidence: {
        name: 'KNOWN',
        tagSignals: { levelTags: ['L1'], unconfirmed: false, demolished: true },
      },
    });

    const sourceValueDigest = createHash('sha256')
      .update(
        JSON.stringify(
          snapshot.landmarks.map(
            ({
              id,
              inGameAddress,
              inGameCoordinates,
              inGamePhotoSize,
              realWorldAddress,
              realWorldCoordinates,
              realWorldPhotoSize,
              tags,
              color,
              editedAt,
            }) => ({
              id,
              inGameAddress,
              inGameCoordinates,
              inGamePhotoSize,
              realWorldAddress,
              realWorldCoordinates,
              realWorldPhotoSize,
              tags,
              color,
              editedAt,
            }),
          ),
        ),
      )
      .digest('hex');
    expect(sourceValueDigest).toBe(
      '934abed19ca0883dcb2483a04c68af8924db5404858fde943d9c5b7f0e735aa3',
    );
  });
});
