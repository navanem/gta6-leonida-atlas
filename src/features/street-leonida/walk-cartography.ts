import { publicPath } from '../explorer/public-path';
import * as THREE from 'three';

import { gtadbToWorld, WORLD_METRES_PER_GTADB_UNIT, worldToGtadb } from './leonida-coordinates';
import { ALL_LOCATION_ANCHORS, getLeonidaZoneProfile, PLACE_ENTRY_VIEWS } from './walk-geography';
import type { AxisAlignedRectangle, WalkPoint } from './walk-engine';
import { extractRasterBuildingFootprints, type RasterBuildingFootprint } from './walk-footprints';
import {
  createBuildingFabricKit,
  type BuildingFabric,
  type FabricBuilding,
} from './walk-building-fabric';
import { simplifyRoadEdges, sampleRoadFixtures } from './walk-road-geometry';

export interface GtadbGroundTileAddress {
  readonly z: 5;
  readonly x: number;
  readonly y: number;
}

export type GtadbBuildingFootprint = RasterBuildingFootprint;

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
  readonly pathId?: number;
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
  const oriented = footprint.oriented;
  if (oriented) {
    const c = Math.abs(Math.cos(oriented.rotation)),
      s = Math.abs(Math.sin(oriented.rotation));
    const halfX = ((oriented.width * c + oriented.depth * s) * WORLD_METRES_PER_GTADB_UNIT) / 2;
    const halfZ = ((oriented.width * s + oriented.depth * c) * WORLD_METRES_PER_GTADB_UNIT) / 2;
    const x = tileBounds.minX + oriented.centerX * WORLD_METRES_PER_GTADB_UNIT;
    const z = tileBounds.minZ + oriented.centerY * WORLD_METRES_PER_GTADB_UNIT;
    return {
      minX: x - halfX,
      maxX: x + halfX,
      minZ: z - halfZ,
      maxZ: z + halfZ,
    };
  }
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

export const extractGtadbBuildingFootprints = extractRasterBuildingFootprints;

export function getGtadbTileUrl(tile: GtadbGroundTileAddress): string {
  return publicPath(
    `assets/street-leonida/maps/gtadb-yanis-16-z5/${tile.z},${tile.y},${tile.x}.jpg`,
  );
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
        edges.push({
          x: minX + cellWidth / 2,
          y: minY,
          length: cellWidth,
          rotation: 0,
        });
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

export {
  createBuildingFacadeTexture as createGtadbBuildingFacadeTexture,
  createBuildingEmissiveTexture as createGtadbBuildingEmissiveTexture,
} from './walk-building-fabric';

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

function createRoadPalmCrownGeometry(): THREE.BufferGeometry {
  const vertices: number[] = [],
    indices: number[] = [];
  const radii = [0, 0.75, 1.65, 2.5, 3.05];
  const heights = [0.15, 0.8, 0.62, 0.02, -0.8];
  const widths = [0.035, 0.24, 0.36, 0.22, 0.012];
  for (let frond = 0; frond < 9; frond++) {
    const angle = (frond * Math.PI * 2) / 9,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const first = vertices.length / 3;
    for (let station = 0; station < radii.length; station++) {
      for (const side of [-1, 1])
        vertices.push(
          c * radii[station]! - s * widths[station]! * side,
          heights[station]! + (frond % 3) * 0.07,
          s * radii[station]! + c * widths[station]! * side,
        );
      if (station > 0) {
        const a = first + (station - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGtadbGroundTileStream(options: {
  readonly radius: number;
  readonly anisotropy: number;
  readonly detail?: 'desktop' | 'mobile';
  readonly detailDistance?: number;
}): GtadbGroundTileStream {
  const root = new THREE.Group();
  root.name = 'street-leonida/gtadb-ground-cartography';
  root.userData.source = 'GTADB yanis,16';
  root.userData.revision = '7c3f8c295d64254e6b6d269b77c6f84fc4339f9c';
  root.userData.license = 'CC BY 4.0';
  root.userData.evidence = 'APPROXIMATE';

  const geometry = new THREE.PlaneGeometry(GTADB_TILE_WORLD_SIZE, GTADB_TILE_WORLD_SIZE);
  geometry.rotateX(-Math.PI / 2);
  const fabricKit = createBuildingFabricKit();
  const detail = options.detail ?? 'desktop';
  const detailDistance = Math.max(100, options.detailDistance ?? (detail === 'mobile' ? 220 : 300));
  const curbGeometry = new THREE.BoxGeometry(1, 0.16, 0.28);
  const lampPoleGeometry = new THREE.CylinderGeometry(0.08, 0.11, 4.8, 7);
  const lampHeadGeometry = new THREE.BoxGeometry(0.6, 0.16, 0.22);
  const palmTrunkGeometry = new THREE.CylinderGeometry(0.12, 0.2, 5.8, 7);
  const palmCrownGeometry = createRoadPalmCrownGeometry();
  const curbMaterial = new THREE.MeshStandardMaterial({
    color: 0x706d67,
    roughness: 1,
  });
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
  const palmTrunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f4b32,
    roughness: 1,
  });
  const palmCrownMaterial = new THREE.MeshStandardMaterial({
    color: 0x426b3f,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const loader = new THREE.TextureLoader();
  const meshes = new Map<string, THREE.Mesh>();
  const buildingFabrics = new Map<string, BuildingFabric>();
  const roadDetailGroups = new Map<string, THREE.Group>();
  const roadSegments = new Map<string, readonly GtadbRoadEdgeSegment[]>();
  const buildingFootprints = new Map<string, readonly GtadbBuildingFootprint[]>();
  const collisionGroups = new Map<string, AxisAlignedRectangle[]>();
  const collisions: AxisAlignedRectangle[] = [];
  let centerKey = '';
  let currentCenter: GtadbGroundTileAddress | null = null;
  let currentPosition: WalkPoint | null = null;
  let protectedArrival: WalkPoint | null = null;
  let disposed = false;

  const refreshBuildingStats = (): void => {
    collisions.splice(0, collisions.length, ...[...collisionGroups.values()].flat());
    root.userData.buildingCount = [...buildingFabrics.values()].reduce(
      (count, fabric) => count + fabric.buildingCount,
      0,
    );
    root.userData.buildingDetailCount = [...buildingFabrics.values()].reduce(
      (count, fabric) => count + fabric.detailCount,
      0,
    );
  };

  const disposeInstancedMeshBuffers = (subtree: THREE.Object3D): void => {
    subtree.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
  };

  const removeBuildings = (key: string): void => {
    buildingFabrics.get(key)?.dispose();
    buildingFabrics.delete(key);
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
      dummy.rotation.set(0, -segment.rotation, 0);
      dummy.scale.set(segment.length * WORLD_METRES_PER_GTADB_UNIT, 1, 1);
      dummy.updateMatrix();
      curbs.setMatrixAt(index, dummy.matrix);
    });
    curbs.instanceMatrix.needsUpdate = true;
    curbs.name = 'gtadb-road-curbs';
    curbs.receiveShadow = true;
    group.add(curbs);

    const fixtures = includeFurniture ? sampleRoadFixtures(segments, 48) : [];
    if (fixtures.length > 0) {
      const poles = new THREE.InstancedMesh(lampPoleGeometry, lampPoleMaterial, fixtures.length);
      const heads = new THREE.InstancedMesh(lampHeadGeometry, lampHeadMaterial, fixtures.length);
      fixtures.forEach((segment, index) => {
        const x = tileBounds.minX + segment.x * WORLD_METRES_PER_GTADB_UNIT;
        const z = tileBounds.minZ + segment.y * WORLD_METRES_PER_GTADB_UNIT;
        dummy.rotation.set(0, -segment.rotation, 0);
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

    const region = getLeonidaZoneProfile(getGtadbTileWorldCenter(tile)).name;
    const palms =
      includeFurniture && ['Vice City', 'Leonida Keys', 'Port Gellhorn'].includes(region)
        ? sampleRoadFixtures(segments, 68)
        : [];
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

  const hasCloseDetail = (tile: GtadbGroundTileAddress): boolean => {
    if (!currentPosition) return false;
    const bounds = getGtadbTileWorldBounds(tile);
    const dx = Math.max(bounds.minX - currentPosition.x, 0, currentPosition.x - bounds.maxX);
    const dz = Math.max(bounds.minZ - currentPosition.z, 0, currentPosition.z - bounds.maxZ);
    return Math.hypot(dx, dz) <= detailDistance;
  };
  const syncBuildingDetails = (): void => {
    for (const [key, fabric] of buildingFabrics) {
      const tile = meshes.get(key)?.userData.tile as GtadbGroundTileAddress | undefined;
      if (tile) fabric.setDetail(hasCloseDetail(tile));
    }
    refreshBuildingStats();
  };
  const addBuildings = (
    key: string,
    tile: GtadbGroundTileAddress,
    footprints: readonly GtadbBuildingFootprint[],
  ): void => {
    removeBuildings(key);
    const sampled = footprints.filter((footprint) => {
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
    if (!sampled.length) return;
    const tileBounds = getGtadbTileWorldBounds(tile);
    const specs: FabricBuilding[] = sampled.map((footprint) => {
      const orientation = footprint.oriented;
      const x =
        tileBounds.minX +
        (orientation?.centerX ?? footprint.x + footprint.width / 2) * WORLD_METRES_PER_GTADB_UNIT;
      const z =
        tileBounds.minZ +
        (orientation?.centerY ?? footprint.y + footprint.height / 2) * WORLD_METRES_PER_GTADB_UNIT;
      return {
        x,
        z,
        width: Math.max(
          3,
          (orientation?.width ?? footprint.width) * WORLD_METRES_PER_GTADB_UNIT * 0.94,
        ),
        depth: Math.max(
          3,
          (orientation?.depth ?? footprint.height) * WORLD_METRES_PER_GTADB_UNIT * 0.94,
        ),
        rotation: orientation?.rotation ?? 0,
        seed: deterministicUnit(tile.x, tile.y, footprint.x, footprint.y),
        region: getLeonidaZoneProfile({ x, z }).name,
      };
    });
    const fabric = fabricKit.create(
      specs,
      `gtadb-approximate-buildings-${tile.x}-${tile.y}`,
      detail,
    );
    root.add(fabric.root);
    buildingFabrics.set(key, fabric);
    collisionGroups.set(
      key,
      sampled.map((footprint) => getGtadbFootprintWorldBounds(tile, footprint)),
    );
    fabric.setDetail(hasCloseDetail(tile));
    refreshBuildingStats();
  };

  return {
    root,
    collisions,
    sync(position) {
      if (disposed) return;
      const center = getGtadbTileAddressFromWorld(position);
      currentCenter = center;
      currentPosition = { ...position };
      syncBuildingDetails();
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
          if (disposed || meshes.get(key)?.userData.sourceTexture !== loadedTexture) {
            loadedTexture.dispose();
            return;
          }
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
            const segments = simplifyRoadEdges(
              extractGtadbRoadEdgeSegments(
                imageData.data,
                imageData.width,
                imageData.height,
                4,
                detail === 'mobile' ? 2 : 1,
              ),
              detail === 'mobile' ? 1.3 : 0.85,
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
        const material = new THREE.MeshStandardMaterial({
          roughness: 0.96,
          metalness: 0,
          color: 0x8e928d,
          map: texture,
          fog: true,
        });
        const mesh = new THREE.Mesh(geometry, material);
        const centerPosition = getGtadbTileWorldCenter(tile);
        mesh.name = `gtadb-ground-tile-${tile.x}-${tile.y}`;
        mesh.position.set(centerPosition.x, 0.055, centerPosition.z);
        mesh.receiveShadow = true;
        mesh.userData.evidence = 'APPROXIMATE';
        mesh.userData.tile = tile;
        mesh.userData.sourceTexture = texture;
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
      for (const fabric of buildingFabrics.values()) fabric.dispose();
      buildingFabrics.clear();
      buildingFootprints.clear();
      protectedArrival = null;
      disposeInstancedMeshBuffers(root);
      collisionGroups.clear();
      collisions.splice(0, collisions.length);
      geometry.dispose();
      fabricKit.dispose();
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
