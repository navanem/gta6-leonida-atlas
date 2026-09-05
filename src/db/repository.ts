import Dexie, { type Table, type Transaction } from 'dexie';
import { DEFAULT_PREFERENCES } from '../domain/types';
import type {
  Backup,
  Collection,
  Favorite,
  PersonalMarker,
  PlaceNote,
  Preferences,
  UserData,
} from '../domain/types';
import {
  BACKUP_LIMITS,
  BackupValidationError,
  parseBackup,
  parseCollection,
  parseId,
  parsePersonalMarker,
  parsePreferences,
  parseText,
} from './backup';

type PreferencesRecord = { key: 'preferences'; value: Preferences };

/** A draft must be reconciled with the current record before it can be saved. */
export class ConflictError extends Error {
  constructor(
    message = 'This record changed in another tab or import. Review the current version before saving.',
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

function checkRevision(
  current: { updatedAt: string } | undefined,
  expectedUpdatedAt: string | null | undefined,
): void {
  if (expectedUpdatedAt !== undefined && (current?.updatedAt ?? null) !== expectedUpdatedAt) {
    throw new ConflictError();
  }
}

/** Millisecond timestamps also act as revisions, so every local edit must advance them. */
function nextUpdatedAt(previous?: string, proposed = new Date(Date.now()).toISOString()): string {
  if (!previous || proposed > previous) return proposed;
  return new Date(Date.parse(previous) + 1).toISOString();
}
const schemaV1 = {
  favorites: 'placeId',
  notes: 'placeId',
  markers: 'id',
  collections: 'id',
  preferences: 'key',
};
const schemaV2 = {
  favorites: 'placeId, createdAt',
  notes: 'placeId, updatedAt',
  markers: 'id, category, updatedAt',
  collections: 'id, name, updatedAt, *placeIds',
  preferences: 'key',
};

async function migrateV1(transaction: Transaction): Promise<void> {
  const [favorites, notes, markers, collections, prefs] = await Promise.all([
    transaction.table('favorites').toArray(),
    transaction.table('notes').toArray(),
    transaction.table('markers').toArray(),
    transaction.table('collections').toArray(),
    transaction.table('preferences').get('preferences'),
  ]);
  const migrated = parseBackup({
    format: 'leonida-atlas',
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites,
    notes,
    markers,
    collections,
    preferences: prefs?.value,
  });
  // An upgrade validation/write failure aborts IndexedDB's versionchange transaction.
  await transaction.table('markers').bulkPut(migrated.markers);
  await transaction.table('favorites').bulkPut(migrated.favorites);
  await transaction.table('notes').bulkPut(migrated.notes);
  await transaction.table('collections').bulkPut(migrated.collections);
  await transaction.table('preferences').put({ key: 'preferences', value: migrated.preferences });
}

function mergeNewest<T extends { updatedAt: string }>(
  local: T[],
  imported: T[],
  getId: (item: T) => string,
): T[] {
  const merged = new Map(local.map((item) => [getId(item), item]));
  for (const item of imported) {
    const previous = merged.get(getId(item));
    if (!previous || item.updatedAt > previous.updatedAt) merged.set(getId(item), item);
  }
  return [...merged.values()];
}

export class AtlasDatabase extends Dexie {
  declare favorites: Table<Favorite, string>;
  declare notes: Table<PlaceNote, string>;
  declare markers: Table<PersonalMarker, string>;
  declare collections: Table<Collection, string>;
  declare preferences: Table<PreferencesRecord, string>;

  constructor(name = 'leonida-atlas') {
    super(name);
    this.version(1).stores(schemaV1);
    this.version(2).stores(schemaV2).upgrade(migrateV1);
  }

  private async snapshot(): Promise<UserData> {
    const [favorites, notes, markers, collections, preferences] = await Promise.all([
      this.favorites.toArray(),
      this.notes.toArray(),
      this.markers.toArray(),
      this.collections.toArray(),
      this.preferences.get('preferences'),
    ]);
    return {
      favorites,
      notes,
      markers,
      collections,
      preferences: preferences?.value ?? { ...DEFAULT_PREFERENCES },
    };
  }

  async load(): Promise<UserData> {
    return this.transaction('r', this.tables, () => this.snapshot());
  }

  private async requirePlace(id: string): Promise<void> {
    if (id.startsWith('custom:') && !(await this.markers.get(id))) {
      throw new BackupValidationError(`reference contains missing personal marker ${id}`);
    }
  }

  private async checkCapacity<T>(table: Table<T, string>, id: string): Promise<void> {
    if (!(await table.get(id)) && (await table.count()) >= BACKUP_LIMITS.items) {
      throw new BackupValidationError(
        `${table.name} exceeds the limit of ${BACKUP_LIMITS.items} items`,
      );
    }
  }

  private async ensureRestorable(): Promise<void> {
    // Called inside the write transaction so exceeding backup limits rolls it back.
    parseBackup({
      ...(await this.snapshot()),
      format: 'leonida-atlas',
      version: 2,
      exportedAt: new Date().toISOString(),
    });
  }

  async toggleFavorite(placeId: string): Promise<void> {
    const id = parseId(placeId, 'placeId');
    await this.transaction('rw', this.tables, async () => {
      if (await this.favorites.get(id)) await this.favorites.delete(id);
      else {
        await this.requirePlace(id);
        await this.checkCapacity(this.favorites, id);
        await this.favorites.put({ placeId: id, createdAt: new Date().toISOString() });
        await this.ensureRestorable();
      }
    });
  }

  async saveNote(placeId: string, text: string, expectedUpdatedAt?: string | null): Promise<void> {
    const id = parseId(placeId, 'placeId');
    const value = parseText(text, 'note.text', BACKUP_LIMITS.note);
    await this.transaction('rw', this.tables, async () => {
      const current = await this.notes.get(id);
      checkRevision(current, expectedUpdatedAt);
      if (!value.trim()) await this.notes.delete(id);
      else {
        await this.requirePlace(id);
        await this.checkCapacity(this.notes, id);
        await this.notes.put({
          placeId: id,
          text: value,
          updatedAt: nextUpdatedAt(current?.updatedAt),
        });
        await this.ensureRestorable();
      }
    });
  }

  async saveMarker(marker: PersonalMarker, expectedUpdatedAt?: string | null): Promise<void> {
    const value = parsePersonalMarker(marker);
    await this.transaction('rw', this.tables, async () => {
      const current = await this.markers.get(value.id);
      checkRevision(current, expectedUpdatedAt);
      await this.checkCapacity(this.markers, value.id);
      await this.markers.put({
        ...value,
        updatedAt: nextUpdatedAt(current?.updatedAt, value.updatedAt),
      });
      await this.ensureRestorable();
    });
  }

  async deleteMarker(id: string): Promise<void> {
    const markerId = parseId(id, 'marker.id', true);
    await this.transaction(
      'rw',
      [this.markers, this.favorites, this.notes, this.collections],
      async () => {
        await this.markers.delete(markerId);
        await this.favorites.delete(markerId);
        await this.notes.delete(markerId);
        await this.collections
          .where('placeIds')
          .equals(markerId)
          .modify((collection) => {
            collection.placeIds = collection.placeIds.filter((placeId) => placeId !== markerId);
            collection.updatedAt = nextUpdatedAt(collection.updatedAt);
          });
      },
    );
  }

  /** Complete drafts should carry a revision; field edits use the transactional methods below. */
  async saveCollection(collection: Collection, expectedUpdatedAt?: string | null): Promise<void> {
    const value = parseCollection(collection);
    await this.transaction('rw', this.tables, async () => {
      const current = await this.collections.get(value.id);
      checkRevision(current, expectedUpdatedAt);
      await this.checkCapacity(this.collections, value.id);
      for (const id of value.placeIds) await this.requirePlace(id);
      await this.collections.put({
        ...value,
        updatedAt: nextUpdatedAt(current?.updatedAt, value.updatedAt),
      });
      await this.ensureRestorable();
    });
  }

  private async updateCollection(
    id: string,
    update: (current: Collection) => Collection,
  ): Promise<void> {
    const collectionId = parseId(id, 'collection.id');
    await this.transaction('rw', this.tables, async () => {
      const current = await this.collections.get(collectionId);
      if (!current)
        throw new ConflictError(
          'This collection was deleted. Create a new collection to continue.',
        );
      const value = parseCollection({
        ...update(current),
        updatedAt: nextUpdatedAt(current.updatedAt),
      });
      for (const placeId of value.placeIds) await this.requirePlace(placeId);
      await this.collections.put(value);
      await this.ensureRestorable();
    });
  }

  async addCollectionPlace(id: string, placeId: string): Promise<void> {
    const value = parseId(placeId, 'placeId');
    await this.updateCollection(id, (current) => ({
      ...current,
      placeIds: [...new Set([...current.placeIds, value])],
    }));
  }

  async removeCollectionPlace(id: string, placeId: string): Promise<void> {
    const value = parseId(placeId, 'placeId');
    await this.updateCollection(id, (current) => ({
      ...current,
      placeIds: current.placeIds.filter((member) => member !== value),
    }));
  }

  async renameCollection(id: string, name: string): Promise<void> {
    const value = parseText(name, 'collection.name', BACKUP_LIMITS.title, true);
    await this.updateCollection(id, (current) => ({ ...current, name: value }));
  }

  async deleteCollection(id: string): Promise<void> {
    await this.collections.delete(parseId(id, 'collection.id'));
  }

  async savePreferences(prefs: Preferences): Promise<void> {
    const value = parsePreferences(prefs);
    await this.transaction('rw', this.tables, async () => {
      await this.preferences.put({ key: 'preferences', value });
      await this.ensureRestorable();
    });
  }

  async exportBackup(): Promise<Backup> {
    return parseBackup({
      ...(await this.load()),
      format: 'leonida-atlas',
      version: 2,
      exportedAt: new Date().toISOString(),
    });
  }

  async importBackup(input: unknown): Promise<void> {
    const imported = parseBackup(input);
    await this.transaction('rw', this.tables, async () => {
      const local = await this.snapshot();
      const favorites = new Map(local.favorites.map((item) => [item.placeId, item]));
      for (const item of imported.favorites) {
        const previous = favorites.get(item.placeId);
        if (!previous || item.createdAt < previous.createdAt) favorites.set(item.placeId, item);
      }
      // Import deliberately merges newer revisions; open editor drafts must use compare-and-set
      // saves so a restored revision cannot later be replaced by stale component state.
      // Check merged limits and relationships before writing, including local data.
      const merged = parseBackup({
        ...imported,
        favorites: [...favorites.values()],
        markers: mergeNewest(local.markers, imported.markers, (item) => item.id),
        notes: mergeNewest(local.notes, imported.notes, (item) => item.placeId),
        collections: mergeNewest(local.collections, imported.collections, (item) => item.id),
      });
      await this.markers.bulkPut(merged.markers);
      await this.favorites.bulkPut(merged.favorites);
      await this.notes.bulkPut(merged.notes);
      await this.collections.bulkPut(merged.collections);
      await this.preferences.put({ key: 'preferences', value: merged.preferences });
    });
  }

  async requestPersistence(): Promise<boolean> {
    if (typeof navigator === 'undefined' || typeof navigator.storage?.persist !== 'function')
      return false;
    return navigator.storage.persist();
  }
}

// A live binding lets existing local operations use the selected namespace.
// Only the store's serialized workspace transition may replace it.
export let atlasRepository = new AtlasDatabase();
export function replaceAtlasRepository(repository: AtlasDatabase): void {
  atlasRepository = repository;
}

export function workspaceDatabaseName(workspaceId: string | null): string {
  if (workspaceId === null) return 'leonida-atlas';
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(workspaceId)) throw new Error('Invalid workspace identifier.');
  return `leonida-atlas-workspace-${workspaceId}`;
}
