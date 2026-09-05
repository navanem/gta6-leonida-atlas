/** Source pixels are two canonical world units; north is negative SVG Y. */
export function tilePixelToWorld(tileX, tileY, pixelX, pixelY) {
  return { x: -32768 + (tileX * 256 + pixelX) * 2, y: -32768 + (tileY * 256 + pixelY) * 2 };
}

/** The left source panel is credits, screenshots and legend, not map evidence. */
export function isGeographicPixel(tileX, tileY, pixelX, pixelY) {
  return (
    tileX >= 0 &&
    tileX <= 79 &&
    tileY >= 21 &&
    tileY <= 99 &&
    pixelX >= 0 &&
    pixelX < 256 &&
    pixelY >= 0 &&
    pixelY < 256 &&
    tileX * 256 + pixelX >= 5384
  );
}

export const UNKNOWN_RGB = [23, 59, 73];
export const WATER_RGB = [59, 104, 125];

/** Interpret the pinned raster's own legend colors, allowing JPEG edge noise. */
export function classifyPixel(r, g, b) {
  if (b > r + 28 && b > g + 9) return 'water';
  if (g > r + 5 && g > b + 25) return 'vegetation';
  if (r > b + 35 && g > b + 25 && r >= g) return 'sand';
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread > 24) return 'annotation';
  const light = (r + g + b) / 3;
  if (light < 42 || light > 245) return 'annotation';
  if (light <= 102) return 'road';
  if (light < 149) return 'pavement';
  if (light <= 199) return 'building';
  return 'ground';
}

function mappedColor(type, r, g) {
  if (type === 'water') {
    return WATER_RGB;
  }
  if (type === 'vegetation') {
    const relief = Math.max(0, Math.min(115, (r + g) / 2 - 100));
    return [122 + relief * 0.44, 140 + relief * 0.37, 88 + relief * 0.34];
  }
  if (type === 'sand') return [229, 218, 181];
  if (type === 'road') return [249, 242, 218];
  if (type === 'pavement') return [163, 168, 148];
  if (type === 'building') return [190, 189, 169];
  if (type === 'ground') return [225, 220, 201];
  return UNKNOWN_RGB;
}

/** Recolor only source-supported surfaces. Suppress annotation with a nearby
 * source surface sample, never an authored shape or POI-derived road. */
export function stylizeRaster(input, width, height) {
  const output = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      let source = i;
      let type = classifyPixel(input[i], input[i + 1], input[i + 2]);
      if (type === 'annotation') {
        // Expand across a bounded neighborhood. Prefer a supported area fill;
        // roads are deliberately not synthesized through colored annotations.
        search: for (let radius = 1; radius <= 10; radius++) {
          for (const [dx, dy] of [
            [-radius, 0],
            [radius, 0],
            [0, -radius],
            [0, radius],
          ]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const candidate = (ny * width + nx) * 3;
            const neighbor = classifyPixel(
              input[candidate],
              input[candidate + 1],
              input[candidate + 2],
            );
            if (['water', 'vegetation', 'sand', 'ground', 'building'].includes(neighbor)) {
              source = candidate;
              type = neighbor;
              break search;
            }
          }
        }
      }
      const color = mappedColor(type, input[source], input[source + 1]);
      output[i] = Math.round(color[0]);
      output[i + 1] = Math.round(color[1]);
      output[i + 2] = Math.round(color[2]);
    }
  }
  return output;
}

/** Decorative shore-proximity tint, not depth/bathymetry. Only recolored water
 * is affected; unknown areas and source land stay exactly as they were. */
export function applyCoastHalo(rgb, proximity) {
  for (let p = 0; p < proximity.length; p++) {
    const i = p * 3;
    if (
      Math.abs(rgb[i] - 59) > 3 ||
      Math.abs(rgb[i + 1] - 104) > 3 ||
      Math.abs(rgb[i + 2] - 125) > 3
    )
      continue;
    const amount = Math.min(1, proximity[p] / 128);
    rgb[i] = Math.round(59 + amount * 44);
    rgb[i + 1] = Math.round(104 + amount * 47);
    rgb[i + 2] = Math.round(125 + amount * 33);
  }
  return rgb;
}
