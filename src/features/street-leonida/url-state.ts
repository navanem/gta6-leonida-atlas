export type StreetMapLayer = 'scenes' | 'places' | 'regions';

export interface StreetUrlState {
  t?: number;
  x?: number;
  y?: number;
  z?: number;
  layer?: StreetMapLayer;
}

interface StreetUrlStateOptions {
  timeRange?: { start: number; end: number };
}

const MAP_COORDINATE_LIMIT = 1_000_000;
const MAP_ZOOM_LIMIT = 12;
const DEFAULT_TIME_LIMIT = 86_400;
const LAYERS = new Set<StreetMapLayer>(['scenes', 'places', 'regions']);

function paramsFrom(input: string | URL | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  if (input instanceof URL) return input.searchParams;
  return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
}

function finiteInRange(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function parseStreetUrlState(
  input: string | URL | URLSearchParams,
  options: StreetUrlStateOptions = {},
): StreetUrlState {
  const params = paramsFrom(input);
  const result: StreetUrlState = {};
  const timeStart = options.timeRange?.start ?? 0;
  const timeEnd = options.timeRange?.end ?? DEFAULT_TIME_LIMIT;
  const t = finiteInRange(params.get('t'), timeStart, timeEnd);
  if (t !== null) result.t = t;

  const x = finiteInRange(params.get('x'), -MAP_COORDINATE_LIMIT, MAP_COORDINATE_LIMIT);
  const y = finiteInRange(params.get('y'), -MAP_COORDINATE_LIMIT, MAP_COORDINATE_LIMIT);
  if (x !== null && y !== null) {
    result.x = x;
    result.y = y;
  }

  const z = finiteInRange(params.get('z'), 0, MAP_ZOOM_LIMIT);
  if (z !== null) result.z = z;
  const layer = params.get('layer');
  if (LAYERS.has(layer as StreetMapLayer)) result.layer = layer as StreetMapLayer;
  return result;
}

function addFinite(
  params: URLSearchParams,
  key: 't' | 'x' | 'y' | 'z',
  value: unknown,
  min: number,
  max: number,
): void {
  if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) {
    params.set(key, String(value));
  }
}

export function serializeStreetUrlState(state: StreetUrlState): string {
  const params = new URLSearchParams();
  addFinite(params, 't', state.t, 0, DEFAULT_TIME_LIMIT);
  if (
    typeof state.x === 'number' &&
    typeof state.y === 'number' &&
    Number.isFinite(state.x) &&
    Number.isFinite(state.y) &&
    Math.abs(state.x) <= MAP_COORDINATE_LIMIT &&
    Math.abs(state.y) <= MAP_COORDINATE_LIMIT
  ) {
    params.set('x', String(state.x));
    params.set('y', String(state.y));
  }
  addFinite(params, 'z', state.z, 0, MAP_ZOOM_LIMIT);
  if (LAYERS.has(state.layer as StreetMapLayer)) params.set('layer', state.layer as StreetMapLayer);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export function buildStreetShareUrl(pathname: string, state: StreetUrlState): string {
  const cleanPath = pathname.split(/[?#]/, 1)[0] || '/gta6-leonida-atlas/app';
  const canonicalPath = cleanPath === '/' ? cleanPath : cleanPath.replace(/\/+$/, '');
  return `${canonicalPath}${serializeStreetUrlState(state)}`;
}
