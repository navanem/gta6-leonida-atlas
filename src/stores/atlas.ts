import { create } from 'zustand';
import type { Filters, LayerDefinition, Place, Position, UserData } from '../domain/types';
import { EMPTY_USER_DATA } from '../domain/types';
import { atlasRepository, ConflictError } from '../db/repository';
import { atlasRegistry } from '../plugins/registry';

export const DEFAULT_FILTERS: Filters = {
  query: '',
  category: 'all',
  favoritesOnly: false,
  personalOnly: false,
  evidence: 'all',
  collectionId: null,
};
export const useDomainStore = create<{
  places: Place[];
  status: 'loading' | 'ready' | 'error';
  error: string;
  setPlaces: (places: Place[]) => void;
  fail: (error: string) => void;
}>((set) => ({
  places: [],
  status: 'loading',
  error: '',
  setPlaces: (places) => set({ places, status: 'ready', error: '' }),
  fail: (error) => set({ status: 'error', error }),
}));
export const useMapStore = create<{
  selectedId: string | null;
  focus: { position: Position; requestId: number } | null;
  layers: LayerDefinition[];
  editorMode: 'none' | 'create' | 'move';
  draftPosition: Position | null;
  setLayers: (layers: LayerDefinition[]) => void;
  select: (place: Place | null) => void;
  setEditor: (mode: 'none' | 'create' | 'move') => void;
  setPosition: (position: Position) => void;
}>((set) => ({
  selectedId: null,
  focus: null,
  layers: [],
  editorMode: 'none',
  draftPosition: null,
  setLayers: (layers) => set({ layers }),
  select: (place) => {
    set((state) => ({
      selectedId: place?.id ?? null,
      focus: place?.position
        ? { position: place.position, requestId: (state.focus?.requestId ?? 0) + 1 }
        : null,
      editorMode: 'none',
      draftPosition: null,
    }));
    atlasRegistry.emit('selection', place?.id ?? null);
  },
  setEditor: (editorMode) => set({ editorMode, draftPosition: null }),
  setPosition: (draftPosition) => set({ draftPosition }),
}));
export type SidebarTab = 'explore' | 'layers' | 'saved';
export const useUiStore = create<{
  filters: Filters;
  tab: SidebarTab;
  sidebarOpen: boolean;
  dialog: 'settings' | 'backup' | null;
  editorOpen: boolean;
  setFilters: (filters: Partial<Filters>) => void;
  resetFilters: () => void;
  setTab: (tab: SidebarTab) => void;
  setSidebar: (open: boolean) => void;
  setDialog: (dialog: 'settings' | 'backup' | null) => void;
  setEditorOpen: (open: boolean) => void;
}>((set) => ({
  filters: DEFAULT_FILTERS,
  tab: 'explore',
  sidebarOpen: true,
  dialog: null,
  editorOpen: false,
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  setTab: (tab) => set({ tab }),
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
  setDialog: (dialog) => set({ dialog }),
  setEditorOpen: (editorOpen) => set({ editorOpen }),
}));
export const useUserStore = create<UserData>(() => structuredClone(EMPTY_USER_DATA));
export const usePersistenceStore = create<{
  status: 'loading' | 'saved' | 'saving' | 'error';
  error: string;
  offline: boolean;
  ready: boolean;
}>(() => ({
  status: 'loading',
  error: '',
  offline: typeof navigator !== 'undefined' && !navigator.onLine,
  ready: false,
}));

export async function hydrateUserData() {
  try {
    const data = await atlasRepository.load();
    useUserStore.setState(data);
    usePersistenceStore.setState({ status: 'saved', error: '', ready: true });
  } catch {
    usePersistenceStore.setState({
      status: 'error',
      ready: false,
      error:
        'Local storage is unavailable. Check browser storage permissions, then retry. Your existing data has not been reset.',
    });
  }
}
let writeQueue: Promise<unknown> = Promise.resolve();
let pending = 0;
/** Serialize local writes; publish success only after the transaction and reload complete. */
export function saveLocal(action: () => Promise<void>): Promise<boolean> {
  pending++;
  usePersistenceStore.setState({ status: 'saving', error: '' });
  const operation = writeQueue.then(async () => {
    try {
      await action();
      const data = await atlasRepository.load();
      useUserStore.setState(data);
      pending--;
      usePersistenceStore.setState({
        status: pending ? 'saving' : 'saved',
        error: '',
        ready: true,
      });
      atlasRegistry.emit('saved', undefined);
      return true;
    } catch (error) {
      pending--;
      usePersistenceStore.setState({
        status: 'error',
        error:
          error instanceof ConflictError
            ? 'A newer version exists in another tab or import. Preserve your draft and reload the saved version before editing again.'
            : 'Could not save to this device. Free storage or check permissions, then retry. Existing data is preserved.',
      });
      return false;
    }
  });
  writeQueue = operation;
  return operation;
}
