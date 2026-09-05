import * as THREE from 'three';

import { gtadbToWorld, WORLD_METRES_PER_GTADB_UNIT, worldToGtadb } from './leonida-coordinates';
import { ALL_LOCATION_ANCHORS, getLeonidaZoneProfile, PLACE_ENTRY_VIEWS } from './walk-geography';
import type { AxisAlignedRectangle, WalkPoint } from './walk-engine';

export interface GtadbGroundTileAddress {
  readonly z: 5;
  readonly x: number;
  readonly y: number;
}

export interface GtadbBuildingFootprint {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type GtadbSurfaceClass =
  | 'ink'
  | 'road'
  | 'pavement'
  | 'building'
  | 'ground'
  | 'vegetation'
  | 'water'
  | 'marking'
  | 'unknown';

export interface GtadbRoadEdgeSegment {
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly rotation: number;
}

export interface GtadbGroundTileStream {
  readonly root: THREE.Group;
  readonly collisions: AxisAlignedRectangle[];
  sync(position: WalkPoint): void;
  setProtectedArrival(arrival: WalkPoint | null): void;
  dispose(): void;
}

const GTADB_TILE_ZOOM = 5 as const;
const GTADB_TILE_PIXELS = 256;
const GTADB_LEVEL_MIN = -16_384;
const GTADB_LEVEL_MAX = 16_384;
const GTADB_TILE_RANGE = { minX: 0, maxX: 79, minY: 21, maxY: 99 } as const;
const GTADB_TILE_WORLD_SIZE = GTADB_TILE_PIXELS * WORLD_METRES_PER_GTADB_UNIT;
const GTADB_PROTECTED_ARRIVAL_CLEARANCE_METRES = 3;

function tileKey(tile: GtadbGroundTileAddress): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

function isAvailableTile(tile: GtadbGroundTileAddress): boolean {
  return (
    tile.x >= GTADB_TILE_RANGE.minX &&
    tile.x <= GTADB_TILE_RANGE.maxX &&
    tile.y >= GTADB_TILE_RANGE.minY &&
    tile.y <= GTADB_TILE_RANGE.maxY
  );
}

export function getGtadbTileAddressFromWorld(position: WalkPoint): GtadbGroundTileAddress {
  const gtadb = worldToGtadb(position);
  return {
    z: GTADB_TILE_ZOOM,
    x: Math.floor((gtadb.x - GTADB_LEVEL_MIN) / GTADB_TILE_PIXELS),
    y: Math.floor((GTADB_LEVEL_MAX - gtadb.y) / GTADB_TILE_PIXELS),
  };
}

export function getGtadbTileWorldSize(): number {
  return GTADB_TILE_WORLD_SIZE;
}

export function getGtadbTileWorldCenter(tile: GtadbGroundTileAddress): WalkPoint {
  const gtadbX = GTADB_LEVEL_MIN + (tile.x + 0.5) * GTADB_TILE_PIXELS;
  const gtadbY = GTADB_LEVEL_MAX - (tile.y + 0.5) * GTADB_TILE_PIXELS;
  return gtadbToWorld({ x: gtadbX, y: gtadbY });
}

export function getGtadbTileWorldBounds(tile: GtadbGroundTileAddress): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const center = getGtadbTileWorldCenter(tile);
  const halfSize = GTADB_TILE_WORLD_SIZE / 2;
  return {
    minX: center.x - halfSize,
    maxX: center.x + halfSize,
    minZ: center.z - halfSize,
    maxZ: center.z + halfSize,
  };
}

export function getGtadbFootprintWorldBounds(
  tile: GtadbGroundTileAddress,
  footprint: GtadbBuildingFootprint,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const tileBounds = getGtadbTileWorldBounds(tile);
  return {
    minX: tileBounds.minX + footprint.x * WORLD_METRES_PER_GTADB_UNIT,
    maxX: tileBounds.minX + (footprint.x + footprint.width) * WORLD_METRES_PER_GTADB_UNIT,
    minZ: tileBounds.minZ + footprint.y * WORLD_METRES_PER_GTADB_UNIT,
    maxZ: tileBounds.minZ + (footprint.y + footprint.height) * WORLD_METRES_PER_GTADB_UNIT,
  };
}

/** True when an approximate footprint would obstruct an authored regional arrival road. */
export function doesGtadbFootprintOverlapArrivalCorridor(bounds: AxisAlignedRectangle): boolean {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const halfX = Math.abs(bounds.maxX - bounds.minX) / 2;
  const halfZ = Math.abs(bounds.maxZ - bounds.minZ) / 2;
  return Object.values(PLACE_ENTRY_VIEWS).some((view) => {
    const yaw = Math.atan2(view.position.x - view.target.x, view.position.z - view.target.z);
    const cosine = Math.cos(yaw);
    const sine = Math.sin(yaw);
    const deltaX = centerX - view.position.x;
    const deltaZ = centerZ - view.position.z;
    const localX = deltaX * cosine - deltaZ * sine;
    const localZ = deltaX * sine + deltaZ * cosine;
    const projectedHalfX = Math.abs(cosine) * halfX + Math.abs(sine) * halfZ;
    const projectedHalfZ = Math.abs(sine) * halfX + Math.abs(cosine) * halfZ;
    return (
      Math.abs(localX) <= 14 + projectedHalfX &&
      localZ + projectedHalfZ >= -292 &&
      localZ - projectedHalfZ <= 36
    );
  });
}

/** True when an approximate footprint reaches the dynamically selected arrival clearance. */
export function doesGtadbFootprintOverlapProtectedArrival(
  bounds: AxisAlignedRectangle,
  arrival: WalkPoint | null,
): boolean {
  if (!arrival) return false;
  return (
    arrival.x >= bounds.minX - GTADB_PROTECTED_ARRIVAL_CLEARANCE_METRES &&
    arrival.x <= bounds.maxX + GTADB_PROTECTED_ARRIVAL_CLEARANCE_METRES &&
    arrival.z >= bounds.minZ - GTADB_PROTECTED_ARRIVAL_CLEARANCE_METRES &&
    arrival.z <= bounds.maxZ + GTADB_PROTECTED_ARRIVAL_CLEARANCE_METRES
  );
}

function isBuildingFillPixel(pixels: Uint8Array | Uint8ClampedArray, offset: number): boolean {
  const red = pixels[offset] ?? 0;
  const green = pixels[offset + 1] ?? 0;
  const blue = pixels[offset + 2] ?? 0;
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  const lightness = (red + green + blue) / 3;
  return spread <= 12 && lightness >= 158 && lightness <= 197;
}

export function extractGtadbBuildingFootprints(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels = 4,
): GtadbBuildingFootprint[] {
  if (width <= 0 || height <= 0 || channels < 3) return [];
  const total = width * height;
  const mask = new Uint8Array(total);
  const visited = new Uint8Array(total);
  for (let pixel = 0; pixel < total; pixel += 1) {
    mask[pixel] = Number(isBuildingFillPixel(pixels, pixel * channels));
  }

  const candidates: Array<GtadbBuildingFootprint & { area: number }> = [];
  const queue = new Int32Array(total);
  for (let start = 0; start < total; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let queueStart = 0;
    let queueEnd = 1;
    queue[0] = start;
    visited[start] = 1;
    let area = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    while (queueStart < queueEnd) {
      const pixel = queue[queueStart++] ?? 0;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      area += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const neighbors = [pixel - 1, pixel + 1, pixel - width, pixel + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= total || visited[neighbor] || !mask[neighbor]) continue;
        if (Math.abs((neighbor % width) - x) > 1) continue;
        visited[neighbor] = 1;
        queue[queueEnd++] = neighbor;
      }
    }

    const footprintWidth = maxX - minX + 1;
    const footprintHeight = maxY - minY + 1;
    const fillRatio = area / (footprintWidth * footprintHeight);
    if (
      area >= 24 &&
      footprintWidth >= 4 &&
      footprintHeight >= 4 &&
      footprintWidth <= 96 &&
      footprintHeight <= 96 &&
      fillRatio >= 0.34
    ) {
      candidates.push({ x: minX, y: minY, width: footprintWidth, height: footprintHeight, area });
    }
  }

  const kept: GtadbBuildingFootprint[] = [];
  for (const candidate of candidates.sort(
    (left, right) => right.width * right.height - left.width * left.height,
  )) {
    const covered = kept.some((existing) => {
      const intersectionWidth = Math.max(
        0,
        Math.min(candidate.x + candidate.width, existing.x + existing.width) -
          Math.max(candidate.x, existing.x),
      );
      const intersectionHeight = Math.max(
        0,
        Math.min(candidate.y + candidate.height, existing.y + existing.height) -
          Math.max(candidate.y, existing.y),
      );
      return (intersectionWidth * intersectionHeight) / (candidate.width * candidate.height) >= 0.6;
    });
    if (!covered) {
      kept.push({
        x: candidate.x,
        y: candidate.y,
        width: candidate.width,
        height: candidate.height,
      });
    }
  }
  return kept;
}

export function getGtadbTileUrl(tile: GtadbGroundTileAddress): string {
  return `/assets/street-leonida/maps/gtadb-yanis-16-z5/${tile.z},${tile.y},${tile.x}.jpg`;
}

export function listGtadbGroundTiles(
  position: WalkPoint,
  radius: number,
): GtadbGroundTileAddress[] {
  const center = getGtadbTileAddressFromWorld(position);
  const safeRadius = Math.max(0, Math.floor(Number.isFinite(radius) ? radius : 0));
  const tiles: GtadbGroundTileAddress[] = [];

  for (let y = center.y - safeRadius; y <= center.y + safeRadius; y += 1) {
    for (let x = center.x - safeRadius; x <= center.x + safeRadius; x += 1) {
      const tile = { z: GTADB_TILE_ZOOM, x, y } as const;
      if (isAvailableTile(tile)) tiles.push(tile);
    }
  }
  return tiles;
}

function disposeTile(mesh: THREE.Mesh): void {
  const material = mesh.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
  material.map?.dispose();
  material.dispose();
  mesh.removeFromParent();
}

export function classifyGtadbSurfacePixel(
  red: number,
  green: number,
  blue: number,
): GtadbSurfaceClass {
  if (blue >= red + 45 && blue >= green + 25) return 'water';
  if (green >= red + 12 && green >= blue + 40) return 'vegetation';
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  if (spread > 18) return 'unknown';
  const lightness = (red + green + blue) / 3;
  if (lightness <= 28) return 'ink';
  if (lightness >= 244) return 'marking';
  if (lightness >= 55 && lightness <= 101) return 'road';
  if (lightness > 101 && lightness <= 138) return 'pavement';
  if (lightness >= 150 && lightness <= 197) return 'building';
  if (lightness > 197 && lightness < 244) return 'ground';
  return 'unknown';
}

function isRoadPixel(pixels: Uint8Array | Uint8ClampedArray, offset: number): boolean {
  return (
    classifyGtadbSurfacePixel(
      pixels[offset] ?? 0,
      pixels[offset + 1] ?? 0,
      pixels[offset + 2] ?? 0,
    ) === 'road'
  );
}

export function extractGtadbRoadEdgeSegments(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels = 4,
  stride = 4,
): GtadbRoadEdgeSegment[] {
  if (width <= 0 || height <= 0 || channels < 3) return [];
  const step = Math.max(1, Math.floor(Number.isFinite(stride) ? stride : 1));
  const columns = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  const road = new Uint8Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const minX = column * step;
      const minY = row * step;
      const maxX = Math.min(width, minX + step);
      const maxY = Math.min(height, minY + step);
      let roadPixels = 0;
      let sampledPixels = 0;
      for (let y = minY; y < maxY; y += 1) {
        for (let x = minX; x < maxX; x += 1) {
          sampledPixels += 1;
          if (isRoadPixel(pixels, (y * width + x) * channels)) roadPixels += 1;
        }
      }
      road[row * columns + column] = Number(roadPixels / Math.max(1, sampledPixels) >= 0.24);
    }
  }

  const isRoadCell = (column: number, row: number): boolean =>
    column >= 0 && row >= 0 && column < columns && row < rows
      ? road[row * columns + column] === 1
      : false;
  const edges: GtadbRoadEdgeSegment[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (!isRoadCell(column, row)) continue;
      const minX = column * step;
      const minY = row * step;
      const cellWidth = Math.min(step, width - minX);
      const cellHeight = Math.min(step, height - minY);
      if (!isRoadCell(column - 1, row)) {
        edges.push({
          x: minX,
          y: minY + cellHeight / 2,
          length: cellHeight,
          rotation: Math.PI / 2,
        });
      }
      if (!isRoadCell(column + 1, row)) {
        edges.push({
          x: minX + cellWidth,
          y: minY + cellHeight / 2,
          length: cellHeight,
          rotation: Math.PI / 2,
        });
      }
      if (!isRoadCell(column, row - 1)) {
        edges.push({ x: minX + cellWidth / 2, y: minY, length: cellWidth, rotation: 0 });
      }
      if (!isRoadCell(column, row + 1)) {
        edges.push({
          x: minX + cellWidth / 2,
          y: minY + cellHeight,
          length: cellWidth,
          rotation: 0,
        });
      }
    }
  }
  return edges;
}

const BUILDING_PALETTES: Readonly<Record<string, readonly number[]>> = {
  'Vice City': [0xe8e3d8, 0xcdd5d7, 0xd5b5aa, 0xa9bdc2, 0xf0eee6],
  'Port Gellhorn': [0x988c7e, 0xb7a38d, 0x77838a, 0xb58b78],
  Ambrosia: [0xb9a17d, 0x95775d, 0x9b9c91, 0xc2b38e],
  'Leonida Keys': [0xe3ddca, 0xb7c9c0, 0xd0b990, 0xe7e5db],
  Grassrivers: [0x766c55, 0x8b8874, 0x655f50],
  'Mount Kalaga': [0x796e5b, 0x8c8d82, 0x685e4f],
};

export function createGtadbBuildingFacadeTexture(): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const localX = x % 16;
      const localY = y % 16;
      const column = Math.floor(x / 16);
      const row = Math.floor(y / 16);
      const window = localX >= 3 && localX <= 12 && localY >= 4 && localY <= 13;
      const mullion = window && (localX === 7 || localX === 8);
      const reflection = window && localY === 5 && localX >= 4 && localX <= 11;
      const litWindow = window && !mullion && (column * 7 + row * 11) % 13 === 0;
      const panelJoint = localX === 0 || localY === 0;
      const concreteNoise = (x * 17 + y * 31) % 9;

      let red = 207 + concreteNoise;
      let green = 211 + concreteNoise;
      let blue = 209 + concreteNoise;
      if (panelJoint) {
        red = 164;
        green = 170;
        blue = 169;
      } else if (mullion) {
        red = 19;
        green = 27;
        blue = 33;
      } else if (litWindow) {
        red = 232;
        green = 154;
        blue = 84;
      } else if (reflection) {
        red = 64;
        green = 104;
        blue = 132;
      } else if (window) {
        red = 27;
        green = 52;
        blue = 73;
      }

      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createGtadbBuildingEmissiveTexture(): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const localX = x % 16;
      const localY = y % 16;
      const column = Math.floor(x / 16);
      const row = Math.floor(y / 16);
      const windowInterior =
        localX >= 3 && localX <= 12 && localX !== 7 && localX !== 8 && localY >= 4 && localY <= 13;
      const lit = windowInterior && (column * 7 + row * 11) % 13 === 0;
      const value = lit ? 255 : 0;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function getGtadbBuildingDetailLevels(height: number): number[] {
  if (!Number.isFinite(height) || height < 16) return [];
  const levels: number[] = [];
  for (let elevation = 8; elevation <= height - 2.5; elevation += 4.5) {
    levels.push(elevation);
  }
  return levels;
}

function deterministicUnit(...values: number[]): number {
  let state = 2166136261;
  for (const value of values) {
    state ^= Math.round(value * 1000);
    state = Math.imul(state, 16777619);
  }
  return (state >>> 0) / 4294967295;
}

function buildingHeight(
  regionName: string,
  footprint: GtadbBuildingFootprint,
  tile: GtadbGroundTileAddress,
): number {
  const random = deterministicUnit(tile.x, tile.y, footprint.x, footprint.y);
  const footprintScale = Math.sqrt(footprint.width * footprint.height);
  if (regionName === 'Vice City') {
    const tower = random > 0.88 ? 42 + random * 68 : 0;
    return tower || THREE.MathUtils.clamp(7 + footprintScale * 0.28 + random * 18, 7, 36);
  }
  if (regionName === 'Ambrosia') {
    return random > 0.94
      ? 24 + random * 18
      : THREE.MathUtils.clamp(4 + footprintScale * 0.2 + random * 7, 4, 17);
  }
  if (regionName === 'Port Gellhorn') return 3.6 + random * 7.4;
  if (regionName === 'Leonida Keys') return 3.8 + random * 8.2;
  if (regionName === 'Mount Kalaga') return 3.4 + random * 6.6;
  return 3.2 + random * 5.8;
}

function readTilePixels(texture: THREE.Texture): ImageData | null {
  if (typeof document === 'undefined' || !texture.image) return null;
  const canvas = document.createElement('canvas');
  canvas.width = GTADB_TILE_PIXELS;
  canvas.height = GTADB_TILE_PIXELS;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(texture.image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export function restyleGtadbGroundPixels(
  pixels: Uint8Array | Uint8ClampedArray,
  channels: number,
): Uint8Array {
  const styled = new Uint8Array(pixels);
  if (channels < 3) return styled;
  for (let offset = 0; offset < styled.length; offset += channels) {
    const red = pixels[offset] ?? 0;
    const green = pixels[offset + 1] ?? 0;
    const blue = pixels[offset + 2] ?? 0;
    const surface = classifyGtadbSurfacePixel(red, green, blue);
    const color = (
      {
        ink: [35, 38, 42],
        road: [28, 31, 35],
        pavement: [111, 109, 104],
        building: [120, 119, 115],
        ground: [105, 105, 98],
        vegetation: [55, 82, 48],
        water: [24, 86, 106],
        marking: [170, 168, 158],
        unknown: [82, 84, 80],
      } as const
    )[surface];
    styled[offset] = color[0];
    styled[offset + 1] = color[1];
    styled[offset + 2] = color[2];
  }
  return styled;
}

function createStyledGroundTexture(imageData: ImageData, anisotropy: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    restyleGtadbGroundPixels(imageData.data, 4),
    imageData.width,
    imageData.height,
    THREE.RGBAFormat,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.flipY = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createGtadbGroundTileStream(options: {
  readonly radius: number;
  readonly anisotropy: number;
}): GtadbGroundTileStream {
  const root = new THREE.Group();
  root.name = 'street-leonida/gtadb-ground-cartography';
  root.userData.source = 'GTADB yanis,16';
  root.userData.revision = '7c3f8c295d64254e6b6d269b77c6f84fc4339f9c';
  root.userData.license = 'CC BY 4.0';
  root.userData.evidence = 'APPROXIMATE';

  const geometry = new THREE.PlaneGeometry(GTADB_TILE_WORLD_SIZE, GTADB_TILE_WORLD_SIZE);
  geometry.rotateX(-Math.PI / 2);
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingDetailGeometry = new THREE.BoxGeometry(1, 1, 1);
  const curbGeometry = new THREE.BoxGeometry(1, 0.16, 0.28);
  const lampPoleGeometry = new THREE.CylinderGeometry(0.08, 0.11, 4.8, 7);
  const lampHeadGeometry = new THREE.BoxGeometry(0.6, 0.16, 0.22);
  const palmTrunkGeometry = new THREE.CylinderGeometry(0.12, 0.2, 5.8, 7);
  const palmCrownGeometry = new THREE.ConeGeometry(1.35, 0.65, 7);
  const buildingFacadeTexture = createGtadbBuildingFacadeTexture();
  const buildingEmissiveTexture = createGtadbBuildingEmissiveTexture();
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: buildingFacadeTexture,
    emissive: 0xffb36b,
    emissiveMap: buildingEmissiveTexture,
    emissiveIntensity: 0.28,
    roughness: 0.7,
    metalness: 0.08,
    envMapIntensity: 1.08,
  });
  const balconyMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f7d80,
    roughness: 0.56,
    metalness: 0.22,
  });
  const lobbyMaterial = new THREE.MeshStandardMaterial({
    color: 0x16485b,
    emissive: 0x0b2935,
    emissiveIntensity: 0.54,
    roughness: 0.22,
    metalness: 0.38,
  });
  const rooftopMaterial = new THREE.MeshStandardMaterial({
    color: 0x747a78,
    roughness: 0.76,
    metalness: 0.18,
  });
  const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x706d67, roughness: 1 });
  const lampPoleMaterial = new THREE.MeshStandardMaterial({
    color: 0x29323a,
    roughness: 0.48,
    metalness: 0.62,
  });
  const lampHeadMaterial = new THREE.MeshStandardMaterial({
    color: 0xffdba0,
    emissive: 0xff9a43,
    emissiveIntensity: 1.8,
    roughness: 0.28,
  });
  const palmTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6f4b32, roughness: 1 });
  const palmCrownMaterial = new THREE.MeshStandardMaterial({ color: 0x276b44, roughness: 0.92 });
  const loader = new THREE.TextureLoader();
  const meshes = new Map<string, THREE.Mesh>();
  const buildingMeshes = new Map<string, THREE.InstancedMesh>();
  const buildingDetailGroups = new Map<string, THREE.Group>();
  const roadDetailGroups = new Map<string, THREE.Group>();
  const roadSegments = new Map<string, readonly GtadbRoadEdgeSegment[]>();
  const buildingFootprints = new Map<string, readonly GtadbBuildingFootprint[]>();
  const collisionGroups = new Map<string, AxisAlignedRectangle[]>();
  const collisions: AxisAlignedRectangle[] = [];
  let centerKey = '';
  let currentCenter: GtadbGroundTileAddress | null = null;
  let protectedArrival: WalkPoint | null = null;
  let disposed = false;

  const refreshBuildingStats = (): void => {
    collisions.splice(0, collisions.length, ...[...collisionGroups.values()].flat());
    root.userData.buildingCount = [...buildingMeshes.values()].reduce(
      (count, mesh) => count + mesh.count,
      0,
    );
    root.userData.buildingDetailCount = [...buildingDetailGroups.values()].reduce(
      (count, group) => count + Number(group.userData.detailCount ?? 0),
      0,
    );
  };

  const disposeInstancedMeshBuffers = (subtree: THREE.Object3D): void => {
    subtree.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
  };

  const removeBuildings = (key: string): void => {
    const buildings = buildingMeshes.get(key);
    if (buildings) {
      disposeInstancedMeshBuffers(buildings);
      buildings.removeFromParent();
    }
    buildingMeshes.delete(key);
    const buildingDetails = buildingDetailGroups.get(key);
    if (buildingDetails) {
      disposeInstancedMeshBuffers(buildingDetails);
      buildingDetails.removeFromParent();
    }
    buildingDetailGroups.delete(key);
    collisionGroups.delete(key);
    refreshBuildingStats();
  };

  const refreshRoadStats = (): void => {
    root.userData.roadSegmentCount = [...roadSegments.values()].reduce(
      (count, segments) => count + segments.length,
      0,
    );
    root.userData.roadsideDetailCount = [...roadDetailGroups.values()].reduce(
      (count, group) => count + Number(group.userData.furnitureCount ?? 0),
      0,
    );
  };

  const removeRoadDetails = (key: string): void => {
    const roadDetails = roadDetailGroups.get(key);
    if (roadDetails) {
      disposeInstancedMeshBuffers(roadDetails);
      roadDetails.removeFromParent();
    }
    roadDetailGroups.delete(key);
    refreshRoadStats();
  };

  const addRoadDetails = (
    key: string,
    tile: GtadbGroundTileAddress,
    segments: readonly GtadbRoadEdgeSegment[],
    includeFurniture: boolean,
  ): void => {
    removeRoadDetails(key);
    if (segments.length === 0) return;
    const group = new THREE.Group();
    group.name = `gtadb-road-details-${tile.x}-${tile.y}`;
    group.userData.evidence = 'APPROXIMATE';
    group.userData.source = 'GTADB raster road boundaries';
    group.userData.includeFurniture = includeFurniture;
    const tileBounds = getGtadbTileWorldBounds(tile);
    const curbs = new THREE.InstancedMesh(curbGeometry, curbMaterial, segments.length);
    const dummy = new THREE.Object3D();
    segments.forEach((segment, index) => {
      dummy.position.set(
        tileBounds.minX + segment.x * WORLD_METRES_PER_GTADB_UNIT,
        0.07,
        tileBounds.minZ + segment.y * WORLD_METRES_PER_GTADB_UNIT,
      );
      dummy.rotation.set(0, segment.rotation, 0);
      dummy.scale.set(segment.length * WORLD_METRES_PER_GTADB_UNIT, 1, 1);
      dummy.updateMatrix();
      curbs.setMatrixAt(index, dummy.matrix);
    });
    curbs.instanceMatrix.needsUpdate = true;
    curbs.name = 'gtadb-road-curbs';
    curbs.receiveShadow = true;
    group.add(curbs);

    const fixtures = includeFurniture ? segments.filter((_, index) => index % 24 === 0) : [];
    if (fixtures.length > 0) {
      const poles = new THREE.InstancedMesh(lampPoleGeometry, lampPoleMaterial, fixtures.length);
      const heads = new THREE.InstancedMesh(lampHeadGeometry, lampHeadMaterial, fixtures.length);
      fixtures.forEach((segment, index) => {
        const x = tileBounds.minX + segment.x * WORLD_METRES_PER_GTADB_UNIT;
        const z = tileBounds.minZ + segment.y * WORLD_METRES_PER_GTADB_UNIT;
        dummy.rotation.set(0, segment.rotation, 0);
        dummy.scale.set(1, 1, 1);
        dummy.position.set(x, 2.48, z);
        dummy.updateMatrix();
        poles.setMatrixAt(index, dummy.matrix);
        dummy.position.y = 4.92;
        dummy.updateMatrix();
        heads.setMatrixAt(index, dummy.matrix);
      });
      poles.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      poles.name = 'gtadb-road-lamp-poles';
      heads.name = 'gtadb-road-lamp-heads';
      group.add(poles, heads);
    }

    const palms = includeFurniture ? segments.filter((_, index) => index % 41 === 0) : [];
    if (palms.length > 0) {
      const trunks = new THREE.InstancedMesh(palmTrunkGeometry, palmTrunkMaterial, palms.length);
      const crowns = new THREE.InstancedMesh(palmCrownGeometry, palmCrownMaterial, palms.length);
      palms.forEach((segment, index) => {
        const x = tileBounds.minX + segment.x * WORLD_METRES_PER_GTADB_UNIT;
        const z = tileBounds.minZ + segment.y * WORLD_METRES_PER_GTADB_UNIT;
        dummy.rotation.set(0, deterministicUnit(tile.x, tile.y, index) * Math.PI * 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.position.set(x, 2.98, z);
        dummy.updateMatrix();
        trunks.setMatrixAt(index, dummy.matrix);
        dummy.position.y = 6.15;
        dummy.updateMatrix();
        crowns.setMatrixAt(index, dummy.matrix);
      });
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      trunks.name = 'gtadb-roadside-palm-trunks';
      crowns.name = 'gtadb-roadside-palm-crowns';
      group.add(trunks, crowns);
    }
    group.userData.furnitureCount = fixtures.length + palms.length;
    root.add(group);
    roadDetailGroups.set(key, group);
    refreshRoadStats();
  };

  const syncRoadDetails = (center: GtadbGroundTileAddress): void => {
    for (const [key, segments] of roadSegments) {
      const tile = meshes.get(key)?.userData.tile as GtadbGroundTileAddress | undefined;
      if (!tile) continue;
      const includeFurniture =
        Math.max(Math.abs(tile.x - center.x), Math.abs(tile.y - center.y)) <= 1;
      const existing = roadDetailGroups.get(key);
      if (existing?.userData.includeFurniture === includeFurniture) continue;
      addRoadDetails(key, tile, segments, includeFurniture);
    }
  };

  const addBuildings = (
    key: string,
    tile: GtadbGroundTileAddress,
    footprints: readonly GtadbBuildingFootprint[],
  ): void => {
    removeBuildings(key);
    const sampleStep = options.radius <= 2 ? 2 : 1;
    const sampled = footprints.filter((footprint, index) => {
      if (index % sampleStep !== 0) return false;
      const bounds = getGtadbFootprintWorldBounds(tile, footprint);
      if (doesGtadbFootprintOverlapArrivalCorridor(bounds)) return false;
      if (doesGtadbFootprintOverlapProtectedArrival(bounds, protectedArrival)) return false;
      return !ALL_LOCATION_ANCHORS.some(
        ({ world }) =>
          world.x >= bounds.minX - 18 &&
          world.x <= bounds.maxX + 18 &&
          world.z >= bounds.minZ - 18 &&
          world.z <= bounds.maxZ + 18,
      );
    });
    if (sampled.length === 0) return;
    const tileCenter = getGtadbTileWorldCenter(tile);
    const regionName = getLeonidaZoneProfile(tileCenter).name;
    const palette = BUILDING_PALETTES[regionName] ?? BUILDING_PALETTES['Port Gellhorn']!;
    const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, sampled.length);
    const dummy = new THREE.Object3D();
    const tileCollisions: AxisAlignedRectangle[] = [];
    const balconies: Array<{ x: number; y: number; z: number; width: number; depth: number }> = [];
    const lobbies: Array<{ x: number; y: number; z: number; width: number; depth: number }> = [];
    const rooftops: Array<{ x: number; y: number; z: number; width: number; depth: number }> = [];

    sampled.forEach((footprint, index) => {
      const bounds = getGtadbFootprintWorldBounds(tile, footprint);
      const width = Math.max(3, (bounds.maxX - bounds.minX) * 0.88);
      const depth = Math.max(3, (bounds.maxZ - bounds.minZ) * 0.88);
      const height = buildingHeight(regionName, footprint, tile);
      const x = (bounds.minX + bounds.maxX) / 2;
      const z = (bounds.minZ + bounds.maxZ) / 2;
      dummy.position.set(x, height / 2 + 0.03, z);
      dummy.scale.set(width, height, depth);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix);
      buildings.setColorAt(
        index,
        new THREE.Color(
          palette[
            Math.floor(deterministicUnit(tile.x, tile.y, footprint.x, index) * palette.length)
          ] ?? palette[0],
        ),
      );
      getGtadbBuildingDetailLevels(height).forEach((elevation) => {
        balconies.push({
          x,
          y: elevation,
          z,
          width: width + 0.7,
          depth: depth + 0.7,
        });
      });
      lobbies.push({ x, y: 1.35, z, width: width + 0.12, depth: depth + 0.12 });
      rooftops.push({
        x,
        y: height + 0.62,
        z,
        width: Math.max(2.2, width * 0.62),
        depth: Math.max(2.2, depth * 0.62),
      });
      tileCollisions.push({
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
      });
    });
    buildings.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    buildings.name = `gtadb-approximate-buildings-${tile.x}-${tile.y}`;
    buildings.castShadow = false;
    buildings.receiveShadow = true;
    buildings.userData.evidence = 'APPROXIMATE';
    buildings.userData.source = 'GTADB footprints + Rockstar regional visual references';
    root.add(buildings);
    buildingMeshes.set(key, buildings);
    const detailGroup = new THREE.Group();
    detailGroup.name = `gtadb-building-details-${tile.x}-${tile.y}`;
    const addDetailInstances = (
      name: string,
      placements: readonly { x: number; y: number; z: number; width: number; depth: number }[],
      height: number,
      material: THREE.MeshStandardMaterial,
    ): void => {
      if (placements.length === 0) return;
      const instances = new THREE.InstancedMesh(
        buildingDetailGeometry,
        material,
        placements.length,
      );
      placements.forEach((placement, index) => {
        dummy.position.set(placement.x, placement.y, placement.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(placement.width, height, placement.depth);
        dummy.updateMatrix();
        instances.setMatrixAt(index, dummy.matrix);
      });
      instances.instanceMatrix.needsUpdate = true;
      instances.name = name;
      instances.receiveShadow = true;
      detailGroup.add(instances);
    };
    addDetailInstances('gtadb-balcony-floor-lines', balconies, 0.16, balconyMaterial);
    addDetailInstances('gtadb-glazed-lobbies', lobbies, 2.7, lobbyMaterial);
    addDetailInstances('gtadb-rooftop-penthouses', rooftops, 1.24, rooftopMaterial);
    detailGroup.userData.detailCount = balconies.length + lobbies.length + rooftops.length;
    detailGroup.userData.evidence = 'APPROXIMATE';
    root.add(detailGroup);
    buildingDetailGroups.set(key, detailGroup);
    collisionGroups.set(key, tileCollisions);
    refreshBuildingStats();
  };

  return {
    root,
    collisions,
    sync(position) {
      if (disposed) return;
      const center = getGtadbTileAddressFromWorld(position);
      currentCenter = center;
      const nextCenterKey = tileKey(center);
      if (nextCenterKey === centerKey) return;
      centerKey = nextCenterKey;

      const desiredTiles = listGtadbGroundTiles(position, options.radius);
      const desiredKeys = new Set(desiredTiles.map(tileKey));
      for (const [key, mesh] of meshes) {
        if (desiredKeys.has(key)) continue;
        removeBuildings(key);
        buildingFootprints.delete(key);
        removeRoadDetails(key);
        roadSegments.delete(key);
        refreshRoadStats();
        disposeTile(mesh);
        meshes.delete(key);
      }

      for (const tile of desiredTiles) {
        const key = tileKey(tile);
        if (meshes.has(key)) continue;
        const texture = loader.load(getGtadbTileUrl(tile), (loadedTexture) => {
          if (disposed || !meshes.has(key)) return;
          try {
            const imageData = readTilePixels(loadedTexture);
            if (!imageData) return;
            const footprints = extractGtadbBuildingFootprints(
              imageData.data,
              imageData.width,
              imageData.height,
              4,
            );
            buildingFootprints.set(key, footprints);
            addBuildings(key, tile, footprints);
            const segments = extractGtadbRoadEdgeSegments(
              imageData.data,
              imageData.width,
              imageData.height,
              4,
              options.radius <= 2 ? 8 : 4,
            );
            roadSegments.set(key, segments);
            if (currentCenter) syncRoadDetails(currentCenter);
            const activeTile = meshes.get(key);
            if (activeTile) {
              const material = activeTile.material as
                THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
              material.map = createStyledGroundTexture(imageData, texture.anisotropy);
              material.color.setHex(0xffffff);
              material.needsUpdate = true;
              loadedTexture.dispose();
            }
          } catch {
            // The exact raster remains usable if a browser cannot expose its decoded pixels.
          }
        });
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.max(1, options.anisotropy);
        const material = new THREE.MeshBasicMaterial({
          color: 0x8e928d,
          map: texture,
          fog: true,
        });
        const mesh = new THREE.Mesh(geometry, material);
        const centerPosition = getGtadbTileWorldCenter(tile);
        mesh.name = `gtadb-ground-tile-${tile.x}-${tile.y}`;
        mesh.position.set(centerPosition.x, 0.055, centerPosition.z);
        mesh.receiveShadow = false;
        mesh.userData.evidence = 'APPROXIMATE';
        mesh.userData.tile = tile;
        root.add(mesh);
        meshes.set(key, mesh);
      }
      syncRoadDetails(center);
      root.userData.tileCount = meshes.size;
    },
    setProtectedArrival(arrival) {
      if (disposed) return;
      const nextArrival = arrival ? { x: arrival.x, z: arrival.z } : null;
      if (
        protectedArrival?.x === nextArrival?.x &&
        protectedArrival?.z === nextArrival?.z &&
        Boolean(protectedArrival) === Boolean(nextArrival)
      ) {
        return;
      }
      protectedArrival = nextArrival;
      for (const [key, footprints] of buildingFootprints) {
        const tile = meshes.get(key)?.userData.tile as GtadbGroundTileAddress | undefined;
        if (tile) addBuildings(key, tile, footprints);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mesh of meshes.values()) disposeTile(mesh);
      meshes.clear();
      for (const key of [...roadDetailGroups.keys()]) removeRoadDetails(key);
      roadSegments.clear();
      for (const mesh of buildingMeshes.values()) {
        disposeInstancedMeshBuffers(mesh);
        mesh.removeFromParent();
      }
      buildingMeshes.clear();
      for (const group of buildingDetailGroups.values()) {
        disposeInstancedMeshBuffers(group);
        group.removeFromParent();
      }
      buildingDetailGroups.clear();
      buildingFootprints.clear();
      protectedArrival = null;
      disposeInstancedMeshBuffers(root);
      collisionGroups.clear();
      collisions.splice(0, collisions.length);
      geometry.dispose();
      buildingGeometry.dispose();
      buildingDetailGeometry.dispose();
      buildingFacadeTexture.dispose();
      buildingEmissiveTexture.dispose();
      buildingMaterial.dispose();
      balconyMaterial.dispose();
      lobbyMaterial.dispose();
      rooftopMaterial.dispose();
      curbGeometry.dispose();
      lampPoleGeometry.dispose();
      lampHeadGeometry.dispose();
      palmTrunkGeometry.dispose();
      palmCrownGeometry.dispose();
      curbMaterial.dispose();
      lampPoleMaterial.dispose();
      lampHeadMaterial.dispose();
      palmTrunkMaterial.dispose();
      palmCrownMaterial.dispose();
      root.removeFromParent();
    },
  };
}
