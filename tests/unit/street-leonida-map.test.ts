import { describe, expect, it } from 'vitest';

import {
  mapStreetLink,
  mapStreetPlace,
  mapStreetPlaces,
  mapStreetViewpoint,
} from '@features/street-leonida/map';
import { assetUrl, defaultResponsiveSizes, responsiveAssetSources } from '@lib/payload/client';
import { mapMedia } from '@lib/payload/map';

const officialSource = {
  id: 93,
  title: 'Only in Leonida',
  publisher: 'Rockstar Games',
  url: 'https://www.rockstargames.com/VI/only-in-leonida',
  sourceType: 'official',
  publishedAt: '2026-08-27T00:00:00.000Z',
  notes: 'private source note',
};

const image = {
  id: 46,
  alt: 'A daytime aerial view of Vice City waterfront, towers and boats.',
  caption: 'Vice City waterfront in daylight. Credit: Rockstar Games.',
  url: 'https://cms.gta6state.com/api/media/file/vice-city.webp',
  filename: 'vice-city.webp',
  mimeType: 'image/webp',
  width: 3840,
  height: 2160,
  sizes: {
    thumbnail: {
      url: 'https://cms.gta6state.com/api/media/file/vice-city-400x225.webp',
      width: 400,
      height: 225,
    },
    card: {
      url: 'https://cms.gta6state.com/api/media/file/vice-city-800x450.webp',
      width: 800,
      height: 450,
    },
    hero: {
      url: 'https://cms.gta6state.com/api/media/file/vice-city-1600x900.webp',
      width: 1600,
      height: 900,
    },
  },
};

const place = {
  id: 101,
  status: 'published',
  name: 'Vice City',
  slug: 'vice-city',
  aliases: [{ alias: 'VC' }],
  category: 'CITY',
  description: 'A Rockstar-confirmed city in Leonida.',
  region: {
    id: 7,
    status: 'published',
    name: 'Leonida',
    slug: 'leonida',
    privateNote: 'hidden',
  },
  relatedLocation: { id: 13, status: 'published', name: 'Vice City', slug: 'vice-city' },
  mapX: null,
  mapY: null,
  deduplicationKey: 'rockstar:vice-city',
  importFingerprint: 'private-place-fingerprint',
  rawPayload: { shouldNever: 'leave the CMS' },
  claims: [
    {
      id: 'claim-1',
      claimType: 'NAME',
      source: officialSource,
      retrievedAt: '2026-09-03T12:00:00.000Z',
      authority: 'ROCKSTAR_OFFICIAL',
      confidence: 'HIGH',
      precision: 'EXACT_AS_SOURCED',
      privateNote: 'hidden claim note',
      reviewedBy: { id: 1, email: 'reviewer@example.com' },
      reviewedAt: '2026-09-03T12:30:00.000Z',
    },
  ],
};

const viewpoint = {
  id: 201,
  status: 'published',
  title: 'Vice City Waterfront, Daytime',
  slug: 'vice-city-waterfront-daytime',
  place,
  mediaKind: 'STILL_IMAGE',
  deliveryMode: 'LOCAL_IMAGE',
  image,
  source: officialSource,
  mediaAuthority: 'ROCKSTAR_OFFICIAL',
  mapX: null,
  mapY: null,
  perspective: 'AERIAL',
  captureContext: 'Official screenshot.',
  visualDescription: image.alt,
  coverageMessage: 'Coverage ends here',
  rights: {
    decision: 'CLEARED_LOCAL',
    legalBasis: 'private legal basis',
    privateNote: 'private rights note',
    reviewedBy: { id: 1, email: 'reviewer@example.com' },
    reviewedAt: '2026-09-03T12:30:00.000Z',
  },
  importFingerprint: 'private-viewpoint-fingerprint',
  privateUrl: 'https://internal.invalid/media',
};

describe('Street Leonida public mapper', () => {
  it('keeps an official place name independent from an unknown position', () => {
    expect(mapStreetPlace(place)).toEqual({
      name: 'Vice City',
      slug: 'vice-city',
      aliases: ['VC'],
      category: 'CITY',
      description: 'A Rockstar-confirmed city in Leonida.',
      region: { name: 'Leonida', slug: 'leonida' },
      relatedLocationSlug: 'vice-city',
      position: null,
      labels: ['Official place name'],
      source: {
        title: 'Only in Leonida',
        publisher: 'Rockstar Games',
        url: 'https://www.rockstargames.com/VI/only-in-leonida',
        publishedAt: '2026-08-27T00:00:00.000Z',
        retrievedAt: '2026-09-03T12:00:00.000Z',
      },
    });
  });

  it('filters draft documents from public collections', () => {
    expect(
      mapStreetPlaces([place, { ...place, id: 102, slug: 'draft-place', status: 'draft' }]),
    ).toHaveLength(1);
    expect(mapStreetPlace({ ...place, status: 'draft' })).toBeNull();
  });

  it('omits expanded region and location relations unless they are published', () => {
    expect(
      mapStreetPlace({
        ...place,
        region: { ...place.region, status: 'draft' },
        relatedLocation: { ...place.relatedLocation, status: 'draft' },
      }),
    ).toMatchObject({ region: null, relatedLocationSlug: null });
  });

  it('exposes only cleared local image fields and strips every private/internal field', () => {
    const mapped = mapStreetViewpoint(viewpoint);
    expect(mapped?.media.image).toMatchObject({
      src: 'https://cms.gta6state.com/api/media/file/vice-city.webp',
      width: 3840,
      height: 2160,
      alt: image.alt,
    });
    expect(mapped?.labels).toEqual(['Official media', 'Documented view']);

    const serialized = JSON.stringify(mapped);
    for (const secret of [
      'private legal basis',
      'private rights note',
      'reviewer@example.com',
      'private-viewpoint-fingerprint',
      'https://internal.invalid/media',
      'private source note',
      'private-place-fingerprint',
      'shouldNever',
      '"id"',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('keeps a reviewed local image available for a genuine panorama viewpoint', () => {
    const mapped = mapStreetViewpoint({ ...viewpoint, mediaKind: 'PANORAMA_360' });

    expect(mapped?.media).toMatchObject({
      kind: 'PANORAMA_360',
      deliveryMode: 'LOCAL_IMAGE',
      image: {
        src: 'https://cms.gta6state.com/api/media/file/vice-city.webp',
        width: 3840,
        height: 2160,
      },
    });
  });

  it.each(['UNKNOWN', 'REJECTED'])('removes media URLs when rights are %s', (decision) => {
    const mapped = mapStreetViewpoint({ ...viewpoint, rights: { decision } });
    expect(mapped?.media.image).toBeNull();
    expect(mapped?.media.video).toBeNull();
    expect(mapped?.media.outboundUrl).toBeNull();
    expect(JSON.stringify(mapped?.media)).not.toContain('https://');
  });

  it('uses the CMS externalUrl as an authorized embed only with matching rights', () => {
    const externalUrl = 'https://www.youtube.com/embed/documented-source';
    const mapped = mapStreetViewpoint({
      ...viewpoint,
      mediaKind: 'VIDEO_EXCERPT',
      deliveryMode: 'AUTHORIZED_EMBED',
      externalUrl,
      videoStartSeconds: 10,
      videoEndSeconds: 20,
      rights: { decision: 'CLEARED_EMBED' },
    });
    expect(mapped?.media.video).toMatchObject({ src: null, embedUrl: externalUrl });

    const mismatched = mapStreetViewpoint({
      ...viewpoint,
      mediaKind: 'VIDEO_EXCERPT',
      deliveryMode: 'AUTHORIZED_EMBED',
      externalUrl,
      videoStartSeconds: 10,
      videoEndSeconds: 20,
      rights: { decision: 'CLEARED_HOTLINK' },
    });
    expect(mismatched?.media.video).toBeNull();
  });

  it.each([
    'https://www.youtube.com/watch?v=abc123def45',
    'https://youtu.be/abc123def45',
    'https://www.youtube.com/embed/abc123def45/extra',
    'https://www.youtube.com/embed/%2e%2e/private',
  ])('rejects a non-canonical authorized embed URL %s', (externalUrl) => {
    const mapped = mapStreetViewpoint({
      ...viewpoint,
      mediaKind: 'VIDEO_EXCERPT',
      deliveryMode: 'AUTHORIZED_EMBED',
      externalUrl,
      videoStartSeconds: 10,
      videoEndSeconds: 20,
      rights: { decision: 'CLEARED_EMBED' },
    });
    expect(mapped?.media.video).toBeNull();
  });

  it('uses the CMS externalUrl as first-party media only with matching rights', () => {
    const externalUrl = 'https://www.rockstargames.com/VI/media/videos/documented-source.mp4';
    const mapped = mapStreetViewpoint({
      ...viewpoint,
      mediaKind: 'VIDEO_EXCERPT',
      deliveryMode: 'CLEARED_FIRST_PARTY_URL',
      externalUrl,
      videoStartSeconds: 10,
      videoEndSeconds: 20,
      rights: { decision: 'CLEARED_HOTLINK' },
    });
    expect(mapped?.media.video).toMatchObject({ src: externalUrl, embedUrl: null });

    const mismatched = mapStreetViewpoint({
      ...viewpoint,
      mediaKind: 'VIDEO_EXCERPT',
      deliveryMode: 'CLEARED_FIRST_PARTY_URL',
      externalUrl,
      videoStartSeconds: 10,
      videoEndSeconds: 20,
      rights: { decision: 'CLEARED_EMBED' },
    });
    expect(mismatched?.media.video).toBeNull();
  });

  it('maps LINK_ONLY to its approved outbound source without exposing playable media', () => {
    const mapped = mapStreetViewpoint({
      ...viewpoint,
      deliveryMode: 'OUTBOUND_LINK',
      outboundUrl: officialSource.url,
      externalMediaUrl: 'https://www.rockstargames.com/private.mp4',
      rights: { decision: 'LINK_ONLY' },
    });
    expect(mapped?.media).toMatchObject({
      image: null,
      video: null,
      outboundUrl: officialSource.url,
    });
  });

  it.each([
    'http://cms.gta6state.com/api/media/file/vice-city.webp',
    'https://user:pass@cms.gta6state.com/api/media/file/vice-city.webp',
    'https://cms.gta6state.com:444/api/media/file/vice-city.webp',
    'https://evil.example/vice-city.webp',
  ])('fails closed for unsafe media URL %s', (url) => {
    const mapped = mapStreetViewpoint({ ...viewpoint, image: { ...image, url } });
    expect(mapped?.media.image).toBeNull();
  });

  it('fails closed when original image dimensions are incomplete', () => {
    const mapped = mapStreetViewpoint({ ...viewpoint, image: { ...image, height: null } });
    expect(mapped?.media.image).toBeNull();
  });

  it('keeps community position status separate from the official name status', () => {
    const mapped = mapStreetPlace({
      ...place,
      mapX: 412.5,
      mapY: 719.25,
      claims: [
        ...place.claims,
        {
          claimType: 'POSITION',
          source: { ...officialSource, title: 'Reviewed community dataset' },
          authority: 'COMMUNITY_SOURCE',
          confidence: 'MEDIUM',
          precision: 'APPROXIMATE',
          retrievedAt: '2026-09-03T13:00:00.000Z',
        },
      ],
    });
    expect(mapped?.labels).toEqual([
      'Official place name',
      'Community-mapped position',
      'Approximate position',
    ]);
    expect(mapped?.position).toEqual({
      x: 412.5,
      y: 719.25,
      authority: 'COMMUNITY_SOURCE',
      confidence: 'MEDIUM',
      precision: 'APPROXIMATE',
      label: 'Approximate position',
      source: {
        title: 'Reviewed community dataset',
        publisher: 'Rockstar Games',
        url: 'https://www.rockstargames.com/VI/only-in-leonida',
        publishedAt: '2026-08-27T00:00:00.000Z',
        retrievedAt: '2026-09-03T13:00:00.000Z',
      },
    });
  });

  it('maps viewpoint coordinates only with its dedicated valid positionClaim', () => {
    const positionClaim = {
      claimType: 'POSITION',
      source: officialSource,
      retrievedAt: '2026-09-03T14:00:00.000Z',
      authority: 'COMMUNITY_SOURCE',
      confidence: 'HIGH',
      precision: 'EXACT_AS_SOURCED',
    };
    const mapped = mapStreetViewpoint({
      ...viewpoint,
      mapX: 105,
      mapY: 205,
      positionClaim,
      claims: [],
    });
    expect(mapped?.position).toMatchObject({
      x: 105,
      y: 205,
      authority: 'COMMUNITY_SOURCE',
      confidence: 'HIGH',
      precision: 'EXACT_AS_SOURCED',
      label: 'Community-mapped position',
    });
    expect(mapped?.position?.source.url).toBe(officialSource.url);
  });

  it('rejects incomplete coordinates, the generic claims array, or an invalid positionClaim', () => {
    const genericPositionClaim = {
      claimType: 'POSITION',
      source: officialSource,
      retrievedAt: '2026-09-03T14:00:00.000Z',
      authority: 'COMMUNITY_SOURCE',
      confidence: 'HIGH',
      precision: 'EXACT_AS_SOURCED',
    };
    expect(
      mapStreetViewpoint({
        ...viewpoint,
        mapX: 105,
        mapY: 205,
        claims: [genericPositionClaim],
      })?.position,
    ).toBeNull();
    expect(
      mapStreetViewpoint({
        ...viewpoint,
        mapX: 105,
        mapY: null,
        positionClaim: genericPositionClaim,
      })?.position,
    ).toBeNull();
    expect(
      mapStreetViewpoint({
        ...viewpoint,
        mapX: 105,
        mapY: 205,
        positionClaim: {
          ...genericPositionClaim,
          source: { ...officialSource, url: 'http://unsafe.test' },
        },
      })?.position,
    ).toBeNull();
  });

  it('maps only published links using public slugs and public notes', () => {
    expect(
      mapStreetLink({
        id: 301,
        status: 'published',
        fromViewpoint: viewpoint,
        toViewpoint: { ...viewpoint, id: 202, slug: 'vice-city-night' },
        linkType: 'REGION_JUMP',
        authority: 'ROCKSTAR_OFFICIAL',
        confidence: 'HIGH',
        publicNote: 'Another documented view in Vice City.',
        privateNote: 'hidden',
        reviewedBy: { id: 1 },
      }),
    ).toEqual({
      fromSlug: 'vice-city-waterfront-daytime',
      toSlug: 'vice-city-night',
      type: 'REGION_JUMP',
      label: 'Jump to scene',
      note: 'Another documented view in Vice City.',
      authority: 'ROCKSTAR_OFFICIAL',
      confidence: 'HIGH',
      source: null,
    });
  });

  it('rejects links whose expanded endpoint is not published', () => {
    expect(
      mapStreetLink({
        status: 'published',
        fromViewpoint: { ...viewpoint, status: 'draft' },
        toViewpoint: { ...viewpoint, slug: 'published-target' },
        linkType: 'REGION_JUMP',
      }),
    ).toBeNull();
  });

  it('rejects a viewpoint whose expanded place is not published', () => {
    expect(mapStreetViewpoint({ ...viewpoint, place: { ...place, status: 'draft' } })).toBeNull();
  });
});

describe('Payload responsive media mapping', () => {
  it('preserves valid thumbnail, card, and hero variants', () => {
    const mapped = mapMedia(image);
    expect(mapped?.sizes).toEqual(image.sizes);
  });

  it('drops malformed variants while retaining the original', () => {
    const mapped = mapMedia({
      ...image,
      sizes: {
        ...image.sizes,
        card: { url: image.sizes.card.url, width: 800, height: null },
      },
    });
    expect(mapped?.sizes?.card).toBeUndefined();
    expect(mapped?.url).toBe(image.url);
  });

  it('chooses the smallest real variant at least as wide as requested, then original', () => {
    const mapped = mapMedia(image);
    expect(assetUrl(mapped, { width: 390 })).toBe(image.sizes.thumbnail.url);
    expect(assetUrl(mapped, { width: 401 })).toBe(image.sizes.card.url);
    expect(assetUrl(mapped, { width: 1200 })).toBe(image.sizes.hero.url);
    expect(assetUrl(mapped, { width: 2000 })).toBe(image.url);
  });

  it('builds a distinct width-descriptor candidate list including the original', () => {
    const sources = responsiveAssetSources(mapMedia(image));
    expect(sources).toEqual([
      { url: image.sizes.thumbnail.url, width: 400 },
      { url: image.sizes.card.url, width: 800 },
      { url: image.sizes.hero.url, width: 1600 },
      { url: image.url, width: 3840 },
    ]);
  });

  it('provides an intrinsic-width default sizes hint for responsive images', () => {
    expect(defaultResponsiveSizes(480)).toBe('(max-width: 480px) 100vw, 480px');
    expect(defaultResponsiveSizes(0)).toBe('100vw');
  });
});
