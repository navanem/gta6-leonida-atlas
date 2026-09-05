import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasDatabase } from '../../src/db/repository';
import type { Collection, PersonalMarker } from '../../src/domain/types';

const time = '2026-09-01T12:00:00.000Z';
const collection = (): Collection => ({
  id: 'collection:trip', name: 'Trip', placeIds: ['L1'], createdAt: time, updatedAt: time,
});
const marker = (): PersonalMarker => ({
  id: 'custom:beach', title: 'Beach', description: '', category: 'personal',
  position: { x: 0, y: 0 }, icon: 'pin', createdAt: time, updatedAt: time,
});

let first: AtlasDatabase;
let second: AtlasDatabase;
beforeEach(async () => {
  const name = `atlas-concurrency-${crypto.randomUUID()}`;
  first = new AtlasDatabase(name);
  second = new AtlasDatabase(name);
  await Promise.all([first.open(), second.open()]);
});
afterEach(async () => {
  vi.restoreAllMocks();
  second.close();
  await first.delete();
});

describe('edits from independent Atlas tabs', () => {
  it('keeps parallel membership additions and a rename on the current collection', async () => {
    await first.saveCollection(collection());
    await Promise.all([
      first.addCollectionPlace('collection:trip', 'L2'),
      second.addCollectionPlace('collection:trip', 'L3'),
      first.renameCollection('collection:trip', 'Weekend'),
    ]);
    const saved = (await second.load()).collections[0]!;
    expect(saved.name).toBe('Weekend');
    expect(saved.placeIds.slice().sort()).toEqual(['L1', 'L2', 'L3']);
    expect(saved.updatedAt > time).toBe(true);
  });

  it('removes only the requested member while another tab adds a different place', async () => {
    await first.saveCollection(collection());
    await Promise.all([
      first.removeCollectionPlace('collection:trip', 'L1'),
      second.addCollectionPlace('collection:trip', 'L2'),
    ]);
    expect((await first.load()).collections[0]!.placeIds).toEqual(['L2']);
    await second.addCollectionPlace('collection:trip', 'L2');
    expect((await first.load()).collections[0]!.placeIds).toEqual(['L2']);
  });

  it('does not resurrect a deleted collection or add a missing personal marker', async () => {
    await first.saveCollection(collection());
    await expect(second.addCollectionPlace('collection:trip', 'custom:missing')).rejects.toThrow(/missing|reference/i);
    expect((await first.load()).collections[0]!.placeIds).toEqual(['L1']);
    await first.deleteCollection('collection:trip');
    await expect(second.renameCollection('collection:trip', 'Resurrected')).rejects.toMatchObject({ name: 'ConflictError' });
    await expect(second.removeCollectionPlace('collection:trip', 'L1')).rejects.toMatchObject({ name: 'ConflictError' });
    expect((await second.load()).collections).toEqual([]);
  });

  it('rejects a stale full collection edit after a membership update', async () => {
    const stale = collection();
    await first.saveCollection(stale);
    await second.addCollectionPlace(stale.id, 'L2');
    await expect(first.saveCollection({ ...stale, name: 'Old draft' }, stale.updatedAt)).rejects.toMatchObject({ name: 'ConflictError' });
    expect((await second.load()).collections[0]).toMatchObject({ name: 'Trip', placeIds: ['L1', 'L2'] });
  });

  it('allows only one note update from the same revision, including within one millisecond', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(time));
    await first.saveNote('L1', 'Initial', null);
    const revision = (await first.load()).notes[0]!.updatedAt;
    const outcomes = await Promise.allSettled([
      first.saveNote('L1', 'First tab', revision),
      second.saveNote('L1', 'Second tab', revision),
    ]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(result => result.status === 'rejected')).toMatchObject({ reason: { name: 'ConflictError' } });
    const saved = (await first.load()).notes[0]!;
    expect(['First tab', 'Second tab']).toContain(saved.text);
    expect(saved.updatedAt > revision).toBe(true);
  });

  it('rejects stale note deletion and expects absence when creating a note', async () => {
    await first.saveNote('L1', 'Initial', null);
    const revision = (await first.load()).notes[0]!.updatedAt;
    await second.saveNote('L1', 'New text', revision);
    await expect(first.saveNote('L1', '', revision)).rejects.toMatchObject({ name: 'ConflictError' });
    await expect(first.saveNote('L1', 'New draft', null)).rejects.toMatchObject({ name: 'ConflictError' });
    expect((await first.load()).notes[0]!.text).toBe('New text');
    await second.saveNote('L1', '');
    await expect(first.saveNote('L1', 'Resurrected', revision)).rejects.toMatchObject({ name: 'ConflictError' });
    expect((await first.load()).notes).toEqual([]);
  });

  it('rejects marker edits from an old revision even when timestamps repeat', async () => {
    const original = marker();
    await first.saveMarker(original, null);
    const outcomes = await Promise.allSettled([
      first.saveMarker({ ...original, title: 'First tab' }, original.updatedAt),
      second.saveMarker({ ...original, title: 'Second tab' }, original.updatedAt),
    ]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(result => result.status === 'rejected')).toMatchObject({ reason: { name: 'ConflictError' } });
    expect((await first.load()).markers[0]!.updatedAt > original.updatedAt).toBe(true);
    await second.deleteMarker(original.id);
    await expect(first.saveMarker(original, original.updatedAt)).rejects.toMatchObject({ name: 'ConflictError' });
    expect((await first.load()).markers).toEqual([]);
  });

  it('preserves an imported newer note against an older open draft', async () => {
    await first.saveNote('L1', 'Initial');
    const before = await first.exportBackup();
    const revision = before.notes[0]!.updatedAt;
    before.notes[0] = { ...before.notes[0]!, text: 'Restored newer text', updatedAt: '2090-01-01T00:00:00.000Z' };
    await second.importBackup(before);
    await expect(first.saveNote('L1', 'Old open draft', revision)).rejects.toMatchObject({ name: 'ConflictError' });
    expect((await first.load()).notes[0]!.text).toBe('Restored newer text');
  });
});
