import { describe, expect, it } from 'vitest';

import {
  derivePreviousMoment,
  getCoverageState,
  getStreetLinkLabel,
} from '@features/street-leonida/links';
import * as streetLinks from '@features/street-leonida/links';
import type { PublicStreetLink } from '@features/street-leonida/types';

const timeline: PublicStreetLink = {
  fromSlug: 'moment-one',
  toSlug: 'moment-two',
  type: 'VIDEO_TIMELINE_NEXT',
  label: 'Next moment',
  note: null,
  authority: 'ROCKSTAR_OFFICIAL',
  confidence: 'HIGH',
  source: null,
};

describe('Street Leonida documented links', () => {
  it('uses Next moment only for a reviewed timeline relation', () => {
    expect(getStreetLinkLabel('VIDEO_TIMELINE_NEXT')).toBe('Next moment');
  });

  it.each(['SAME_PLACE_JUMP', 'REGION_JUMP', 'MANUAL_JUMP'] as const)(
    'labels %s as Jump to scene',
    (type) => expect(getStreetLinkLabel(type)).toBe('Jump to scene'),
  );

  it('derives previous only from an incoming timeline relation', () => {
    expect(
      derivePreviousMoment('moment-two', [
        timeline,
        { ...timeline, fromSlug: 'other', toSlug: 'moment-two', type: 'REGION_JUMP' },
      ]),
    ).toBe('moment-one');
    expect(derivePreviousMoment('moment-one', [timeline])).toBeNull();
  });

  it('returns an explicit terminal message when no outgoing documented link exists', () => {
    expect(getCoverageState('moment-two', [timeline], null)).toEqual({
      terminal: true,
      message: 'Coverage ends here',
    });
  });

  it('uses the reviewed coverage message and stays non-terminal when a link exists', () => {
    expect(
      getCoverageState('moment-one', [timeline], 'No further official media is documented.'),
    ).toEqual({ terminal: false, message: null });
    expect(
      getCoverageState('moment-two', [timeline], 'No further official media is documented.'),
    ).toEqual({ terminal: true, message: 'No further official media is documented.' });
  });

  it('keeps reviewed timeline navigation separate from non-spatial scene jumps', () => {
    const links = streetLinks as typeof streetLinks & {
      resolveStreetNavigation?: (
        currentSlug: string,
        candidates: PublicStreetLink[],
      ) => {
        previousMoment: PublicStreetLink | null;
        nextMoment: PublicStreetLink | null;
        previousScene: PublicStreetLink | null;
        nextScene: PublicStreetLink | null;
      };
    };
    expect(typeof links.resolveStreetNavigation).toBe('function');

    const sceneJump: PublicStreetLink = {
      ...timeline,
      fromSlug: 'moment-one',
      toSlug: 'other-scene',
      type: 'REGION_JUMP',
      label: 'Jump to scene',
    };
    expect(links.resolveStreetNavigation?.('moment-one', [sceneJump, timeline])).toEqual({
      previousMoment: null,
      nextMoment: timeline,
      previousScene: null,
      nextScene: sceneJump,
    });
  });
});
