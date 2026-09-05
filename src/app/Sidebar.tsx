import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  ChevronRight,
  Compass,
  Database,
  Layers,
  MapPin,
  Search,
  Settings,
  X,
} from 'lucide-react';
import type { Category, Place } from '../domain/types';
import { useDomainStore, useMapStore, useUiStore } from '../stores/atlas';
import { SavedPlaces } from '../features/library/SavedPlaces';
import { Status } from './Status';
import { setAccountEntryTarget } from '../capabilities/extension-host';

export const CATEGORIES: { id: Category | 'all'; name: string }[] = [
  { id: 'all', name: 'All places' },
  { id: 'region', name: 'Regions' },
  { id: 'landmark', name: 'Landmarks' },
  { id: 'nature', name: 'Nature' },
  { id: 'transport', name: 'Transport' },
  { id: 'business', name: 'Businesses' },
  { id: 'personal', name: 'Personal' },
];

function LayerManager() {
  const layers = useMapStore((s) => s.layers);
  const ordered = [...layers].sort((a, b) => b.order - a.order);
  function move(id: string, direction: number) {
    const index = ordered.findIndex((l) => l.id === id);
    const neighbor = ordered[index + direction];
    const current = ordered[index];
    if (!neighbor || !current) return;
    useMapStore
      .getState()
      .setLayers(
        layers.map((layer) =>
          layer.id === id
            ? { ...layer, order: neighbor.order }
            : layer.id === neighbor.id
              ? { ...layer, order: current.order }
              : layer,
        ),
      );
  }
  return (
    <div className="layer-manager">
      <p className="panel-intro">
        Choose what appears on the map. Layers at the top draw above the others.
      </p>
      {ordered.map((layer, index) => (
        <div className="layer-row" key={layer.id}>
          <label>
            <input
              type="checkbox"
              checked={layer.visible}
              onChange={(e) =>
                useMapStore
                  .getState()
                  .setLayers(
                    layers.map((l) =>
                      l.id === layer.id ? { ...l, visible: e.target.checked } : l,
                    ),
                  )
              }
            />
            <span className="layer-dot" style={{ background: layer.style.color }} />
            <span>
              {layer.name}
              <small>{layer.description}</small>
            </span>
          </label>
          <div>
            <button
              className="icon-button"
              aria-label={`Raise ${layer.name}`}
              disabled={index === 0}
              onClick={() => move(layer.id, -1)}
            >
              <ArrowUp size={15} />
            </button>
            <button
              className="icon-button"
              aria-label={`Lower ${layer.name}`}
              disabled={index === ordered.length - 1}
              onClick={() => move(layer.id, 1)}
            >
              <ArrowDown size={15} />
            </button>
          </div>
        </div>
      ))}
      <p className="empty-state">
        The basemap is a community reconstruction. Unmapped areas remain unknown; positions are
        approximate.
      </p>
    </div>
  );
}

function Results({ places }: { places: Place[] }) {
  const filters = useUiStore((s) => s.filters);
  const selectedId = useMapStore((s) => s.selectedId);
  const status = useDomainStore((s) => s.status);
  const [limit, setLimit] = useState(50);
  useEffect(() => setLimit(50), [filters]);
  function select(place: Place) {
    useMapStore.getState().select(place);
    if (window.innerWidth < 1000) useUiStore.getState().setSidebar(false);
  }
  return (
    <>
      <div className="filter-controls">
        <label htmlFor="category">Browse categories</label>
        <select
          id="category"
          value={filters.category}
          onChange={(e) =>
            useUiStore.getState().setFilters({ category: e.target.value as Category | 'all' })
          }
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="row-between">
          <label className="check-label">
            <input
              type="checkbox"
              checked={filters.favoritesOnly}
              onChange={(e) =>
                useUiStore.getState().setFilters({ favoritesOnly: e.target.checked })
              }
            />
            Favorites
          </label>
          <select
            className="compact-select"
            aria-label="Evidence filter"
            value={filters.evidence}
            onChange={(e) =>
              useUiStore
                .getState()
                .setFilters({ evidence: e.target.value as 'all' | 'approximate' | 'uncertain' })
            }
          >
            <option value="all">All evidence</option>
            <option value="approximate">Named entries</option>
            <option value="uncertain">Uncertain entries</option>
          </select>
        </div>
      </div>
      <div className="results-count">
        <span>{places.length.toLocaleString()} results</span>
        <button className="text-button" onClick={() => useUiStore.getState().resetFilters()}>
          Reset filters
        </button>
      </div>
      {status === 'loading' ? (
        <p className="empty-state">Loading the public catalogue…</p>
      ) : !places.length ? (
        <p className="empty-state">
          No places match these filters. Try another name, region or tag.
        </p>
      ) : (
        <div className="place-results" aria-label="Search results">
          {places.slice(0, limit).map((place) => (
            <button
              className={`place-result ${selectedId === place.id ? 'active' : ''}`}
              key={place.id}
              onClick={() => select(place)}
            >
              <MapPin size={19} />
              <span>
                <strong>{place.title || 'Unnamed entry'}</strong>
                <small>
                  {!place.position
                    ? 'Unpositioned'
                    : place.evidence === 'personal'
                      ? 'Personal marker'
                      : place.category === 'region'
                        ? 'Region · approximate'
                        : place.evidence === 'uncertain'
                          ? 'Uncertain · approximate'
                          : `${place.category} · approximate`}
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      )}
      {places.length > limit && (
        <button className="load-more" onClick={() => setLimit((n) => n + 50)}>
          Show next {Math.min(50, places.length - limit)} places
        </button>
      )}
    </>
  );
}

export function Sidebar({ places }: { places: Place[] }) {
  const tab = useUiStore((s) => s.tab);
  const open = useUiStore((s) => s.sidebarOpen);
  const query = useUiStore((s) => s.filters.query);
  return (
    <aside className="sidebar" data-open={open} aria-label="Atlas sidebar">
      <header className="brand-header">
        <div>
          <h1>LEONIDA ATLAS</h1>
          <p>GTA VI INDEPENDENT COMMUNITY ATLAS</p>
        </div>
        <button
          className="icon-button mobile-only"
          aria-label="Close sidebar"
          onClick={() => useUiStore.getState().setSidebar(false)}
        >
          <X size={21} />
        </button>
      </header>
      <div className="search-field">
        <Search size={18} />
        <input
          id="atlas-search"
          type="search"
          maxLength={250}
          placeholder="Search places, regions, tags"
          aria-label="Search places, regions, tags"
          value={query}
          onChange={(e) => {
            useUiStore.getState().setFilters({ query: e.target.value });
            useUiStore.getState().setTab('explore');
          }}
        />
        <kbd>/</kbd>
      </div>
      <nav className="sidebar-tabs" aria-label="Atlas tools">
        {(
          [
            { id: 'explore', name: 'Explore', icon: Compass },
            { id: 'layers', name: 'Layers', icon: Layers },
            { id: 'saved', name: 'Saved', icon: Bookmark },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? 'active' : ''}
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => useUiStore.getState().setTab(item.id)}
          >
            <item.icon size={18} />
            {item.name}
          </button>
        ))}
      </nav>
      <div className="sidebar-content">
        {tab === 'explore' ? (
          <Results places={places} />
        ) : tab === 'layers' ? (
          <LayerManager />
        ) : (
          <SavedPlaces />
        )}
      </div>
      <footer className="sidebar-footer">
        <div ref={setAccountEntryTarget} data-atlas-account-slot />
        <Status />
        <div className="button-row">
          <button className="button" onClick={() => useUiStore.getState().setDialog('settings')}>
            <Settings size={17} />
            Settings
          </button>
          <button className="button" onClick={() => useUiStore.getState().setDialog('backup')}>
            <Database size={17} />
            Backup
          </button>
        </div>
      </footer>
    </aside>
  );
}
