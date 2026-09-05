import type { PublicStreetPanBounds } from './types';

export interface PanOffset {
  x: number;
  y: number;
}

export interface PanLimits {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  renderedWidth?: number;
  renderedHeight?: number;
}

interface PanGeometry {
  imageWidth: number;
  imageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  zoom?: number;
  panBounds?: PublicStreetPanBounds | null;
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validNormalizedBounds(value: PublicStreetPanBounds | null | undefined): boolean {
  return Boolean(
    value &&
    [value.minX, value.maxX, value.minY, value.maxY].every(
      (bound) => Number.isFinite(bound) && bound >= 0 && bound <= 1,
    ) &&
    value.minX <= value.maxX &&
    value.minY <= value.maxY,
  );
}

function stablePixel(value: number): number {
  if (Math.abs(value) < 1e-9) return 0;
  return Math.round(value * 1e9) / 1e9;
}

export function getPanLimits(geometry: PanGeometry): Required<PanLimits> {
  const { imageWidth, imageHeight, viewportWidth, viewportHeight } = geometry;
  if (
    !positiveFinite(imageWidth) ||
    !positiveFinite(imageHeight) ||
    !positiveFinite(viewportWidth) ||
    !positiveFinite(viewportHeight)
  ) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      renderedWidth: positiveFinite(viewportWidth) ? viewportWidth : 0,
      renderedHeight: positiveFinite(viewportHeight) ? viewportHeight : 0,
    };
  }

  const requestedZoom = positiveFinite(geometry.zoom ?? 1) ? Math.max(1, geometry.zoom ?? 1) : 1;
  const scale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight) * requestedZoom;
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;
  const physicalX = Math.max(0, (renderedWidth - viewportWidth) / 2);
  const physicalY = Math.max(0, (renderedHeight - viewportHeight) / 2);

  let minX = -physicalX;
  let maxX = physicalX;
  let minY = -physicalY;
  let maxY = physicalY;

  if (validNormalizedBounds(geometry.panBounds)) {
    const bounds = geometry.panBounds as PublicStreetPanBounds;
    const editorialMinX = (0.5 - bounds.maxX) * renderedWidth;
    const editorialMaxX = (0.5 - bounds.minX) * renderedWidth;
    const editorialMinY = (0.5 - bounds.maxY) * renderedHeight;
    const editorialMaxY = (0.5 - bounds.minY) * renderedHeight;
    minX = Math.max(minX, editorialMinX);
    maxX = Math.min(maxX, editorialMaxX);
    minY = Math.max(minY, editorialMinY);
    maxY = Math.min(maxY, editorialMaxY);
    if (minX > maxX) minX = maxX = 0;
    if (minY > maxY) minY = maxY = 0;
  }

  return {
    minX: stablePixel(minX),
    maxX: stablePixel(maxX),
    minY: stablePixel(minY),
    maxY: stablePixel(maxY),
    renderedWidth: stablePixel(renderedWidth),
    renderedHeight: stablePixel(renderedHeight),
  };
}

export function clampPanOffset(offset: PanOffset, limits: PanLimits): PanOffset {
  const x = Number.isFinite(offset.x) ? offset.x : 0;
  const y = Number.isFinite(offset.y) ? offset.y : 0;
  return {
    x: Math.min(limits.maxX, Math.max(limits.minX, x)),
    y: Math.min(limits.maxY, Math.max(limits.minY, y)),
  };
}

export function panBy(offset: PanOffset, delta: PanOffset, limits: PanLimits): PanOffset {
  return clampPanOffset({ x: offset.x + delta.x, y: offset.y + delta.y }, limits);
}
