import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Box, Info, MapPinPlus, Menu, X } from 'lucide-react';
import { loadCatalogue, markerToPlace } from '../data/catalogue';
import { filterPlaces } from '../domain/filter';
import { DEFAULT_LAYERS } from '../features/map/layers';
import MapView from '../features/map/MapView';
import { explorerPath } from '../features/explorer/public-path';
import { atlasRegistry } from '../plugins/registry';
import {
  hydrateUserData,
  useDomainStore,
  useMapStore,
  usePersistenceStore,
  useUiStore,
  useUserStore,
  useWorkspaceStore,
} from '../stores/atlas';
import { Sidebar } from './Sidebar';
import { resolveRoute } from './routes';
import type { Position } from '../domain/types';

const PlaceDetails = lazy(() => import('../features/library/PlaceDetails'));
const MarkerEditor = lazy(() => import('../features/editor/MarkerEditor'));
const BackupDialog = lazy(() => import('../features/library/BackupDialog'));
const SettingsDialog = lazy(() => import('../features/library/SettingsDialog'));
const ExplorerView = lazy(() => import('../features/explorer/ExplorerView'));
const ProjectPage = lazy(() => import('../features/project/ProjectPage'));

let cataloguePromise: ReturnType<typeof loadCatalogue> | undefined;
for (const layer of DEFAULT_LAYERS) {
  if (!atlasRegistry.layers.has(layer.id)) atlasRegistry.registerLayer(layer);
}
if (!atlasRegistry.sources.has('public'))
  atlasRegistry.registerDataSource({ id: 'public', load: loadCatalogue });

export default function App() {
  const [route, setRoute] = useState(() => resolveRoute(location.pathname, location.search));
  const places = useDomainStore((s) => s.places);
  const status = useDomainStore((s) => s.status);
  const error = useDomainStore((s) => s.error);
  const markers = useUserStore((s) => s.markers);
  const favorites = useUserStore((s) => s.favorites);
  const notes = useUserStore((s) => s.notes);
  const collections = useUserStore((s) => s.collections);
  const preferences = useUserStore((s) => s.preferences);
  const filters = useUiStore((s) => s.filters);
  const dialog = useUiStore((s) => s.dialog);
  const editorOpen = useUiStore((s) => s.editorOpen);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const selectedId = useMapStore((s) => s.selectedId);
  const layers = useMapStore((s) => s.layers);
  const focus = useMapStore((s) => s.focus);
  const editorMode = useMapStore((s) => s.editorMode);
  const draftPosition = useMapStore((s) => s.draftPosition);
  const ready = usePersistenceStore((s) => s.ready);
  const persistenceLoading = usePersistenceStore((s) => s.status === 'loading');
  const workspaceRevision = useWorkspaceStore((s) => s.revision);
  const allPlaces = useMemo(() => [...places, ...markers.map(markerToPlace)], [places, markers]);
  const deferredQuery = useDeferredValue(filters.query);
  const filtered = useMemo(
    () =>
      filterPlaces(
        allPlaces,
        { ...filters, query: deferredQuery },
        favorites.map((f) => f.placeId),
        notes,
        collections,
      ).filter((place) =>
        [...atlasRegistry.filters.values()].every((filter) => filter.matches(place)),
      ),
    [allPlaces, filters, deferredQuery, favorites, notes, collections],
  );
  const selected = useMemo(
    () => allPlaces.find((p) => p.id === selectedId),
    [allPlaces, selectedId],
  );
  const select = useCallback(
    (id: string) => {
      const place = allPlaces.find((p) => p.id === id);
      if (place) {
        useMapStore.getState().select(place);
        if (window.innerWidth < 1000) useUiStore.getState().setSidebar(false);
      }
    },
    [allPlaces],
  );
  const placePosition = useCallback((position: Position) => {
    useMapStore.getState().setPosition(position);
    useUiStore.getState().setEditorOpen(true);
  }, []);
  const closeEditor = useCallback(() => {
    useUiStore.getState().setEditorOpen(false);
    useMapStore.getState().setEditor('none');
  }, []);
  const closeDialog = useCallback(() => useUiStore.getState().setDialog(null), []);
  const goMap = useCallback(() => {
    history.pushState({}, '', import.meta.env.BASE_URL);
    setRoute(resolveRoute(location.pathname, location.search));
  }, []);
  function navigate(view: '3d' | 'about') {
    const url = view === '3d' ? explorerPath(selected?.id) : `${import.meta.env.BASE_URL}about`;
    history.pushState({}, '', url);
    setRoute(resolveRoute(location.pathname, location.search));
  }
  function beginMarker() {
    useMapStore.getState().setEditor('create');
    if (window.innerWidth < 1000) useUiStore.getState().setSidebar(false);
  }
  useEffect(() => {
    useMapStore.getState().setLayers([...atlasRegistry.layers.values()]);
    void hydrateUserData();
    cataloguePromise ??= Promise.all(
      [...atlasRegistry.sources.values()].map((source) => source.load()),
    ).then((batches) => batches.flat());
    void cataloguePromise
      .then((p) => useDomainStore.getState().setPlaces(p))
      .catch(() =>
        useDomainStore
          .getState()
          .fail('The public catalogue could not be loaded. Reload to retry.'),
      );
    if (window.innerWidth < 800) useUiStore.getState().setSidebar(false);
    const network = (event: Event) =>
      usePersistenceStore.setState({ offline: event.type === 'offline' });
    const pop = () => setRoute(resolveRoute(location.pathname, location.search));
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('popstate', pop);
    const keyboard = (event: KeyboardEvent) => {
      const editing =
        event.target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) ||
          event.target.isContentEditable);
      if (event.key === '/' && !editing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        useUiStore.getState().setSidebar(true);
        requestAnimationFrame(() => document.getElementById('atlas-search')?.focus());
      }
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        useMapStore.getState().setEditor('none');
        useMapStore.getState().select(null);
      }
    };
    document.addEventListener('keydown', keyboard);
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('leonida-atlas-local') : null;
    channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
      const data = event.data;
      const ownWorkspace = useWorkspaceStore.getState().workspaceId;
      const matches =
        data === 'saved'
          ? ownWorkspace === null
          : typeof data === 'object' &&
            data !== null &&
            'workspaceId' in data &&
            data.workspaceId === ownWorkspace;
      if (matches && usePersistenceStore.getState().status !== 'saving') void hydrateUserData();
    });
    const unlisten = atlasRegistry.on('saved', () =>
      channel?.postMessage({ workspaceId: useWorkspaceStore.getState().workspaceId }),
    );
    return () => {
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      window.removeEventListener('popstate', pop);
      document.removeEventListener('keydown', keyboard);
      unlisten();
      channel?.close();
    };
  }, []);
  useEffect(() => {
    if (route.placeId && status === 'ready') {
      const place = allPlaces.find((p) => p.id === route.placeId);
      if (place) useMapStore.getState().select(place);
    }
  }, [route.placeId, status, allPlaces]);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(preferences.reducedMotion);
  }, [preferences.reducedMotion]);
  if (route.view === 'explorer') {
    const initialPlace = allPlaces.find((place) => place.id === route.placeId);
    // Deep links must wait for the catalogue/local hydration before choosing a spawn.
    if (route.placeId && !initialPlace && (status === 'loading' || persistenceLoading))
      return <div className="full-loading">Opening selected place in 3D…</div>;
    return (
      <Suspense fallback={<div className="full-loading">Opening 3D explorer…</div>}>
        <ExplorerView
          key={`${route.placeId ?? 'default'}:${workspaceRevision}`}
          initialPlace={initialPlace}
          requestedPlaceId={route.placeId}
          onClose={goMap}
        />
      </Suspense>
    );
  }
  if (route.view === 'project')
    return (
      <Suspense fallback={<div className="full-loading">Loading project information…</div>}>
        <ProjectPage page={route.page} onClose={goMap} />
      </Suspense>
    );
  return (
    <main className="atlas-app" data-details={Boolean(selected)}>
      <a className="skip-link" href="#atlas-map-region">
        Skip to map
      </a>
      <Sidebar places={filtered} />
      <section className="map-workspace" id="atlas-map-region" aria-label="Interactive Leonida map">
        <MapView
          places={filtered}
          layers={layers}
          selectedId={selectedId}
          focus={focus}
          editorMode={editorMode}
          preferences={preferences}
          onSelect={select}
          onPlacePosition={placePosition}
        />
        <div className="map-topbar">
          <button
            className="button sidebar-toggle"
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Open sidebar'}
            onClick={() => useUiStore.getState().setSidebar(!sidebarOpen)}
          >
            <Menu size={18} />
            <span>Explore</span>
          </button>
          <div className="map-actions">
            <button className="button" disabled={!ready} onClick={beginMarker}>
              <MapPinPlus size={18} />
              <span>Add marker</span>
            </button>
            <button className="button" onClick={() => navigate('3d')}>
              <Box size={18} />
              <span>3D explorer</span>
            </button>
            <button
              className="icon-button map-about"
              aria-label="About this atlas"
              onClick={() => navigate('about')}
            >
              <Info size={19} />
            </button>
          </div>
        </div>
        {status === 'error' && (
          <div className="map-notice inline-error" role="alert">
            {error}
            <button className="text-button" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        )}
        {editorMode !== 'none' && (
          <div className="placement-notice" role="status">
            <MapPinPlus size={19} />
            <span>
              {editorMode === 'create'
                ? 'Click the map to place your marker'
                : 'Click a new position for this marker'}
            </span>
            <button
              className="text-button"
              onClick={() => useUiStore.getState().setEditorOpen(true)}
            >
              Enter coordinates
            </button>
            <button className="icon-button" aria-label="Cancel placement" onClick={closeEditor}>
              <X size={18} />
            </button>
          </div>
        )}
      </section>
      <Suspense
        fallback={
          <div className="loading-panel" role="status">
            Opening panel…
          </div>
        }
      >
        {selected && <PlaceDetails key={selected.id} place={selected} />}
        {editorOpen && <MarkerEditor position={draftPosition} onClose={closeEditor} />}
        {dialog === 'backup' && <BackupDialog onClose={closeDialog} />}
        {dialog === 'settings' && <SettingsDialog onClose={closeDialog} />}
      </Suspense>
    </main>
  );
}
