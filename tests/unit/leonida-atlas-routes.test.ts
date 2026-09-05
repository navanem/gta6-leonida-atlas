import { describe, expect, it } from 'vitest';

import { legacyAtlasRedirectTarget } from '@features/street-leonida/routes';

describe('Leonida Atlas legacy redirect targets', () => {
  it('preserves the request query exactly on the new overview route', () => {
    expect(
      legacyAtlasRedirectTarget(
        new URL('https://gta6state.com/tools/street-leonida/?mode=map&panel=evidence'),
        '/gta6-leonida-atlas',
      ),
    ).toBe('/gta6-leonida-atlas?mode=map&panel=evidence');
  });

  it('keeps an encoded deep-link identifier and the request query', () => {
    expect(
      legacyAtlasRedirectTarget(
        new URL('https://gta6state.com/tools/street-leonida/place/vice-city/?from=tools'),
        '/gta6-leonida-atlas/app/place/vice-city',
      ),
    ).toBe('/gta6-leonida-atlas/app/place/vice-city?from=tools');
  });

  it('does not add a trailing question mark when no query exists', () => {
    expect(
      legacyAtlasRedirectTarget(
        new URL('https://gta6state.com/tools/street-leonida/viewpoint/waterfront-daytime/'),
        '/gta6-leonida-atlas/app/viewpoint/waterfront-daytime',
      ),
    ).toBe('/gta6-leonida-atlas/app/viewpoint/waterfront-daytime');
  });
});
