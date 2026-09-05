import { describe, expect, it } from 'vitest';

import { PLACE_ANCHORS } from '../../src/features/street-leonida/walk-geography';
import {
  findWorldHotspotById,
  getWalkSceneProvenance,
  resolveWalkScenePositions,
  shouldResumeWalkAfterOverlayClose,
} from '../../src/features/street-leonida/walk-world';

describe('Street Leonida world truth boundaries', () => {
  it('does not invent a world position for a scene whose place has no reviewed anchor', () => {
    const positions = resolveWalkScenePositions([
      { placeSlug: 'vice-city' },
      { placeSlug: 'unreviewed-community-place' },
      { placeSlug: 'vice-city' },
    ]);

    expect(positions[0]).toEqual(PLACE_ANCHORS['vice-city']);
    expect(positions[1]).toBeNull();
    expect(positions[2]).toEqual({
      x: PLACE_ANCHORS['vice-city']!.x - 25,
      z: PLACE_ANCHORS['vice-city']!.z,
    });
    expect(resolveWalkScenePositions([{ placeSlug: 'leonida' }])).toEqual([null]);
  });

  it('resolves sparse hotspot identifiers without treating them as array indexes', () => {
    const hotspots = [{ id: 0 }, { id: 2 }];

    expect(findWorldHotspotById(hotspots, 2)).toBe(hotspots[1]);
    expect(findWorldHotspotById(hotspots, 1)).toBeNull();
  });

  it('only resumes a started walk after every modal overlay has closed', () => {
    expect(shouldResumeWalkAfterOverlayClose(true, false)).toBe(true);
    expect(shouldResumeWalkAfterOverlayClose(false, false)).toBe(false);
    expect(shouldResumeWalkAfterOverlayClose(true, true)).toBe(false);
  });

  it('only calls evidence official when its mapped authority and publisher support that claim', () => {
    expect(
      getWalkSceneProvenance({
        labels: ['Official media'],
        source: { publisher: 'Rockstar Games' },
      }),
    ).toEqual({
      evidenceLabel: 'OFFICIAL VISUAL EVIDENCE',
      kicker: 'Rockstar evidence',
      sourceLinkLabel: 'Open Rockstar Games',
      descriptionFallback: 'A documented scene from official Grand Theft Auto VI media.',
    });

    expect(
      getWalkSceneProvenance({
        labels: ['Documented view'],
        source: { publisher: null },
      }),
    ).toEqual({
      evidenceLabel: 'DOCUMENTED SOURCE EVIDENCE',
      kicker: 'Cited-source evidence',
      sourceLinkLabel: 'Open cited source',
      descriptionFallback: 'A documented scene from the cited source.',
    });
  });
});
