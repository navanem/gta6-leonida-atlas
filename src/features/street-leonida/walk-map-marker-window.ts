import type { GtadbLandmark } from './gtadb';
import { classifyGtadbUncertaintyReasons, isPositionedGtadbLandmark } from './gtadb';
import { gtadbToWorld, MAP_BOUNDS, worldToMap } from './leonida-coordinates';
import { REVIEWED_GTADB_ANCHORS } from './leonida-evidence';

export interface GtadbMarkerViewBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const GTADB_MAP_MARKER_DOM_BUDGET = 420;
export const GTADB_MAP_MARKER_OVERSCAN_RATIO = 0.08;

const REVIEWED_ANCHOR_IDS = new Set(Object.keys(REVIEWED_GTADB_ANCHORS));

interface PositionedMarker {
  readonly landmark: GtadbLandmark;
  readonly x: number;
  readonly y: number;
}

function markerPosition(landmark: GtadbLandmark): PositionedMarker | null {
  if (!isPositionedGtadbLandmark(landmark)) return null;
  const map = worldToMap(gtadbToWorld(landmark.inGameCoordinates));
  return { landmark, x: map.x, y: map.y };
}

function paddedViewBox(viewBox: GtadbMarkerViewBox): GtadbMarkerViewBox {
  const paddingX = viewBox.width * GTADB_MAP_MARKER_OVERSCAN_RATIO;
  const paddingY = viewBox.height * GTADB_MAP_MARKER_OVERSCAN_RATIO;
  return {
    x: viewBox.x - paddingX,
    y: viewBox.y - paddingY,
    width: viewBox.width + paddingX * 2,
    height: viewBox.height + paddingY * 2,
  };
}

function insideView(marker: PositionedMarker, viewBox: GtadbMarkerViewBox): boolean {
  return (
    marker.x >= viewBox.x &&
    marker.x <= viewBox.x + viewBox.width &&
    marker.y >= viewBox.y &&
    marker.y <= viewBox.y + viewBox.height
  );
}

function preferMarker(candidate: PositionedMarker, current: PositionedMarker): boolean {
  const candidateReviewed = REVIEWED_ANCHOR_IDS.has(candidate.landmark.id);
  const currentReviewed = REVIEWED_ANCHOR_IDS.has(current.landmark.id);
  if (candidateReviewed !== currentReviewed) return candidateReviewed;
  const candidateStable =
    classifyGtadbUncertaintyReasons(candidate.landmark.inGameAddress, candidate.landmark.tags)
      .length === 0;
  const currentStable =
    classifyGtadbUncertaintyReasons(current.landmark.inGameAddress, current.landmark.tags)
      .length === 0;
  if (candidateStable !== currentStable) return candidateStable;
  const candidateNamed = candidate.landmark.evidence.name === 'KNOWN';
  const currentNamed = current.landmark.evidence.name === 'KNOWN';
  if (candidateNamed !== currentNamed) return candidateNamed;
  return candidate.landmark.id.localeCompare(current.landmark.id, undefined, { numeric: true }) < 0;
}

/**
 * Returns a deterministic, spatially distributed window of clickable SVG markers.
 * The density layer and search catalogue still represent every pinned record; this
 * only caps interactive DOM nodes that would otherwise block the atlas main thread.
 */
export function selectGtadbMarkerWindow(
  landmarks: readonly GtadbLandmark[],
  viewBox: GtadbMarkerViewBox = {
    x: MAP_BOUNDS.minX,
    y: MAP_BOUNDS.minY,
    width: MAP_BOUNDS.width,
    height: MAP_BOUNDS.height,
  },
  markerBudget = GTADB_MAP_MARKER_DOM_BUDGET,
): readonly GtadbLandmark[] {
  const budget = Math.max(1, Math.floor(markerBudget));
  const window = paddedViewBox(viewBox);
  const candidates = landmarks
    .map(markerPosition)
    .filter((marker): marker is PositionedMarker => Boolean(marker && insideView(marker, window)));
  if (candidates.length <= budget) return candidates.map(({ landmark }) => landmark);

  const aspect = Math.max(0.25, Math.min(4, window.width / Math.max(1, window.height)));
  const columns = Math.max(1, Math.ceil(Math.sqrt(budget * aspect)));
  const rows = Math.max(1, Math.ceil(budget / columns));
  const cells = new Map<number, PositionedMarker>();
  for (const candidate of candidates) {
    const column = Math.min(
      columns - 1,
      Math.max(0, Math.floor(((candidate.x - window.x) / window.width) * columns)),
    );
    const row = Math.min(
      rows - 1,
      Math.max(0, Math.floor(((candidate.y - window.y) / window.height) * rows)),
    );
    const key = row * columns + column;
    const current = cells.get(key);
    if (!current || preferMarker(candidate, current)) cells.set(key, candidate);
  }

  const selected = new Map<string, PositionedMarker>();
  for (const candidate of candidates) {
    if (REVIEWED_ANCHOR_IDS.has(candidate.landmark.id)) {
      selected.set(candidate.landmark.id, candidate);
    }
  }
  for (const candidate of [...cells.values()].sort((left, right) => {
    if (left.y !== right.y) return left.y - right.y;
    if (left.x !== right.x) return left.x - right.x;
    return left.landmark.id.localeCompare(right.landmark.id, undefined, { numeric: true });
  })) {
    if (selected.size >= budget) break;
    selected.set(candidate.landmark.id, candidate);
  }

  if (selected.size < budget) {
    const remaining = candidates.filter(({ landmark }) => !selected.has(landmark.id));
    const slots = budget - selected.size;
    const step = remaining.length / slots;
    for (let index = 0; index < slots; index += 1) {
      const candidate = remaining[Math.min(remaining.length - 1, Math.floor(index * step))];
      if (candidate) selected.set(candidate.landmark.id, candidate);
    }
  }

  return [...selected.values()].slice(0, budget).map(({ landmark }) => landmark);
}
