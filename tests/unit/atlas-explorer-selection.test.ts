import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import ExplorerView from '../../src/features/explorer/ExplorerView';
import type { Place } from '../../src/domain/types';
import { PLACE_ENTRY_VIEWS } from '../../src/features/street-leonida/walk-geography';
import { explorerPath } from '../../src/features/explorer/public-path';
import { parseInitialWalkDestination } from '../../src/features/street-leonida/walk-world';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-7c3f8c2.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const catalogue = catalogueFromSnapshot(snapshot);
const findPlace = (id: string) => catalogue.find((place) => place.id === id)!;

function initialAttributes(place?: Place) {
  const html = renderToStaticMarkup(
    createElement(ExplorerView, { onClose() {}, initialPlace: place }),
  );
  const attribute = (name: string) =>
    new RegExp(`${name}="([^"]*)"`)
      .exec(html)?.[1]
      ?.replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&');
  return {
    region: attribute('data-initial-place'),
    position: attribute('data-player-position'),
    destination: attribute('data-initial-destination'),
    html,
  };
}

describe('selected map place enters the optional explorer', () => {
  it('preserves selected identifiers in a base-aware explorer link', () => {
    expect(explorerPath('region:ambrosia', '/atlas/')).toBe(
      '/atlas/?view=3d&place=region%3Aambrosia',
    );
    expect(explorerPath('L530', '/atlas/')).toBe('/atlas/?view=3d&place=L530');
    expect(explorerPath(null, '/atlas/')).toBe('/atlas/?view=3d');
  });
  it.each(['ambrosia', 'leonida-keys'])(
    'passes selected %s to both regional context and the initial world position',
    (slug) => {
      const place = findPlace(`region:${slug}`);
      const attributes = initialAttributes(place);
      expect(attributes.region).toBe(slug);
      expect(attributes.position).toBe(`${place.position!.x * 2},${place.position!.y * -2}`);
      expect(JSON.parse(attributes.destination!)).toMatchObject({
        id: place.id,
        label: place.title,
        x: place.position!.x * 2,
        z: place.position!.y * -2,
        source: 'region',
      });
    },
  );

  it('retains an individual landmark coordinate instead of replacing it with a regional center', () => {
    const place = findPlace('L530');
    const attributes = initialAttributes(place);
    expect(JSON.parse(attributes.destination!)).toMatchObject({
      id: 'L530',
      label: place.title,
      x: place.position!.x * 2,
      z: place.position!.y * -2,
      source: 'gtadb',
    });
    expect(attributes.position).toBe(`${place.position!.x * 2},${place.position!.y * -2}`);
  });

  it('the world initializer accepts the serialized Ambrosia destination with its exact source coordinates', () => {
    const place = findPlace('region:ambrosia');
    const attributes = initialAttributes(place);
    expect(parseInitialWalkDestination(attributes.destination)).toEqual({
      id: place.id,
      label: place.title,
      x: place.position!.x * 2,
      z: place.position!.y * -2,
      source: 'region',
    });
  });

  it.each([
    undefined,
    '{invalid json',
    JSON.stringify({ id: 'bad', label: 'Bad place', x: 999999999, z: 10, source: 'map' }),
  ])('rejects an invalid initial world destination %s', (serialized) => {
    expect(parseInitialWalkDestination(serialized)).toBeNull();
  });

  it('keeps Vice City as the explicit no-selection starting point', () => {
    const attributes = initialAttributes();
    const entry = PLACE_ENTRY_VIEWS['vice-city']!;
    expect(attributes.region).toBe('vice-city');
    expect(attributes.position).toBe(`${entry.position.x},${entry.position.z}`);
    expect(attributes.destination).toBeUndefined();
  });

  it('does not manufacture a position for an unpositioned record', () => {
    const place = catalogue.find((place) => !place.position)!;
    const attributes = initialAttributes(place);
    expect(attributes.destination).toBeUndefined();
    expect(attributes.html).toContain('has no mapped position');
  });
});
