import { useEffect, useRef, useState } from 'react';
import type { Place } from '../../domain/types';
import { getLocalStreetPlaces, getLocalStreetViewpoints } from '../street-leonida/page-data';
import {
  GTADB_LICENSE_URL,
  GTADB_PINNED_DATA_URL,
  GTADB_PREFERRED_SOURCE,
  GTADB_REVISION,
} from '../street-leonida/gtadb';
import { mountExplorer } from './mount-explorer';
import { projectPath } from './public-path';
import { resolveExplorerEntry } from './initial-entry';
import './explorer.css';

export interface ExplorerViewProps {
  onClose: () => void;
  initialPlace?: Place | null;
  requestedPlaceId?: string | null;
}

const regions = getLocalStreetPlaces().items;
const scenes = getLocalStreetViewpoints().items.map((viewpoint) => ({
  slug: viewpoint.slug,
  title: viewpoint.title,
  placeName: viewpoint.place.name,
  placeSlug: viewpoint.place.slug,
  description: viewpoint.visualDescription,
  image: viewpoint.media.image ?? viewpoint.media.video?.poster ?? null,
  source: viewpoint.source,
  labels: viewpoint.labels,
}));

function Attribution() {
  return (
    <p className="explorer-attribution">
      <strong>APPROXIMATE</strong> · Community reconstruction ·{' '}
      <a href={GTADB_PREFERRED_SOURCE} target="_blank" rel="noreferrer">
        GTADB / Map GTA
      </a>{' '}
      ·{' '}
      <a href={GTADB_LICENSE_URL} target="_blank" rel="noreferrer">
        CC BY 4.0
      </a>{' '}
      ·{' '}
      <a href={GTADB_PINNED_DATA_URL} target="_blank" rel="noreferrer">
        {GTADB_REVISION.slice(0, 7)}
      </a>
    </p>
  );
}

/** Maintained DOM contract for the existing imperative Three.js reconstruction. */
export default function ExplorerView({
  onClose,
  initialPlace,
  requestedPlaceId,
}: ExplorerViewProps) {
  const worldRef = useRef<HTMLElement>(null);
  const entry = resolveExplorerEntry(initialPlace);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  useEffect(() => {
    if (destinationsOpen)
      worldRef.current?.querySelector<HTMLInputElement>('[data-walk-map-search]')?.focus();
  }, [destinationsOpen]);
  useEffect(() => {
    const root = worldRef.current;
    if (!root) return;
    const previousFocus = document.activeElement;
    const dispose = mountExplorer(root);
    return () => {
      dispose();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <section
      className="explorer-view"
      data-street-shell=""
      data-atlas-standalone="true"
      aria-label="Optional 3D explorer"
    >
      <section
        ref={worldRef}
        className="explorer-world"
        data-walk-world=""
        data-atlas-standalone="true"
        data-walk-active="false"
        data-walk-ready="false"
        data-initial-place={entry.regionSlug}
        data-initial-scene={Math.max(
          0,
          scenes.findIndex((scene) => scene.placeSlug === entry.regionSlug),
        )}
        data-initial-destination={entry.destination ? JSON.stringify(entry.destination) : undefined}
        data-player-position={`${entry.position.x},${entry.position.z}`}
        data-scenes={JSON.stringify(scenes)}
      >
        <canvas
          data-walk-canvas=""
          tabIndex={-1}
          aria-label="Three-dimensional community reconstruction of Leonida"
        />
        <header className="explorer-toolbar">
          <div>
            <span className="explorer-kicker">COMMUNITY RECONSTRUCTION</span>
            <h1>Explore Leonida</h1>
          </div>
          <nav aria-label="Explorer tools">
            <button type="button" data-start-walking="">
              Resume walking
            </button>
            <button type="button" data-open-walk-map="">
              Travel map <kbd>M</kbd>
            </button>
            <button type="button" data-open-walk-evidence="">
              Evidence
            </button>
            <button type="button" onClick={onClose}>
              Back to atlas
            </button>
          </nav>
        </header>
        <div className="explorer-loading" data-walk-loading="" role="status">
          Building Leonida…
        </div>
        <div className="explorer-unavailable" data-walk-unsupported="" role="status" hidden>
          <h2>3D view unavailable</h2>
          <p>The renderer could not start. Your local atlas and saved work remain available.</p>
          <button type="button" onClick={onClose}>
            Return to the atlas
          </button>
          <button type="button" data-open-walk-evidence="">
            Read source notes
          </button>
        </div>
        <div className="explorer-hud" data-walk-hud="">
          <strong data-walk-zone="">{entry.regionName}</strong>
          <span data-walk-zone-detail="">Approximate community reconstruction</span>
          <small data-walk-hud-coordinates="">GTADB frame</small>
          <b data-walk-heading="">N</b>
        </div>
        <p
          className="explorer-arrival"
          data-atlas-arrival-notice=""
          role="status"
          aria-live="polite"
          hidden={(!initialPlace && !requestedPlaceId) || Boolean(entry.destination)}
        >
          {initialPlace && !entry.destination
            ? `${initialPlace.title} has no mapped position. The explorer starts in Vice City.`
            : requestedPlaceId && !initialPlace
              ? 'The selected place is unavailable in this browser. The explorer starts in Vice City.'
              : ''}
        </p>
        <div className="explorer-zoom" aria-label="Camera zoom">
          <button type="button" data-walk-zoom-in="" aria-label="Zoom camera in">
            +
          </button>
          <output data-walk-zoom-value="">100%</output>
          <button type="button" data-walk-zoom-out="" aria-label="Zoom camera out">
            −
          </button>
        </div>
        <p className="explorer-controls-hint">
          <kbd>WASD</kbd> move · <kbd>Shift</kbd> run · <kbd>E</kbd> explore
        </p>
        <p className="explorer-lock-hint" data-walk-lock-hint="" hidden>
          Click the scene to look around. Esc releases the pointer.
        </p>
        <button className="explorer-prompt" type="button" data-walk-prompt="" hidden>
          <kbd>E</kbd> Explore <span data-walk-prompt-title="" />
        </button>
        <div
          className="explorer-touch"
          data-walk-mobile-controls=""
          role="group"
          aria-label="Touch movement controls"
        >
          <div data-walk-joystick="" role="group" aria-label="Analog movement">
            <span data-walk-joystick-knob="" aria-hidden="true" />
            <small>MOVE</small>
          </div>
          <div data-walk-look-pad="" role="group" aria-label="Drag to look around">
            <small>DRAG TO LOOK</small>
          </div>
          <button type="button" data-walk-interact="" disabled>
            Explore
          </button>
        </div>
        <details className="explorer-buttons" data-walk-button-controls="">
          <summary>Button controls</summary>
          <div role="group" aria-label="Movement buttons">
            {(['forward', 'left', 'backward', 'right'] as const).map((direction, i) => (
              <button
                key={direction}
                type="button"
                data-walk-move-button={direction}
                aria-label={`Move ${direction}`}
              >
                {['↑', '←', '↓', '→'][i]}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Look buttons">
            {(['up', 'left', 'down', 'right'] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                data-walk-look-button={direction}
                aria-label={`Look ${direction}`}
              >
                Look {direction}
              </button>
            ))}
          </div>
        </details>
        <footer className="explorer-footer">
          <Attribution />
        </footer>

        <dialog
          className="explorer-dialog explorer-map"
          data-walk-map=""
          data-destinations-open={String(destinationsOpen)}
          aria-labelledby="explorer-map-title"
        >
          <header>
            <div>
              <span className="explorer-kicker">3D TRAVEL</span>
              <h2 id="explorer-map-title">Choose a destination</h2>
            </div>
            <div className="explorer-map-header-actions">
              <button
                className="explorer-destinations-toggle"
                type="button"
                aria-controls="explorer-destinations"
                aria-expanded={destinationsOpen}
                onClick={() => setDestinationsOpen(!destinationsOpen)}
              >
                Destinations
              </button>
              <button type="button" data-close-walk-map="">
                Back to 3D
              </button>
            </div>
          </header>
          <div className="explorer-map-body">
            <div className="explorer-map-drawing">
              <div className="explorer-map-viewport" data-walk-map-viewport="">
                <svg
                  data-walk-map-svg=""
                  role="group"
                  aria-label="Interactive community evidence map"
                />
              </div>
              <div className="explorer-map-tools" aria-label="Travel map controls">
                <button type="button" data-walk-map-zoom-in="" aria-label="Zoom map in">
                  +
                </button>
                <output data-walk-map-zoom-value="">100%</output>
                <button type="button" data-walk-map-zoom-out="" aria-label="Zoom map out">
                  −
                </button>
                <button type="button" data-walk-map-zoom-reset="">
                  Fit
                </button>
                <button type="button" data-walk-map-center-player="">
                  My position
                </button>
              </div>
              <div className="explorer-map-pose">
                <strong data-walk-map-live-region="">{entry.regionName}</strong>
                <span data-walk-map-live-heading="">N</span>
                <span data-walk-map-live-gtadb="">GTADB frame</span>
                <span data-walk-map-live-world="" />
                <small data-walk-map-live-evidence="">APPROXIMATE</small>
              </div>
            </div>
            <aside
              id="explorer-destinations"
              className="explorer-destinations"
              aria-label="Travel destinations"
            >
              <button
                className="explorer-destinations-close"
                type="button"
                onClick={() => {
                  setDestinationsOpen(false);
                  worldRef.current
                    ?.querySelector<HTMLButtonElement>('.explorer-destinations-toggle')
                    ?.focus();
                }}
              >
                Close destinations
              </button>
              <p data-walk-map-fallback-note="" role="status" hidden>
                3D travel is unavailable; evidence browsing remains available.
              </p>
              <label>
                Search the catalogue
                <input
                  type="search"
                  data-walk-map-search=""
                  aria-label="Search GTADB places"
                  placeholder="Place, tag or marker ID…"
                  autoComplete="off"
                />
              </label>
              <details open>
                <summary>Six documented regions</summary>
                <div className="explorer-regions">
                  {regions.map((region) => (
                    <button key={region.slug} type="button" data-walk-region={region.slug}>
                      {region.name}
                      <small>APPROXIMATE</small>
                    </button>
                  ))}
                </div>
              </details>
              <div className="explorer-layer-toggles" aria-label="Evidence visibility">
                <button type="button" data-walk-map-layer-toggle="supported" aria-pressed="true">
                  <span data-walk-map-toggle-state="">Hide</span> named evidence
                </button>
                <button type="button" data-walk-map-layer-toggle="uncertain" aria-pressed="false">
                  <span data-walk-map-toggle-state="">Show</span> uncertain entries
                </button>
              </div>
              <output data-walk-map-search-summary="" aria-live="polite">
                Loading local catalogue…
              </output>
              <button type="button" data-walk-map-search-clear="" hidden>
                Clear
              </button>
              <div
                className="explorer-search-results"
                data-walk-map-search-results=""
                aria-label="GTADB search results"
              />
              <p data-walk-map-caveat="">
                Tap a point to travel. Drag to pan; scroll or pinch to zoom. Unpositioned records
                remain searchable.
              </p>
              <a href={projectPath('credits')}>Sources and credits</a>
            </aside>
          </div>
          <footer>
            <Attribution />
          </footer>
        </dialog>

        <dialog
          className="explorer-dialog explorer-evidence"
          data-walk-evidence-dialog=""
          aria-labelledby="explorer-evidence-title"
        >
          <header>
            <h2 id="explorer-evidence-title">What is known</h2>
            <button type="button" data-close-walk-evidence="">
              Close
            </button>
          </header>
          <div className="explorer-dialog-copy">
            <p>
              Rockstar visual evidence can establish official identity or existence. GTADB / Map GTA
              supplies community-estimated placement. Geometry between evidence points is an
              editorial reconstruction.
            </p>
            <dl>
              <dt>CONFIRMED</dt>
              <dd>Official visual identity or existence shown or named by Rockstar.</dd>
              <dt>SUPPORTED</dt>
              <dd>Community identification with compatible source context.</dd>
              <dt>APPROXIMATE</dt>
              <dd>Community-estimated placement or reconstructed geometry.</dd>
              <dt>UNKNOWN</dt>
              <dd>
                Missing names, missing coverage and source flags remain visible as uncertainty; they
                do not become confirmed geography.
              </dd>
            </dl>
            <p>
              Procedural geometry and generated material or vegetation studies are reconstruction
              assets, not extracted GTA VI game assets.
            </p>
            <a
              href="https://www.rockstargames.com/VI/media/screenshots"
              target="_blank"
              rel="noreferrer"
            >
              Rockstar visual references
            </a>
            <Attribution />
            <p>
              Not affiliated with, endorsed by or sponsored by Rockstar Games or Take-Two
              Interactive.
            </p>
          </div>
        </dialog>
        <dialog
          className="explorer-dialog explorer-scene"
          data-walk-scene-dialog=""
          aria-labelledby="explorer-scene-title"
        >
          <header>
            <h2 id="explorer-scene-title" data-walk-scene-title="">
              Documented scene
            </h2>
            <button type="button" data-close-walk-scene="">
              Close discovery
            </button>
          </header>
          <div className="explorer-dialog-copy">
            <img data-walk-scene-image="" alt="" hidden />
            <span data-walk-scene-evidence-label="">DOCUMENTED SOURCE EVIDENCE</span>
            <p>
              <span data-walk-scene-provenance="" /> · <strong data-walk-scene-place="" />
            </p>
            <p data-walk-scene-description="" />
            <p>
              Source identity and appearance are documented; nearby hotspot placement and
              interpolated geometry remain approximate.
            </p>
            <a href={projectPath('documentation')}>Read the methodology</a>
            {' · '}
            <a
              data-walk-scene-source=""
              href="https://www.rockstargames.com/VI"
              target="_blank"
              rel="noreferrer"
            >
              Open cited source
            </a>
          </div>
        </dialog>
      </section>
    </section>
  );
}
