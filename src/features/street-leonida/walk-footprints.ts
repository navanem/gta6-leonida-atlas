/** Pixel geometry only: no invented roads, positions or geographic reprojection. */
export interface RasterBuildingFootprint {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly oriented?: {
    readonly centerX: number;
    readonly centerY: number;
    readonly width: number;
    readonly depth: number;
    /** Three.js yaw; source pixel y increases world z. */
    readonly rotation: number;
  };
}

type Point = readonly [number, number];
function hull(points: Point[]): Point[] {
  const sorted = points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: Point, b: Point, c: Point) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (input: Point[]) => {
    const output: Point[] = [];
    for (const point of input) {
      while (
        output.length > 1 &&
        cross(output[output.length - 2]!, output[output.length - 1]!, point) <= 0
      )
        output.pop();
      output.push(point);
    }
    return output;
  };
  return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
}

function describePart(points: Point[]): RasterBuildingFootprint | null {
  if (points.length < 24) return null;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const width = maxX - minX + 1,
    height = maxY - minY + 1;
  if (width < 4 || height < 4) return null;
  const base = { x: minX, y: minY, width, height };
  const outline = hull(points);
  let best = {
    area: width * height,
    angle: 0,
    minU: minX,
    maxU: maxX + 1,
    minV: minY,
    maxV: maxY + 1,
  };
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!,
      b = outline[(i + 1) % outline.length]!;
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(angle),
      s = Math.sin(angle);
    let minU = Infinity,
      maxU = -Infinity,
      minV = Infinity,
      maxV = -Infinity;
    // Project whole pixel squares, not only their centres, so the envelope is conservative.
    for (const [x, y] of outline)
      for (const dx of [0, 1])
        for (const dy of [0, 1]) {
          const u = (x + dx) * c + (y + dy) * s,
            v = -(x + dx) * s + (y + dy) * c;
          minU = Math.min(minU, u);
          maxU = Math.max(maxU, u);
          minV = Math.min(minV, v);
          maxV = Math.max(maxV, v);
        }
    const area = (maxU - minU) * (maxV - minV);
    if (area < best.area * 0.995) best = { area, angle, minU, maxU, minV, maxV };
  }
  if (points.length / best.area < 0.67) return null;
  if (best.area > width * height * 0.97) return base;
  const c = Math.cos(best.angle),
    s = Math.sin(best.angle);
  const u = (best.minU + best.maxU) / 2,
    v = (best.minV + best.maxV) / 2;
  let angle = best.angle,
    spanU = best.maxU - best.minU,
    spanV = best.maxV - best.minV;
  if (spanV > spanU) {
    [spanU, spanV] = [spanV, spanU];
    angle += Math.PI / 2;
  }
  while (angle > Math.PI / 2) angle -= Math.PI;
  while (angle < -Math.PI / 2) angle += Math.PI;
  return {
    ...base,
    oriented: {
      centerX: u * c - v * s,
      centerY: u * s + v * c,
      width: spanU,
      depth: spanV,
      rotation: -angle,
    },
  };
}

export function extractRasterBuildingFootprints(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels = 4,
): RasterBuildingFootprint[] {
  if (width <= 0 || height <= 0 || channels < 3 || pixels.length < width * height * channels)
    return [];
  const mask = new Uint8Array(width * height),
    visited = new Uint8Array(mask.length),
    queue = new Int32Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    const r = pixels[i * channels]!,
      g = pixels[i * channels + 1]!,
      b = pixels[i * channels + 2]!;
    mask[i] = Number(
      Math.max(r, g, b) - Math.min(r, g, b) <= 12 &&
        (r + g + b) / 3 >= 158 &&
        (r + g + b) / 3 <= 197,
    );
  }
  const result: RasterBuildingFootprint[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0,
      tail = 1;
    queue[0] = start;
    visited[start] = 1;
    const points: Point[] = [];
    while (head < tail) {
      const i = queue[head++]!,
        x = i % width,
        y = Math.floor(i / width);
      points.push([x, y]);
      for (const n of [i - 1, i + 1, i - width, i + width]) {
        if (n < 0 || n >= mask.length || Math.abs((n % width) - x) > 1 || !mask[n] || visited[n])
          continue;
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    // An undifferentiated fill covering the image is not evidence of a building.
    if (points.length > width * height * 0.8) continue;
    const parts: RasterBuildingFootprint[] = [];
    const split = (input: Point[], depth: number) => {
      if (input.length < 24 || parts.length >= 16) return;
      const part = describePart(input);
      if (part && part.width <= 96 && part.height <= 96) {
        parts.push(part);
        return;
      }
      if (depth >= 4) return;
      const xs = input.map((p) => p[0]),
        ys = input.map((p) => p[1]);
      const minX = Math.min(...xs),
        maxX = Math.max(...xs),
        minY = Math.min(...ys),
        maxY = Math.max(...ys);
      const axis = maxX - minX >= maxY - minY ? 0 : 1;
      const middle = axis === 0 ? (minX + maxX) / 2 : (minY + maxY) / 2;
      split(
        input.filter((p) => p[axis] <= middle),
        depth + 1,
      );
      split(
        input.filter((p) => p[axis] > middle),
        depth + 1,
      );
    };
    split(points, 0);
    result.push(...parts);
  }
  return result.sort((a, b) => b.width * b.height - a.width * a.height);
}
