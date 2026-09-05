import { describe, expect, it } from 'vitest';
import { parseBackup } from '../../src/db/backup';

const time = '2026-09-01T12:00:00.000Z';
const marker = {
  id: 'custom:beach',
  title: 'Beach stop',
  description: '<b>plain text</b>',
  category: 'personal',
  position: { x: -1200, y: 900 },
  icon: 'pin',
  createdAt: time,
  updatedAt: time,
};
const backup = () => ({
  format: 'leonida-atlas',
  version: 2,
  exportedAt: time,
  favorites: [
    { placeId: 'L42', createdAt: time },
    { placeId: 'custom:beach', createdAt: time },
  ],
  notes: [{ placeId: 'custom:beach', text: 'Visit later', updatedAt: time }],
  collections: [
    {
      id: 'collection:trip',
      name: 'Trip',
      placeIds: ['L42', 'custom:beach'],
      createdAt: time,
      updatedAt: time,
    },
  ],
  markers: [structuredClone(marker)],
  preferences: { reducedMotion: false, showLabels: true, clusterMarkers: true },
});

describe('portable backup validation', () => {
  it('copies known fields without retaining untrusted keys or mutating input', () => {
    const input = { ...backup(), executable: 'ignored' };
    Object.assign(input.markers[0]!, { html: 'ignored', position: { x: -1200, y: 900, z: 20 } });
    const result = parseBackup(input);
    expect(result).not.toHaveProperty('executable');
    expect(result.markers[0]).not.toHaveProperty('html');
    expect(result.markers[0]?.position).toEqual({ x: -1200, y: 900 });
    expect(result.markers[0]?.description).toBe('<b>plain text</b>');
    result.collections[0]!.placeIds.push('L99');
    expect(input.collections[0]!.placeIds).toEqual(['L42', 'custom:beach']);
  });

  it.each([null, [], 'text', {}, { ...backup(), format: 'other' }, { ...backup(), version: 3 }])(
    'rejects invalid envelopes and unsupported versions (%j)',
    (input) => {
      expect(() => parseBackup(input)).toThrow(/backup|format|version/i);
    },
  );

  it.each([
    { x: Number.NaN, y: 0 },
    { x: 0, y: Number.POSITIVE_INFINITY },
    { x: -16001, y: 0 },
    { x: 4001, y: 0 },
    { x: 0, y: -8001 },
    { x: 0, y: 12001 },
  ])('rejects non-finite or out-of-map coordinates (%j)', (position) => {
    const input = backup();
    input.markers[0]!.position = position;
    expect(() => parseBackup(input)).toThrow(/position|bounds|coordinate/i);
  });

  it.each(['', '../bad', 'custom:<script>', '__proto__', 'L42', 'custom:'])(
    'rejects unsafe personal IDs (%s)',
    (id) => {
      const input = backup();
      input.markers[0]!.id = id;
      expect(() => parseBackup(input)).toThrow(/id/i);
    },
  );

  it('accepts safe public references without coupling backups to a current catalogue', () => {
    const input = backup();
    input.favorites.push({ placeId: 'future:landmark-9', createdAt: time });
    expect(parseBackup(input).favorites).toHaveLength(3);
  });

  it.each(['markers', 'notes', 'favorites', 'collections'] as const)(
    'rejects duplicate %s records',
    (field) => {
      const input = backup();
      (input[field] as unknown[]).push(structuredClone(input[field][0]));
      expect(() => parseBackup(input)).toThrow(/duplicate/i);
    },
  );

  it('rejects missing custom references and duplicate collection membership', () => {
    const missing = backup();
    missing.notes[0]!.placeId = 'custom:missing';
    expect(() => parseBackup(missing)).toThrow(/missing|reference/i);
    const duplicate = backup();
    duplicate.collections[0]!.placeIds.push('L42');
    expect(() => parseBackup(duplicate)).toThrow(/duplicate/i);
  });

  it('rejects oversized lists, text, and malformed fields', () => {
    const text = backup();
    text.notes[0]!.text = 'x'.repeat(100_001);
    expect(() => parseBackup(text)).toThrow(/length|limit|characters/i);
    const items = backup();
    items.favorites = Array.from({ length: 10_001 }, (_, index) => ({
      placeId: `L${index}`,
      createdAt: time,
    }));
    expect(() => parseBackup(items)).toThrow(/limit|items/i);
    const timestamp = backup();
    timestamp.markers[0]!.updatedAt = 'yesterday';
    expect(() => parseBackup(timestamp)).toThrow(/date|time/i);
    const preference = backup();
    Object.assign(preference.preferences, { showLabels: 'true' });
    expect(() => parseBackup(preference)).toThrow(/boolean|showLabels/i);
    const category = backup();
    category.markers[0]!.category = 'invalid';
    expect(() => parseBackup(category)).toThrow(/category/i);
  });

  it('rejects aggregate data beyond the portable file limit even when individual notes fit', () => {
    const input = backup();
    input.notes = Array.from({ length: 106 }, (_, index) => ({
      placeId: `L${index}`,
      text: 'x'.repeat(100_000),
      updatedAt: time,
    }));
    expect(() => parseBackup(input)).toThrow(/MiB|data limit/i);
  });

  it('rejects impossible calendar dates and malformed legacy preference values', () => {
    const input = backup();
    input.markers[0]!.createdAt = '2026-02-31T12:00:00.000Z';
    expect(() => parseBackup(input)).toThrow(/date/i);
    expect(() => parseBackup({ ...backup(), version: 1, preferences: null })).toThrow(
      /preferences/i,
    );
  });

  it('migrates a v1 backup with missing introduced fields into a complete v2 backup', () => {
    const result = parseBackup({
      format: 'leonida-atlas',
      version: 1,
      exportedAt: time,
      favorites: ['L42'],
      notes: [{ placeId: 'L42', text: 'Remember' }],
      markers: [{ id: 'custom:old', title: 'Old stop', position: { x: 0, y: 0 }, createdAt: time }],
      collections: [{ id: 'trip', name: 'Old trip', placeIds: ['custom:old'] }],
      preferences: { showLabels: false },
    });
    expect(result.version).toBe(2);
    expect(result.favorites).toEqual([{ placeId: 'L42', createdAt: time }]);
    expect(result.notes).toEqual([{ placeId: 'L42', text: 'Remember', updatedAt: time }]);
    expect(result.markers[0]).toEqual({
      id: 'custom:old',
      title: 'Old stop',
      description: '',
      position: { x: 0, y: 0 },
      category: 'personal',
      icon: 'pin',
      createdAt: time,
      updatedAt: time,
    });
    expect(result.collections[0]?.updatedAt).toBe(time);
    expect(result.preferences).toEqual({
      reducedMotion: false,
      showLabels: false,
      clusterMarkers: true,
    });
  });
});
