import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Backup, PersonalMarker } from '../../src/domain/types';
import { AtlasDatabase } from '../../src/db/repository';

const time = '2026-09-01T12:00:00.000Z';
const marker = (id = 'custom:beach'): PersonalMarker => ({
  id,
  title: 'Beach stop',
  description: 'Visit later',
  category: 'personal',
  position: { x: -1200, y: 900 },
  icon: 'flag',
  createdAt: time,
  updatedAt: time,
});
const incoming = (): Backup => ({
  format: 'leonida-atlas',
  version: 2,
  exportedAt: time,
  favorites: [{ placeId: 'L42', createdAt: time }],
  notes: [{ placeId: 'L42', text: 'Imported note', updatedAt: time }],
  collections: [{ id: 'trip', name: 'Trip', placeIds: ['L42'], createdAt: time, updatedAt: time }],
  markers: [marker()],
  preferences: { reducedMotion: true, showLabels: false, clusterMarkers: false },
});

let db: AtlasDatabase;
beforeEach(() => {
  db = new AtlasDatabase(`atlas-test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('local atlas repository', () => {
  it('returns defaults from a fresh database and durably reloads all editable data', async () => {
    expect(await db.load()).toEqual({
      favorites: [],
      notes: [],
      collections: [],
      markers: [],
      preferences: { reducedMotion: false, showLabels: true, clusterMarkers: true },
    });
    await db.saveMarker(marker());
    await db.toggleFavorite('custom:beach');
    await db.saveNote('custom:beach', 'Go at sunset');
    await db.saveCollection({
      id: 'trip',
      name: 'Trip',
      placeIds: ['L42', 'custom:beach'],
      createdAt: time,
      updatedAt: time,
    });
    await db.savePreferences({ reducedMotion: true, showLabels: false, clusterMarkers: true });
    db.close();
    await db.open();
    const saved = await db.load();
    expect(saved.markers).toEqual([marker()]);
    expect(saved.notes[0]).toMatchObject({ placeId: 'custom:beach', text: 'Go at sunset' });
    expect(saved.favorites[0]?.placeId).toBe('custom:beach');
    expect(saved.collections[0]?.placeIds).toEqual(['L42', 'custom:beach']);
    expect(saved.preferences).toEqual({
      reducedMotion: true,
      showLabels: false,
      clusterMarkers: true,
    });
  });

  it('serializes concurrent favorite toggles and deletes an empty note', async () => {
    await Promise.all([db.toggleFavorite('L42'), db.toggleFavorite('L42')]);
    expect((await db.load()).favorites).toEqual([]);
    await db.saveNote('L42', 'Saved');
    await db.saveNote('L42', '   ');
    expect((await db.load()).notes).toEqual([]);
  });

  it('cascades deleting a marker without deleting public places or collection records', async () => {
    await db.saveMarker(marker());
    await db.toggleFavorite('custom:beach');
    await db.toggleFavorite('L42');
    await db.saveNote('custom:beach', 'Private');
    await db.saveNote('L42', 'Public');
    await db.saveCollection({
      id: 'trip',
      name: 'Trip',
      placeIds: ['custom:beach', 'L42'],
      createdAt: time,
      updatedAt: time,
    });
    await db.deleteMarker('custom:beach');
    const saved = await db.load();
    expect(saved.markers).toEqual([]);
    expect(saved.favorites.map((favorite) => favorite.placeId)).toEqual(['L42']);
    expect(saved.notes.map((note) => note.placeId)).toEqual(['L42']);
    expect(saved.collections[0]?.placeIds).toEqual(['L42']);
    await db.deleteCollection('trip');
    expect((await db.load()).collections).toEqual([]);
    expect((await db.load()).notes).toHaveLength(1);
  });

  it('rejects invalid saves and missing custom references without changes', async () => {
    await db.saveNote('L42', 'Keep');
    const before = await db.load();
    await expect(db.saveMarker({ ...marker(), position: { x: Infinity, y: 0 } })).rejects.toThrow(
      /position|coordinate/i,
    );
    await expect(db.toggleFavorite('custom:missing')).rejects.toThrow(/missing|reference/i);
    await expect(db.saveNote('custom:missing', 'Invalid')).rejects.toThrow(/missing|reference/i);
    await expect(
      db.saveCollection({
        id: 'trip',
        name: 'Trip',
        placeIds: ['custom:missing'],
        createdAt: time,
        updatedAt: time,
      }),
    ).rejects.toThrow(/missing|reference/i);
    expect(await db.load()).toEqual(before);
  });

  it('merges backups, preserves newer local edits, and exports an independent snapshot', async () => {
    const local = marker('custom:local');
    await db.saveMarker(local);
    await db.saveNote('L42', 'Newer local note');
    await db.toggleFavorite('L99');
    await db.importBackup(incoming());
    const saved = await db.load();
    expect(saved.markers.map((item) => item.id)).toEqual(['custom:beach', 'custom:local']);
    expect(saved.notes[0]?.text).toBe('Newer local note');
    expect(saved.favorites.map((item) => item.placeId)).toEqual(['L42', 'L99']);
    expect(saved.collections[0]?.name).toBe('Trip');
    expect(saved.preferences).toEqual({
      reducedMotion: true,
      showLabels: false,
      clusterMarkers: false,
    });
    const exported = await db.exportBackup();
    expect(exported).toMatchObject({ format: 'leonida-atlas', version: 2 });
    exported.markers[0]!.title = 'Mutated export';
    expect((await db.load()).markers[0]?.title).toBe('Beach stop');
  });

  it('does not write partially valid backups or clear data on unsupported versions', async () => {
    await db.saveNote('L99', 'Keep me');
    const before = await db.load();
    await expect(
      db.importBackup({ ...incoming(), notes: [{ placeId: 'L42', text: 42, updatedAt: time }] }),
    ).rejects.toThrow();
    await expect(db.importBackup({ ...incoming(), version: 99 })).rejects.toThrow(/version/i);
    expect(await db.load()).toEqual(before);
  });

  it('merges newer imported edits, keeps local ties, and remains idempotent', async () => {
    const first = incoming();
    first.markers[0]!.title = 'Original';
    await db.importBackup(first);
    const updated = incoming();
    updated.markers[0]!.title = 'New marker title';
    updated.markers[0]!.updatedAt = '2026-09-02T12:00:00.000Z';
    updated.notes[0]!.text = 'New note';
    updated.notes[0]!.updatedAt = '2026-09-02T12:00:00.000Z';
    updated.collections[0]!.name = 'New trip';
    updated.collections[0]!.updatedAt = '2026-09-02T12:00:00.000Z';
    await db.importBackup(updated);
    const saved = await db.load();
    expect(saved.markers[0]?.title).toBe('New marker title');
    expect(saved.notes[0]?.text).toBe('New note');
    expect(saved.collections[0]?.name).toBe('New trip');
    const tied = structuredClone(updated);
    tied.markers[0]!.title = 'Different same-time title';
    await db.importBackup(tied);
    await db.importBackup(updated);
    expect(await db.load()).toEqual(saved);
  });

  it('rejects direct saves that would make existing data exceed the restorable backup limit', async () => {
    const initial = incoming();
    initial.notes = Array.from({ length: 104 }, (_, index) => ({
      placeId: `L${index}`,
      text: 'x'.repeat(100_000),
      updatedAt: time,
    }));
    await db.importBackup(initial);
    await expect(db.saveNote('Lextra', 'x'.repeat(100_000))).rejects.toThrow(/MiB|data limit/i);
    expect((await db.load()).notes).toHaveLength(104);
    expect((await db.exportBackup()).notes).toHaveLength(104);
  });

  it('rolls back all imported tables after a storage failure midway through a transaction', async () => {
    await db.saveNote('L99', 'Keep me');
    const before = await db.load();
    const failWrite = () => {
      throw new Error('Simulated storage failure');
    };
    db.collections.hook('creating', failWrite);
    await expect(db.importBackup(incoming())).rejects.toThrow(/storage failure/i);
    db.collections.hook('creating').unsubscribe(failWrite);
    expect(await db.load()).toEqual(before);
  });

  it('returns persistence availability and surfaces actual storage errors', async () => {
    vi.stubGlobal('navigator', {});
    expect(await db.requestPersistence()).toBe(false);
    vi.stubGlobal('navigator', { storage: { persist: async () => true } });
    expect(await db.requestPersistence()).toBe(true);
    vi.stubGlobal('navigator', {
      storage: {
        persist: async () => {
          throw new Error('Storage blocked');
        },
      },
    });
    await expect(db.requestPersistence()).rejects.toThrow(/Storage blocked/);
  });
});

describe('real IndexedDB schema upgrade', () => {
  it('opens a v1 database and preserves records while adding v2 defaults and indexes', async () => {
    const legacy = new Dexie(db.name);
    legacy
      .version(1)
      .stores({
        favorites: 'placeId',
        notes: 'placeId',
        markers: 'id',
        collections: 'id',
        preferences: 'key',
      });
    await legacy.open();
    await legacy
      .table('markers')
      .put({ id: 'custom:old', title: 'Old stop', position: { x: 0, y: 0 }, createdAt: time });
    await legacy.table('notes').put({ placeId: 'custom:old', text: 'Old note' });
    await legacy.table('favorites').put({ placeId: 'custom:old' });
    await legacy
      .table('collections')
      .put({ id: 'trip', name: 'Old trip', placeIds: ['custom:old'], createdAt: time });
    await legacy.table('preferences').put({ key: 'preferences', value: { showLabels: false } });
    legacy.close();
    await db.open();
    const saved = await db.load();
    expect(db.verno).toBe(2);
    expect(saved.markers[0]).toMatchObject({
      id: 'custom:old',
      title: 'Old stop',
      category: 'personal',
      icon: 'pin',
      createdAt: time,
      updatedAt: time,
    });
    expect(saved.notes[0]).toMatchObject({ placeId: 'custom:old', text: 'Old note' });
    expect(saved.favorites[0]?.placeId).toBe('custom:old');
    expect(saved.collections[0]?.placeIds).toEqual(['custom:old']);
    expect(saved.preferences).toEqual({
      reducedMotion: false,
      showLabels: false,
      clusterMarkers: true,
    });
    expect(await db.markers.where('category').equals('personal').count()).toBe(1);
    expect(await db.notes.orderBy('updatedAt').count()).toBe(1);
  });

  it('aborts an invalid v1 upgrade and keeps the original database recoverable', async () => {
    const legacy = new Dexie(db.name);
    legacy
      .version(1)
      .stores({
        favorites: 'placeId',
        notes: 'placeId',
        markers: 'id',
        collections: 'id',
        preferences: 'key',
      });
    await legacy
      .table('markers')
      .put({ id: 'custom:old', title: 'Old stop', position: { x: 'invalid', y: 0 } });
    legacy.close();
    await expect(db.open()).rejects.toThrow();
    const recovery = new Dexie(db.name);
    await recovery.open();
    expect(recovery.verno).toBe(1);
    expect(await recovery.table('markers').get('custom:old')).toMatchObject({
      position: { x: 'invalid', y: 0 },
    });
    recovery.close();
  });
});
