import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasDatabase, atlasRepository } from '../../src/db/repository';
import {
  deleteLocalWorkspace,
  exportWorkspaceBackup,
  hydrateUserData,
  importWorkspaceBackup,
  saveLocal,
  switchLocalWorkspace,
  useMapStore,
  usePersistenceStore,
  useUiStore,
  useUserStore,
  useWorkspaceStore,
} from '../../src/stores/atlas';

const ids = new Set<string>();
function account() {
  const id = crypto.randomUUID();
  ids.add(id);
  return id;
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((r) => {
    release = r;
  });
  return { promise, release };
}
beforeEach(async () => {
  await atlasRepository.open();
  await hydrateUserData();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await switchLocalWorkspace(null);
  for (const id of ids) await deleteLocalWorkspace(id);
  ids.clear();
  await atlasRepository.delete();
});

describe('isolated optional account workspaces', () => {
  it('preserves guest data and restores each account without merging identities', async () => {
    await hydrateUserData();
    await saveLocal(() => atlasRepository.saveNote('L1', 'Guest note'));
    const first = account(),
      second = account();
    await switchLocalWorkspace(first);
    expect(useUserStore.getState().notes).toEqual([]);
    await saveLocal(() => atlasRepository.saveNote('L1', 'First account'));
    await switchLocalWorkspace(second);
    expect(useUserStore.getState().notes).toEqual([]);
    await saveLocal(() => atlasRepository.saveNote('L1', 'Second account'));
    await switchLocalWorkspace(first);
    expect(useUserStore.getState().notes[0]?.text).toBe('First account');
    await switchLocalWorkspace(null);
    expect(atlasRepository.name).toBe('leonida-atlas');
    expect(useUserStore.getState().notes[0]?.text).toBe('Guest note');
  });

  it('drains already accepted writes into their original database and blocks writes during a switch', async () => {
    await hydrateUserData();
    const pending = gate();
    const saved = saveLocal(async () => {
      await pending.promise;
      await atlasRepository.saveNote('L1', 'Still guest');
    });
    const switched = switchLocalWorkspace(account());
    expect(usePersistenceStore.getState().ready).toBe(false);
    const denied = vi.fn(async () => {
      await atlasRepository.saveNote('L2', 'Crossed');
    });
    expect(await saveLocal(denied)).toBe(false);
    expect(denied).not.toHaveBeenCalled();
    pending.release();
    // The original write commits, but its old UI callback must not reopen a draft or selection.
    expect(await saved).toBe(false);
    await switched;
    expect(useUserStore.getState().notes).toEqual([]);
    await switchLocalWorkspace(null);
    expect(useUserStore.getState().notes.map((n) => n.text)).toEqual(['Still guest']);
  });

  it('ignores an old hydration completing after the new identity is loaded', async () => {
    await hydrateUserData();
    const old = await atlasRepository.load();
    old.notes.push({
      placeId: 'L1',
      text: 'Private old data',
      updatedAt: new Date().toISOString(),
    });
    const delayed = gate();
    vi.spyOn(atlasRepository, 'load').mockImplementationOnce(async () => {
      await delayed.promise;
      return old;
    });
    const hydration = hydrateUserData();
    await switchLocalWorkspace(account());
    delayed.release();
    await hydration;
    expect(useUserStore.getState().notes).toEqual([]);
    expect(usePersistenceStore.getState().ready).toBe(true);
  });

  it('clears visible previous data and open drafts immediately and serializes rapid account switches', async () => {
    await hydrateUserData();
    await saveLocal(() => atlasRepository.saveNote('L1', 'Private'));
    useUiStore.setState({
      dialog: 'backup',
      editorOpen: true,
      filters: { ...useUiStore.getState().filters, collectionId: 'collection:old' },
    });
    useMapStore.setState({
      selectedId: 'custom:old',
      editorMode: 'move',
      draftPosition: { x: 1, y: 2 },
    });
    const first = switchLocalWorkspace(account());
    const lastId = account(),
      last = switchLocalWorkspace(lastId);
    expect(useUserStore.getState().notes).toEqual([]);
    expect(useUiStore.getState()).toMatchObject({
      dialog: null,
      editorOpen: false,
      filters: { collectionId: null },
    });
    expect(useMapStore.getState()).toMatchObject({
      selectedId: null,
      editorMode: 'none',
      draftPosition: null,
    });
    await Promise.all([first, last]);
    expect(useWorkspaceStore.getState()).toMatchObject({ workspaceId: lastId, switching: false });
    expect(usePersistenceStore.getState().ready).toBe(true);
  });

  it('deletes only the requested inactive account namespace and refuses guest/active deletion', async () => {
    await hydrateUserData();
    await saveLocal(() => atlasRepository.saveNote('L1', 'Guest kept'));
    const id = account();
    await switchLocalWorkspace(id);
    await saveLocal(() => atlasRepository.saveNote('L1', 'Account deleted'));
    await expect(deleteLocalWorkspace(id)).rejects.toThrow(/active/i);
    await expect(deleteLocalWorkspace('')).rejects.toThrow(/workspace/i);
    await switchLocalWorkspace(null);
    await deleteLocalWorkspace(id);
    await switchLocalWorkspace(id);
    expect(useUserStore.getState().notes).toEqual([]);
    await switchLocalWorkspace(null);
    expect(useUserStore.getState().notes[0]?.text).toBe('Guest kept');
  });

  it('rejects export and restore from a stale account callback and a delayed export after logout', async () => {
    const id = account();
    await switchLocalWorkspace(id);
    await saveLocal(() => atlasRepository.saveNote('L1', 'Secret'));
    const backup = await exportWorkspaceBackup(id);
    const delayed = gate();
    vi.spyOn(atlasRepository, 'exportBackup').mockImplementationOnce(async () => {
      await delayed.promise;
      return backup;
    });
    const exported = exportWorkspaceBackup(id);
    // Let export pass the write-queue barrier and start reading before switching.
    await Promise.resolve();
    await Promise.resolve();
    await switchLocalWorkspace(null);
    const rejected = expect(exported).rejects.toThrow(/workspace/i);
    delayed.release();
    await rejected;
    await expect(exportWorkspaceBackup(id)).rejects.toThrow(/workspace/i);
    await expect(importWorkspaceBackup(id, backup)).rejects.toThrow(/workspace/i);
    expect(useUserStore.getState().notes).toEqual([]);
  });

  it('leaves previous personal data hidden on storage failure and allows a later transition', async () => {
    await saveLocal(() => atlasRepository.saveNote('L1', 'Keep private'));
    const load = vi
      .spyOn(AtlasDatabase.prototype, 'load')
      .mockRejectedValueOnce(new Error('Storage denied'));
    await expect(switchLocalWorkspace(account())).rejects.toThrow('Storage denied');
    expect(useUserStore.getState().notes).toEqual([]);
    expect(usePersistenceStore.getState()).toMatchObject({ status: 'error', ready: false });
    expect(
      await saveLocal(async () => {
        throw new Error('Must not run');
      }),
    ).toBe(false);
    load.mockRestore();
    await switchLocalWorkspace(null);
    expect(useUserStore.getState().notes[0]?.text).toBe('Keep private');
  });

  it('does not publish an old hydration over a newer save in the same workspace', async () => {
    const old = await atlasRepository.load();
    const delayed = gate();
    vi.spyOn(atlasRepository, 'load').mockImplementationOnce(async () => {
      await delayed.promise;
      return old;
    });
    const hydration = hydrateUserData();
    expect(await saveLocal(() => atlasRepository.saveNote('L1', 'Newest'))).toBe(true);
    delayed.release();
    await hydration;
    expect(useUserStore.getState().notes[0]?.text).toBe('Newest');
  });

  it('finishes namespace deletion before a queued switch may open it', async () => {
    const id = account();
    await switchLocalWorkspace(id);
    await saveLocal(() => atlasRepository.saveNote('L1', 'Deleted copy'));
    await switchLocalWorkspace(null);
    const delayed = gate(),
      started = gate();
    const original = AtlasDatabase.prototype.delete;
    vi.spyOn(AtlasDatabase.prototype, 'delete').mockImplementationOnce(function (
      this: AtlasDatabase,
    ) {
      started.release();
      return Dexie.Promise.resolve(delayed.promise).then(() => original.call(this));
    });
    const deletion = deleteLocalWorkspace(id);
    await started.promise;
    const switching = switchLocalWorkspace(id);
    expect(usePersistenceStore.getState().ready).toBe(false);
    delayed.release();
    await Promise.all([deletion, switching]);
    expect(useWorkspaceStore.getState().workspaceId).toBe(id);
    expect(useUserStore.getState().notes).toEqual([]);
    expect(await saveLocal(() => atlasRepository.saveNote('L1', 'New copy'))).toBe(true);
  });
});
