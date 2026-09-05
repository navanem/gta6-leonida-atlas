import { publicPath } from '../explorer/public-path';
import {
  classifyGtadbEvidence,
  classifyGtadbUncertaintyReasons,
  getGtadbCatalogueStats,
  GTADB_ATTRIBUTION,
  GTADB_LICENSE,
  GTADB_LICENSE_URL,
  GTADB_PREFERRED_SOURCE,
  GTADB_PRESENTATION_NOTICE,
  GTADB_REVISION,
  GTADB_SNAPSHOT_SHA256,
  GTADB_SOURCE,
  isPositionedGtadbLandmark,
  type GtadbLandmark,
  type GtadbUncertaintyReason,
} from './gtadb';
import { gtadbToWorld, MAP_BOUNDS, worldToGtadb, worldToMap } from './leonida-coordinates';
import { getLeonidaZoneProfile, PLACE_ENTRY_VIEWS } from './walk-geography';
import { GTADB_MAP_MARKER_DOM_BUDGET, selectGtadbMarkerWindow } from './walk-map-marker-window';

export { GTADB_MAP_MARKER_DOM_BUDGET } from './walk-map-marker-window';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
export const GTADB_MAP_ASSET_URL =
  publicPath('assets/street-leonida/maps/gtadb-landmarks-7c3f8c2.json');

export interface GtadbMapSnapshotSource {
  readonly repository: string;
  readonly revision: string;
  readonly path: string;
  readonly rawUrl: string;
  readonly license: string;
  readonly preferredSource: string;
  readonly licenseUrl: string;
  readonly sha256: string;
  readonly presentation: string;
  readonly attribution: string;
}

export interface GtadbMapSnapshot {
  readonly source: GtadbMapSnapshotSource;
  readonly counts: {
    readonly recordCount: number;
    readonly positionedCount: number;
    readonly unpositionedCount: number;
    readonly knownNameCount: number;
    readonly unknownNameCount: number;
  };
  readonly landmarks: readonly GtadbLandmark[];
}

export interface GtadbMapRenderResult {
  readonly catalogueCount: number;
  readonly renderedCount: number;
  readonly supportedRenderedCount: number;
  readonly uncertainRenderedCount: number;
  readonly unpositionedCount: number;
}

export interface GtadbMapSearchResult {
  readonly items: readonly GtadbLandmark[];
  readonly totalMatches: number;
}

export interface GtadbSearchResultPresentation {
  readonly uncertainty: string;
  readonly status: string;
  readonly ariaLabel: string;
}

export type WalkMapTravelSource = 'gtadb' | 'region' | 'map';

export interface WalkMapTravelDetail {
  readonly x: number;
  readonly z: number;
  readonly label: string;
  readonly id: string;
  readonly source: WalkMapTravelSource;
}

export interface WalkMapPlayerPose {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

export interface WalkMapPoseDescription {
  readonly region: string;
  readonly heading: string;
  readonly world: string;
  readonly gtadb: string;
  readonly evidence: string;
}

export interface WalkMapViewBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WalkMapClientRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface WalkMapFreePointTapAssessment {
  readonly maxTravel: number;
  readonly cancelled: boolean;
  readonly hadMultiplePointers: boolean;
  readonly startedOnTravelTarget: boolean;
  readonly endedOnTravelTarget: boolean;
}

export interface WalkMapElements {
  readonly root: HTMLElement;
  readonly svg: SVGSVGElement;
  readonly viewport: Element | null;
  readonly world: SVGGraphicsElement | null;
  readonly player: SVGGraphicsElement | null;
  readonly heading: SVGGraphicsElement | null;
  readonly playerTitle: SVGTitleElement | null;
  readonly zoomIn: HTMLButtonElement | null;
  readonly zoomOut: HTMLButtonElement | null;
  readonly zoomReset: HTMLButtonElement | null;
  readonly centerPlayer: HTMLButtonElement | null;
  readonly zoomValue: HTMLElement | null;
  readonly liveRegion?: HTMLElement | null;
  readonly liveHeading?: HTMLElement | null;
  readonly liveWorld?: HTMLElement | null;
  readonly liveGtadb?: HTMLElement | null;
  readonly liveEvidence?: HTMLElement | null;
}

export interface WalkMapOptions {
  /** Replace stale or incomplete SVG content with the transformed community overview. */
  readonly renderMap?: boolean | 'if-missing';
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly zoomStep?: number;
  /** Optional world host whose data-player-x/z/yaw values should be observed. */
  readonly playerStateHost?: HTMLElement | null;
  readonly observePlayerDataset?: boolean;
  /** Leave the 1.7 MB / 2,091-marker catalogue unloaded until the atlas is opened. */
  readonly deferCatalogue?: boolean;
}

export interface WalkMapController {
  readonly updatePlayer: (pose: WalkMapPlayerPose) => void;
  readonly setZoom: (zoom: number, focalClientPoint?: { x: number; y: number }) => number;
  readonly zoomIn: () => number;
  readonly zoomOut: () => number;
  readonly resetView: () => void;
  readonly centerOnPlayer: () => void;
  readonly getZoom: () => number;
  readonly getViewBox: () => WalkMapViewBox;
  readonly loadCatalogue: () => Promise<GtadbMapRenderResult>;
  readonly dispose: () => void;
}

const DEFAULT_VIEW_BOX: WalkMapViewBox = {
  x: MAP_BOUNDS.minX,
  y: MAP_BOUNDS.minY,
  width: MAP_BOUNDS.width,
  height: MAP_BOUNDS.height,
};
const DEFAULT_MIN_ZOOM = 1;
const DEFAULT_MAX_ZOOM = 16;
const DEFAULT_ZOOM_STEP = 1.35;
const RECENTER_ZOOM = 4;
const FREE_POINT_TAP_MAX_TRAVEL_PX = 6;
const MIN_VIEW_BOX_SIZE = 0.001;
const GEOGRAPHIC_FIT_BOUNDS = {
  x: -22_000,
  y: -22_016,
  width: 30_000,
  height: 38_016,
} as const satisfies WalkMapViewBox;
const PLAYER_LABEL_EDGE_GUTTER_PX = 145;
const EMPTY_RENDER_RESULT: GtadbMapRenderResult = Object.freeze({
  catalogueCount: 0,
  renderedCount: 0,
  supportedRenderedCount: 0,
  uncertainRenderedCount: 0,
  unpositionedCount: 0,
});

let mapInstanceCount = 0;
const gtadbLayerLoads = new WeakMap<SVGSVGElement, Promise<GtadbMapRenderResult>>();
const gtadbLayerSnapshots = new WeakMap<SVGSVGElement, GtadbMapSnapshot>();
const gtadbLayerAbortControllers = new WeakMap<SVGSVGElement, AbortController>();

interface WalkMapNavigationState {
  readonly dialog: HTMLDialogElement;
  svg: SVGSVGElement;
  snapshot: GtadbMapSnapshot | null;
  readonly positionedDetails: Map<string, WalkMapTravelDetail>;
  dispose: () => void;
}

const mapNavigationStates = new WeakMap<HTMLDialogElement, WalkMapNavigationState>();

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function rectAspect(rect: WalkMapClientRect): number | null {
  if (![rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return rect.width / rect.height;
}

export function fitLeonidaAtlasViewBox(rect: WalkMapClientRect): WalkMapViewBox {
  const aspect = rectAspect(rect);
  if (aspect === null) return copyViewBox(DEFAULT_VIEW_BOX);
  const mobile = rect.width <= 767;
  if (!mobile) {
    const centerX = GEOGRAPHIC_FIT_BOUNDS.x + GEOGRAPHIC_FIT_BOUNDS.width / 2;
    return {
      x: centerX - (GEOGRAPHIC_FIT_BOUNDS.height * aspect) / 2,
      y: GEOGRAPHIC_FIT_BOUNDS.y,
      width: GEOGRAPHIC_FIT_BOUNDS.height * aspect,
      height: GEOGRAPHIC_FIT_BOUNDS.height,
    };
  }
  const topInset = Math.min(rect.height, mobile ? 140 : 100);
  const bottomInset = Math.min(Math.max(0, rect.height - topInset), mobile ? 180 : 80);
  const availableHeight = Math.max(1, rect.height - topInset - bottomInset);
  const scale = Math.min(
    rect.width / GEOGRAPHIC_FIT_BOUNDS.width,
    availableHeight / GEOGRAPHIC_FIT_BOUNDS.height,
  );
  const width = rect.width / scale;
  const height = rect.height / scale;
  const renderedCoverageWidth = GEOGRAPHIC_FIT_BOUNDS.width * scale;
  const renderedCoverageHeight = GEOGRAPHIC_FIT_BOUNDS.height * scale;
  const coverageLeft = (rect.width - renderedCoverageWidth) / 2;
  const coverageTop = topInset + (availableHeight - renderedCoverageHeight) / 2;
  return {
    x: GEOGRAPHIC_FIT_BOUNDS.x - coverageLeft / scale,
    y: GEOGRAPHIC_FIT_BOUNDS.y - coverageTop / scale,
    width,
    height,
  };
}

export const calculateWalkMapFitViewBox = fitLeonidaAtlasViewBox;

export function walkMapPlayerHorizontalEdge(
  pose: Readonly<{ x: number; z: number }>,
  viewBox: WalkMapViewBox,
  rect: WalkMapClientRect,
): 'right' | 'none' {
  const map = worldToMap(pose);
  const scale = renderedMapScale(viewBox, rect);
  if (scale === null) return 'none';
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;
  const contentLeft = rect.left + (rect.width - renderedWidth) / 2;
  const contentTop = rect.top + (rect.height - renderedHeight) / 2;
  const screenX = contentLeft + (map.x - viewBox.x) * scale;
  const screenY = contentTop + (map.y - viewBox.y) * scale;
  if (screenY < rect.top || screenY > rect.top + rect.height) return 'none';
  if (screenX > rect.left + rect.width - PLAYER_LABEL_EDGE_GUTTER_PX) return 'right';
  return 'none';
}

function renderedMapScale(viewBox: WalkMapViewBox, rect: WalkMapClientRect): number | null {
  if (
    ![
      viewBox.x,
      viewBox.y,
      viewBox.width,
      viewBox.height,
      rect.left,
      rect.top,
      rect.width,
      rect.height,
    ].every(Number.isFinite) ||
    viewBox.width <= MIN_VIEW_BOX_SIZE ||
    viewBox.height <= MIN_VIEW_BOX_SIZE ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return null;
  }
  const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height);
  return Number.isFinite(scale) && scale > 0 ? scale : null;
}

/** Map units represented by one rendered CSS pixel under the SVG's centered meet letterboxing. */
export function walkMapUnitsPerCssPixel(
  viewBox: WalkMapViewBox,
  rect: WalkMapClientRect,
): number | null {
  const scale = renderedMapScale(viewBox, rect);
  return scale === null ? null : 1 / scale;
}

/** Invert the rendered SVG point into the shared world X/Z frame, rejecting letterbox gutters. */
export function projectWalkMapClientPoint(
  point: Readonly<{ x: number; y: number }>,
  rect: WalkMapClientRect,
  viewBox: WalkMapViewBox,
): Readonly<{ x: number; z: number }> | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const scale = renderedMapScale(viewBox, rect);
  if (scale === null) return null;
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;
  const contentLeft = rect.left + (rect.width - renderedWidth) / 2;
  const contentTop = rect.top + (rect.height - renderedHeight) / 2;
  const contentRight = contentLeft + renderedWidth;
  const contentBottom = contentTop + renderedHeight;
  if (
    point.x < contentLeft ||
    point.x > contentRight ||
    point.y < contentTop ||
    point.y > contentBottom
  ) {
    return null;
  }
  const x = viewBox.x + (point.x - contentLeft) / scale;
  const z = viewBox.y + (point.y - contentTop) / scale;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    x < MAP_BOUNDS.minX ||
    x > MAP_BOUNDS.maxX ||
    z < MAP_BOUNDS.minY ||
    z > MAP_BOUNDS.maxY
  ) {
    return null;
  }
  return { x, z };
}

export function isWalkMapFreePointTap(assessment: WalkMapFreePointTapAssessment): boolean {
  return (
    Number.isFinite(assessment.maxTravel) &&
    assessment.maxTravel <= FREE_POINT_TAP_MAX_TRAVEL_PX &&
    !assessment.cancelled &&
    !assessment.hadMultiplePointers &&
    !assessment.startedOnTravelTarget &&
    !assessment.endedOnTravelTarget
  );
}

function coordinate(value: number): string {
  return Object.is(value, -0) ? '0' : String(value);
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.+-]+/g, ' ')
    .trim();
}

function landmarkLabel(landmark: GtadbLandmark): string {
  return landmark.inGameAddress.trim() || `Unnamed GTADB marker ${landmark.id}`;
}

const GTADB_UNCERTAINTY_LABELS: Readonly<Record<GtadbUncertaintyReason, string>> = {
  'unknown-name': 'unknown landmark name',
  unconfirmed: 'unconfirmed',
  'may-not-exist': 'may not exist',
  cancelled: 'cancelled',
  fictional: 'fictional',
  demolished: 'demolished',
  duplicate: 'duplicate record',
};

function landmarkUncertaintyReasons(
  landmark: Pick<GtadbLandmark, 'inGameAddress' | 'tags'>,
): readonly GtadbUncertaintyReason[] {
  return classifyGtadbUncertaintyReasons(landmark.inGameAddress, landmark.tags);
}

function uncertaintyReasonLabel(reasons: readonly GtadbUncertaintyReason[]): string {
  return reasons.map((reason) => GTADB_UNCERTAINTY_LABELS[reason]).join('; ');
}

function transformedTravelDetail(landmark: GtadbLandmark): WalkMapTravelDetail | null {
  if (!isPositionedGtadbLandmark(landmark)) return null;
  const world = gtadbToWorld(landmark.inGameCoordinates);
  return {
    x: world.x,
    z: world.z,
    label: landmarkLabel(landmark),
    id: landmark.id,
    source: 'gtadb',
  };
}

export function dispatchWalkMapTravel(
  mapDialog: HTMLDialogElement,
  detail: WalkMapTravelDetail,
): boolean {
  return mapDialog.dispatchEvent(
    new CustomEvent<WalkMapTravelDetail>('street-leonida:map-travel', {
      bubbles: true,
      detail,
    }),
  );
}

export function searchGtadbLandmarks(
  landmarks: readonly GtadbLandmark[],
  query: string,
  limit = 60,
): GtadbMapSearchResult {
  const terms = normalizeSearchValue(query).split(' ').filter(Boolean);
  const matches =
    terms.length === 0
      ? landmarks
      : landmarks.filter((landmark) => {
          const uncertaintyReasons = landmarkUncertaintyReasons(landmark);
          const haystack = normalizeSearchValue(
            [
              landmark.id,
              landmark.inGameAddress,
              landmark.confidence,
              landmark.color,
              ...landmark.tags,
              ...uncertaintyReasons,
              ...(uncertaintyReasons.length > 0 ? ['uncertain'] : []),
              ...(landmark.inGameCoordinates?.map(String) ?? []),
            ].join(' '),
          );
          return terms.every((term) => haystack.includes(term));
        });
  const safeLimit = Math.max(0, Math.floor(finite(limit, 60)));
  return { items: matches.slice(0, safeLimit), totalMatches: matches.length };
}

function gtadbMarkerMarkup(landmark: GtadbLandmark, focusable: boolean): string | null {
  const detail = transformedTravelDetail(landmark);
  if (!detail || !isPositionedGtadbLandmark(landmark)) return null;
  const map = worldToMap({ x: detail.x, z: detail.z });
  const id = escapeSvgText(landmark.id);
  const label = escapeSvgText(detail.label);
  const confidence = landmark.confidence;
  const nameEvidence = landmark.evidence.name;
  const uncertaintyReasons = landmarkUncertaintyReasons(landmark);
  const isUncertain = uncertaintyReasons.length > 0;
  const uncertainty = uncertaintyReasons.join(' ') || 'none';
  const fill = /^[0-9a-f]{6}$/i.test(landmark.color) ? `#${landmark.color}` : '#9adce5';
  const uncertaintyStatus = isUncertain
    ? `, uncertain GTADB entry: ${uncertaintyReasonLabel(uncertaintyReasons)}`
    : '';
  const tags = landmark.tags.length > 0 ? ` · tags: ${landmark.tags.join(', ')}` : '';
  const title = escapeSvgText(
    `${detail.label} · NAME ${nameEvidence} · UNCERTAINTY ${uncertaintyReasons.length > 0 ? uncertaintyReasons.join(', ') : 'NONE'} · PLACEMENT APPROXIMATE${tags} · source ${coordinate(landmark.inGameCoordinates[0])}, ${coordinate(landmark.inGameCoordinates[1])}`,
  );

  const markerColor = isUncertain ? '#f4bd64' : '#ff4fa3';
  return `<g data-gtadb-id="${id}" data-gtadb-confidence="${confidence}" data-gtadb-name="${nameEvidence}" data-gtadb-uncertainty="${uncertainty}" data-gtadb-transform="deterministic-pixel-aligned" data-gtadb-placement="APPROXIMATE" transform="translate(${coordinate(map.x)} ${coordinate(map.y)})" data-map-travel data-map-travel-source="gtadb" data-map-travel-id="${id}" data-map-travel-label="${label}" data-map-travel-x="${coordinate(detail.x)}" data-map-travel-z="${coordinate(detail.z)}" role="button" tabindex="${focusable ? '0' : '-1'}" aria-label="Travel to ${label}${uncertaintyStatus}, community reconstruction, approximate placement"><title>${title}</title><circle data-map-marker-hit r="150" fill="transparent" stroke="none"/><circle r="62" fill="${markerColor}" fill-opacity="${isUncertain ? '0.5' : '0.72'}" stroke="#f3fbff" stroke-opacity="0.62" stroke-width="1.1" vector-effect="non-scaling-stroke"/><circle r="23" fill="${fill}" fill-opacity="0.94"/></g>`;
}

function evidenceDensityMarkup(landmarks: readonly GtadbLandmark[]): string {
  const cellSize = 640;
  const bins = new Map<string, { x: number; y: number; count: number }>();
  let sourceCount = 0;
  for (const landmark of landmarks) {
    if (!isPositionedGtadbLandmark(landmark)) continue;
    sourceCount += 1;
    const world = gtadbToWorld(landmark.inGameCoordinates);
    const column = Math.floor((world.x - MAP_BOUNDS.minX) / cellSize);
    const row = Math.floor((world.z - MAP_BOUNDS.minY) / cellSize);
    const key = `${column}:${row}`;
    const current = bins.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    bins.set(key, {
      x: MAP_BOUNDS.minX + (column + 0.5) * cellSize,
      y: MAP_BOUNDS.minY + (row + 0.5) * cellSize,
      count: 1,
    });
  }
  const cells = [...bins.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, cell]) => {
      const radius = cellSize * 0.47;
      const halfHeight = radius * 0.866;
      const opacity = Math.min(0.42, 0.08 + Math.log2(cell.count + 1) * 0.055);
      const points = [
        [cell.x - radius, cell.y],
        [cell.x - radius / 2, cell.y - halfHeight],
        [cell.x + radius / 2, cell.y - halfHeight],
        [cell.x + radius, cell.y],
        [cell.x + radius / 2, cell.y + halfHeight],
        [cell.x - radius / 2, cell.y + halfHeight],
      ]
        .map(([x, y]) => `${coordinate(x ?? 0)},${coordinate(y ?? 0)}`)
        .join(' ');
      return `<polygon data-density-cell data-density-count="${cell.count}" points="${points}" fill="#50cfc3" fill-opacity="${opacity.toFixed(3)}" stroke="#86e8df" stroke-opacity="0.13" stroke-width="1" vector-effect="non-scaling-stroke"><title>${cell.count} transformed GTADB evidence point${cell.count === 1 ? '' : 's'} in this cell</title></polygon>`;
    })
    .join('');
  return `<g data-walk-map-evidence-density data-evidence="APPROXIMATE" data-density-source-count="${sourceCount}" aria-label="Density of transformed GTADB evidence points without listed uncertainty signals; not coastline geometry" pointer-events="none">${cells}</g>`;
}

export function renderGtadbLandmarkLayer(
  layer: SVGGraphicsElement,
  snapshot: GtadbMapSnapshot,
  viewBox: WalkMapViewBox = DEFAULT_VIEW_BOX,
): GtadbMapRenderResult {
  const supportedMarkers: string[] = [];
  const uncertainMarkers: string[] = [];
  const supportedDensityLandmarks: GtadbLandmark[] = [];
  let positionedCount = 0;
  let supportedCount = 0;
  let uncertainCount = 0;
  let hasSupportedTabStop = false;

  for (const landmark of snapshot.landmarks) {
    if (!isPositionedGtadbLandmark(landmark)) continue;
    positionedCount += 1;
    const hasUncertaintySignals = landmarkUncertaintyReasons(landmark).length > 0;
    if (!hasUncertaintySignals) {
      supportedCount += 1;
      supportedDensityLandmarks.push(landmark);
    } else {
      uncertainCount += 1;
    }
  }

  const markerWindow = selectGtadbMarkerWindow(
    snapshot.landmarks,
    viewBox,
    GTADB_MAP_MARKER_DOM_BUDGET,
  );
  for (const landmark of markerWindow) {
    const hasUncertaintySignals = landmarkUncertaintyReasons(landmark).length > 0;
    const marker = gtadbMarkerMarkup(landmark, !hasUncertaintySignals && !hasSupportedTabStop);
    if (!marker) continue;
    if (hasUncertaintySignals) uncertainMarkers.push(marker);
    else {
      supportedMarkers.push(marker);
      hasSupportedTabStop = true;
    }
  }

  const domMarkerCount = supportedMarkers.length + uncertainMarkers.length;
  const result: GtadbMapRenderResult = {
    catalogueCount: snapshot.landmarks.length,
    renderedCount: positionedCount,
    supportedRenderedCount: supportedCount,
    uncertainRenderedCount: uncertainCount,
    unpositionedCount: snapshot.landmarks.length - positionedCount,
  };
  const declaredCountsAreValid =
    snapshot.counts.recordCount === result.catalogueCount &&
    snapshot.counts.positionedCount === result.renderedCount &&
    snapshot.counts.unpositionedCount === result.unpositionedCount;

  layer.innerHTML = `${evidenceDensityMarkup(supportedDensityLandmarks)}<g data-walk-map-gtadb-supported data-layer-visible="true" aria-label="GTADB entries without uncertainty signals">${supportedMarkers.join('')}</g><g data-walk-map-gtadb-uncertain data-layer-visible="false" display="none" hidden aria-hidden="true" pointer-events="none" aria-label="Uncertain GTADB entries">${uncertainMarkers.join('')}</g>`;
  layer.setAttribute('data-gtadb-count', String(result.catalogueCount));
  layer.setAttribute('data-gtadb-rendered-count', String(result.renderedCount));
  layer.setAttribute('data-gtadb-supported-rendered-count', String(result.supportedRenderedCount));
  layer.setAttribute('data-gtadb-uncertain-rendered-count', String(result.uncertainRenderedCount));
  layer.setAttribute('data-gtadb-dom-marker-count', String(domMarkerCount));
  layer.setAttribute('data-gtadb-dom-marker-budget', String(GTADB_MAP_MARKER_DOM_BUDGET));
  layer.setAttribute('data-gtadb-unpositioned-count', String(result.unpositionedCount));
  layer.setAttribute('data-gtadb-declared-counts-valid', String(declaredCountsAreValid));
  layer.setAttribute('data-gtadb-source', snapshot.source.repository);
  layer.setAttribute('data-gtadb-preferred-source', snapshot.source.preferredSource);
  layer.setAttribute('data-gtadb-revision', snapshot.source.revision);
  layer.setAttribute('data-gtadb-license', snapshot.source.license);
  layer.setAttribute('data-gtadb-license-url', snapshot.source.licenseUrl);
  layer.setAttribute('data-gtadb-attribution', snapshot.source.attribution);
  layer.setAttribute('data-gtadb-caveat', GTADB_PRESENTATION_NOTICE);
  return result;
}

function isFinitePair(value: unknown): value is readonly [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  );
}

function isNullableFinitePair(value: unknown): value is readonly [number, number] | null {
  return value === null || isFinitePair(value);
}

function isGtadbLandmark(value: unknown): value is GtadbLandmark {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GtadbLandmark>;
  const hasValidSourceFields =
    typeof candidate.id === 'string' &&
    /^L\d+$/.test(candidate.id) &&
    typeof candidate.inGameAddress === 'string' &&
    isNullableFinitePair(candidate.inGameCoordinates) &&
    isNullableFinitePair(candidate.inGamePhotoSize) &&
    typeof candidate.realWorldAddress === 'string' &&
    isNullableFinitePair(candidate.realWorldCoordinates) &&
    isNullableFinitePair(candidate.realWorldPhotoSize) &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === 'string') &&
    typeof candidate.color === 'string' &&
    Array.isArray(candidate.editedAt) &&
    candidate.editedAt.length === 3 &&
    candidate.editedAt.every(
      (timestamp) => typeof timestamp === 'number' && Number.isFinite(timestamp),
    ) &&
    (candidate.confidence === 'SUPPORTED' || candidate.confidence === 'UNKNOWN');
  if (!hasValidSourceFields) return false;

  const expectedEvidence = classifyGtadbEvidence(
    candidate.inGameAddress!,
    candidate.inGameCoordinates!,
    candidate.tags!,
  );
  const evidence = candidate.evidence;
  if (!evidence) return false;
  return (
    evidence.name === expectedEvidence.name &&
    evidence.placement === expectedEvidence.placement &&
    Array.isArray(evidence.tagSignals?.levelTags) &&
    evidence.tagSignals.levelTags.length === expectedEvidence.tagSignals.levelTags.length &&
    evidence.tagSignals.levelTags.every(
      (tag, index) => tag === expectedEvidence.tagSignals.levelTags[index],
    ) &&
    evidence.tagSignals.unconfirmed === expectedEvidence.tagSignals.unconfirmed &&
    evidence.tagSignals.demolished === expectedEvidence.tagSignals.demolished &&
    candidate.confidence === (expectedEvidence.name === 'UNKNOWN' ? 'UNKNOWN' : 'SUPPORTED')
  );
}

function isGtadbMapSnapshot(value: unknown): value is GtadbMapSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GtadbMapSnapshot>;
  if (
    !candidate.source ||
    candidate.source.repository !== GTADB_SOURCE ||
    candidate.source.preferredSource !== GTADB_PREFERRED_SOURCE ||
    candidate.source.revision !== GTADB_REVISION ||
    candidate.source.license !== GTADB_LICENSE ||
    candidate.source.licenseUrl !== GTADB_LICENSE_URL ||
    candidate.source.sha256 !== GTADB_SNAPSHOT_SHA256 ||
    candidate.source.presentation !== GTADB_PRESENTATION_NOTICE ||
    candidate.source.attribution !== GTADB_ATTRIBUTION ||
    !candidate.counts ||
    !Array.isArray(candidate.landmarks) ||
    !candidate.landmarks.every(isGtadbLandmark)
  ) {
    return false;
  }
  const statistics = getGtadbCatalogueStats(candidate.landmarks);
  return (
    candidate.counts.recordCount === statistics.recordCount &&
    candidate.counts.positionedCount === statistics.positionedCount &&
    candidate.counts.unpositionedCount === statistics.unpositionedCount &&
    candidate.counts.knownNameCount === statistics.knownNameCount &&
    candidate.counts.unknownNameCount === statistics.unknownNameCount
  );
}

function exposeGtadbMetadata(
  svg: SVGSVGElement,
  snapshot: GtadbMapSnapshot,
  result: GtadbMapRenderResult,
): void {
  svg.setAttribute('data-walk-map-gtadb-count', String(result.catalogueCount));
  svg.setAttribute('data-walk-map-gtadb-rendered-count', String(result.renderedCount));
  svg.setAttribute('data-walk-map-gtadb-supported-count', String(result.supportedRenderedCount));
  svg.setAttribute('data-walk-map-gtadb-uncertain-count', String(result.uncertainRenderedCount));
  svg.setAttribute('data-walk-map-gtadb-unpositioned-count', String(result.unpositionedCount));
  svg.setAttribute('data-walk-map-gtadb-source', snapshot.source.repository);
  svg.setAttribute('data-walk-map-gtadb-preferred-source', snapshot.source.preferredSource);
  svg.setAttribute('data-walk-map-gtadb-revision', snapshot.source.revision);
  svg.setAttribute('data-walk-map-gtadb-license', snapshot.source.license);
  svg.setAttribute('data-walk-map-gtadb-license-url', snapshot.source.licenseUrl);
  svg.setAttribute('data-walk-map-gtadb-presentation', snapshot.source.presentation);
  svg.setAttribute('data-walk-map-gtadb-attribution', snapshot.source.attribution);
  const landmarkLayer = svg.querySelector<SVGGraphicsElement>('[data-walk-map-gtadb-locations]');
  const domMarkerCount = landmarkLayer?.getAttribute?.('data-gtadb-dom-marker-count') ?? '0';
  svg.setAttribute('data-walk-map-gtadb-dom-count', domMarkerCount);
  const mapRoot = svg.closest<HTMLElement>('[data-walk-map]');
  if (!mapRoot) return;
  mapRoot.dataset.walkMapGtadbCount = String(result.catalogueCount);
  mapRoot.dataset.walkMapGtadbRenderedCount = String(result.renderedCount);
  mapRoot.dataset.walkMapGtadbUnpositionedCount = String(result.unpositionedCount);
  mapRoot.dataset.walkMapGtadbDomCount = domMarkerCount;
  mapRoot.dataset.walkMapGtadbSource = snapshot.source.repository;
  mapRoot.dataset.walkMapGtadbPreferredSource = snapshot.source.preferredSource;
  mapRoot.dataset.walkMapGtadbRevision = snapshot.source.revision;
  mapRoot.dataset.walkMapGtadbLicense = snapshot.source.license;
  mapRoot.dataset.walkMapGtadbLicenseUrl = snapshot.source.licenseUrl;
  mapRoot.dataset.walkMapGtadbPresentation = snapshot.source.presentation;
  mapRoot.dataset.walkMapGtadbAttribution = snapshot.source.attribution;
  const count = mapRoot.querySelector<HTMLElement>(
    '[data-walk-gtadb-count], [data-walk-community-count]',
  );
  if (count) count.textContent = result.catalogueCount.toLocaleString('en-US');
  const renderedCount = mapRoot.querySelector<HTMLElement>(
    '[data-walk-gtadb-rendered-count], [data-walk-community-rendered-count]',
  );
  if (renderedCount) renderedCount.textContent = result.renderedCount.toLocaleString('en-US');
  const unpositionedCount = mapRoot.querySelector<HTMLElement>(
    '[data-walk-gtadb-unpositioned-count], [data-walk-community-unplaced-count]',
  );
  if (unpositionedCount) {
    unpositionedCount.textContent = result.unpositionedCount.toLocaleString('en-US');
  }
}

export function loadGtadbLandmarkLayer(
  svg: SVGSVGElement,
  fetchSnapshot: typeof fetch = globalThis.fetch,
): Promise<GtadbMapRenderResult> {
  const currentLoad = gtadbLayerLoads.get(svg);
  if (currentLoad) {
    const cachedSnapshot = gtadbLayerSnapshots.get(svg);
    if (cachedSnapshot) syncNavigationCatalogue(svg, cachedSnapshot);
    return currentLoad;
  }
  const layer = svg.querySelector<SVGGraphicsElement>('[data-walk-map-gtadb-locations]');
  if (!layer) return Promise.resolve(EMPTY_RENDER_RESULT);
  layer.setAttribute('data-gtadb-state', 'loading');
  layer.setAttribute('aria-busy', 'true');
  const abortController = new AbortController();
  gtadbLayerAbortControllers.set(svg, abortController);

  const load = (async (): Promise<GtadbMapRenderResult> => {
    try {
      const response = await fetchSnapshot(GTADB_MAP_ASSET_URL, {
        headers: { accept: 'application/json' },
        signal: abortController.signal,
      });
      if (!response.ok) throw new Error(`GTADB snapshot returned ${response.status}`);
      const snapshotJson: unknown = await response.json();
      if (abortController.signal.aborted) return EMPTY_RENDER_RESULT;
      if (!isGtadbMapSnapshot(snapshotJson)) throw new Error('Invalid pinned GTADB snapshot');
      gtadbLayerSnapshots.set(svg, snapshotJson);
      const result = renderGtadbLandmarkLayer(layer, snapshotJson, parseViewBox(svg));
      layer.setAttribute('data-gtadb-state', 'ready');
      layer.setAttribute('aria-busy', 'false');
      layer.removeAttribute?.('data-gtadb-error');
      exposeGtadbMetadata(svg, snapshotJson, result);
      syncNavigationCatalogue(svg, snapshotJson);
      return result;
    } catch (error) {
      gtadbLayerLoads.delete(svg);
      if (abortController.signal.aborted) {
        layer.setAttribute('data-gtadb-state', 'idle');
        layer.setAttribute('aria-busy', 'false');
        return EMPTY_RENDER_RESULT;
      }
      layer.setAttribute('data-gtadb-state', 'error');
      layer.setAttribute('aria-busy', 'false');
      layer.setAttribute(
        'data-gtadb-error',
        error instanceof Error ? error.message : 'Unable to load GTADB snapshot',
      );
      return EMPTY_RENDER_RESULT;
    } finally {
      if (gtadbLayerAbortControllers.get(svg) === abortController) {
        gtadbLayerAbortControllers.delete(svg);
      }
    }
  })();
  gtadbLayerLoads.set(svg, load);
  return load;
}

function travelDetailFromElement(element: Element): WalkMapTravelDetail | null {
  const x = Number.parseFloat(element.getAttribute('data-map-travel-x') ?? '');
  const z = Number.parseFloat(element.getAttribute('data-map-travel-z') ?? '');
  const label = element.getAttribute('data-map-travel-label')?.trim() ?? '';
  const id = element.getAttribute('data-map-travel-id')?.trim() ?? '';
  const source = element.getAttribute('data-map-travel-source');
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    !label ||
    !id ||
    (source !== 'gtadb' && source !== 'region' && source !== 'map')
  ) {
    return null;
  }
  return { x, z, label, id, source };
}

function applyTravelAttributes(element: HTMLElement, detail: WalkMapTravelDetail): void {
  element.setAttribute('data-map-travel', '');
  element.setAttribute('data-map-travel-source', detail.source);
  element.setAttribute('data-map-travel-id', detail.id);
  element.setAttribute('data-map-travel-label', detail.label);
  element.setAttribute('data-map-travel-x', coordinate(detail.x));
  element.setAttribute('data-map-travel-z', coordinate(detail.z));
}

export function getGtadbSearchResultPresentation(
  landmark: GtadbLandmark,
  positioned: boolean,
): GtadbSearchResultPresentation {
  const reasons = landmarkUncertaintyReasons(landmark);
  const placement = positioned ? 'approximate placement' : 'unpositioned';
  const uncertainty = reasons.join(' ') || 'none';
  const status =
    reasons.length > 0
      ? `UNCERTAIN · ${uncertaintyReasonLabel(reasons)} · ${placement}`
      : `DEFAULT LAYER · no listed uncertainty signals · ${placement}`;
  return {
    uncertainty,
    status,
    ariaLabel: `${landmarkLabel(landmark)} (${landmark.id}) · ${status}`,
  };
}

function renderGtadbSearchResults(state: WalkMapNavigationState): void {
  const { dialog, snapshot } = state;
  const input = dialog.querySelector<HTMLInputElement>('[data-walk-map-search]');
  const summary = dialog.querySelector<HTMLOutputElement>('[data-walk-map-search-summary]');
  const clear = dialog.querySelector<HTMLButtonElement>('[data-walk-map-search-clear]');
  const results = dialog.querySelector<HTMLElement>('[data-walk-map-search-results]');
  if (!input || !summary || !results) return;
  const query = input.value.trim();
  if (clear) clear.hidden = query.length === 0;
  if (!snapshot) {
    summary.textContent = 'Loading GTADB catalogue…';
    results.setAttribute('aria-busy', 'true');
    return;
  }

  const searchResult = searchGtadbLandmarks(snapshot.landmarks, query);
  const visibleCount = searchResult.items.length;
  const matchLabel = searchResult.totalMatches === 1 ? 'match' : 'matches';
  summary.textContent = `${searchResult.totalMatches.toLocaleString('en-US')} ${matchLabel} · showing ${visibleCount.toLocaleString('en-US')}`;
  dialog.dataset.walkMapSearchMatches = String(searchResult.totalMatches);
  results.replaceChildren();
  results.setAttribute('aria-busy', 'false');

  if (visibleCount === 0) {
    const empty = results.ownerDocument.createElement('p');
    empty.className = 'street-walk-map__results-empty';
    empty.textContent = 'No GTADB catalogue entry matches this search.';
    results.append(empty);
    return;
  }

  const fragment = results.ownerDocument.createDocumentFragment();
  for (const landmark of searchResult.items) {
    const travelDetail = state.positionedDetails.get(landmark.id) ?? null;
    const presentation = getGtadbSearchResultPresentation(landmark, Boolean(travelDetail));
    const button = results.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'street-walk-map__result';
    button.setAttribute('data-walk-map-search-result', landmark.id);
    button.setAttribute('data-gtadb-confidence', landmark.confidence);
    button.setAttribute('data-gtadb-name', landmark.evidence.name);
    button.setAttribute('data-gtadb-uncertainty', presentation.uncertainty);
    button.setAttribute('aria-label', presentation.ariaLabel);
    button.disabled = !travelDetail;
    if (travelDetail) applyTravelAttributes(button, travelDetail);

    const copy = results.ownerDocument.createElement('span');
    copy.className = 'street-walk-map__result-copy';
    const title = results.ownerDocument.createElement('strong');
    title.textContent = landmarkLabel(landmark);
    const meta = results.ownerDocument.createElement('small');
    const tagSummary = landmark.tags.join(' · ');
    meta.textContent = tagSummary || landmark.id;
    copy.append(title, meta);

    const status = results.ownerDocument.createElement('span');
    status.className = 'street-walk-map__result-status';
    status.setAttribute('data-gtadb-uncertainty-badge', '');
    status.setAttribute('data-gtadb-uncertainty', presentation.uncertainty);
    status.textContent = presentation.status;
    button.append(copy, status);
    fragment.append(button);
  }
  results.append(fragment);
}

function syncNavigationCatalogue(svg: SVGSVGElement, snapshot: GtadbMapSnapshot): void {
  const dialog = svg.closest<HTMLDialogElement>('[data-walk-map]');
  if (!dialog) return;
  const state = mapNavigationStates.get(dialog);
  if (!state) return;
  state.snapshot = snapshot;
  state.positionedDetails.clear();
  for (const landmark of snapshot.landmarks) {
    const detail = transformedTravelDetail(landmark);
    if (detail) state.positionedDetails.set(detail.id, detail);
  }
  renderGtadbSearchResults(state);
}

type GtadbLayerName = 'supported' | 'uncertain';

export function getGtadbLayerToggleLabel(layerName: GtadbLayerName, visible: boolean): string {
  const entries =
    layerName === 'supported'
      ? 'GTADB entries without uncertainty signals'
      : 'uncertain GTADB entries';
  return `${visible ? 'Hide' : 'Show'} ${entries}`;
}

function normalizedLayerName(value: string | undefined): GtadbLayerName | null {
  if (value === 'supported' || value === 'documented' || value === 'canonical') return 'supported';
  if (value === 'uncertain' || value === 'community') return 'uncertain';
  return null;
}

function setLayerInteractive(layer: Element | null, visible: boolean): void {
  if (!layer) return;
  layer.setAttribute('data-layer-visible', String(visible));
  layer.setAttribute('aria-hidden', String(!visible));
  if (visible) {
    layer.removeAttribute('display');
    layer.removeAttribute('hidden');
    layer.removeAttribute('pointer-events');
  } else {
    layer.setAttribute('display', 'none');
    layer.setAttribute('hidden', '');
    layer.setAttribute('pointer-events', 'none');
  }
  if (!visible) {
    layer.querySelectorAll('[data-map-travel]').forEach((marker) => {
      marker.setAttribute('tabindex', '-1');
    });
  }
}

function visibleGtadbMarkers(svg: SVGSVGElement): SVGGraphicsElement[] {
  return [...svg.querySelectorAll<SVGGraphicsElement>('[data-gtadb-id][data-map-travel]')].filter(
    (marker) => {
      const layer = marker.closest(
        '[data-walk-map-gtadb-supported], [data-walk-map-gtadb-uncertain]',
      );
      return layer?.getAttribute('data-layer-visible') === 'true' && !layer.hasAttribute('hidden');
    },
  );
}

function syncRovingGtadbMarkerTabStop(
  svg: SVGSVGElement,
  preferred?: SVGGraphicsElement | null,
): SVGGraphicsElement | null {
  const allMarkers = [
    ...svg.querySelectorAll<SVGGraphicsElement>('[data-gtadb-id][data-map-travel]'),
  ];
  const visibleMarkers = visibleGtadbMarkers(svg);
  const next =
    (preferred && visibleMarkers.includes(preferred) ? preferred : null) ??
    visibleMarkers.find((marker) => marker.getAttribute('tabindex') === '0') ??
    visibleMarkers[0] ??
    null;
  allMarkers.forEach((marker) => marker.setAttribute('tabindex', marker === next ? '0' : '-1'));
  return next;
}

function refreshGtadbMarkerWindow(svg: SVGSVGElement, viewBox: WalkMapViewBox): void {
  const snapshot = gtadbLayerSnapshots.get(svg);
  if (!snapshot || typeof svg.querySelector !== 'function') return;
  const layer = svg.querySelector<SVGGraphicsElement>('[data-walk-map-gtadb-locations]');
  if (!layer) return;
  const activeElement = svg.ownerDocument?.activeElement;
  const activeMarkerId =
    typeof Element !== 'undefined' && activeElement instanceof Element
      ? activeElement.closest('[data-gtadb-id]')?.getAttribute('data-gtadb-id')
      : null;
  const dialog = svg.closest<HTMLElement>('[data-walk-map]');
  const supportedVisible = dialog?.dataset.walkMapSupportedVisible !== 'false';
  const uncertainVisible = dialog?.dataset.walkMapUncertainVisible === 'true';

  renderGtadbLandmarkLayer(layer, snapshot, viewBox);
  setLayerInteractive(svg.querySelector('[data-walk-map-gtadb-supported]'), supportedVisible);
  setLayerInteractive(svg.querySelector('[data-walk-map-gtadb-uncertain]'), uncertainVisible);
  const preferred = activeMarkerId
    ? svg.querySelector<SVGGraphicsElement>(`[data-gtadb-id="${activeMarkerId}"]`)
    : null;
  syncRovingGtadbMarkerTabStop(svg, preferred);

  const domMarkerCount = layer.getAttribute?.('data-gtadb-dom-marker-count') ?? '0';
  svg.setAttribute('data-walk-map-gtadb-dom-count', domMarkerCount);
  if (dialog) dialog.dataset.walkMapGtadbDomCount = domMarkerCount;
}

function moveRovingGtadbMarkerFocus(
  svg: SVGSVGElement,
  current: SVGGraphicsElement,
  key: string,
): boolean {
  const markers = visibleGtadbMarkers(svg);
  const currentIndex = markers.indexOf(current);
  if (currentIndex < 0 || markers.length === 0) return false;
  let nextIndex: number;
  if (key === 'Home') nextIndex = 0;
  else if (key === 'End') nextIndex = markers.length - 1;
  else if (key === 'ArrowRight' || key === 'ArrowDown') {
    nextIndex = (currentIndex + 1) % markers.length;
  } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + markers.length) % markers.length;
  } else {
    return false;
  }
  const next = syncRovingGtadbMarkerTabStop(svg, markers[nextIndex]);
  next?.focus({ preventScroll: true });
  return Boolean(next);
}

function setLayerVisibility(state: WalkMapNavigationState, button: HTMLButtonElement): void {
  const layerName = normalizedLayerName(button.dataset.walkMapLayerToggle);
  if (!layerName) return;
  const selector =
    layerName === 'supported'
      ? '[data-walk-map-gtadb-supported]'
      : '[data-walk-map-gtadb-uncertain]';
  const visible = button.getAttribute('aria-pressed') !== 'true';
  setLayerInteractive(state.svg.querySelector(selector), visible);
  syncRovingGtadbMarkerTabStop(state.svg);
  button.setAttribute('aria-pressed', String(visible));
  const toggleState = button.querySelector<HTMLElement>('[data-walk-map-toggle-state]');
  if (toggleState) toggleState.textContent = visible ? 'Hide' : 'Show';
  button.setAttribute('aria-label', getGtadbLayerToggleLabel(layerName, visible));
  if (layerName === 'supported') {
    state.dialog.dataset.walkMapSupportedVisible = String(visible);
  } else {
    state.dialog.dataset.walkMapUncertainVisible = String(visible);
  }
}

function configureRegionalTravelButtons(dialog: HTMLDialogElement): void {
  dialog.querySelectorAll<HTMLButtonElement>('[data-walk-region]').forEach((button) => {
    const slug = button.dataset.walkRegion ?? '';
    const entry = PLACE_ENTRY_VIEWS[slug];
    if (!entry) return;
    const label = button.querySelector('strong')?.textContent?.trim() || slug;
    applyTravelAttributes(button, {
      x: entry.position.x,
      z: entry.position.z,
      label,
      id: `region-entry.${slug}`,
      source: 'region',
    });
  });
}

function initializeWalkMapNavigation(svg: SVGSVGElement): () => void {
  const dialog = svg.closest<HTMLDialogElement>('[data-walk-map]');
  if (!dialog) return () => undefined;
  mapNavigationStates.get(dialog)?.dispose();

  const state: WalkMapNavigationState = {
    dialog,
    svg,
    snapshot: null,
    positionedDetails: new Map(),
    dispose: () => undefined,
  };
  mapNavigationStates.set(dialog, state);
  configureRegionalTravelButtons(dialog);
  dialog.dataset.walkMapSupportedVisible = 'true';
  dialog.dataset.walkMapUncertainVisible = 'false';
  setLayerInteractive(svg.querySelector('[data-walk-map-gtadb-supported]'), true);
  setLayerInteractive(svg.querySelector('[data-walk-map-gtadb-uncertain]'), false);
  syncRovingGtadbMarkerTabStop(svg);
  dialog.querySelectorAll<HTMLButtonElement>('[data-walk-map-layer-toggle]').forEach((toggle) => {
    const layerName = normalizedLayerName(toggle.dataset.walkMapLayerToggle);
    if (!layerName) return;
    const visible = layerName === 'supported';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', getGtadbLayerToggleLabel(layerName, visible));
    const toggleState = toggle.querySelector<HTMLElement>('[data-walk-map-toggle-state]');
    if (toggleState) toggleState.textContent = visible ? 'Hide' : 'Show';
  });

  const onInput = (event: Event): void => {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.matches('[data-walk-map-search]')
    ) {
      renderGtadbSearchResults(state);
    }
  };
  const onClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return;
    const toggle = event.target.closest<HTMLButtonElement>('[data-walk-map-layer-toggle]');
    if (toggle) {
      setLayerVisibility(state, toggle);
      return;
    }
    if (event.target.closest('[data-walk-map-search-clear]')) {
      const input = dialog.querySelector<HTMLInputElement>('[data-walk-map-search]');
      if (input) {
        input.value = '';
        input.focus();
        renderGtadbSearchResults(state);
      }
      return;
    }
    const target = event.target.closest<Element>('[data-map-travel]');
    if (!target || (target instanceof HTMLButtonElement && target.disabled)) return;
    const detail = travelDetailFromElement(target);
    if (detail) dispatchWalkMapTravel(dialog, detail);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.target instanceof Element)) return;
    const marker = event.target.closest<SVGGraphicsElement>('g[data-map-travel]');
    if (!marker) return;
    if (moveRovingGtadbMarkerFocus(svg, marker, event.key)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if ((event.key !== 'Enter' && event.key !== ' ') || marker.getAttribute('tabindex') !== '0') {
      return;
    }
    event.preventDefault();
    marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };

  dialog.addEventListener('input', onInput);
  dialog.addEventListener('click', onClick);
  dialog.addEventListener('keydown', onKeyDown, true);
  state.dispose = (): void => {
    dialog.removeEventListener('input', onInput);
    dialog.removeEventListener('click', onClick);
    dialog.removeEventListener('keydown', onKeyDown, true);
    if (mapNavigationStates.get(dialog) === state) mapNavigationStates.delete(dialog);
  };
  return state.dispose;
}

function completeMapMarkup(prefix: string): string {
  const entry = PLACE_ENTRY_VIEWS['vice-city']?.position ?? { x: 0, z: 0 };
  const regions = [
    ['vice-city', 'VICE CITY'],
    ['leonida-keys', 'LEONIDA KEYS'],
    ['grassrivers', 'GRASSRIVERS'],
    ['port-gellhorn', 'PORT GELLHORN'],
    ['ambrosia', 'AMBROSIA'],
    ['mount-kalaga-national-park', 'MOUNT KALAGA'],
  ] as const;
  const labels = regions
    .map(([slug, name], index) => {
      const point = PLACE_ENTRY_VIEWS[slug]?.target;
      if (!point) return '';
      return `<g data-walk-map-region="${slug}" data-evidence="APPROXIMATE" transform="translate(${coordinate(point.x)} ${coordinate(point.z)})">
      <text class="atlas-region-label" y="-680" text-anchor="middle">${name}</text>
      <circle r="145" fill="#102a35" stroke="#f8f2df" stroke-width="60"/>
      <text y="70" text-anchor="middle" fill="#ffffff" font-size="200" font-family="Inter, sans-serif" font-weight="700">${index + 1}</text>
    </g>`;
    })
    .join('');
  return `
    <title>Leonida Atlas — community cartography</title>
    <desc>Original cartographic presentation derived from pinned GTADB / Yanis v16 community map tiles. Coastlines, roads, land cover and placements are APPROXIMATE, not official. Unmapped source areas are UNKNOWN. The established GTADB coordinate transform is unchanged. ${GTADB_ATTRIBUTION}</desc>
    <defs>
      <pattern id="${prefix}-unknown" width="500" height="500" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <path d="M0 0V500" stroke="#bdd2ce" stroke-opacity=".07" stroke-width="18"/>
      </pattern>
    </defs>
    <g data-walk-map-world>
      <rect data-walk-map-neutral-frame x="${MAP_BOUNDS.minX}" y="${MAP_BOUNDS.minY}" width="${MAP_BOUNDS.width}" height="${MAP_BOUNDS.height}" fill="#173b49"/>
      <g data-walk-map-original-cartography data-evidence="APPROXIMATE" aria-label="Source-derived community land, water, vegetation and transportation">
        <image data-atlas-basemap href="${publicPath('assets/gta6-leonida-atlas/basemap.svg')}" x="${MAP_BOUNDS.minX}" y="${MAP_BOUNDS.minY}" width="${MAP_BOUNDS.width}" height="${MAP_BOUNDS.height}" preserveAspectRatio="none"/>
        <g data-atlas-low-evidence-continuity data-evidence="UNKNOWN" aria-label="Low-evidence continuation: no mapped GTADB source coverage">
          <rect x="-32000" y="-24000" width="10000" height="40000" fill="#183b47" fill-opacity=".92"/>
          <rect x="-32000" y="-24000" width="10000" height="40000" fill="url(#${prefix}-unknown)"/>
          <path d="M-31550 -20900C-30100 -21850 -28350 -21350 -27050 -19850S-24650 -17600 -23000 -18450" fill="none" stroke="#9bbbad" stroke-width="140" stroke-opacity=".16" stroke-linecap="round"/>
          <path d="M-31300 -15100C-29650 -15900 -27950 -15350 -26800 -13900S-24600 -12000 -22600 -12850" fill="none" stroke="#d6d4aa" stroke-width="95" stroke-opacity=".13" stroke-linecap="round"/>
          <path d="M-31700 -8300C-30000 -9350 -28500 -8750 -27550 -7250S-25300 -5200 -22900 -6350" fill="none" stroke="#9bbbad" stroke-width="160" stroke-opacity=".17" stroke-linecap="round"/>
          <path d="M-31400 900C-29550 -650 -27750 -50 -26600 1650S-24300 4000 -22450 2850" fill="none" stroke="#d6d4aa" stroke-width="120" stroke-opacity=".13" stroke-linecap="round"/>
          <path d="M-31050 7800C-29600 7000 -27600 7350 -26150 9100S-24200 11750 -22500 10550" fill="none" stroke="#9bbbad" stroke-width="145" stroke-opacity=".15" stroke-linecap="round"/>
          <circle cx="-29900" cy="-18800" r="420" fill="#d6d4aa" fill-opacity=".07"/>
          <circle cx="-28650" cy="-10300" r="270" fill="#9bbbad" fill-opacity=".08"/>
          <circle cx="-24900" cy="-1360" r="360" fill="#d6d4aa" fill-opacity=".06"/>
          <circle cx="-27750" cy="9800" r="510" fill="#9bbbad" fill-opacity=".07"/>
          <text x="-27000" y="-4750" text-anchor="middle" fill="#c0d1cf" font-size="390" font-family="Inter, sans-serif" letter-spacing="62">UNKNOWN</text>
          <text x="-27000" y="-4150" text-anchor="middle" fill="#c0d1cf" font-size="230" font-family="Inter, sans-serif">Low-evidence continuation</text>
          <text x="-27000" y="-3680" text-anchor="middle" fill="#9db7b5" font-size="190" font-family="Inter, sans-serif">No mapped source coverage</text>
        </g>
        <g data-atlas-region-labels pointer-events="none">${labels}</g>
      </g>
      <g data-walk-map-gtadb-locations data-gtadb-state="idle" aria-label="GTADB reconstructed landmarks"></g>
    </g>
    <g data-walk-map-player transform="translate(${coordinate(entry.x)} ${coordinate(entry.z)})" pointer-events="none">
      <title data-walk-map-player-title>You are here</title>
      <circle r="15" fill="#092333" fill-opacity=".35"/>
      <circle r="11" fill="#15d9df" stroke="#ffffff" stroke-width="3"/>
      <circle r="4" fill="#e9ffff"/>
      <g data-walk-map-heading><path d="M0-29-7-17 0-20 7-17Z" fill="#ffffff" stroke="#102735" stroke-width="1.5"/></g>
      <g class="atlas-player-label"><rect x="20" y="-13" width="110" height="26" rx="4" fill="#0b202c" stroke="#75dadd" stroke-width=".7"/><text x="29" y="4" fill="#fff" font-family="Inter, sans-serif" font-size="10" font-weight="800" letter-spacing=".4">YOU ARE HERE</text></g>
    </g>`;
}

/** Installs transformed community cartography and pinned GTADB points on one shared frame. */
export function renderCompleteLeonidaMap(svg: SVGSVGElement, snapshot?: GtadbMapSnapshot): void {
  gtadbLayerLoads.delete(svg);
  gtadbLayerSnapshots.delete(svg);
  const prefix = `walk-map-${++mapInstanceCount}`;
  svg.setAttribute(
    'viewBox',
    `${MAP_BOUNDS.minX} ${MAP_BOUNDS.minY} ${MAP_BOUNDS.width} ${MAP_BOUNDS.height}`,
  );
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('data-walk-map-svg', '');
  svg.setAttribute('data-walk-map-complete', 'true');
  svg.setAttribute('data-walk-map-coordinate-system', 'gtadb-derived-xz');
  svg.setAttribute('data-walk-map-transform', 'deterministic-pixel-aligned');
  svg.setAttribute('data-walk-map-placement', 'APPROXIMATE');
  svg.setAttribute('data-walk-map-scale', 'approximate-visualization');
  svg.setAttribute('data-walk-map-cartography', 'source-derived-community-atlas');
  svg.setAttribute('data-walk-map-attribution', GTADB_ATTRIBUTION);
  svg.setAttribute('data-walk-map-preferred-source', GTADB_PREFERRED_SOURCE);
  svg.setAttribute('data-walk-map-license', GTADB_LICENSE);
  svg.setAttribute('data-walk-map-license-url', GTADB_LICENSE_URL);
  svg.setAttribute('data-walk-map-revision', GTADB_REVISION);
  svg.setAttribute('role', 'group');
  svg.setAttribute(
    'aria-label',
    'Interactive transformed GTADB / Map GTA community map with community-estimated placement, deterministic pixel-aligned transform, and approximate visualization scale',
  );
  svg.innerHTML = completeMapMarkup(prefix);
  if (!snapshot) return;
  const layer = svg.querySelector<SVGGraphicsElement>('[data-walk-map-gtadb-locations]');
  if (!layer) return;
  const result = renderGtadbLandmarkLayer(layer, snapshot);
  exposeGtadbMetadata(svg, snapshot, result);
}

function isSvgElement(element: Element | null): element is SVGSVGElement {
  return element?.namespaceURI === SVG_NAMESPACE && element.tagName.toLowerCase() === 'svg';
}

function findSvg(root: ParentNode): SVGSVGElement | null {
  if (typeof Element !== 'undefined' && root instanceof Element && isSvgElement(root)) return root;
  const element = root.querySelector('[data-walk-map-svg], .street-walk-map__drawing svg');
  return isSvgElement(element) ? element : null;
}

export function queryWalkMapElements(root: HTMLElement): WalkMapElements | null {
  const svg = findSvg(root);
  if (!svg) return null;
  return {
    root,
    svg,
    viewport: root.querySelector('[data-walk-map-viewport]'),
    world: svg.querySelector<SVGGraphicsElement>('[data-walk-map-world]'),
    player: svg.querySelector<SVGGraphicsElement>('[data-walk-map-player]'),
    heading: svg.querySelector<SVGGraphicsElement>('[data-walk-map-heading]'),
    playerTitle: svg.querySelector<SVGTitleElement>('[data-walk-map-player-title]'),
    zoomIn: root.querySelector<HTMLButtonElement>('[data-walk-map-zoom-in]'),
    zoomOut: root.querySelector<HTMLButtonElement>('[data-walk-map-zoom-out]'),
    zoomReset: root.querySelector<HTMLButtonElement>('[data-walk-map-zoom-reset]'),
    centerPlayer: root.querySelector<HTMLButtonElement>('[data-walk-map-center-player]'),
    zoomValue: root.querySelector<HTMLElement>('[data-walk-map-zoom-value]'),
    liveRegion: root.querySelector<HTMLElement>('[data-walk-map-live-region]'),
    liveHeading: root.querySelector<HTMLElement>('[data-walk-map-live-heading]'),
    liveWorld: root.querySelector<HTMLElement>('[data-walk-map-live-world]'),
    liveGtadb: root.querySelector<HTMLElement>('[data-walk-map-live-gtadb]'),
    liveEvidence: root.querySelector<HTMLElement>('[data-walk-map-live-evidence]'),
  };
}

function parseViewBox(svg: SVGSVGElement): WalkMapViewBox {
  const serialized =
    typeof svg.getAttribute === 'function' ? (svg.getAttribute('viewBox') ?? '') : '';
  const values = serialized
    .trim()
    .split(/[\s,]+/)
    .map((value) => Number.parseFloat(value));
  if (
    values.length === 4 &&
    values.every(Number.isFinite) &&
    (values[2] ?? 0) > MIN_VIEW_BOX_SIZE &&
    (values[3] ?? 0) > MIN_VIEW_BOX_SIZE
  ) {
    return {
      x: values[0] ?? DEFAULT_VIEW_BOX.x,
      y: values[1] ?? DEFAULT_VIEW_BOX.y,
      width: values[2] ?? DEFAULT_VIEW_BOX.width,
      height: values[3] ?? DEFAULT_VIEW_BOX.height,
    };
  }
  return { ...DEFAULT_VIEW_BOX };
}

function copyViewBox(viewBox: WalkMapViewBox): WalkMapViewBox {
  return { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height };
}

function formatViewBox(viewBox: WalkMapViewBox): string {
  return [viewBox.x, viewBox.y, viewBox.width, viewBox.height]
    .map((value) => Number(value.toFixed(4)))
    .join(' ');
}

function normalizedOptions(options: WalkMapOptions): {
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
} {
  const minZoom = Math.max(1, finite(options.minZoom ?? DEFAULT_MIN_ZOOM, DEFAULT_MIN_ZOOM));
  const maxZoom = Math.max(minZoom, finite(options.maxZoom ?? DEFAULT_MAX_ZOOM, DEFAULT_MAX_ZOOM));
  const zoomStep = Math.max(1.01, finite(options.zoomStep ?? DEFAULT_ZOOM_STEP, DEFAULT_ZOOM_STEP));
  return { minZoom, maxZoom, zoomStep };
}

function datasetPose(host: HTMLElement | null | undefined): WalkMapPlayerPose | null {
  if (!host) return null;
  const x = Number.parseFloat(host.dataset.playerX ?? '');
  const z = Number.parseFloat(host.dataset.playerZ ?? '');
  const yaw = Number.parseFloat(host.dataset.playerYaw ?? '');
  return Number.isFinite(x) && Number.isFinite(z)
    ? { x, z, yaw: Number.isFinite(yaw) ? yaw : 0 }
    : null;
}

function headingDegrees(yaw: number): number {
  return (-finite(yaw, 0) * 180) / Math.PI;
}

function normalizedHeadingDegrees(yaw: number): number {
  return ((headingDegrees(yaw) % 360) + 360) % 360;
}

function signedNumber(value: number, fractionDigits: number): string {
  const sign = value < 0 || Object.is(value, -0) ? '−' : '+';
  return `${sign}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/** Readable, explicitly non-official description of a pose on the shared coordinate frame. */
export function describeWalkMapPose(pose: WalkMapPlayerPose): WalkMapPoseDescription {
  const degrees = normalizedHeadingDegrees(pose.yaw);
  const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
  const gtadb = worldToGtadb(pose);
  return {
    region: getLeonidaZoneProfile(pose).name,
    heading: `${cardinal} · ${String(Math.round(degrees) % 360).padStart(3, '0')}°`,
    world: `VISUAL X ${signedNumber(pose.x, 0)} · Z ${signedNumber(pose.z, 0)}`,
    gtadb: `GTADB ${signedNumber(gtadb.x, 1)} · ${signedNumber(gtadb.y, 1)}`,
    evidence:
      'NEAREST REGION: APPROXIMATE · TRANSFORM: DETERMINISTIC, PIXEL-ALIGNED · PLACEMENT: COMMUNITY ESTIMATE · SCALE: APPROXIMATE VISUALIZATION',
  };
}

/**
 * Creates the interactive SVG controller independently of Three.js. Player and destination
 * positions both remain in the same visualization-coordinate X/Z frame.
 */
export function createWalkMapController(
  elements: WalkMapElements,
  options: WalkMapOptions = {},
): WalkMapController {
  const { root, svg } = elements;
  const { minZoom, maxZoom, zoomStep } = normalizedOptions(options);
  const baseViewBox = parseViewBox(svg);
  let viewBox = copyViewBox(baseViewBox);
  let playerPose: WalkMapPlayerPose | null = null;
  let disposed = false;
  let pinchingDistance: number | null = null;
  let pinchMidpoint: { x: number; y: number } | null = null;
  let markerRefreshFrame: number | null = null;
  let markerRefreshPending = false;
  let userModifiedView = false;
  let fittedViewBox: WalkMapViewBox | null = null;
  const activePointers = new Map<
    number,
    {
      x: number;
      y: number;
      readonly startX: number;
      readonly startY: number;
      maxTravel: number;
      hadMultiplePointers: boolean;
      readonly startedOnTravelTarget: boolean;
      captureTarget: Pick<
        Element,
        'setPointerCapture' | 'hasPointerCapture' | 'releasePointerCapture'
      >;
    }
  >();
  let suppressNextClick = false;
  let suppressClickTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  const previousTouchAction = svg.style.touchAction;
  const addedTabIndex = !svg.hasAttribute('tabindex');
  svg.style.touchAction = 'none';
  if (addedTabIndex) svg.setAttribute('tabindex', '0');

  function currentZoom(): number {
    return baseViewBox.width / viewBox.width;
  }

  function displayZoom(): number {
    const displayBase = fittedViewBox ?? baseViewBox;
    return displayBase.width / viewBox.width;
  }

  function minimumAllowedZoom(): number {
    const fittedZoom = fittedViewBox ? baseViewBox.width / fittedViewBox.width : minZoom;
    return Math.min(minZoom, fittedZoom);
  }

  function syncPlayerTransform(): void {
    if (!playerPose || !elements.player) return;
    const map = worldToMap(playerPose);
    const rect = svg.getBoundingClientRect();
    const unitsPerPixel = walkMapUnitsPerCssPixel(viewBox, rect) ?? 1;
    elements.player.setAttribute(
      'transform',
      `translate(${coordinate(map.x)} ${coordinate(map.y)}) scale(${coordinate(unitsPerPixel)})`,
    );
    const edge = walkMapPlayerHorizontalEdge(playerPose, viewBox, rect);
    root.dataset.atlasPlayerEdge = edge;
    const querySelector = elements.player.querySelector;
    const label =
      typeof querySelector === 'function'
        ? querySelector.call(elements.player, '.atlas-player-label')
        : null;
    if (label) {
      if (edge === 'right') label.setAttribute('transform', 'translate(-150 0)');
      else label.removeAttribute('transform');
    }
  }

  function constrainAxis(start: number, size: number, minimum: number, maximum: number): number {
    const span = maximum - minimum;
    return size <= span
      ? clamp(start, minimum, maximum - size)
      : clamp(start, maximum - size, minimum);
  }

  function constrain(candidate: WalkMapViewBox): WalkMapViewBox {
    const width = clamp(
      candidate.width,
      baseViewBox.width / maxZoom,
      baseViewBox.width / minimumAllowedZoom(),
    );
    const aspect = candidate.width / Math.max(MIN_VIEW_BOX_SIZE, candidate.height);
    const height = width / aspect;
    return {
      x: constrainAxis(candidate.x, width, MAP_BOUNDS.minX, MAP_BOUNDS.maxX),
      y: constrainAxis(candidate.y, height, MAP_BOUNDS.minY, MAP_BOUNDS.maxY),
      width,
      height,
    };
  }

  function scheduleMarkerRefresh(): void {
    if (disposed) return;
    if (activePointers.size > 0) {
      markerRefreshPending = true;
      return;
    }
    if (markerRefreshFrame !== null) return;
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      refreshGtadbMarkerWindow(svg, viewBox);
      return;
    }
    markerRefreshFrame = globalThis.requestAnimationFrame(() => {
      markerRefreshFrame = null;
      if (activePointers.size > 0) {
        markerRefreshPending = true;
        return;
      }
      if (!disposed) refreshGtadbMarkerWindow(svg, viewBox);
    });
  }

  function syncView(): void {
    viewBox = constrain(viewBox);
    svg.setAttribute('viewBox', formatViewBox(viewBox));
    const zoom = currentZoom();
    const visibleZoom = displayZoom();
    root.dataset.walkMapZoom = visibleZoom.toFixed(2);
    root.dataset.walkMapPanned = String(userModifiedView);
    if (elements.zoomValue) elements.zoomValue.textContent = `${Math.round(visibleZoom * 100)}%`;
    if (elements.zoomIn) elements.zoomIn.disabled = zoom >= maxZoom - 0.001;
    if (elements.zoomOut) elements.zoomOut.disabled = zoom <= minimumAllowedZoom() + 0.001;
    if (elements.zoomReset) elements.zoomReset.disabled = !userModifiedView;
    syncPlayerTransform();
    scheduleMarkerRefresh();
  }

  function clientPointToMap(point: { x: number; y: number }): { x: number; y: number } {
    const rect = svg.getBoundingClientRect();
    const projected = projectWalkMapClientPoint(point, rect, viewBox);
    return projected
      ? { x: projected.x, y: projected.z }
      : { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 };
  }

  function setZoom(zoom: number, focalClientPoint?: { x: number; y: number }): number {
    if (disposed) return currentZoom();
    userModifiedView = true;
    const nextZoom = clamp(finite(zoom, currentZoom()), minimumAllowedZoom(), maxZoom);
    const focal = focalClientPoint
      ? clientPointToMap(focalClientPoint)
      : { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 };
    const relativeX = viewBox.width > 0 ? (focal.x - viewBox.x) / viewBox.width : 0.5;
    const relativeY = viewBox.height > 0 ? (focal.y - viewBox.y) / viewBox.height : 0.5;
    const currentAspect = viewBox.width / Math.max(MIN_VIEW_BOX_SIZE, viewBox.height);
    const width = baseViewBox.width / nextZoom;
    const height = width / currentAspect;
    viewBox = constrain({
      x: focal.x - relativeX * width,
      y: focal.y - relativeY * height,
      width,
      height,
    });
    syncView();
    return currentZoom();
  }

  function panByClientDelta(deltaX: number, deltaY: number): void {
    const rect = svg.getBoundingClientRect();
    const unitsPerPixel = walkMapUnitsPerCssPixel(viewBox, rect);
    if (unitsPerPixel === null || currentZoom() <= minimumAllowedZoom() + 0.001) return;
    userModifiedView = true;
    viewBox = constrain({
      ...viewBox,
      x: viewBox.x - finite(deltaX, 0) * unitsPerPixel,
      y: viewBox.y - finite(deltaY, 0) * unitsPerPixel,
    });
    syncView();
  }

  function zoomIn(): number {
    return setZoom(currentZoom() * zoomStep);
  }

  function zoomOut(): number {
    return setZoom(currentZoom() / zoomStep);
  }

  function resetView(): void {
    userModifiedView = false;
    const rect =
      typeof svg.getBoundingClientRect === 'function' ? svg.getBoundingClientRect() : null;
    if (!rect) {
      fittedViewBox = null;
      viewBox = copyViewBox(baseViewBox);
      syncView();
      return;
    }
    if (rectAspect(rect) === null) {
      fittedViewBox = null;
      viewBox = copyViewBox(baseViewBox);
      syncView();
      return;
    }
    fittedViewBox = fitLeonidaAtlasViewBox(rect);
    viewBox = constrain(fittedViewBox);
    fittedViewBox = copyViewBox(viewBox);
    syncView();
  }

  function updatePlayer(pose: WalkMapPlayerPose): void {
    if (disposed || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return;
    playerPose = { x: pose.x, z: pose.z, yaw: finite(pose.yaw, 0) };
    const map = worldToMap(playerPose);
    syncPlayerTransform();
    elements.heading?.setAttribute(
      'transform',
      `rotate(${coordinate(headingDegrees(playerPose.yaw))})`,
    );
    if (elements.playerTitle) {
      elements.playerTitle.textContent = `Current position: ${coordinate(playerPose.x)}, ${coordinate(playerPose.z)}`;
    }
    const description = describeWalkMapPose(playerPose);
    if (elements.liveRegion) elements.liveRegion.textContent = description.region;
    if (elements.liveHeading) elements.liveHeading.textContent = description.heading;
    if (elements.liveWorld) elements.liveWorld.textContent = description.world;
    if (elements.liveGtadb) elements.liveGtadb.textContent = description.gtadb;
    if (elements.liveEvidence) elements.liveEvidence.textContent = description.evidence;
    root.dataset.walkMapPlayerX = coordinate(playerPose.x);
    root.dataset.walkMapPlayerZ = coordinate(playerPose.z);
    root.dataset.walkMapPlayerY = coordinate(map.y);
    root.dataset.walkMapPlayerYaw = coordinate(playerPose.yaw);
    root.dataset.walkMapPlayerRegion = description.region;
    root.dataset.walkMapPlayerHeading = description.heading;
  }

  function centerOnPlayer(): void {
    if (!playerPose) return;
    userModifiedView = true;
    const map = worldToMap(playerPose);
    const zoom = clamp(RECENTER_ZOOM, minZoom, maxZoom);
    const currentAspect = viewBox.width / Math.max(MIN_VIEW_BOX_SIZE, viewBox.height);
    const width = baseViewBox.width / zoom;
    const height = width / currentAspect;
    viewBox = constrain({
      x: map.x - width / 2,
      y: map.y - height / 2,
      width,
      height,
    });
    syncView();
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    const multiplier = Math.exp(-clamp(event.deltaY, -120, 120) * 0.0045);
    setZoom(currentZoom() * multiplier, { x: event.clientX, y: event.clientY });
  }

  function onDoubleClick(event: MouseEvent): void {
    event.preventDefault();
    setZoom(currentZoom() * zoomStep, { x: event.clientX, y: event.clientY });
  }

  function eventTargetsTravelDestination(event: Event): boolean {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
    return path.some((target) => {
      if (!target || typeof target !== 'object') return false;
      const closest = (target as { closest?: (selector: string) => unknown }).closest;
      return typeof closest === 'function' && Boolean(closest.call(target, '[data-map-travel]'));
    });
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    const startedOnTravelTarget = eventTargetsTravelDestination(event);
    const eventTarget = event.target as Partial<
      Pick<Element, 'setPointerCapture' | 'hasPointerCapture' | 'releasePointerCapture'>
    > | null;
    const captureTarget =
      startedOnTravelTarget &&
      typeof eventTarget?.setPointerCapture === 'function' &&
      typeof eventTarget.hasPointerCapture === 'function' &&
      typeof eventTarget.releasePointerCapture === 'function'
        ? (eventTarget as Pick<
            Element,
            'setPointerCapture' | 'hasPointerCapture' | 'releasePointerCapture'
          >)
        : svg;
    activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      maxTravel: 0,
      hadMultiplePointers: false,
      startedOnTravelTarget,
      captureTarget,
    });
    if (activePointers.size >= 2) {
      activePointers.forEach((pointer) => {
        pointer.hadMultiplePointers = true;
      });
    }
    try {
      captureTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can disappear during dialog teardown.
    }
    if (activePointers.size === 2) {
      const [first, second] = [...activePointers.values()];
      if (first && second) {
        pinchingDistance = Math.hypot(second.x - first.x, second.y - first.y);
        pinchMidpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      }
    }
  }

  function onPointerMove(event: PointerEvent): void {
    const previous = activePointers.get(event.pointerId);
    if (!previous) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      cancelPointer(event);
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - previous.x;
    const deltaY = event.clientY - previous.y;
    previous.x = event.clientX;
    previous.y = event.clientY;
    previous.maxTravel = Math.max(
      previous.maxTravel,
      Math.hypot(event.clientX - previous.startX, event.clientY - previous.startY),
    );
    if (activePointers.size >= 2) {
      const [first, second] = [...activePointers.values()];
      if (!first || !second) return;
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      if (pinchingDistance && pinchMidpoint) {
        panByClientDelta(midpoint.x - pinchMidpoint.x, midpoint.y - pinchMidpoint.y);
        setZoom(currentZoom() * (distance / pinchingDistance), midpoint);
      }
      pinchingDistance = distance;
      pinchMidpoint = midpoint;
      return;
    }
    if (
      previous.startedOnTravelTarget &&
      previous.captureTarget !== svg &&
      previous.maxTravel > FREE_POINT_TAP_MAX_TRAVEL_PX
    ) {
      try {
        svg.setPointerCapture(event.pointerId);
        previous.captureTarget = svg;
        scheduleClickSuppression();
      } catch {
        // Pointer capture may not be transferable in nonstandard test shims or during teardown.
      }
    }
    panByClientDelta(deltaX, deltaY);
  }

  function releasePointer(event: PointerEvent): void {
    const pointer = activePointers.get(event.pointerId);
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) {
      pinchingDistance = null;
      pinchMidpoint = null;
    }
    try {
      if (pointer?.captureTarget.hasPointerCapture(event.pointerId)) {
        pointer.captureTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // A browser may release capture before this cleanup runs.
    }
    if (activePointers.size === 0 && markerRefreshPending) {
      markerRefreshPending = false;
      scheduleMarkerRefresh();
    }
  }

  function onPointerUp(event: PointerEvent): void {
    const pointer = activePointers.get(event.pointerId);
    if (!pointer) return;
    pointer.maxTravel = Math.max(
      pointer.maxTravel,
      Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY),
    );
    const endedOnTravelTarget = eventTargetsTravelDestination(event);
    const isShortSinglePointerGesture =
      pointer.maxTravel <= FREE_POINT_TAP_MAX_TRAVEL_PX && !pointer.hadMultiplePointers;
    if (pointer.startedOnTravelTarget && !(isShortSinglePointerGesture && endedOnTravelTarget)) {
      scheduleClickSuppression();
    }
    const shouldTravel = isWalkMapFreePointTap({
      maxTravel: pointer.maxTravel,
      cancelled: false,
      hadMultiplePointers: pointer.hadMultiplePointers,
      startedOnTravelTarget: pointer.startedOnTravelTarget,
      endedOnTravelTarget,
    });
    releasePointer(event);
    if (!shouldTravel) return;
    const destination = projectWalkMapClientPoint(
      { x: event.clientX, y: event.clientY },
      svg.getBoundingClientRect(),
      viewBox,
    );
    const mapDialog = svg.closest<HTMLDialogElement>('[data-walk-map]');
    if (!destination || !mapDialog) return;
    dispatchWalkMapTravel(mapDialog, {
      ...destination,
      label: 'Selected map point',
      id: `map-point:${coordinate(destination.x)}:${coordinate(destination.z)}`,
      source: 'map',
    });
  }

  function cancelPointer(event: PointerEvent): void {
    const pointer = activePointers.get(event.pointerId);
    if (pointer?.startedOnTravelTarget) scheduleClickSuppression();
    releasePointer(event);
  }

  function onLostPointerCapture(event: PointerEvent): void {
    const pointer = activePointers.get(event.pointerId);
    if (
      pointer?.captureTarget === svg &&
      typeof svg.hasPointerCapture === 'function' &&
      svg.hasPointerCapture(event.pointerId)
    ) {
      return;
    }
    cancelPointer(event);
  }

  function scheduleClickSuppression(): void {
    suppressNextClick = true;
    if (suppressClickTimer !== null) globalThis.clearTimeout(suppressClickTimer);
    suppressClickTimer = globalThis.setTimeout(() => {
      suppressNextClick = false;
      suppressClickTimer = null;
    }, 0);
  }

  function suppressDisqualifiedClick(event: MouseEvent): void {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    if (suppressClickTimer !== null) globalThis.clearTimeout(suppressClickTimer);
    suppressClickTimer = null;
    event.preventDefault();
    event.stopPropagation();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomIn();
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomOut();
      return;
    }
    if (event.key === '0' || event.key === 'Home') {
      event.preventDefault();
      resetView();
      return;
    }
    const panStepX = viewBox.width * 0.08;
    const panStepY = viewBox.height * 0.08;
    if (event.key === 'ArrowLeft') viewBox = { ...viewBox, x: viewBox.x - panStepX };
    else if (event.key === 'ArrowRight') viewBox = { ...viewBox, x: viewBox.x + panStepX };
    else if (event.key === 'ArrowUp') viewBox = { ...viewBox, y: viewBox.y - panStepY };
    else if (event.key === 'ArrowDown') viewBox = { ...viewBox, y: viewBox.y + panStepY };
    else return;
    event.preventDefault();
    syncView();
  }

  const onZoomIn = (): void => {
    zoomIn();
  };
  const onZoomOut = (): void => {
    zoomOut();
  };
  const onReset = (): void => {
    resetView();
  };
  const onCenterPlayer = (): void => {
    centerOnPlayer();
  };

  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('dblclick', onDoubleClick);
  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', cancelPointer);
  svg.addEventListener('lostpointercapture', onLostPointerCapture);
  svg.ownerDocument?.addEventListener('pointerup', onPointerUp);
  svg.ownerDocument?.addEventListener('pointercancel', cancelPointer);
  svg.addEventListener('click', suppressDisqualifiedClick);
  svg.addEventListener('keydown', onKeyDown);
  elements.zoomIn?.addEventListener('click', onZoomIn);
  elements.zoomOut?.addEventListener('click', onZoomOut);
  elements.zoomReset?.addEventListener('click', onReset);
  elements.centerPlayer?.addEventListener('click', onCenterPlayer);

  const stateHost =
    options.playerStateHost ?? root.closest<HTMLElement>('[data-walk-world]') ?? undefined;
  const syncDatasetPlayer = (): void => {
    const pose = datasetPose(stateHost);
    if (pose) updatePlayer(pose);
  };
  const playerObserver =
    options.observePlayerDataset && stateHost && typeof MutationObserver !== 'undefined'
      ? new MutationObserver(syncDatasetPlayer)
      : null;
  const playerResizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          const rect = svg.getBoundingClientRect();
          const aspect = rectAspect(rect);
          if (aspect === null) {
            syncPlayerTransform();
            return;
          }
          fittedViewBox = fitLeonidaAtlasViewBox(rect);
          if (!userModifiedView) {
            viewBox = constrain(fittedViewBox);
            fittedViewBox = copyViewBox(viewBox);
            syncView();
            return;
          }
          const centerX = viewBox.x + viewBox.width / 2;
          const centerY = viewBox.y + viewBox.height / 2;
          const width = baseViewBox.width / currentZoom();
          const height = width / aspect;
          viewBox = constrain({
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
          });
          syncView();
        })
      : null;
  playerObserver?.observe(stateHost as HTMLElement, {
    attributes: true,
    attributeFilter: ['data-player-x', 'data-player-z', 'data-player-yaw'],
  });
  playerResizeObserver?.observe(svg);

  resetView();
  syncDatasetPlayer();

  return {
    updatePlayer,
    setZoom,
    zoomIn,
    zoomOut,
    resetView,
    centerOnPlayer,
    getZoom: currentZoom,
    getViewBox: () => copyViewBox(viewBox),
    loadCatalogue: () => loadGtadbLandmarkLayer(svg),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (markerRefreshFrame !== null && typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(markerRefreshFrame);
      }
      markerRefreshFrame = null;
      if (suppressClickTimer !== null) globalThis.clearTimeout(suppressClickTimer);
      suppressClickTimer = null;
      const catalogueAbort = gtadbLayerAbortControllers.get(svg);
      if (catalogueAbort) {
        catalogueAbort.abort();
        gtadbLayerAbortControllers.delete(svg);
        gtadbLayerLoads.delete(svg);
      }
      activePointers.clear();
      playerObserver?.disconnect();
      playerResizeObserver?.disconnect();
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('dblclick', onDoubleClick);
      svg.removeEventListener('pointerdown', onPointerDown);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', onPointerUp);
      svg.removeEventListener('pointercancel', cancelPointer);
      svg.removeEventListener('lostpointercapture', onLostPointerCapture);
      svg.ownerDocument?.removeEventListener('pointerup', onPointerUp);
      svg.ownerDocument?.removeEventListener('pointercancel', cancelPointer);
      svg.removeEventListener('click', suppressDisqualifiedClick);
      svg.removeEventListener('keydown', onKeyDown);
      elements.zoomIn?.removeEventListener('click', onZoomIn);
      elements.zoomOut?.removeEventListener('click', onZoomOut);
      elements.zoomReset?.removeEventListener('click', onReset);
      elements.centerPlayer?.removeEventListener('click', onCenterPlayer);
      svg.style.touchAction = previousTouchAction;
      if (addedTabIndex) svg.removeAttribute('tabindex');
    },
  };
}

/** Initializes the transformed map, its delegated navigation, async catalogue, and owned cleanup. */
export function initializeWalkMap(
  root: HTMLElement,
  options: WalkMapOptions = {},
): WalkMapController | null {
  const svg = findSvg(root);
  if (!svg) return null;
  const renderMode = options.renderMap ?? 'if-missing';
  const hasMapLayers =
    svg.getAttribute('data-walk-map-coordinate-system') === 'gtadb-derived-xz' &&
    Boolean(
      svg.querySelector('[data-walk-map-world]') &&
      svg.querySelector('[data-walk-map-player]') &&
      svg.querySelector('[data-walk-map-gtadb-locations]'),
    );
  if (renderMode === true || (renderMode === 'if-missing' && !hasMapLayers)) {
    renderCompleteLeonidaMap(svg);
  }
  const elements = queryWalkMapElements(root);
  if (!elements) return null;
  const mapController = createWalkMapController(elements, options);
  const disposeNavigation = initializeWalkMapNavigation(svg);
  if (!options.deferCatalogue) void mapController.loadCatalogue();
  let disposed = false;
  return {
    ...mapController,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disposeNavigation();
      mapController.dispose();
    },
  };
}
