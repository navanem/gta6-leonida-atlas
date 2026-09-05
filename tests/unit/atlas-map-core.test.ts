import { describe, expect, it } from 'vitest';
import type { Place } from '../../src/domain/types';
import { BASEMAP_BOUNDS, fromMapCoordinate, toMapCoordinate, isValidPosition, getFocusCenter } from '../../src/features/map/coordinates';
import { DEFAULT_LAYERS, getVisiblePlaces } from '../../src/features/map/layers';
import { buildSpatialIndex, clusterPlaces, querySpatialIndex } from '../../src/features/map/spatial';

const place = (id: string, x = 0, y = 0, layerId = 'community'): Place => ({
  id, title: id, description: '', category: 'landmark', position: { x, y }, layerId,
  tags: [], region: '', source: { title: 'Test', url: '' }, evidence: 'approximate',
});

describe('Atlas game coordinates', () => {
  it('retains raw GTADB values through Leaflet ordering without an Earth projection', () => {
    const raw = { x: -9832.096534490327, y: 8896.53 };
    expect(toMapCoordinate(raw)).toEqual([8896.53, -9832.096534490327]);
    expect(fromMapCoordinate({ lat: raw.y, lng: raw.x })).toEqual(raw);
  });
  it('uses the exact SVG calibration and validates finite positions within it', () => {
    expect(BASEMAP_BOUNDS).toEqual({ west: -16000, east: 4000, south: -8000, north: 12000 });
    expect(isValidPosition({ x: -16000, y: 12000 })).toBe(true);
    expect(isValidPosition({ x: 4001, y: 0 })).toBe(false);
    expect(isValidPosition({ x: Number.NaN, y: 0 })).toBe(false);
  });
  it('keeps a mobile selected point in the visible top area above a bottom detail panel', () => {
    const target = { x: 800, y: 2600 };
    const center = getFocusCenter(target, -1, 800, true);
    expect(center.x).toBe(target.x);
    expect(400 - (target.y - center.y) * Math.pow(2, -1)).toBeCloseTo(224);
    expect(getFocusCenter(target, -1, 800, false)).toEqual(target);
  });
});

describe('Atlas layer visibility', () => {
  it('honors visibility, zoom limits and stable layer order without mutating input', () => {
    const layers = DEFAULT_LAYERS.map(layer => ({ ...layer, visible: layer.id !== 'uncertain', ...(layer.id === 'community' ? { minZoom: -3, maxZoom: 0 } : {}) }));
    const places = [place('a'), place('b', 0, 0, 'uncertain'), place('c', 0, 0, 'regions'), place('d', 0, 0, 'personal')];
    expect(getVisiblePlaces(places, layers, -4).map(p => p.id)).toEqual(['c', 'd']);
    expect(getVisiblePlaces(places, layers, -3).map(p => p.id)).toEqual(['c', 'a', 'd']);
    expect(getVisiblePlaces(places, layers, 1).map(p => p.id)).toEqual(['c', 'd']);
    expect(places.map(p => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('keeps unpositioned records available for catalogue filters', () => {
    expect(getVisiblePlaces([{ ...place('unplaced'), position: null }], DEFAULT_LAYERS)).toHaveLength(1);
  });
});

describe('Atlas viewport grid', () => {
  it('excludes unpositioned and invalid records and queries exact viewport boundaries', () => {
    const index = buildSpatialIndex([place('west', -512, 20), place('edge', 100, 100), place('outside', 101, 100), { ...place('unplaced'), position: null }, place('invalid', Infinity, 5)]);
    expect(querySpatialIndex(index, { west: -512, east: 100, south: 0, north: 100 }).map(p => p.id).sort()).toEqual(['edge', 'west']);
  });
  it('groups nearby markers, preserves their identities and separates at a closer zoom', () => {
    const places = [place('a', 2, 2), place('b', 22, 2)];
    const far = clusterPlaces(places, { zoom: -2, enabled: true });
    expect(far).toHaveLength(1);
    expect(far[0]?.places.map(p => p.id)).toEqual(['a', 'b']);
    expect(far[0]?.position).toEqual({ x: 12, y: 2 });
    expect(clusterPlaces(places, { zoom: 3, enabled: true })).toHaveLength(2);
  });
  it('keeps the selected marker independently focusable and honors the clustering preference at ordinary density', () => {
    const places = [place('a', 2, 2), place('b', 22, 2), place('c', 24, 2)];
    expect(clusterPlaces(places, { zoom: -2, enabled: true, selectedId: 'b' }).some(group => group.places.length === 1 && group.places[0]?.id === 'b')).toBe(true);
    expect(clusterPlaces(places, { zoom: -2, enabled: false })).toHaveLength(3);
  });
  it('keeps the six regional reference labels outside community clusters', () => {
    const region = { ...place('region:vice-city', 2, 2, 'regions'), category: 'region' as const };
    const groups = clusterPlaces([region, place('a', 2, 2), place('b', 3, 3)], { zoom: -5, enabled: true });
    expect(groups.some(group => group.places.length === 1 && group.places[0]?.id === region.id)).toBe(true);
    expect(groups.some(group => group.places.length === 2)).toBe(true);
  });
  it('bounds rendered marker count at scale without dropping records, even with clustering disabled', () => {
    const places = Array.from({ length: 10_000 }, (_, i) => place(String(i), -1000 + (i % 100) * 10, Math.floor(i / 100) * 10));
    const groups = clusterPlaces(places, { zoom: 5, enabled: false, maxMarkers: 250, selectedId: '420' });
    expect(groups.length).toBeLessThanOrEqual(250);
    expect(new Set(groups.flatMap(group => group.places.map(p => p.id))).size).toBe(10_000);
    expect(groups.some(group => group.places.length === 1 && group.places[0]?.id === '420')).toBe(true);
  });
});
