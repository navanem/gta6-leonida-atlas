#!/usr/bin/env node
/** Reproducible, source-derived atlas cartography. Run from repository root:
 * node scripts/build-leonida-atlas-basemap.mjs
 * No network, new dependencies, inferred coastlines or authored road geometry.
 */
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import {
  tilePixelToWorld,
  stylizeRaster,
  applyCoastHalo,
  UNKNOWN_RGB,
} from './lib/leonida-atlas-basemap.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
sharp.concurrency(2);
sharp.cache({ memory: 64, files: 0, items: 20 });
const sourceDirectory = resolve(root, 'public/assets/street-leonida/maps/gtadb-yanis-16-z5');
const outputDirectory = resolve(root, 'public/assets/gta6-leonida-atlas');
await mkdir(outputDirectory, { recursive: true });

const size = 10000;
const worldPerPixel = 4;
const rgb = Buffer.alloc(size * size * 3);
for (let i = 0; i < rgb.length; i += 3) {
  rgb[i] = UNKNOWN_RGB[0];
  rgb[i + 1] = UNKNOWN_RGB[1];
  rgb[i + 2] = UNKNOWN_RGB[2];
}
const sourceHash = createHash('sha256');
let count = 0;
for (let tileY = 21; tileY <= 95; tileY++) {
  // Only map pixels intersecting canonical bounds are decoded. The non-map
  // source panel ends at global source pixel 5384, world X=-22000.
  for (let tileX = 21; tileX <= 79; tileX++) {
    const bytes = await readFile(resolve(sourceDirectory, `5,${tileY},${tileX}.jpg`));
    sourceHash.update(bytes);
    const input = await sharp(bytes).removeAlpha().raw().toBuffer();
    const styled = stylizeRaster(input, 256, 256);
    const tile = await sharp(styled, { raw: { width: 256, height: 256, channels: 3 } })
      .resize(128, 128, { kernel: 'lanczos3' })
      .raw()
      .toBuffer();
    const world = tilePixelToWorld(tileX, tileY, 0, 0);
    const left = (world.x + 32000) / worldPerPixel;
    const top = (world.y + 24000) / worldPerPixel;
    const startX = tileX === 21 ? 4 : 0;
    const copyWidth = Math.min(128, size - left) - startX;
    const copyHeight = Math.min(128, size - top);
    if (copyWidth > 0 && copyHeight > 0) {
      for (let row = 0; row < copyHeight; row++) {
        tile.copy(
          rgb,
          ((top + row) * size + left + startX) * 3,
          (row * 128 + startX) * 3,
          (row * 128 + startX + copyWidth) * 3,
        );
      }
    }
    count++;
  }
  if ((tileY - 21) % 10 === 0) console.log(`Atlas source row ${tileY}/95 (${count} tiles)`);
}

// Create a shore-proximity halo from source land, not the source's discontinuous
// blue image texture. A blurred mask is a styling device, not bathymetry.
const landMask = Buffer.alloc(size * size);
for (let p = 0; p < landMask.length; p++) landMask[p] = rgb[p * 3] > 110 ? 255 : 0;
const proximity = await sharp(landMask, { raw: { width: size, height: size, channels: 1 } })
  .blur(28)
  .greyscale()
  .raw()
  .toBuffer();
applyCoastHalo(rgb, proximity);
const raster = sharp(rgb, { raw: { width: size, height: size, channels: 3 } });
const webp = await raster.clone().webp({ quality: 88, effort: 5 }).toBuffer();
await writeFile(resolve(outputDirectory, 'basemap.webp'), webp);
await raster
  .clone()
  .resize(2000, 2000)
  .webp({ quality: 86, effort: 5 })
  .toFile(resolve(outputDirectory, 'preview.webp'));
await raster
  .clone()
  .extract({ left: 2500, top: 496, width: 7500, height: 9504 })
  .resize({ height: 2000 })
  .webp({ quality: 88, effort: 5 })
  .toFile(resolve(outputDirectory, 'project-preview.webp'));
const compact = await raster.clone().resize(4096, 4096).webp({ quality: 88, effort: 5 }).toBuffer();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="4096" viewBox="-32000 -24000 40000 40000"><title>Leonida Atlas — approximate community cartography</title><desc>Derived from Yanis v16 / GTADB revision 7c3f8c295d64254e6b6d269b77c6f84fc4339f9c, CC BY 4.0. Raster source surfaces recolored; source legend excluded. Shore halo is decorative, not bathymetry. Unknown area at west and north is not geographic evidence.</desc><image x="-32000" y="-24000" width="40000" height="40000" href="data:image/webp;base64,${compact.toString('base64')}"/><g fill="#8ba6a8" font-family="sans-serif" font-size="210" letter-spacing="32"><text x="-15000" y="-23000">UNKNOWN · NO SOURCE COVERAGE</text></g></svg>\n`;
await writeFile(resolve(outputDirectory, 'basemap.svg'), svg);
const metadata = {
  title: 'Leonida Atlas source-derived basemap',
  source: 'Yanis v16 GTA VI Community Map via GTADB',
  sourceRevision: '7c3f8c295d64254e6b6d269b77c6f84fc4339f9c',
  sourceUrl:
    'https://github.com/rolux/gtadb.org/tree/7c3f8c295d64254e6b6d269b77c6f84fc4339f9c/maps',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  confidence: 'APPROXIMATE',
  official: false,
  derivative:
    'GTA6 Leonida Atlas palette and raster surface interpretation; source artwork is recolored, generalized and cropped. Source annotation colors are suppressed locally; source label remnants may persist where indistinguishable from road detail.',
  method:
    'Classify full-resolution JPEG pixels by source legend colors; map water, vegetation/relief, sand, urban ground, buildings, road and pavement to a muted atlas palette. Suppress colored annotations with bounded adjacent surface samples. Downsample each tile 2:1 with Lanczos. Assemble by exact canonical world registration. Replace source water texture with uniform blue and a source-land-mask Gaussian proximity halo (sigma 28 raster pixels / 112 world units), a decorative coastline emphasis, NOT depth or bathymetry. No fabricated land or road geometry. No elevation.bin used.',
  transform: 'world x = GTADB x * 2; SVG y = world z = -GTADB y * 2',
  bounds: { minX: -32000, minY: -24000, width: 40000, height: 40000 },
  geographicCoverage: { minX: -22000, minY: -22016, maxX: 8000, maxY: 16000 },
  excludedSource:
    'Western legend/screenshots column, global source x < 5384; rows above zoom-5 row 21 have no tiles. These areas are UNKNOWN, not sea.',
  resolution: { width: size, height: size, approximateWorldUnitsPerPixel: worldPerPixel },
  defaultSvgResolution: { width: 4096, height: 4096, approximateDecodedRgbaMiB: 64 },
  projectPreviewBounds: { minX: -22000, minY: -22016, width: 30000, height: 38016 },
  files: {
    svg: 'basemap.svg',
    optionalFullDetailRaster: 'basemap.webp',
    preview: 'preview.webp',
    projectPreview: 'project-preview.webp',
  },
  tilesProcessed: count,
  sourceBytesSha256: sourceHash.digest('hex'),
};
await writeFile(
  resolve(outputDirectory, 'metadata.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
);
await writeFile(
  resolve(outputDirectory, 'ATTRIBUTION.md'),
  `# Leonida Atlas basemap\n\nSource: **Yanis v16 GTA VI Community Map**, distributed by **GTADB** at pinned revision \`${metadata.sourceRevision}\`. [Source](${metadata.sourceUrl}).\n\nSource cartography is licensed [Creative Commons Attribution 4.0 International](${metadata.licenseUrl}). This original atlas presentation changes the palette, interprets surface colors, suppresses source annotations where practical, generalizes raster detail and excludes the source legend and screenshot column. This is a community reconstruction, **APPROXIMATE**, not official Rockstar geography. No source author endorsement is implied.\n\nRebuild: \`node scripts/build-leonida-atlas-basemap.mjs\`. Uses local pinned tiles and Astro's installed Sharp dependency; no network download. Registration, method, bounds and an input SHA-256 are in \`metadata.json\`. The SVG contains its raster internally and can be displayed directly with SVG \`<image>\`.\n\nUNKNOWN margins represent absent geographic source content. Color classification cannot reliably separate all neutral text from roads; residual marks must not be treated as new evidence. The land shading follows source raster colors, not a validated elevation measurement.\n`,
);
console.log(
  `Built ${size}×${size} atlas: ${count} source tiles; WebP ${(webp.length / 1048576).toFixed(2)} MiB; SVG ${(Buffer.byteLength(svg) / 1048576).toFixed(2)} MiB.`,
);
