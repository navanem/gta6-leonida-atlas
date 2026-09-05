import { describe, expect, it } from 'vitest';

import { clampPanOffset, getPanLimits, panBy } from '@features/street-leonida/pan';

describe('Street Leonida still-image pan', () => {
  it('allows no movement when image and desktop viewport have the same aspect ratio', () => {
    expect(
      getPanLimits({
        imageWidth: 3840,
        imageHeight: 2160,
        viewportWidth: 1280,
        viewportHeight: 720,
      }),
    ).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0, renderedWidth: 1280, renderedHeight: 720 });
  });

  it('clamps a landscape image inside a portrait mobile viewport with no blank edge', () => {
    const limits = getPanLimits({
      imageWidth: 3840,
      imageHeight: 2160,
      viewportWidth: 390,
      viewportHeight: 844,
    });
    expect(limits.renderedHeight).toBeCloseTo(844, 5);
    expect(limits.renderedWidth).toBeCloseTo(1500.444444, 5);
    expect(limits.minX).toBeCloseTo(-555.222222, 5);
    expect(limits.maxX).toBeCloseTo(555.222222, 5);
    expect(limits.minY).toBe(0);
    expect(limits.maxY).toBe(0);
    expect(clampPanOffset({ x: 9999, y: -9999 }, limits)).toEqual({
      x: limits.maxX,
      y: 0,
    });
  });

  it('honors narrower editorial pan bounds without leaving the real rendered pixels', () => {
    const limits = getPanLimits({
      imageWidth: 2400,
      imageHeight: 1600,
      viewportWidth: 800,
      viewportHeight: 800,
      panBounds: { minX: 0.4, maxX: 0.6, minY: 0.4, maxY: 0.6 },
    });
    expect(limits).toMatchObject({ minX: -120, maxX: 120, minY: 0, maxY: 0 });
  });

  it('applies button or drag deltas through the same clamp', () => {
    const limits = { minX: -100, maxX: 100, minY: -40, maxY: 40 };
    expect(panBy({ x: 80, y: -30 }, { x: 50, y: -20 }, limits)).toEqual({ x: 100, y: -40 });
  });

  it('never scales below cover size when a caller supplies zoom below one', () => {
    expect(
      getPanLimits({
        imageWidth: 3840,
        imageHeight: 2160,
        viewportWidth: 1280,
        viewportHeight: 720,
        zoom: 0.25,
      }),
    ).toMatchObject({ renderedWidth: 1280, renderedHeight: 720 });
  });

  it('fails closed to a centered non-pannable image for invalid dimensions', () => {
    expect(
      getPanLimits({ imageWidth: 0, imageHeight: 2160, viewportWidth: 390, viewportHeight: 844 }),
    ).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0, renderedWidth: 390, renderedHeight: 844 });
  });
});
