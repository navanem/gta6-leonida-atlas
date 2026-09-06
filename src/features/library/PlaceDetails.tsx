import { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, ExternalLink, MapPin, Move, Pencil, Star, X } from 'lucide-react';
import type { Place } from '../../domain/types';
import { atlasRepository, ConflictError } from '../../db/repository';
import {
  saveLocal,
  useMapStore,
  usePersistenceStore,
  useUiStore,
  useUserStore,
} from '../../stores/atlas';
import { finishNoteSave, reconcileNoteDraft, type NoteDraft } from './note-draft';
import { getResearchForPlace } from '../street-leonida/leonida-research';
import RegionalResearch from './RegionalResearch';

export default function PlaceDetails({ place }: { place: Place }) {
  const favorite = useUserStore((s) => s.favorites.some((f) => f.placeId === place.id));
  const savedNote = useUserStore((s) => s.notes.find((n) => n.placeId === place.id)?.text ?? '');
  const savedRevision = useUserStore(
    (s) => s.notes.find((n) => n.placeId === place.id)?.updatedAt ?? null,
  );
  const collections = useUserStore((s) => s.collections);
  const ready = usePersistenceStore((s) => s.ready);
  const [draft, setDraft] = useState<NoteDraft>({
    text: savedNote,
    revision: savedRevision,
    dirty: false,
    conflict: false,
  });
  const [noteSaved, setNoteSaved] = useState(false);
  const saving = useRef(false);
  const [noteBusy, setNoteBusy] = useState(false);
  useEffect(() => {
    if (!saving.current)
      setDraft((current) => reconcileNoteDraft(current, savedNote, savedRevision));
  }, [savedNote, savedRevision]);
  const [copied, setCopied] = useState(false);
  const isPersonal = place.evidence === 'personal';
  const research = getResearchForPlace(place);
  async function saveNote() {
    if (saving.current || !draft.dirty || draft.conflict) return;
    saving.current = true;
    setNoteBusy(true);
    const captured = draft;
    let conflict = false;
    const ok = await saveLocal(async () => {
      try {
        await atlasRepository.saveNote(place.id, captured.text, captured.revision);
      } catch (error) {
        conflict = error instanceof ConflictError;
        throw error;
      }
    });
    saving.current = false;
    setNoteBusy(false);
    if (ok) {
      const persisted = useUserStore.getState().notes.find((n) => n.placeId === place.id);
      setDraft((current) =>
        finishNoteSave(current, captured, {
          text: persisted?.text ?? '',
          revision: persisted?.updatedAt ?? null,
        }),
      );
      setNoteSaved((persisted?.text ?? '') === (captured.text.trim() ? captured.text : ''));
    } else if (conflict) setDraft((current) => ({ ...current, conflict: true }));
  }
  async function addToCollection(id: string) {
    const collection = collections.find((c) => c.id === id);
    if (!collection) return;
    await saveLocal(() => atlasRepository.addCollectionPlace(collection.id, place.id));
  }
  async function share() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('place', place.id);
    try {
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <aside className="detail-panel" aria-label="Place details">
      <header className="panel-heading">
        <span className="eyebrow">{isPersonal ? 'PERSONAL PLACE' : 'PLACE DETAILS'}</span>
        <button
          className="icon-button"
          aria-label="Close place details"
          onClick={() => useMapStore.getState().select(null)}
        >
          <X size={20} />
        </button>
      </header>
      <div className="detail-scroll">
        <div className="place-title">
          <MapPin size={27} />
          <h2>{place.title}</h2>
        </div>
        <p className="evidence-label">
          {isPersonal
            ? 'Personal marker · on this device'
            : !place.position
              ? 'No mapped position'
              : place.evidence === 'uncertain'
                ? 'Uncertain entry · approximate placement'
                : 'Community placement · approximate'}
        </p>
        <button
          disabled={!ready}
          className={`button ${favorite ? 'selected' : ''}`}
          onClick={() => void saveLocal(() => atlasRepository.toggleFavorite(place.id))}
        >
          <Star size={18} fill={favorite ? 'currentColor' : 'none'} />
          {favorite ? 'Saved to favorites' : 'Add to favorites'}
        </button>
        {place.description && <p className="description">{place.description}</p>}
        <dl className="place-meta">
          <div>
            <dt>Category</dt>
            <dd>{place.category}</dd>
          </div>
          {place.region && (
            <div>
              <dt>Region</dt>
              <dd>{place.region}</dd>
            </div>
          )}
          {place.position && (
            <div>
              <dt>Game coordinates</dt>
              <dd>
                {place.position.x.toFixed(1)}, {place.position.y.toFixed(1)}
              </dd>
            </div>
          )}
        </dl>
        {place.tags.length > 0 && <p className="tags">{place.tags.join(' · ')}</p>}
        {place.source.url && (
          <a className="source-link" href={place.source.url} target="_blank" rel="noreferrer">
            {place.source.title}
            <ExternalLink size={13} />
          </a>
        )}
        {research && <RegionalResearch region={research.region.slug} />}
        <section className="detail-section">
          <label htmlFor="place-note">Notes</label>
          <textarea
            id="place-note"
            rows={5}
            maxLength={100000}
            value={draft.text}
            disabled={!ready}
            placeholder="Add notes about this place…"
            onChange={(e) => {
              const text = e.currentTarget.value;
              setDraft((current) => ({ ...current, text, dirty: true }));
              setNoteSaved(false);
            }}
            onBlur={() => {
              if (draft.dirty && ready) void saveNote();
            }}
          />
          <div className="row-between">
            <small>{draft.text.length.toLocaleString()} / 100,000</small>
            <button
              className="text-button"
              disabled={!ready || noteBusy || draft.conflict}
              onClick={() => void saveNote()}
            >
              {noteBusy ? (
                'Saving…'
              ) : noteSaved ? (
                <>
                  <Check size={14} />
                  Saved
                </>
              ) : (
                'Save note'
              )}
            </button>
          </div>
          {draft.conflict && (
            <div className="inline-error" role="alert">
              This note changed elsewhere or could not be saved. Your draft is preserved here. Copy
              it before loading the latest saved note.
              <button
                className="text-button"
                onClick={() => {
                  setDraft({
                    text: savedNote,
                    revision: savedRevision,
                    dirty: false,
                    conflict: false,
                  });
                  setNoteSaved(false);
                }}
              >
                Load saved note
              </button>
            </div>
          )}
        </section>
        <section className="detail-section">
          <label htmlFor="place-collection">Add to collection</label>
          <select
            id="place-collection"
            disabled={!ready || collections.length === 0}
            value=""
            onChange={(e) => void addToCollection(e.target.value)}
          >
            <option value="">
              {collections.length ? 'Select a collection…' : 'Create a collection in Saved'}
            </option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {collections
            .filter((c) => c.placeIds.includes(place.id))
            .map((c) => (
              <div className="membership" key={c.id}>
                <Bookmark size={14} />
                {c.name}
                <button
                  className="icon-button"
                  aria-label={`Remove from ${c.name}`}
                  onClick={() =>
                    void saveLocal(() => atlasRepository.removeCollectionPlace(c.id, place.id))
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
        </section>
        {isPersonal ? (
          <div className="button-row">
            <button
              className="button"
              disabled={!ready}
              onClick={() => useUiStore.getState().setEditorOpen(true)}
            >
              <Pencil size={16} />
              Edit marker
            </button>
            <button
              className="button"
              disabled={!ready}
              onClick={() => {
                useMapStore.getState().setEditor('move');
                useUiStore.getState().setSidebar(false);
              }}
            >
              <Move size={16} />
              Move
            </button>
          </div>
        ) : (
          <button className="text-button" onClick={() => void share()}>
            {copied ? 'Link copied' : 'Copy place link'}
          </button>
        )}
      </div>
    </aside>
  );
}
