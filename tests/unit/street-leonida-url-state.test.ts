import { describe, expect, it } from 'vitest';

import {
  buildStreetShareUrl,
  parseStreetUrlState,
  serializeStreetUrlState,
} from '@features/street-leonida/url-state';

describe('Street Leonida URL state', () => {
  it('parses range-checked time, paired map position, zoom, and allowlisted layer', () => {
    expect(
      parseStreetUrlState('?t=31.25&x=120.5&y=-30&z=4&layer=scenes', {
        timeRange: { start: 20, end: 40 },
      }),
    ).toEqual({ t: 31.25, x: 120.5, y: -30, z: 4, layer: 'scenes' });
  });

  it('ignores malformed, partial, or out-of-range values', () => {
    expect(
      parseStreetUrlState('?t=41&x=12&y=not-a-number&z=99&layer=https%3A%2F%2Fevil.example&id=42', {
        timeRange: { start: 20, end: 40 },
      }),
    ).toEqual({});
  });

  it('serializes only finite allowlisted state in canonical key order', () => {
    expect(
      serializeStreetUrlState({
        layer: 'places',
        y: 20,
        x: 10,
        z: 3,
        t: 7.5,
        sourceUrl: 'https://evil.example',
      } as never),
    ).toBe('?t=7.5&x=10&y=20&z=3&layer=places');
  });

  it('builds a canonical share URL without IDs, source URLs, or unknown query keys', () => {
    expect(
      buildStreetShareUrl('/gta6-leonida-atlas/app/viewpoint/vice-city', {
        t: 12,
        x: 50,
        y: 60,
        layer: 'scenes',
        id: 88,
        source: 'https://www.rockstargames.com/VI' as never,
      } as never),
    ).toBe('/gta6-leonida-atlas/app/viewpoint/vice-city?t=12&x=50&y=60&layer=scenes');
  });

  it('removes a trailing slash from a Leonida Atlas share URL', () => {
    expect(buildStreetShareUrl('/gta6-leonida-atlas/app/place/vice-city/', {})).toBe(
      '/gta6-leonida-atlas/app/place/vice-city',
    );
  });
});
