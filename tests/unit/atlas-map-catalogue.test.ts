import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot, markerToPlace } from '../../src/data/catalogue';

const snapshot = JSON.parse(readFileSync(new URL('../../public/assets/street-leonida/maps/gtadb-landmarks-7c3f8c2.json', import.meta.url), 'utf8'));

describe('Atlas searchable catalogue', () => {
  it('retains all 2,198 community records and six regions, including 107 unpositioned records', () => {
    const places = catalogueFromSnapshot(snapshot);
    expect(places).toHaveLength(2204);
    expect(places.filter(p => p.position === null)).toHaveLength(107);
    expect(places.filter(p => p.layerId === 'regions')).toHaveLength(6);
    expect(new Set(places.map(p => p.id)).size).toBe(2204);
  });
  it('uses only source game coordinates and keeps approximate and uncertain evidence explicit', () => {
    const places = catalogueFromSnapshot(snapshot);
    for (const record of snapshot.landmarks) {
      const result = places.find(place => place.id === record.id)!;
      expect(result.position).toEqual(record.inGameCoordinates ? { x: record.inGameCoordinates[0], y: record.inGameCoordinates[1] } : null);
      expect(result.source.license).toBe('CC BY 4.0');
      expect(result.evidence).not.toBe('personal');
    }
    expect(places.find(p => p.id === 'L1')).toMatchObject({ evidence: 'uncertain', layerId: 'uncertain' });
    expect(places.find(p => p.id === 'region:vice-city')).toMatchObject({ title: 'Vice City', evidence: 'approximate' });
  });
  it('rejects malformed or duplicate source records instead of manufacturing empty data', () => {
    expect(() => catalogueFromSnapshot({ landmarks: null })).toThrow();
    expect(() => catalogueFromSnapshot({ ...snapshot, landmarks: [snapshot.landmarks[0], snapshot.landmarks[0]] })).toThrow(/duplicate/i);
    expect(() => catalogueFromSnapshot({ ...snapshot, landmarks: [{ ...snapshot.landmarks[0], inGameCoordinates: [0, Infinity] }] })).toThrow();
  });
  it('maps personal markers to their own selectable layer without changing persisted identity', () => {
    const marker = { id: 'personal-1', title: 'My stop', description: 'Visit later', category: 'personal' as const, position: { x: 100, y: -90 }, icon: 'star' as const, createdAt: '2026-09-05', updatedAt: '2026-09-05' };
    expect(markerToPlace(marker)).toMatchObject({ id: marker.id, title: marker.title, position: marker.position, layerId: 'personal', evidence: 'personal' });
  });
});
