import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  GTADB_LICENSE_URL,
  GTADB_PINNED_DATA_URL,
  GTADB_PREFERRED_SOURCE,
  GTADB_REVISION,
  GTADB_SOURCE,
} from '../street-leonida/gtadb';
import { projectPath, publicPath } from '../explorer/public-path';
import { LEONIDA_ATLAS_RELEASES } from '../street-leonida/releases';
import './project.css';

export interface ProjectPageProps {
  page: string;
  onClose: () => void;
}

const pages = [
  ['about', 'About the atlas'],
  ['documentation', 'Documentation'],
  ['credits', 'Credits & sources'],
  ['contributing', 'Contributing'],
  ['changelog', 'Changelog'],
  ['licenses', 'Licenses'],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="project-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function About() {
  return (
    <>
      <p className="project-lead">
        An independent atlas that makes GTA VI location evidence legible, explorable and honest
        about its limits.
      </p>
      <Section title="Why this exists">
        <p>
          Public trailers, screenshots, official pages and community research reveal fragments of
          Leonida. The atlas gives those fragments a shared frame so readers can inspect
          relationships without mistaking an estimate for confirmed geography.
        </p>
        <p>
          This is a community project, not an official map, a leaked game asset or a promise that
          every road and landmark will appear in the released game.
        </p>
      </Section>
      <Section title="What approximate means">
        <p>
          Community-derived coastlines, routes and positions can change when better evidence
          arrives. Uncertainty stays visible; unsupported areas remain unknown instead of being
          completed by guesswork.
        </p>
      </Section>
      <Section title="Your own atlas">
        <p>
          Explore the bundled map as a guest, keep favorites and notes, organize collections and add
          personal markers. Your edits live in this browser’s IndexedDB storage. Export a backup to
          keep a portable copy or move your work between browsers.
        </p>
        <p>
          Personal annotations are separate from the source catalogue. They never turn a community
          estimate into a confirmed location.
        </p>
      </Section>
      <Section title="Independent by design">
        <p>
          The public application builds as static files and runs without a CMS, private server or
          account. Its source code is licensed under AGPL-3.0-only. The optional 3D explorer uses
          the same community coordinate frame.
        </p>
      </Section>
    </>
  );
}

function Documentation() {
  return (
    <>
      <p className="project-lead">
        How source records, evidence labels and local work fit together.
      </p>
      <Section title="Explore and organize">
        <p>
          Search by name, tag or source identifier. Use layers and filters to narrow the map, then
          select a place to inspect its source, coordinates and uncertainty. Save a favorite, add a
          note or include it in a collection.
        </p>
        <p>
          Personal markers describe your own observations. Their positions use the same
          game-coordinate frame as the catalogue. They remain clearly identified as personal data.
        </p>
      </Section>
      <Section title="Shared coordinates">
        <p>
          The coordinate plane represents Leonida game units, never real-world latitude and
          longitude. The calibrated transform is <code>world x = GTADB x × 2</code> and{' '}
          <code>world z = −GTADB y × 2</code>. The legacy SVG map uses that world z value for its
          vertical axis. The main atlas and 3D reconstruction stay aligned with the same source
          records.
        </p>
        <p>
          Missing coordinates remain missing; zero is a valid coordinate and is never a substitute
          for unknown placement. Real-world analogue coordinates are provenance only.
        </p>
      </Section>
      <Section title="Evidence and uncertainty">
        <dl className="project-definitions">
          <dt>CONFIRMED</dt>
          <dd>
            Official visual identity or existence supported by Rockstar media; this does not confirm
            a community-mapped position.
          </dd>
          <dt>SUPPORTED</dt>
          <dd>A community identification with usable source context.</dd>
          <dt>APPROXIMATE</dt>
          <dd>Community-estimated position, generalized cartography or reconstructed geometry.</dd>
          <dt>UNKNOWN</dt>
          <dd>Unknown names, absent coverage, missing positions or source-flagged uncertainty.</dd>
        </dl>
        <p>
          Source flags such as unconfirmed, may not exist, cancelled, fictional, demolished and
          duplicate are retained. They are not interchangeable confidence scores.
        </p>
      </Section>
      <Section title="Cartography">
        <p>
          The basemap derives from pinned Yanis v16 GTADB raster tiles. Land, water, vegetation,
          roads and building marks are generalized and recolored. Landmark proximity is never used
          to invent roads. The coastline halo is decorative, not bathymetry, and land shading is not
          a validated elevation measurement.
        </p>
        <p>
          Legend and screenshot columns are excluded. Unmapped margins represent absent source
          coverage, not evidence of sea. Source annotations may leave residual marks where their
          colors cannot be separated reliably from road detail.
        </p>
      </Section>
      <Section title="Local data and backups">
        <p>
          Favorites, notes, collections, markers and preferences are stored locally in IndexedDB. A
          successful save depends on browser storage being available. Clearing site data removes
          those local records; private browsing and storage limits can affect persistence.
        </p>
        <p>
          Use export to save a versioned JSON backup. Import validates its contents and presents a
          preview before merging with existing data. A backup contains personal notes and markers,
          so share it deliberately.
        </p>
      </Section>
      <Section title="Optional 3D explorer">
        <p>
          The 3D view loads only when opened. Move with WASD or arrow keys, hold Shift to run, click
          the scene for mouse look, press E to inspect nearby evidence and M to open its travel map.
          Escape releases the pointer. Touch users have an analog movement pad, look pad and button
          controls.
        </p>
        <p>
          A deliberate tap on the travel map moves to that coordinate. Panning, pinching and
          cancelled gestures do not trigger travel. Collision-safe arrival adjustments are
          disclosed. If WebGL is unavailable, the main atlas and your saved work remain available.
        </p>
      </Section>
    </>
  );
}

function Credits() {
  return (
    <>
      <p className="project-lead">
        Community cartography and official references keep their own sources and rights.
      </p>
      <Section title="GTADB / Map GTA">
        <p>
          GTA VI Landmarks Data and GTA VI Map Tiles are provided by{' '}
          <a href={GTADB_PREFERRED_SOURCE} target="_blank" rel="noreferrer">
            GTADB / Map GTA
          </a>{' '}
          and its contributors. Community map artwork is Yanis v16, distributed through GTADB.
        </p>
        <p>
          The pinned revision is <code className="project-revision">{GTADB_REVISION}</code>. The
          catalogue contains 2,198 records: 2,091 positioned records and 107 without coordinates.
        </p>
        <p>
          <a href={`${GTADB_SOURCE}/tree/${GTADB_REVISION}/maps`} target="_blank" rel="noreferrer">
            Pinned map source
          </a>{' '}
          ·{' '}
          <a href={GTADB_PINNED_DATA_URL} target="_blank" rel="noreferrer">
            Pinned landmark source
          </a>{' '}
          ·{' '}
          <a href={GTADB_LICENSE_URL} rel="license noreferrer" target="_blank">
            Creative Commons Attribution 4.0 International
          </a>
          .
        </p>
        <p>
          Our presentation recolors and generalizes source pixels, excludes non-geographic legend
          and screenshot areas, and adds decorative coast emphasis. The water halo is not
          bathymetry. No source-author endorsement is implied.
        </p>
        <p>
          <a href={publicPath('assets/gta6-leonida-atlas/ATTRIBUTION.md')}>
            Complete basemap attribution
          </a>{' '}
          · <a href={publicPath('assets/gta6-leonida-atlas/metadata.json')}>Generation manifest</a>.
        </p>
      </Section>
      <Section title="Rockstar Games references">
        <p>
          Official Rockstar trailers, screenshots and webpages inform visual identity and existence.
          They do not establish the precision of community placement. A source citation does not
          grant a reuse license.
        </p>
        <p>
          Grand Theft Auto, GTA, Rockstar Games, their marks and official media belong to their
          respective rights holders. This independent project is not affiliated with, endorsed by or
          sponsored by Rockstar Games or Take-Two Interactive.
        </p>
        <p>
          <a href="https://www.rockstargames.com/VI" target="_blank" rel="noreferrer">
            Official Grand Theft Auto VI website
          </a>
          .
        </p>
      </Section>
      <Section title="Visual direction and reconstruction">
        <p>
          An illustrated map informed the original hierarchy, restrained linework and broad color
          language only; its coastline, labels and geometry were not reused. Procedural geometry and
          generated material or vegetation studies are reconstruction assets, not extracted GTA VI
          game assets. Their rights status remains separate from the CC BY 4.0 map data.
        </p>
      </Section>
      <Section title="Built with">
        <p>
          React and TypeScript provide the application, Vite builds static files, Leaflet provides
          the main map interactions, Dexie handles IndexedDB storage, and Three.js renders the
          optional reconstruction. The travel map retains its native SVG coordinate layer. Interface
          typography uses Inter and Oswald. Dependencies retain their own licenses.
        </p>
      </Section>
    </>
  );
}

function Contributing() {
  return (
    <>
      <p className="project-lead">
        Make evidence easier to inspect, without overstating what it proves.
      </p>
      <Section title="Evidence contributions">
        <p>
          A useful correction includes the proposed place or viewpoint, a stable public source URL,
          its publisher, what the source visibly establishes and an evidence level that matches the
          claim. Proximity, memory or repeated community lore alone are not enough.
        </p>
        <ul>
          <li>Separate an official appearance reference from community-estimated placement.</li>
          <li>Keep missing coordinates unknown; never substitute zero.</li>
          <li>Do not infer roads, boundaries or names from neighboring landmarks.</li>
          <li>Include attribution and rights information for contributed material.</li>
          <li>Retain source identifiers and explain changes to imported records.</li>
        </ul>
      </Section>
      <Section title="Code contributions and forks">
        <p>
          Use the contribution instructions and issue tracker in the repository or fork you are
          working with. Include a focused description, expected behavior and relevant verification.
          Coordinate transforms, evidence labels and the separation between source data and personal
          edits must remain intact.
        </p>
        <p>
          The public application should build and run as a guest without private credentials. Keep
          credentials and local configuration out of source changes. Optional integrations must
          remain explicit and independently configurable.
        </p>
      </Section>
      <Section title="Personal annotations">
        <p>
          Local notes and markers are a useful place to collect observations before proposing a
          source correction. Exporting a backup shares those annotations; it does not submit them to
          the project or publish a change to the source catalogue.
        </p>
      </Section>
    </>
  );
}

function Changelog() {
  return (
    <>
      <p className="project-lead">The current release of the standalone Leonida Atlas.</p>
      {LEONIDA_ATLAS_RELEASES.map((release) => (
        <Section key={release.version} title={release.title}>
          <p className="project-release-version">
            {release.version} ·{' '}
            <time dateTime={release.date}>
              {new Date(`${release.date}T00:00:00Z`).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </time>{' '}
            · {release.status === 'public' ? 'Released' : 'In preparation'}
          </p>
          <p>{release.summary}</p>
          <h3>What is included</h3>
          <ul>
            {release.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Verification</h3>
          <ul>
            {release.verification.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ))}
      <p>
        Detailed verification scope and browser limitations are recorded in the repository’s release
        documentation.
      </p>
    </>
  );
}

function Licenses() {
  return (
    <>
      <p className="project-lead">
        Project code, community data and third-party references have separate rights.
      </p>
      <Section title="Project code">
        <p>
          Original GTA6 Leonida Atlas source code in this repository is licensed under the GNU
          Affero General Public License v3.0 only (<code>AGPL-3.0-only</code>). The repository’s
          LICENSE contains the full terms. See THIRD_PARTY_LICENSES.md for third-party notices.
        </p>
      </Section>
      <Section title="GTADB-derived data and cartography">
        <p>
          GTADB landmark data and Yanis v16 cartographic source material remain under{' '}
          <a href={GTADB_LICENSE_URL} rel="license noreferrer" target="_blank">
            Creative Commons Attribution 4.0 International
          </a>
          . Retain attribution to GTADB and its contributors, link to the license and identify
          adaptations.
        </p>
        <p>
          Adaptations include coordinate transforms, filtering, rendering windows, generalized and
          recolored basemap presentation, and derived metadata. The{' '}
          <a href={projectPath('credits')}>credits page</a> identifies the pinned source and local
          generation manifest.
        </p>
        <p>
          Any code copied directly from GTADB remains subject to its original MIT license and
          copyright notices where applicable.
        </p>
      </Section>
      <Section title="Rockstar and other third-party material">
        <p>
          Rockstar Games material is cited as reference evidence and remains the property of its
          rights holders. It is not licensed with this project’s code or the cartographic layer. A
          citation does not grant reuse rights. Other third-party assets retain their owners’ stated
          licenses.
        </p>
        <p>
          Procedural and generated reconstruction studies are distinct from the GTADB source data.
          Consult the repository’s asset notices for their reuse status.
        </p>
      </Section>
    </>
  );
}

const content: Record<string, () => ReactNode> = {
  about: About,
  documentation: Documentation,
  credits: Credits,
  contributing: Contributing,
  changelog: Changelog,
  licenses: Licenses,
};

export default function ProjectPage({ page, onClose }: ProjectPageProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const selected = content[page] ? page : 'about';
  const Content = content[selected]!;
  const title = pages.find(([key]) => key === selected)![1];
  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [onClose]);
  return (
    <main className="project-page" aria-label={title}>
      <header className="project-header">
        <a href={publicPath('')} className="project-brand">
          LEONIDA <span>ATLAS</span>
        </a>
        <button ref={closeRef} type="button" onClick={onClose}>
          Back to the atlas
        </button>
      </header>
      <div className="project-layout">
        <nav className="project-navigation" aria-label="Project pages">
          {pages.map(([key, label]) => (
            <a
              key={key}
              href={projectPath(key)}
              aria-current={selected === key ? 'page' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <article className="project-article">
          <p className="project-eyebrow">GTA6 LEONIDA ATLAS · INDEPENDENT COMMUNITY PROJECT</p>
          <h1>{title}</h1>
          <Content />
          <footer>Community-estimated geography · Not an official Rockstar map</footer>
        </article>
      </div>
    </main>
  );
}
