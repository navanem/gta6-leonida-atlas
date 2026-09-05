import { useState } from 'react';
import { Bookmark, Check, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { atlasRepository } from '../../db/repository';
import { saveLocal, usePersistenceStore, useUiStore, useUserStore } from '../../stores/atlas';
import type { Collection } from '../../domain/types';

export function SavedPlaces() {
  const collections = useUserStore((s) => s.collections);
  const favorites = useUserStore((s) => s.favorites);
  const markers = useUserStore((s) => s.markers);
  const ready = usePersistenceStore((s) => s.ready);
  const filters = useUiStore((s) => s.filters);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  function show(kind: 'favorites' | 'personal' | 'all', id: string | null = null) {
    useUiStore.getState().resetFilters();
    useUiStore.getState().setFilters({
      favoritesOnly: kind === 'favorites',
      personalOnly: kind === 'personal',
      collectionId: id,
    });
    useUiStore.getState().setTab('explore');
  }
  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const collection = editing
      ? { ...editing, name: trimmed, updatedAt: now }
      : {
          id: `collection:${crypto.randomUUID()}`,
          name: trimmed,
          placeIds: [],
          createdAt: now,
          updatedAt: now,
        };
    if (
      await saveLocal(() =>
        editing
          ? atlasRepository.renameCollection(editing.id, trimmed)
          : atlasRepository.saveCollection(collection),
      )
    ) {
      setName('');
      setEditing(null);
    }
  }
  return (
    <div className="library-view">
      <button className="library-row" onClick={() => show('favorites')}>
        <Star size={19} />
        <span>Favorites</span>
        <span>{favorites.length}</span>
      </button>
      <button className="library-row" onClick={() => show('personal')}>
        <Bookmark size={19} />
        <span>Personal markers</span>
        <span>{markers.length}</span>
      </button>
      <div className="section-label">
        Collections <span>{collections.length}</span>
      </div>
      <form
        className="collection-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="sr-only" htmlFor="collection-name">
          Collection name
        </label>
        <input
          id="collection-name"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={editing ? 'Rename collection' : 'New collection'}
          disabled={!ready}
        />
        <button
          className="icon-button"
          aria-label={editing ? 'Save collection name' : 'Create collection'}
          disabled={!name.trim() || !ready}
        >
          {editing ? <Check size={18} /> : <Plus size={18} />}
        </button>
      </form>
      {editing && (
        <button
          className="text-button"
          onClick={() => {
            setEditing(null);
            setName('');
          }}
        >
          Cancel rename
        </button>
      )}
      {!collections.length && (
        <p className="empty-state">
          Keep your next route, discoveries or photo spots together. Create a collection, then add
          places from their details.
        </p>
      )}
      {collections.map((c) => (
        <div className="collection-row" key={c.id}>
          <button className="collection-open" onClick={() => show('all', c.id)}>
            <Bookmark size={17} />
            <span>
              {c.name}
              <small>{c.placeIds.length} places</small>
            </span>
          </button>
          <button
            className="icon-button"
            aria-label={`Rename ${c.name}`}
            onClick={() => {
              setEditing(c);
              setName(c.name);
            }}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-button danger"
            aria-label={`Delete ${c.name}`}
            onClick={() => setDeleting(c.id)}
          >
            <Trash2 size={15} />
          </button>
          {deleting === c.id && (
            <div className="delete-confirm">
              <span>Delete this collection? Places and notes are kept.</span>
              <button
                className="text-button danger"
                onClick={async () => {
                  if (await saveLocal(() => atlasRepository.deleteCollection(c.id))) {
                    setDeleting(null);
                    if (filters.collectionId === c.id)
                      useUiStore.getState().setFilters({ collectionId: null });
                  }
                }}
              >
                Delete collection
              </button>
              <button className="text-button" onClick={() => setDeleting(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
