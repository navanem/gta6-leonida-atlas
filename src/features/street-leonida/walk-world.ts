import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import {
  collidesWithBuildings,
  findNearestInteractiveHotspot,
  getYawRelativeMovementDelta,
  normalizeMovementAxes,
  type AxisAlignedRectangle,
  type MovementAxes,
  type WalkPoint,
} from './walk-engine';
import { MAP_BOUNDS, WORLD_BOUNDS, worldToMap } from './leonida-coordinates';
import { createWalkWorldLife } from './walk-life';
import { describeWalkMapPose, type WalkMapTravelDetail } from './walk-map';
import { initializeWalkWorldOverlays, type WalkWorldOverlayController } from './walk-overlays';
import { buildWalkRegion, type WalkRegionResource } from './walk-region-builders';
import { createWalkRegionStreamManager } from './walk-region-streaming';
import { createGtadbGroundTileStream } from './walk-cartography';
import { setupWalkAtmosphere } from './walk-atmosphere';
import { REVIEWED_GTADB_TRAVEL_APPROACHES } from './leonida-evidence';
import {
  ALL_LOCATION_ANCHORS,
  AMBROSIA_WORLD,
  getLeonidaZoneProfile,
  LEONIDA_ALIGNMENT_REVISION,
  PLACE_ANCHORS,
  PLACE_ENTRY_VIEWS,
  VICE_CITY_POI_WORLD,
  VICE_CITY_WORLD,
  STATE_OF_LEONIDA_COMMUNITY_MAP,
} from './walk-geography';

interface WalkSceneImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface WalkSceneSource {
  title: string;
  publisher: string | null;
  url: string;
}

interface WalkScene {
  slug: string;
  title: string;
  placeName: string;
  placeSlug: string;
  description: string | null;
  image: WalkSceneImage | null;
  source: WalkSceneSource;
  labels: string[];
}

export type { WalkMapTravelDetail } from './walk-map';

export interface WalkableWorldController {
  openEvidence(): void;
  dispose(): void;
}

export function parseWalkMapTravelDetail(value: unknown): WalkMapTravelDetail | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.x !== 'number' ||
    !Number.isFinite(candidate.x) ||
    typeof candidate.z !== 'number' ||
    !Number.isFinite(candidate.z) ||
    typeof candidate.label !== 'string' ||
    candidate.label.trim().length === 0 ||
    typeof candidate.id !== 'string' ||
    candidate.id.trim().length === 0 ||
    (candidate.source !== 'gtadb' && candidate.source !== 'region' && candidate.source !== 'map') ||
    candidate.x < WORLD_BOUNDS.minX ||
    candidate.x > WORLD_BOUNDS.maxX ||
    candidate.z < WORLD_BOUNDS.minZ ||
    candidate.z > WORLD_BOUNDS.maxZ
  ) {
    return null;
  }

  return {
    x: candidate.x,
    z: candidate.z,
    label: candidate.label.trim(),
    id: candidate.id.trim(),
    source: candidate.source,
  };
}

/**
 * Keep a direct map arrival visually tied to the selected evidence point.
 * When collision clearance moves the player away from the documented point,
 * face back toward it; an unchanged arrival keeps the visitor's heading.
 */
export function resolveMapTravelYaw(
  arrival: WalkPoint,
  documentedTarget: WalkPoint,
  currentYaw: number,
): number {
  const deltaX = arrival.x - documentedTarget.x;
  const deltaZ = arrival.z - documentedTarget.z;
  return Math.hypot(deltaX, deltaZ) <= 1e-6 ? currentYaw : Math.atan2(deltaX, deltaZ);
}

export function resolveMapTravelApproach(detail: WalkMapTravelDetail): WalkPoint {
  const approaches: Readonly<
    Partial<
      Record<
        string,
        (typeof REVIEWED_GTADB_TRAVEL_APPROACHES)[keyof typeof REVIEWED_GTADB_TRAVEL_APPROACHES]
      >
    >
  > = REVIEWED_GTADB_TRAVEL_APPROACHES;
  const approach = detail.source === 'gtadb' ? approaches[detail.id] : undefined;
  if (!approach) return { x: detail.x, z: detail.z };
  const directionLength = Math.hypot(approach.direction.x, approach.direction.z);
  if (directionLength <= 1e-6) return { x: detail.x, z: detail.z };
  return {
    x: detail.x + (approach.direction.x / directionLength) * approach.standoffMetres,
    z: detail.z + (approach.direction.z / directionLength) * approach.standoffMetres,
  };
}

interface WorldHotspot {
  id: number;
  scene: WalkScene;
  position: WalkPoint;
  interactionRadius: number;
  interactive: true;
  marker: THREE.Group;
  label: THREE.Sprite;
}

interface WalkDom {
  canvas: HTMLCanvasElement;
  loading: HTMLElement | null;
  intro: HTMLElement | null;
  start: HTMLButtonElement | null;
  prompt: HTMLButtonElement | null;
  promptTitle: HTMLElement | null;
  lockHint: HTMLElement | null;
  zone: HTMLElement | null;
  zoneDetail: HTMLElement | null;
  hudCoordinates: HTMLElement | null;
  heading: HTMLElement | null;
  playerDot: HTMLElement | null;
  mapButtons: HTMLButtonElement[];
  zoomIn: HTMLButtonElement | null;
  zoomOut: HTMLButtonElement | null;
  zoomValue: HTMLOutputElement | null;
  fullscreenButton: HTMLButtonElement | null;
  fullscreenLabel: HTMLElement | null;
  stop: HTMLButtonElement | null;
  mapDialog: HTMLDialogElement | null;
  closeMap: HTMLButtonElement | null;
  evidenceDialog: HTMLDialogElement | null;
  sceneDialog: HTMLDialogElement | null;
  closeScene: HTMLButtonElement | null;
  sceneImage: HTMLImageElement | null;
  sceneEvidenceLabel: HTMLElement | null;
  sceneProvenance: HTMLElement | null;
  sceneTitle: HTMLElement | null;
  scenePlace: HTMLElement | null;
  sceneDescription: HTMLElement | null;
  scenePage: HTMLAnchorElement | null;
  sceneSource: HTMLAnchorElement | null;
  joystick: HTMLElement | null;
  joystickKnob: HTMLElement | null;
  lookPad: HTMLElement | null;
  interact: HTMLButtonElement | null;
  unsupported: HTMLElement | null;
}

export const WALK_PLAYER_CONFIG = Object.freeze({
  eyeHeightMetres: 1.72,
  radiusMetres: 0.42,
  walkMetresPerSecond: 1.6,
  runMetresPerSecond: 4.8,
});

export const TOUCH_JOYSTICK_RUN_THRESHOLD = 0.9;

export interface TouchJoystickInput {
  readonly axes: MovementAxes;
  readonly intensity: number;
  readonly knob: Readonly<{ x: number; y: number }>;
  readonly running: boolean;
}

export function resolveTouchJoystickInput(
  offsetX: number,
  offsetY: number,
  radius: number,
): TouchJoystickInput {
  if (![offsetX, offsetY, radius].every(Number.isFinite) || radius <= 0) {
    return {
      axes: { right: 0, forward: 0 },
      intensity: 0,
      knob: { x: 0, y: 0 },
      running: false,
    };
  }

  const magnitude = Math.hypot(offsetX, offsetY);
  if (magnitude === 0) {
    return {
      axes: { right: 0, forward: 0 },
      intensity: 0,
      knob: { x: 0, y: 0 },
      running: false,
    };
  }

  const intensity = Math.min(1, magnitude / radius);
  const scale = magnitude > radius ? radius / magnitude : 1;
  const knob = { x: offsetX * scale, y: offsetY * scale };
  return {
    axes: normalizeMovementAxes({ right: knob.x / radius, forward: -knob.y / radius }),
    intensity,
    knob,
    running: intensity >= TOUCH_JOYSTICK_RUN_THRESHOLD,
  };
}

export const WALK_WORLD_RENDER_CONFIG = Object.freeze({
  cameraFarMetres: 1_800,
  desktopPixelRatioCap: 1.35,
  mobilePixelRatioCap: 1.25,
  desktopPixelBudget: 4_500_000,
  mobilePixelBudget: 1_600_000,
  telemetryIntervalMs: 100,
  desktopCartographyTileRadius: 1,
  mobileCartographyTileRadius: 1,
  environmentIntensity: 0.42,
  toneMappingExposure: 0.94,
  shadowFilter: 'pcf',
  shadowMapSize: 1_024,
  shadowDistanceMetres: 280,
});

export function configureWalkSunShadow(
  light: THREE.DirectionalLight,
  coarsePointer: boolean,
): void {
  light.castShadow = true;
  const shadowMapSize = coarsePointer ? 512 : WALK_WORLD_RENDER_CONFIG.shadowMapSize;
  const shadowHalfDistance = WALK_WORLD_RENDER_CONFIG.shadowDistanceMetres / 2;
  light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  light.shadow.camera.left = -shadowHalfDistance;
  light.shadow.camera.right = shadowHalfDistance;
  light.shadow.camera.top = shadowHalfDistance;
  light.shadow.camera.bottom = -shadowHalfDistance;
  light.shadow.camera.near = 8;
  light.shadow.camera.far = WALK_WORLD_RENDER_CONFIG.shadowDistanceMetres + 48;
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.bias = -0.00028;
  light.shadow.normalBias = 0.045;
}

export const WALK_STATE_WATER_CENTER_Y = -2;
export const WALK_STATE_WATER_RENDER_ORDER = -900;

export function createStateWaterContinuityMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x087da0,
    emissive: 0x032b3b,
    emissiveIntensity: 0.12,
    roughness: 0.22,
    metalness: 0.08,
    clearcoat: 0.74,
    clearcoatRoughness: 0.18,
    reflectivity: 0.82,
    // This state-sized continuity surface is a background layer. It must never
    // write or test depth: very large coplanar spans otherwise occlude nearer
    // roads on software/low-end WebGL paths despite their physical separation.
    transparent: false,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });
}
const LAND_OUTLINE: readonly WalkPoint[] = [
  { x: -92, z: -204 },
  { x: 112, z: -204 },
  { x: 154, z: -174 },
  { x: 146, z: -128 },
  { x: 179, z: -86 },
  { x: 187, z: -28 },
  { x: 173, z: 8 },
  { x: 201, z: 52 },
  { x: 183, z: 103 },
  { x: 121, z: 128 },
  { x: 92, z: 151 },
  { x: 58, z: 203 },
  { x: 12, z: 197 },
  { x: -3, z: 165 },
  { x: -32, z: 149 },
  { x: -58, z: 112 },
  { x: -72, z: 79 },
  { x: -121, z: 43 },
  { x: -153, z: 3 },
  { x: -157, z: -55 },
  { x: -126, z: -91 },
  { x: -146, z: -132 },
  { x: -119, z: -177 },
] as const;

const PLACE_OFFSETS: readonly WalkPoint[] = [
  { x: 0, z: 0 },
  { x: -25, z: 0 },
  { x: 0, z: 25 },
  { x: -25, z: 25 },
  { x: 25, z: 0 },
  { x: 0, z: -25 },
] as const;

function queryDom(root: HTMLElement): WalkDom | null {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-walk-canvas]');
  if (!canvas) return null;
  return {
    canvas,
    loading: root.querySelector('[data-walk-loading]'),
    intro: root.querySelector('[data-walk-intro]'),
    start: root.querySelector('[data-start-walking]'),
    prompt: root.querySelector('[data-walk-prompt]'),
    promptTitle: root.querySelector('[data-walk-prompt-title]'),
    lockHint: root.querySelector('[data-walk-lock-hint]'),
    zone: root.querySelector('[data-walk-zone]'),
    zoneDetail: root.querySelector('[data-walk-zone-detail]'),
    hudCoordinates: root.querySelector('[data-walk-hud-coordinates]'),
    heading: root.querySelector('[data-walk-heading]'),
    playerDot: root.querySelector('[data-walk-player-dot]'),
    mapButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-open-walk-map]')],
    zoomIn: root.querySelector('[data-walk-zoom-in]'),
    zoomOut: root.querySelector('[data-walk-zoom-out]'),
    zoomValue: root.querySelector('[data-walk-zoom-value]'),
    fullscreenButton: root.querySelector('[data-toggle-walk-fullscreen]'),
    fullscreenLabel: root.querySelector('[data-walk-fullscreen-label]'),
    stop: root.querySelector('[data-stop-walking]'),
    mapDialog: root.querySelector('[data-walk-map]'),
    closeMap: root.querySelector('[data-close-walk-map]'),
    evidenceDialog: root.querySelector('[data-walk-evidence-dialog]'),
    sceneDialog: root.querySelector('[data-walk-scene-dialog]'),
    closeScene: root.querySelector('[data-close-walk-scene]'),
    sceneImage: root.querySelector('[data-walk-scene-image]'),
    sceneEvidenceLabel: root.querySelector('[data-walk-scene-evidence-label]'),
    sceneProvenance: root.querySelector('[data-walk-scene-provenance]'),
    sceneTitle: root.querySelector('[data-walk-scene-title]'),
    scenePlace: root.querySelector('[data-walk-scene-place]'),
    sceneDescription: root.querySelector('[data-walk-scene-description]'),
    scenePage: root.querySelector('[data-walk-scene-page]'),
    sceneSource: root.querySelector('[data-walk-scene-source]'),
    joystick: root.querySelector('[data-walk-joystick]'),
    joystickKnob: root.querySelector('[data-walk-joystick-knob]'),
    lookPad: root.querySelector('[data-walk-look-pad]'),
    interact: root.querySelector('[data-walk-interact]'),
    unsupported: root.querySelector('[data-walk-unsupported]'),
  };
}

function parseScenes(root: HTMLElement): WalkScene[] {
  try {
    const value: unknown = JSON.parse(root.dataset.scenes ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((candidate): candidate is WalkScene => {
      if (!candidate || typeof candidate !== 'object') return false;
      const scene = candidate as Partial<WalkScene>;
      return (
        typeof scene.slug === 'string' &&
        typeof scene.title === 'string' &&
        typeof scene.placeName === 'string' &&
        Boolean(scene.source && typeof scene.source.url === 'string')
      );
    });
  } catch {
    return [];
  }
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function canvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function resolveWalkScenePositions(
  scenes: readonly { placeSlug: string }[],
): Array<WalkPoint | null> {
  const placeCounts = new Map<string, number>();
  return scenes.map((scene) => {
    const anchor = PLACE_ANCHORS[scene.placeSlug];
    // Only reviewed regional arrivals may host evidence markers. In particular,
    // the compatibility `leonida` origin is explicitly not a place claim.
    if (!anchor || !PLACE_ENTRY_VIEWS[scene.placeSlug]) return null;
    const count = placeCounts.get(scene.placeSlug) ?? 0;
    placeCounts.set(scene.placeSlug, count + 1);
    const offset = PLACE_OFFSETS[count % PLACE_OFFSETS.length] ?? { x: 0, z: 0 };
    return { x: anchor.x + offset.x, z: anchor.z + offset.z };
  });
}

interface WalkSceneProvenanceInput {
  labels: readonly string[];
  source: { publisher: string | null };
}

export interface WalkSceneProvenance {
  evidenceLabel: string;
  kicker: string;
  sourceLinkLabel: string;
  descriptionFallback: string;
}

export function getWalkSceneProvenance(scene: WalkSceneProvenanceInput): WalkSceneProvenance {
  const publisher = scene.source.publisher?.trim() || null;
  const isRockstarOfficial =
    publisher === 'Rockstar Games' && scene.labels.includes('Official media');
  if (isRockstarOfficial) {
    return {
      evidenceLabel: 'OFFICIAL VISUAL EVIDENCE',
      kicker: 'Rockstar evidence',
      sourceLinkLabel: 'Open Rockstar Games',
      descriptionFallback: 'A documented scene from official Grand Theft Auto VI media.',
    };
  }
  return {
    evidenceLabel: 'DOCUMENTED SOURCE EVIDENCE',
    kicker: publisher ? `${publisher} evidence` : 'Cited-source evidence',
    sourceLinkLabel: publisher ? `Open ${publisher}` : 'Open cited source',
    descriptionFallback: 'A documented scene from the cited source.',
  };
}

export function findWorldHotspotById<T extends { id: number }>(
  hotspots: readonly T[],
  id: number,
): T | null {
  return hotspots.find((hotspot) => hotspot.id === id) ?? null;
}

export function shouldResumeWalkAfterOverlayClose(
  walkStarted: boolean,
  hasOpenOverlay: boolean,
): boolean {
  return walkStarted && !hasOpenOverlay;
}

function pointInsideLand(point: WalkPoint): boolean {
  let inside = false;
  for (
    let index = 0, previous = LAND_OUTLINE.length - 1;
    index < LAND_OUTLINE.length;
    previous = index, index += 1
  ) {
    const currentPoint = LAND_OUTLINE[index];
    const previousPoint = LAND_OUTLINE[previous];
    if (!currentPoint || !previousPoint) continue;
    const intersects =
      currentPoint.z > point.z !== previousPoint.z > point.z &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.z - currentPoint.z)) /
          (previousPoint.z - currentPoint.z) +
          currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function adjustArrivalForCollisions(
  documentedTarget: WalkPoint,
  collisions: readonly AxisAlignedRectangle[],
):
  | { readonly position: WalkPoint; readonly adjusted: false; readonly offsetMetres: 0 }
  | {
      readonly position: WalkPoint;
      readonly adjusted: true;
      readonly offsetMetres: number;
      readonly documentedTarget: WalkPoint;
    } {
  const radius = WALK_PLAYER_CONFIG.radiusMetres;
  const finiteCollisions = collisions.filter((collision) =>
    [collision.minX, collision.maxX, collision.minZ, collision.maxZ].every(Number.isFinite),
  );
  const isSafe = (candidate: WalkPoint) =>
    !collidesWithBuildings(candidate, radius, finiteCollisions);
  if (isSafe(documentedTarget)) {
    return { position: { ...documentedTarget }, adjusted: false, offsetMetres: 0 };
  }

  for (let offsetMetres = 1; offsetMetres <= 24; offsetMetres += 1) {
    for (let index = 0; index < 32; index += 1) {
      const angle = (index / 32) * Math.PI * 2;
      const candidate = {
        x: documentedTarget.x + Math.cos(angle) * offsetMetres,
        z: documentedTarget.z + Math.sin(angle) * offsetMetres,
      };
      if (isSafe(candidate)) {
        return {
          position: candidate,
          adjusted: true,
          offsetMetres,
          documentedTarget: { ...documentedTarget },
        };
      }
    }
  }

  const clearance = radius + 0.05;
  const boundaryCandidates = finiteCollisions.flatMap((collision): WalkPoint[] => [
    { x: collision.minX - clearance, z: documentedTarget.z },
    { x: collision.maxX + clearance, z: documentedTarget.z },
    { x: documentedTarget.x, z: collision.minZ - clearance },
    { x: documentedTarget.x, z: collision.maxZ + clearance },
    { x: collision.minX - clearance, z: collision.minZ - clearance },
    { x: collision.minX - clearance, z: collision.maxZ + clearance },
    { x: collision.maxX + clearance, z: collision.minZ - clearance },
    { x: collision.maxX + clearance, z: collision.maxZ + clearance },
  ]);
  boundaryCandidates.sort(
    (left, right) =>
      Math.hypot(left.x - documentedTarget.x, left.z - documentedTarget.z) -
      Math.hypot(right.x - documentedTarget.x, right.z - documentedTarget.z),
  );
  for (const candidate of boundaryCandidates) {
    if (!isSafe(candidate)) continue;
    return {
      position: candidate,
      adjusted: true,
      offsetMetres: Math.hypot(candidate.x - documentedTarget.x, candidate.z - documentedTarget.z),
      documentedTarget: { ...documentedTarget },
    };
  }

  // This point lies beyond the minimum X/Z of every finite AABB, so it cannot
  // remain inside their union. It replaces the previous unverified +24m fallback.
  const guaranteedEscape = {
    x: Math.min(...finiteCollisions.map((collision) => collision.minX)) - clearance,
    z: Math.min(...finiteCollisions.map((collision) => collision.minZ)) - clearance,
  };
  return {
    position: guaranteedEscape,
    adjusted: true,
    offsetMetres: Math.hypot(
      guaranteedEscape.x - documentedTarget.x,
      guaranteedEscape.z - documentedTarget.z,
    ),
    documentedTarget: { ...documentedTarget },
  };
}

export function reconcileWalkPosition(
  current: WalkPoint,
  collisions: readonly AxisAlignedRectangle[],
): { readonly position: WalkPoint; readonly relocated: boolean } {
  if (!collidesWithBuildings(current, WALK_PLAYER_CONFIG.radiusMetres, collisions)) {
    return { position: { ...current }, relocated: false };
  }
  return {
    position: adjustArrivalForCollisions(current, collisions).position,
    relocated: true,
  };
}

function findSafeWalkPosition(
  preferred: WalkPoint,
  collisions: readonly AxisAlignedRectangle[],
): WalkPoint {
  return adjustArrivalForCollisions(preferred, collisions).position;
}

function addBox(
  scene: THREE.Scene,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  material: THREE.Material,
  rotationY = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addBoxCollision(
  collisions: AxisAlignedRectangle[],
  x: number,
  z: number,
  width: number,
  depth: number,
  padding = 0,
): void {
  collisions.push({
    minX: x - width / 2 - padding,
    maxX: x + width / 2 + padding,
    minZ: z - depth / 2 - padding,
    maxZ: z + depth / 2 + padding,
  });
}

function createWorldSign(text: string, color: string, width: number, height: number): THREE.Mesh {
  const texture = canvasTexture(768, 224, (context) => {
    context.clearRect(0, 0, 768, 224);
    context.fillStyle = 'rgba(4, 8, 15, .9)';
    context.strokeStyle = color;
    context.lineWidth = 12;
    context.beginPath();
    context.roundRect(12, 12, 744, 200, 26);
    context.fill();
    context.stroke();
    context.shadowColor = color;
    context.shadowBlur = 24;
    context.fillStyle = color;
    context.font = '900 92px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 384, 116, 680);
  });
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    toneMapped: false,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

function addViceCityBeachDetails(
  scene: THREE.Scene,
  collisions: AxisAlignedRectangle[],
  reducedDensity: boolean,
): void {
  const timber = new THREE.MeshStandardMaterial({ color: 0xd6b17d, roughness: 0.92 });
  const pastel = [0xf26da7, 0x4fd7e8].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.08,
        roughness: 0.68,
      }),
  );
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xf5ead7, roughness: 0.82 });

  const towerZ = reducedDensity ? [26] : [26, 82];
  towerZ.forEach((z, towerIndex) => {
    const material = pastel[towerIndex % pastel.length] ?? roofMaterial;
    addBox(scene, [3.4, 0.28, 3], [183.2, 2.05, z], timber);
    for (const xOffset of [-1.25, 1.25]) {
      for (const zOffset of [-1, 1]) {
        addBox(scene, [0.18, 2.1, 0.18], [183.2 + xOffset, 1.05, z + zOffset], timber);
      }
    }
    addBox(scene, [2.75, 1.75, 2.35], [183.2, 3.05, z], material);
    addBox(scene, [3.25, 0.2, 2.85], [183.2, 4.02, z], roofMaterial);
    addBoxCollision(collisions, 183.2, z, 3.4, 3, 0.15);
  });

  const umbrellaMaterial = new THREE.MeshStandardMaterial({
    color: 0xff529f,
    side: THREE.DoubleSide,
    roughness: 0.8,
  });
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xe7dfce, roughness: 0.75 });
  const umbrellaCount = reducedDensity ? 4 : 8;
  for (let index = 0; index < umbrellaCount; index += 1) {
    const z = 3 + index * (96 / Math.max(1, umbrellaCount - 1));
    const x = index % 2 === 0 ? 179.2 : 186.3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), poleMaterial);
    pole.position.set(x, 1.2, z);
    scene.add(pole);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(1.35, 0.52, 12, 1, true),
      umbrellaMaterial,
    );
    canopy.position.set(x, 2.3, z);
    canopy.rotation.y = index * 0.63;
    scene.add(canopy);
  }

  const sign = createWorldSign('VICE CITY', '#ff58aa', 7.8, 2.3);
  sign.position.set(174.8, 6.1, 105);
  sign.rotation.y = -Math.PI / 2;
  scene.add(sign);
}

function addKeysDetails(
  scene: THREE.Scene,
  collisions: AxisAlignedRectangle[],
  reducedDensity: boolean,
): void {
  const shallowMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x20b9be,
    roughness: 0.16,
    metalness: 0.04,
    transparent: true,
    opacity: 0.72,
  });
  addBox(scene, [35, 0.05, 7], [29, 0.18, 176], shallowMaterial, 0.2);
  if (!reducedDensity) addBox(scene, [26, 0.05, 6], [48, 0.18, 192], shallowMaterial, -0.3);

  const wood = new THREE.MeshStandardMaterial({ color: 0x8b6644, roughness: 0.96 });
  const wallMaterials = [0x73c7be, 0xf0a36c].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.86 }),
  );
  const roof = new THREE.MeshStandardMaterial({ color: 0x69584e, roughness: 1 });
  const cabinPositions = reducedDensity
    ? ([[55, 171]] as const)
    : ([
        [55, 171],
        [12, 180],
      ] as const);
  cabinPositions.forEach(([x, z], index) => {
    for (const xOffset of [-2.2, 2.2]) {
      for (const zOffset of [-1.35, 1.35]) {
        addBox(scene, [0.22, 2.7, 0.22], [x + xOffset, 1.45, z + zOffset], wood);
      }
    }
    const wall = wallMaterials[index % wallMaterials.length] ?? roof;
    addBox(scene, [5.2, 2.6, 3.7], [x, 3.65, z], wall);
    const cabinRoof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.25, 4), roof);
    cabinRoof.position.set(x, 5.35, z);
    cabinRoof.rotation.y = Math.PI / 4;
    scene.add(cabinRoof);
    addBox(scene, [8.5, 0.18, 1.5], [x + 5.9, 0.58, z], wood);
    addBoxCollision(collisions, x, z, 5.2, 3.7, 0.2);
  });

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0xf3eee2,
    metalness: 0.14,
    roughness: 0.42,
  });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 5.5, 6), hullMaterial);
  hull.position.set(63.5, 0.72, 187);
  hull.rotation.z = Math.PI / 2;
  hull.rotation.y = -0.18;
  scene.add(hull);
  addBox(scene, [1.8, 0.8, 1.5], [63.3, 1.25, 187], wood, -0.18);
}

function addGrassriversDetails(scene: THREE.Scene, reducedDensity: boolean): void {
  const water = new THREE.MeshPhysicalMaterial({
    color: 0x164f58,
    roughness: 0.42,
    metalness: 0.08,
    transparent: true,
    opacity: 0.9,
  });
  addBox(scene, [76, 0.06, 7], [19, 0.24, 111], water, 0.13);
  addBox(scene, [62, 0.06, 6], [32, 0.25, 149], water, -0.28);
  if (!reducedDensity) addBox(scene, [47, 0.06, 4.5], [-3, 0.26, 133], water, 0.52);

  const reedGeometry = new THREE.CylinderGeometry(0.035, 0.06, 1.35, 5);
  const reedMaterial = new THREE.MeshStandardMaterial({ color: 0x718340, roughness: 1 });
  const reedCount = reducedDensity ? 42 : 90;
  const reeds = new THREE.InstancedMesh(reedGeometry, reedMaterial, reedCount);
  const dummy = new THREE.Object3D();
  const random = seededRandom(4081);
  const grassriversAnchor = PLACE_ANCHORS.grassrivers ?? { x: 35, z: 128 };
  let placed = 0;
  while (placed < reedCount) {
    const x = -26 + random() * 104;
    const z = 99 + random() * 62;
    if (Math.hypot(x - grassriversAnchor.x, z - grassriversAnchor.z) < 14) continue;
    dummy.position.set(x, 0.88, z);
    dummy.scale.setScalar(0.72 + random() * 0.62);
    dummy.rotation.y = random() * Math.PI;
    dummy.updateMatrix();
    reeds.setMatrixAt(placed, dummy.matrix);
    placed += 1;
  }
  reeds.instanceMatrix.needsUpdate = true;
  scene.add(reeds);

  const gatorMaterial = new THREE.MeshStandardMaterial({ color: 0x344b32, roughness: 1 });
  const gatorPositions = reducedDensity
    ? ([[65, 145]] as const)
    : ([
        [65, 145],
        [-8, 119],
      ] as const);
  gatorPositions.forEach(([x, z], index) => {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), gatorMaterial);
    body.scale.set(1.8, 0.28, 0.5);
    body.position.set(x, 0.43, z);
    body.rotation.y = index ? 0.7 : -0.28;
    scene.add(body);
    const snout = addBox(scene, [1.25, 0.22, 0.56], [x + 1.45, 0.42, z], gatorMaterial);
    snout.rotation.y = body.rotation.y;
  });

  const airboatHull = addBox(
    scene,
    [4.8, 0.45, 2.25],
    [-15, 0.54, 137],
    new THREE.MeshStandardMaterial({ color: 0x826744, metalness: 0.18, roughness: 0.68 }),
    0.34,
  );
  airboatHull.castShadow = false;
  const cage = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.08, 7, 18),
    new THREE.MeshStandardMaterial({ color: 0x252a28, metalness: 0.72, roughness: 0.42 }),
  );
  cage.position.set(-16.1, 1.65, 137.4);
  cage.rotation.y = Math.PI / 2 + 0.34;
  scene.add(cage);
}

function addPortGellhornDetails(scene: THREE.Scene, collisions: AxisAlignedRectangle[]): void {
  const fadedCoral = new THREE.MeshStandardMaterial({ color: 0xb96f68, roughness: 0.98 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb5aa98, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x25282b, roughness: 0.86 });
  addBox(scene, [29, 4.2, 7], [-111, 2.35, -73], fadedCoral);
  addBox(scene, [29.8, 0.25, 2.1], [-111, 4.7, -69.65], concrete);
  for (let index = 0; index < 8; index += 1) {
    const x = -123 + index * 3.45;
    addBox(scene, [1.35, 1.7, 0.12], [x, 2.2, -69.42], dark);
    addBox(scene, [1.1, 0.6, 0.14], [x + 1.35, 3.15, -69.4], concrete);
  }
  addBoxCollision(collisions, -111, -73, 29, 7, 0.2);

  const motelSign = createWorldSign('MOTEL', '#5cdbe9', 5.7, 1.75);
  motelSign.position.set(-92, 6.4, -68.8);
  scene.add(motelSign);
  addBox(scene, [0.28, 6, 0.28], [-92, 3.15, -69], dark);

  const steel = new THREE.MeshStandardMaterial({
    color: 0x69767a,
    metalness: 0.66,
    roughness: 0.54,
  });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 4.4, 16), steel);
  tank.position.set(-145, 13.8, -57);
  scene.add(tank);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3.25, 1.5, 16), steel);
  cap.position.set(-145, 16.75, -57);
  scene.add(cap);
  for (const xOffset of [-2.1, 2.1]) {
    for (const zOffset of [-2.1, 2.1]) {
      addBox(scene, [0.22, 11.7, 0.22], [-145 + xOffset, 6.1, -57 + zOffset], steel);
    }
  }
}

function addAmbrosiaDetails(
  scene: THREE.Scene,
  collisions: AxisAlignedRectangle[],
  reducedDensity: boolean,
): void {
  const galvanized = new THREE.MeshStandardMaterial({
    color: 0xaeb6b1,
    metalness: 0.62,
    roughness: 0.48,
  });
  for (const x of [112, 120]) {
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.55, 14, 18), galvanized);
    silo.position.set(x, 7.25, -78);
    silo.castShadow = true;
    scene.add(silo);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.35, 2, 18), galvanized);
    roof.position.set(x, 15.25, -78);
    scene.add(roof);
    addBoxCollision(collisions, x, -78, 7, 7, 0.1);
  }
  const stackMaterial = new THREE.MeshStandardMaterial({ color: 0x8c4d3d, roughness: 0.9 });
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.55, 25, 14), stackMaterial);
  stack.position.set(130, 12.7, -83);
  stack.castShadow = true;
  scene.add(stack);
  addBoxCollision(collisions, 130, -83, 3.1, 3.1);

  const refinerySign = createWorldSign('AMBROSIA', '#f2c25f', 6.5, 1.9);
  refinerySign.position.set(111, 7.4, -68.2);
  scene.add(refinerySign);

  const caneGeometry = new THREE.BoxGeometry(0.08, 2.25, 0.08);
  const caneMaterial = new THREE.MeshStandardMaterial({ color: 0x8ca84f, roughness: 1 });
  const caneCount = reducedDensity ? 70 : 150;
  const cane = new THREE.InstancedMesh(caneGeometry, caneMaterial, caneCount);
  const dummy = new THREE.Object3D();
  const random = seededRandom(2207);
  for (let index = 0; index < caneCount; index += 1) {
    const row = index % 15;
    const column = Math.floor(index / 15);
    dummy.position.set(17 + row * 1.35, 1.25, -92 + column * 1.55);
    dummy.rotation.y = random() * 0.12;
    dummy.scale.y = 0.72 + random() * 0.38;
    dummy.updateMatrix();
    cane.setMatrixAt(index, dummy.matrix);
  }
  cane.instanceMatrix.needsUpdate = true;
  scene.add(cane);
}

function addMountKalagaDetails(
  scene: THREE.Scene,
  collisions: AxisAlignedRectangle[],
  reducedDensity: boolean,
): void {
  const trunkGeometry = new THREE.CylinderGeometry(0.12, 0.22, 3.8, 6);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x62452e, roughness: 1 });
  const crownGeometry = new THREE.ConeGeometry(1.45, 4.8, 7);
  const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x244c38, roughness: 1 });
  const treeCount = reducedDensity ? 28 : 58;
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount);
  const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, treeCount);
  const dummy = new THREE.Object3D();
  const random = seededRandom(7519);
  const mountKalagaAnchor = PLACE_ANCHORS['mount-kalaga-national-park'] ?? { x: 14, z: -158 };
  let placed = 0;
  while (placed < treeCount) {
    const x = -64 + random() * 145;
    const z = -199 + random() * 66;
    if (
      !pointInsideLand({ x, z }) ||
      Math.hypot(x - mountKalagaAnchor.x, z - mountKalagaAnchor.z) < 17
    )
      continue;
    const scale = 0.72 + random() * 0.68;
    dummy.position.set(x, 2.1 * scale, z);
    dummy.scale.setScalar(scale);
    dummy.rotation.y = random() * Math.PI;
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = 5.25 * scale;
    dummy.updateMatrix();
    crowns.setMatrixAt(placed, dummy.matrix);
    placed += 1;
  }
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  scene.add(trunks, crowns);

  const timber = new THREE.MeshStandardMaterial({ color: 0x6f4b30, roughness: 1 });
  const cabinRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x304039, roughness: 1 });
  addBox(scene, [8, 4.2, 5.4], [-34, 2.25, -156], timber);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 2.3, 4), cabinRoofMaterial);
  roof.position.set(-34, 5.45, -156);
  roof.rotation.y = Math.PI / 4;
  scene.add(roof);
  addBoxCollision(collisions, -34, -156, 8, 5.4, 0.25);

  const lookoutSteel = new THREE.MeshStandardMaterial({ color: 0x4c514b, roughness: 0.9 });
  for (const xOffset of [-2, 2]) {
    for (const zOffset of [-2, 2]) {
      addBox(scene, [0.22, 11, 0.22], [65 + xOffset, 5.6, -175 + zOffset], lookoutSteel);
    }
  }
  addBox(scene, [5.2, 0.35, 5.2], [65, 10.7, -175], timber);
  addBox(scene, [4.2, 2.7, 4.2], [65, 12.15, -175], timber);
  addBox(scene, [5.5, 0.3, 5.5], [65, 13.7, -175], cabinRoofMaterial);
}

void [
  addViceCityBeachDetails,
  addKeysDetails,
  addGrassriversDetails,
  addPortGellhornDetails,
  addAmbrosiaDetails,
  addMountKalagaDetails,
];

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function createHotspotLabel(sceneData: WalkScene, index: number): THREE.Sprite {
  const texture = canvasTexture(768, 304, (context) => {
    context.clearRect(0, 0, 768, 304);
    const gradient = context.createLinearGradient(28, 20, 740, 280);
    gradient.addColorStop(0, 'rgba(10,13,20,.96)');
    gradient.addColorStop(1, 'rgba(42,19,54,.96)');
    context.fillStyle = gradient;
    context.strokeStyle = '#f43d9b';
    context.lineWidth = 6;
    context.beginPath();
    context.roundRect(14, 14, 740, 276, 34);
    context.fill();
    context.stroke();
    context.fillStyle = '#49ddf4';
    context.font = '700 28px sans-serif';
    context.fillText(
      `DISCOVERY ${String(index + 1).padStart(2, '0')} · ${sceneData.placeName.toUpperCase()}`,
      48,
      70,
    );
    context.fillStyle = '#ffffff';
    context.font = '700 46px sans-serif';
    const lines = wrapText(context, sceneData.title, 660);
    lines.forEach((line, lineIndex) => context.fillText(line, 48, 138 + lineIndex * 53));
    context.fillStyle = '#cbd5e1';
    context.font = '500 24px sans-serif';
    context.fillText('Approximate regional placement · press E to explore', 48, 260);
  });
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.6, 1.82, 1);
  return sprite;
}

function createHotspots(
  scene: THREE.Scene,
  scenes: WalkScene[],
  positions: readonly (WalkPoint | null)[],
): WorldHotspot[] {
  return scenes.flatMap((sceneData, index): WorldHotspot[] => {
    const position = positions[index];
    if (!position) return [];
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.08, 9, 28),
      new THREE.MeshStandardMaterial({
        color: 0xff45a4,
        emissive: 0xc81772,
        emissiveIntensity: 2.1,
        metalness: 0.35,
      }),
    );
    ring.position.y = 1.15;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.05, 24),
      new THREE.MeshBasicMaterial({ color: 0x42def2, transparent: true, opacity: 0.28 }),
    );
    core.position.y = 0.24;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.68, 2.35, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff56ae,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beam.position.y = 1.28;
    group.add(ring, core, beam);
    group.position.set(position.x, 0, position.z);
    group.userData.evidence = 'APPROXIMATE';
    group.userData.positionAuthority = 'REGION_ONLY';
    group.traverse((object) => {
      object.userData.hotspotId = index;
      object.userData.evidence = 'APPROXIMATE';
      object.userData.positionAuthority = 'REGION_ONLY';
    });
    scene.add(group);

    const label = createHotspotLabel(sceneData, index);
    label.position.set(position.x, 3.65, position.z);
    label.userData.hotspotId = index;
    label.userData.evidence = 'APPROXIMATE';
    label.userData.positionAuthority = 'REGION_ONLY';
    scene.add(label);

    return [
      {
        id: index,
        scene: sceneData,
        position,
        interactionRadius: 13,
        interactive: true,
        marker: group,
        label,
      },
    ];
  });
}

function zoneProfile(position: WalkPoint): { name: string; detail: string } {
  return getLeonidaZoneProfile(position);
}

function cardinalHeading(yaw: number): string {
  const normalized = ((-yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const index = Math.round(normalized / (Math.PI / 4)) % 8;
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][index] ?? 'N';
}

function updateDialog(dom: WalkDom, hotspot: WorldHotspot): void {
  const { scene } = hotspot;
  const provenance = getWalkSceneProvenance(scene);
  if (dom.sceneEvidenceLabel) dom.sceneEvidenceLabel.textContent = provenance.evidenceLabel;
  if (dom.sceneProvenance) dom.sceneProvenance.textContent = provenance.kicker;
  if (dom.sceneTitle) dom.sceneTitle.textContent = scene.title;
  if (dom.scenePlace) dom.scenePlace.textContent = scene.placeName;
  if (dom.sceneDescription) {
    dom.sceneDescription.textContent = scene.description ?? provenance.descriptionFallback;
  }
  if (dom.sceneImage) {
    if (scene.image?.src) {
      dom.sceneImage.src = scene.image.src;
      dom.sceneImage.alt = scene.image.alt;
      dom.sceneImage.hidden = false;
    } else {
      dom.sceneImage.removeAttribute('src');
      dom.sceneImage.alt = '';
      dom.sceneImage.hidden = true;
    }
  }
  if (dom.scenePage) dom.scenePage.href = `/gta6-leonida-atlas/app/viewpoint/${scene.slug}`;
  if (dom.sceneSource) {
    dom.sceneSource.href = scene.source.url;
    dom.sceneSource.textContent = provenance.sourceLinkLabel;
  }
  dom.sceneDialog?.showModal();
}

export function initializeWalkableWorld(
  root: HTMLElement,
  providedOverlays?: WalkWorldOverlayController,
): WalkableWorldController | undefined {
  if (root.dataset.walkInitialized === 'true') return;
  root.dataset.walkInitialized = 'true';
  root.dataset.walkAlignment = LEONIDA_ALIGNMENT_REVISION;
  root.dataset.walkPlaceAnchors = JSON.stringify(PLACE_ANCHORS);
  root.dataset.walkAllLocationAnchors = JSON.stringify(ALL_LOCATION_ANCHORS);
  root.dataset.walkAmbrosiaAnchors = JSON.stringify(AMBROSIA_WORLD);
  root.dataset.walkViceCityAnchors = JSON.stringify({
    districts: VICE_CITY_WORLD,
    pois: VICE_CITY_POI_WORLD,
  });
  root.dataset.walkCommunityMap = JSON.stringify(STATE_OF_LEONIDA_COMMUNITY_MAP);
  root.dataset.walkCommunityMarkerCount = String(STATE_OF_LEONIDA_COMMUNITY_MAP.markerCount);
  root.dataset.walkCommunityPositionedMarkerCount = String(
    STATE_OF_LEONIDA_COMMUNITY_MAP.positionedMarkerCount,
  );
  root.dataset.walkCommunityUnpositionedMarkerCount = String(
    STATE_OF_LEONIDA_COMMUNITY_MAP.unpositionedMarkerCount,
  );
  const queriedDom = queryDom(root);
  if (!queriedDom) return;
  const dom: WalkDom = queriedDom;
  const scenes = parseScenes(root);
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shell = root.closest<HTMLElement>('[data-street-shell]');
  const standalone = root.dataset.atlasStandalone === 'true';
  const overlays = providedOverlays ?? initializeWalkWorldOverlays(root);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: dom.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    overlays.showWebglFallback();
    let disposed = false;
    return {
      openEvidence: overlays.openEvidence,
      dispose() {
        if (disposed) return;
        disposed = true;
        overlays.dispose();
        root.dataset.walkInitialized = 'false';
        root.dataset.walkReady = 'false';
      },
    };
  }

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      coarsePointer
        ? WALK_WORLD_RENDER_CONFIG.mobilePixelRatioCap
        : WALK_WORLD_RENDER_CONFIG.desktopPixelRatioCap,
    ),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !coarsePointer;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  root.dataset.walkShadowQuality = renderer.shadowMap.enabled ? 'pcf' : 'off';
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = WALK_WORLD_RENDER_CONFIG.toneMappingExposure;
  root.dataset.walkAntialias = 'true';
  root.dataset.walkPixelRatio = renderer.getPixelRatio().toFixed(2);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x17324b);
  let reflectionTarget: THREE.WebGLRenderTarget | null = null;
  const reflectionScene = new RoomEnvironment();
  const reflectionGenerator = new THREE.PMREMGenerator(renderer);
  try {
    reflectionTarget = reflectionGenerator.fromScene(reflectionScene, 0.04);
    scene.environment = reflectionTarget.texture;
    scene.environmentIntensity = WALK_WORLD_RENDER_CONFIG.environmentIntensity;
    root.dataset.walkImageBasedLighting = 'pmrem';
  } catch {
    root.dataset.walkImageBasedLighting = 'direct-light-fallback';
  } finally {
    reflectionScene.dispose();
    reflectionGenerator.dispose();
  }

  const camera = new THREE.PerspectiveCamera(72, 1, 0.08, WALK_WORLD_RENDER_CONFIG.cameraFarMetres);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const oceanMaterial = createStateWaterContinuityMaterial();
  const ocean = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD_BOUNDS.width, 0.22, WORLD_BOUNDS.height),
    oceanMaterial,
  );
  ocean.name = 'walk-state-water-continuity';
  ocean.position.set(
    (WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2,
    WALK_STATE_WATER_CENTER_Y,
    (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2,
  );
  ocean.receiveShadow = true;
  ocean.renderOrder = WALK_STATE_WATER_RENDER_ORDER;
  ocean.userData.evidence = 'APPROXIMATE';
  scene.add(ocean);

  const atmosphere = setupWalkAtmosphere(scene, {
    camera,
    reducedQuality: coarsePointer,
    radius: 1_650,
    fogDensity: coarsePointer ? 0.0019 : 0.0016,
    waterMaterial: oceanMaterial,
  });
  configureWalkSunShadow(atmosphere.sunLight, coarsePointer);
  atmosphere.sunLight.castShadow = renderer.shadowMap.enabled;

  const collisions: AxisAlignedRectangle[] = [];
  const hotspotPositions = resolveWalkScenePositions(scenes);
  const countDrawables = (): number => {
    let count = 0;
    scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Sprite ||
        object instanceof THREE.Line
      )
        count += 1;
    });
    return count;
  };
  root.dataset.walkBaseDrawables = String(countDrawables());
  const hotspots = createHotspots(scene, scenes, hotspotPositions);
  root.dataset.walkUnpositionedSceneCount = String(scenes.length - hotspots.length);
  const hotspotRaycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const initialIndex = Number.parseInt(root.dataset.initialScene ?? '0', 10);
  const requestedInitialScene = scenes[Number.isFinite(initialIndex) ? initialIndex : 0];
  const initialHotspot =
    hotspots.find((hotspot) => hotspot.scene.slug === requestedInitialScene?.slug) ?? hotspots[0];
  const initialEntryView =
    PLACE_ENTRY_VIEWS[root.dataset.initialPlace ?? ''] ??
    (initialHotspot ? PLACE_ENTRY_VIEWS[initialHotspot.scene.placeSlug] : undefined);
  const preferredInitialPosition: WalkPoint =
    initialEntryView?.position ??
    (initialHotspot
      ? {
          x: initialHotspot.position.x + 8.5,
          z: initialHotspot.position.z + 7.8,
        }
      : (PLACE_ENTRY_VIEWS['vice-city']?.position ?? { x: 0, z: 0 }));
  const position: WalkPoint = { ...preferredInitialPosition };
  let yaw = initialEntryView
    ? Math.atan2(position.x - initialEntryView.target.x, position.z - initialEntryView.target.z)
    : initialHotspot
      ? Math.atan2(position.x - initialHotspot.position.x, position.z - initialHotspot.position.z)
      : 0;
  let pitch = -0.03;
  let fieldOfView = 72;
  let active = false;
  let started = false;
  let nearest: WorldHotspot | null = null;
  let joystickAxes: MovementAxes = { right: 0, forward: 0 };
  let joystickIntensity = 0;
  let joystickRunning = false;
  let joystickPointer: number | null = null;
  let lookPointer: number | null = null;
  let lookLast = { x: 0, y: 0 };
  let lastFrame = performance.now();
  let lastTelemetryUpdate = Number.NEGATIVE_INFINITY;
  let walkTime = 0;
  const keys = new Set<string>();
  const eventController = new AbortController();
  let visibleRegionKey = '';
  root.dataset.walkJoystickActive = 'false';
  root.dataset.walkJoystickIntensity = '0.000';
  root.dataset.walkLookActive = 'false';
  root.dataset.walkTouchRunning = 'false';

  const regionManager = createWalkRegionStreamManager<WalkRegionResource>({
    create(region) {
      return buildWalkRegion(region, { renderer, coarsePointer });
    },
    setVisible(resource, visible) {
      resource.root.visible = visible;
      if (visible && resource.root.parent !== scene) scene.add(resource.root);
    },
    dispose(resource) {
      resource.dispose();
    },
  });

  const cartography = createGtadbGroundTileStream({
    radius: coarsePointer
      ? WALK_WORLD_RENDER_CONFIG.mobileCartographyTileRadius
      : WALK_WORLD_RENDER_CONFIG.desktopCartographyTileRadius,
    anisotropy: Math.min(renderer.capabilities.getMaxAnisotropy(), coarsePointer ? 2 : 8),
  });
  cartography.setProtectedArrival(position);
  cartography.sync(position);
  scene.add(cartography.root);
  root.dataset.walkCartography = 'GTADB yanis,16 · CC BY 4.0';

  function syncRegionalVisibility(): void {
    const states = regionManager.sync(position);
    const visibleRegions = states.map(({ region }) => region);
    const activeRegion = states[0]?.region;
    if (activeRegion) {
      atmosphere.setRegion(activeRegion);
      root.dataset.walkAtmosphereRegion = activeRegion;
    }
    const nextKey = visibleRegions.join(',');
    if (nextKey === visibleRegionKey) return;
    visibleRegionKey = nextKey;
    collisions.splice(0, collisions.length);
    let vegetationInstances = 0;
    let featureCount = 0;
    for (const region of visibleRegions) {
      const resource = regionManager.get(region);
      if (!resource) continue;
      collisions.push(...resource.collisions);
      featureCount += resource.featureIds.length;
      const vegetation = resource.root.getObjectByName('street-leonida/photo-vegetation');
      vegetationInstances += Number(vegetation?.userData.instanceCount ?? 0);
    }
    root.dataset.walkVisibleRegions = nextKey;
    root.dataset.walkLoadedRegions = regionManager.loadedRegions().join(',');
    root.dataset.walkRegionalCollisions = String(collisions.length);
    root.dataset.walkStreamedFeatureCount = String(featureCount);
    root.dataset.walkVegetationInstances = String(vegetationInstances);
    root.dataset.walkRegionalDrawables = String(
      Math.max(0, countDrawables() - Number(root.dataset.walkBaseDrawables ?? 0)),
    );
  }

  syncRegionalVisibility();
  const safeInitialPosition = findSafeWalkPosition(position, collisions);
  position.x = safeInitialPosition.x;
  position.z = safeInitialPosition.z;
  const worldLife = createWalkWorldLife(scene, coarsePointer, collisions);

  function setFieldOfView(next: number): void {
    fieldOfView = THREE.MathUtils.clamp(next, 40, 84);
    camera.fov = fieldOfView;
    camera.updateProjectionMatrix();
    const zoomPercent = Math.round((72 / fieldOfView) * 100);
    root.dataset.walkZoom = String(zoomPercent);
    if (dom.zoomValue) dom.zoomValue.textContent = `${zoomPercent}%`;
    if (dom.zoomIn) dom.zoomIn.disabled = fieldOfView <= 40.01;
    if (dom.zoomOut) dom.zoomOut.disabled = fieldOfView >= 83.99;
  }

  function syncPlayerData(): void {
    root.dataset.playerPosition = `${position.x.toFixed(2)},${position.z.toFixed(2)}`;
    root.dataset.playerX = position.x.toFixed(2);
    root.dataset.playerZ = position.z.toFixed(2);
    root.dataset.playerYaw = yaw.toFixed(4);
  }

  function setActive(next: boolean, requestLock = false): void {
    active = next;
    started ||= next;
    root.dataset.walkActive = String(next);
    dom.intro?.toggleAttribute('hidden', started);
    const pointerCaptured = document.pointerLockElement === dom.canvas;
    dom.lockHint?.toggleAttribute('hidden', !started || coarsePointer || pointerCaptured);
    if (next) {
      dom.canvas.focus({ preventScroll: true });
      if (requestLock && !coarsePointer && document.pointerLockElement !== dom.canvas) {
        void dom.canvas.requestPointerLock().catch(() => undefined);
      }
    }
  }

  function startWalking(): void {
    if (coarsePointer || standalone) setExpanded(true);
    setActive(true, false);
  }

  function hotspotAtPointer(event: MouseEvent): WorldHotspot | null {
    const rect = dom.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    hotspotRaycaster.setFromCamera(pointer, camera);
    const targets = hotspots.flatMap((hotspot) => [hotspot.marker, hotspot.label]);
    const hit = hotspotRaycaster.intersectObjects(targets, true)[0];
    const id = hit?.object.userData.hotspotId;
    return typeof id === 'number' ? findWorldHotspotById(hotspots, id) : null;
  }

  function resetJoystick(): void {
    const capturedPointer = joystickPointer;
    joystickPointer = null;
    joystickAxes = { right: 0, forward: 0 };
    joystickIntensity = 0;
    joystickRunning = false;
    root.dataset.walkJoystickActive = 'false';
    root.dataset.walkJoystickIntensity = '0.000';
    root.dataset.walkTouchRunning = 'false';
    if (dom.joystickKnob) dom.joystickKnob.style.transform = 'translate(0px, 0px)';
    if (capturedPointer !== null && dom.joystick?.hasPointerCapture(capturedPointer)) {
      dom.joystick.releasePointerCapture(capturedPointer);
    }
  }

  function resetLook(): void {
    const capturedPointer = lookPointer;
    lookPointer = null;
    root.dataset.walkLookActive = 'false';
    if (capturedPointer !== null && dom.lookPad?.hasPointerCapture(capturedPointer)) {
      dom.lookPad.releasePointerCapture(capturedPointer);
    }
  }

  function resetTouchControls(): void {
    resetJoystick();
    resetLook();
  }

  function pauseWalking(): void {
    keys.clear();
    resetTouchControls();
    setActive(false);
    if (document.pointerLockElement === dom.canvas) document.exitPointerLock();
  }

  function exitWalking(): void {
    pauseWalking();
    if (standalone) {
      window.location.assign('/gta6-leonida-atlas');
      return;
    }
    started = false;
    root.querySelector<HTMLDetailsElement>('[data-walk-button-controls]')?.removeAttribute('open');
    dom.intro?.removeAttribute('hidden');
    dom.lockHint?.setAttribute('hidden', '');
    setExpanded(false);
  }

  function openNearest(): void {
    if (!nearest) return;
    pauseWalking();
    updateDialog(dom, nearest);
  }

  function closeMap(): void {
    overlays.closeMap();
  }

  function openEvidence(): void {
    overlays.openEvidence();
  }

  function hasOpenOverlay(): boolean {
    return Boolean(dom.mapDialog?.open || dom.evidenceDialog?.open || dom.sceneDialog?.open);
  }

  function resumeAfterOverlayClose(): void {
    if (shouldResumeWalkAfterOverlayClose(started, hasOpenOverlay())) {
      setActive(true, false);
    }
  }

  function setExpanded(next: boolean, scheduleResize = true): void {
    if (!shell) return;
    if (standalone) next = true;
    shell.dataset.walkExpanded = String(next);
    document.body.classList.toggle('street-walk-expanded', next);
    dom.fullscreenButton?.setAttribute('aria-pressed', String(next));
    dom.fullscreenButton?.setAttribute(
      'aria-label',
      next ? 'Close full screen' : 'Open full screen',
    );
    if (dom.fullscreenLabel) dom.fullscreenLabel.textContent = next ? 'Close' : 'Full screen';
    if (scheduleResize) requestAnimationFrame(resize);
  }

  function toggleExpanded(): void {
    setExpanded(shell?.dataset.walkExpanded !== 'true');
  }

  function teleportToRegion(placeSlug: string): void {
    const view = PLACE_ENTRY_VIEWS[placeSlug];
    if (!view) return;
    position.x = view.position.x;
    position.z = view.position.z;
    syncRegionalVisibility();
    cartography.setProtectedArrival(view.position);
    cartography.sync(view.position);
    const safePosition = findSafeWalkPosition(view.position, [
      ...collisions,
      ...cartography.collisions,
    ]);
    position.x = safePosition.x;
    position.z = safePosition.z;
    cartography.setProtectedArrival(safePosition);
    yaw = Math.atan2(position.x - view.target.x, position.z - view.target.z);
    pitch = -0.03;
    syncPlayerData();
    closeMap();
    setActive(true, false);
  }

  function teleportToMapDestination(detail: WalkMapTravelDetail): void {
    position.x = detail.x;
    position.z = detail.z;
    syncRegionalVisibility();
    const documentedDestination = { x: detail.x, z: detail.z };
    cartography.setProtectedArrival(documentedDestination);
    cartography.sync(documentedDestination);
    const preferredApproach = resolveMapTravelApproach(detail);
    const safePosition = findSafeWalkPosition(preferredApproach, [
      ...collisions,
      ...cartography.collisions,
    ]);
    position.x = safePosition.x;
    position.z = safePosition.z;
    cartography.setProtectedArrival(safePosition);
    yaw = resolveMapTravelYaw(safePosition, documentedDestination, yaw);
    pitch = -0.03;
    root.dataset.walkMapTravelId = detail.id;
    root.dataset.walkMapTravelSource = detail.source;
    root.dataset.walkMapTravelLabel = detail.label;
    root.dataset.walkMapTravelAdjustment =
      Math.hypot(
        safePosition.x - documentedDestination.x,
        safePosition.z - documentedDestination.z,
      ) > 1e-6
        ? 'APPROXIMATE_VIEW_OFFSET'
        : 'NONE';
    const arrivalNotice = root.querySelector<HTMLElement>('[data-atlas-arrival-notice]');
    if (arrivalNotice) {
      const adjusted = root.dataset.walkMapTravelAdjustment !== 'NONE';
      arrivalNotice.textContent = adjusted
        ? `Arrival adjusted to nearby clear ground · APPROXIMATE. Selected ${detail.label}; your position marker shows the actual arrival.`
        : `Arrived at ${detail.label} · APPROXIMATE community placement.`;
      arrivalNotice.removeAttribute('hidden');
    }
    syncPlayerData();
    syncRegionalVisibility();
    closeMap();
    setActive(true, false);
  }

  function handleMapTravel(event: Event): void {
    const detail = parseWalkMapTravelDetail((event as CustomEvent<unknown>).detail);
    if (detail) teleportToMapDestination(detail);
  }

  function updateJoystick(event: PointerEvent): void {
    if (!dom.joystick || !dom.joystickKnob) return;
    const rect = dom.joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.38);
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const input = resolveTouchJoystickInput(dx, dy, radius);
    dom.joystickKnob.style.transform = `translate(${input.knob.x}px, ${input.knob.y}px)`;
    joystickAxes = input.axes;
    joystickIntensity = input.intensity;
    joystickRunning = input.running;
    root.dataset.walkJoystickIntensity = joystickIntensity.toFixed(3);
    root.dataset.walkTouchRunning = String(joystickRunning);
  }

  overlays.setBeforeOpen(() => pauseWalking());
  const eventOptions = { signal: eventController.signal } as const;
  dom.start?.addEventListener('click', startWalking, eventOptions);
  root
    .closest('[data-street-shell]')
    ?.querySelector<HTMLButtonElement>('[data-enter-explorer]')
    ?.addEventListener('click', startWalking, eventOptions);
  root
    .closest('[data-street-shell]')
    ?.querySelector<HTMLButtonElement>('[data-exit-explorer]')
    ?.addEventListener('click', exitWalking, eventOptions);
  dom.canvas.addEventListener(
    'click',
    (event) => {
      if (!started) return;
      const clickedHotspot = hotspotAtPointer(event);
      if (clickedHotspot) {
        nearest = clickedHotspot;
        openNearest();
        return;
      }
      setActive(true, true);
    },
    eventOptions,
  );
  dom.prompt?.addEventListener('click', openNearest, eventOptions);
  dom.interact?.addEventListener('click', openNearest, eventOptions);
  dom.zoomIn?.addEventListener('click', () => setFieldOfView(fieldOfView - 5), eventOptions);
  dom.zoomOut?.addEventListener('click', () => setFieldOfView(fieldOfView + 5), eventOptions);
  dom.fullscreenButton?.addEventListener('click', toggleExpanded, eventOptions);
  dom.stop?.addEventListener('click', exitWalking, eventOptions);
  dom.mapDialog?.addEventListener('street-leonida:map-travel', handleMapTravel, eventOptions);
  dom.closeScene?.addEventListener('click', () => dom.sceneDialog?.close(), eventOptions);
  [dom.mapDialog, dom.evidenceDialog, dom.sceneDialog].forEach((dialog) => {
    dialog?.addEventListener('close', resumeAfterOverlayClose, eventOptions);
  });
  root.querySelectorAll<HTMLButtonElement>('[data-walk-region]').forEach((button) => {
    button.addEventListener(
      'click',
      () => teleportToRegion(button.dataset.walkRegion ?? ''),
      eventOptions,
    );
  });

  document.addEventListener(
    'pointerlockchange',
    () => {
      if (document.pointerLockElement === dom.canvas) {
        setActive(true);
      } else if (!coarsePointer && active) {
        keys.clear();
        resetTouchControls();
        setActive(false);
      }
    },
    eventOptions,
  );
  document.addEventListener(
    'mousemove',
    (event) => {
      if (!active || document.pointerLockElement !== dom.canvas) return;
      yaw -= event.movementX * 0.00215;
      pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.00175, -1.22, 1.22);
    },
    eventOptions,
  );
  dom.canvas.addEventListener(
    'wheel',
    (event) => {
      if (!started || dom.mapDialog?.open) return;
      event.preventDefault();
      setFieldOfView(fieldOfView + Math.sign(event.deltaY) * 3.5);
    },
    { passive: false, signal: eventController.signal },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'escape' && !standalone && shell?.dataset.walkExpanded === 'true') {
        setExpanded(false);
        return;
      }
      if (
        ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(
          key,
        )
      ) {
        if (active) event.preventDefault();
        keys.add(key);
      }
      if (active && (key === 'e' || key === 'enter')) {
        event.preventDefault();
        openNearest();
      }
      if (active && (key === '+' || key === '=')) {
        event.preventDefault();
        setFieldOfView(fieldOfView - 5);
      }
      if (active && (key === '-' || key === '_')) {
        event.preventDefault();
        setFieldOfView(fieldOfView + 5);
      }
    },
    eventOptions,
  );
  document.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()), eventOptions);
  window.addEventListener(
    'blur',
    () => {
      keys.clear();
      resetTouchControls();
    },
    eventOptions,
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') {
        keys.clear();
        resetTouchControls();
      }
    },
    eventOptions,
  );

  dom.joystick?.addEventListener(
    'pointerdown',
    (event) => {
      if (!active || joystickPointer !== null) return;
      event.preventDefault();
      joystickPointer = event.pointerId;
      root.dataset.walkJoystickActive = 'true';
      try {
        dom.joystick?.setPointerCapture(event.pointerId);
      } catch {
        // Some assistive/synthetic pointers cannot be captured; movement still works until release.
      }
      updateJoystick(event);
    },
    eventOptions,
  );
  dom.joystick?.addEventListener(
    'pointermove',
    (event) => {
      if (joystickPointer === event.pointerId) updateJoystick(event);
    },
    eventOptions,
  );
  const stopJoystick = (event: PointerEvent): void => {
    if (joystickPointer === event.pointerId) resetJoystick();
  };
  dom.joystick?.addEventListener('pointerup', stopJoystick, eventOptions);
  dom.joystick?.addEventListener('pointercancel', stopJoystick, eventOptions);
  dom.joystick?.addEventListener('lostpointercapture', stopJoystick, eventOptions);

  dom.lookPad?.addEventListener(
    'pointerdown',
    (event) => {
      if (!active || lookPointer !== null) return;
      event.preventDefault();
      lookPointer = event.pointerId;
      root.dataset.walkLookActive = 'true';
      lookLast = { x: event.clientX, y: event.clientY };
      try {
        dom.lookPad?.setPointerCapture(event.pointerId);
      } catch {
        // Keep synthetic and switch-control pointers functional without capture support.
      }
    },
    eventOptions,
  );
  dom.lookPad?.addEventListener(
    'pointermove',
    (event) => {
      if (lookPointer !== event.pointerId) return;
      yaw -= (event.clientX - lookLast.x) * 0.006;
      pitch = THREE.MathUtils.clamp(pitch - (event.clientY - lookLast.y) * 0.004, -1.12, 1.12);
      lookLast = { x: event.clientX, y: event.clientY };
    },
    eventOptions,
  );
  const stopLook = (event: PointerEvent): void => {
    if (lookPointer === event.pointerId) resetLook();
  };
  dom.lookPad?.addEventListener('pointerup', stopLook, eventOptions);
  dom.lookPad?.addEventListener('pointercancel', stopLook, eventOptions);
  dom.lookPad?.addEventListener('lostpointercapture', stopLook, eventOptions);

  const accessibleMoveAxes: Readonly<Record<string, MovementAxes>> = {
    forward: { right: 0, forward: 1 },
    backward: { right: 0, forward: -1 },
    left: { right: -1, forward: 0 },
    right: { right: 1, forward: 0 },
  };
  root.querySelectorAll<HTMLButtonElement>('[data-walk-move-button]').forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const axes = accessibleMoveAxes[button.dataset.walkMoveButton ?? ''];
        if (!axes || !active) return;
        tryMove(getYawRelativeMovementDelta(axes, yaw, 0.85));
        syncPlayerData();
      },
      eventOptions,
    );
  });
  root.querySelectorAll<HTMLButtonElement>('[data-walk-look-button]').forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const action = button.dataset.walkLookButton;
        if (action === 'left') yaw += 0.18;
        if (action === 'right') yaw -= 0.18;
        if (action === 'up') pitch = THREE.MathUtils.clamp(pitch + 0.12, -1.12, 1.12);
        if (action === 'down') pitch = THREE.MathUtils.clamp(pitch - 0.12, -1.12, 1.12);
        syncPlayerData();
      },
      eventOptions,
    );
  });

  function keyboardAxes(): MovementAxes {
    const right =
      Number(keys.has('d') || keys.has('arrowright')) -
      Number(keys.has('a') || keys.has('arrowleft'));
    const forward =
      Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
    return normalizeMovementAxes({
      right: right + joystickAxes.right,
      forward: forward + joystickAxes.forward,
    });
  }

  function tryMove(delta: WalkPoint): void {
    const xCandidate = { x: position.x + delta.x, z: position.z };
    if (
      !collidesWithBuildings(xCandidate, WALK_PLAYER_CONFIG.radiusMetres, collisions) &&
      !collidesWithBuildings(xCandidate, WALK_PLAYER_CONFIG.radiusMetres, cartography.collisions)
    ) {
      position.x = xCandidate.x;
    }
    const zCandidate = { x: position.x, z: position.z + delta.z };
    if (
      !collidesWithBuildings(zCandidate, WALK_PLAYER_CONFIG.radiusMetres, collisions) &&
      !collidesWithBuildings(zCandidate, WALK_PLAYER_CONFIG.radiusMetres, cartography.collisions)
    ) {
      position.z = zCandidate.z;
    }
  }

  function resize(): void {
    const rect = root.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const devicePixelRatio = Math.min(
      window.devicePixelRatio || 1,
      coarsePointer
        ? WALK_WORLD_RENDER_CONFIG.mobilePixelRatioCap
        : WALK_WORLD_RENDER_CONFIG.desktopPixelRatioCap,
    );
    const pixelBudget = coarsePointer
      ? WALK_WORLD_RENDER_CONFIG.mobilePixelBudget
      : WALK_WORLD_RENDER_CONFIG.desktopPixelBudget;
    const budgetPixelRatio = Math.sqrt(pixelBudget / (width * height));
    const pixelRatio = Math.min(devicePixelRatio, budgetPixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    root.dataset.walkPixelRatio = pixelRatio.toFixed(3);
    root.dataset.walkPixelBudget = String(pixelBudget);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  resize();
  let disposed = false;
  let animationFrameId = 0;

  function animate(now: number): void {
    if (disposed) return;
    const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    const overlayOpen = Boolean(
      dom.mapDialog?.open || dom.evidenceDialog?.open || dom.sceneDialog?.open,
    );
    const simulationActive = !overlayOpen && document.visibilityState !== 'hidden';
    root.dataset.walkSimulationActive = String(simulationActive);
    const axes = active && simulationActive ? keyboardAxes() : { right: 0, forward: 0 };
    const moving = Math.abs(axes.right) > 0.01 || Math.abs(axes.forward) > 0.01;
    const running = keys.has('shift') || joystickRunning;
    if (simulationActive) {
      worldLife.update(deltaSeconds, now / 1000, position);
      for (const region of regionManager.loadedRegions()) {
        regionManager.get(region)?.update(now / 1000);
      }
    }
    if (moving) {
      const distance =
        (running ? WALK_PLAYER_CONFIG.runMetresPerSecond : WALK_PLAYER_CONFIG.walkMetresPerSecond) *
        deltaSeconds;
      tryMove(getYawRelativeMovementDelta(axes, yaw, distance));
      walkTime += deltaSeconds * (running ? 13 : 8.5);
    }

    const bob = active && moving && !reducedMotion ? Math.sin(walkTime) * 0.045 : 0;
    camera.position.set(position.x, WALK_PLAYER_CONFIG.eyeHeightMetres + bob, position.z);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    // The sky/haze rig follows the camera. Sync it after teleports and movement so
    // a frame can never reveal the edge of the atmosphere sphere.
    if (simulationActive) atmosphere.update(deltaSeconds, now / 1000);
    const shouldSyncTelemetry =
      now - lastTelemetryUpdate >= WALK_WORLD_RENDER_CONFIG.telemetryIntervalMs;
    if (shouldSyncTelemetry) {
      lastTelemetryUpdate = now;
      cartography.sync(position);
      if (
        collidesWithBuildings(position, WALK_PLAYER_CONFIG.radiusMetres, cartography.collisions)
      ) {
        const recovery = reconcileWalkPosition(position, [
          ...collisions,
          ...cartography.collisions,
        ]);
        if (recovery.relocated) {
          position.x = recovery.position.x;
          position.z = recovery.position.z;
          cartography.setProtectedArrival(recovery.position);
          const recoveryCount = Number.parseInt(root.dataset.walkCollisionRecoveryCount ?? '0', 10);
          root.dataset.walkCollisionRecoveryCount = String(
            Number.isFinite(recoveryCount) ? recoveryCount + 1 : 1,
          );
          syncPlayerData();
          const arrivalNotice = root.querySelector<HTMLElement>('[data-atlas-arrival-notice]');
          if (arrivalNotice) {
            arrivalNotice.textContent =
              'Position adjusted to nearby clear ground as regional details loaded · APPROXIMATE. Your map marker shows the updated position.';
            arrivalNotice.removeAttribute('hidden');
          }
        }
      }
      root.dataset.walkCartographyTiles = String(cartography.root.userData.tileCount ?? 0);
      root.dataset.walkCartographyBuildings = String(cartography.root.userData.buildingCount ?? 0);
      root.dataset.walkCartographyBuildingDetails = String(
        cartography.root.userData.buildingDetailCount ?? 0,
      );
      root.dataset.walkCartographyRoadSegments = String(
        cartography.root.userData.roadSegmentCount ?? 0,
      );
      root.dataset.walkCartographyRoadsideDetails = String(
        cartography.root.userData.roadsideDetailCount ?? 0,
      );
      syncRegionalVisibility();
    }

    if (simulationActive) {
      const nearby = findNearestInteractiveHotspot(position, hotspots, 13)?.hotspot ?? null;
      if (nearby !== nearest) {
        nearest = nearby;
        dom.prompt?.toggleAttribute('hidden', !nearest);
        if (dom.promptTitle) dom.promptTitle.textContent = nearest?.scene.title ?? '';
        if (dom.interact) {
          dom.interact.disabled = !nearest;
          dom.interact.textContent = nearest ? 'Explore' : 'Walk closer';
        }
      }

      hotspots.forEach((hotspot, index) => {
        const pulse = reducedMotion ? 1 : 1 + Math.sin(now * 0.0025 + index) * 0.08;
        hotspot.marker.scale.setScalar(pulse);
        hotspot.marker.rotation.y += deltaSeconds * 0.34;
        const distance = camera.position.distanceTo(hotspot.label.position);
        hotspot.label.material.opacity = THREE.MathUtils.clamp(1.3 - distance / 18, 0.25, 1);
        hotspot.label.visible = !coarsePointer && distance < 18;
      });
    }

    if (shouldSyncTelemetry) {
      const currentZone = zoneProfile(position);
      if (dom.zone) dom.zone.textContent = currentZone.name;
      if (dom.zoneDetail) dom.zoneDetail.textContent = currentZone.detail;
      if (dom.heading) dom.heading.textContent = cardinalHeading(yaw);
      if (dom.hudCoordinates) {
        dom.hudCoordinates.textContent = describeWalkMapPose({
          x: position.x,
          z: position.z,
          yaw,
        }).gtadb;
      }
      if (dom.playerDot) {
        const mapPosition = worldToMap(position);
        const x = ((mapPosition.x - MAP_BOUNDS.minX) / MAP_BOUNDS.width) * 100;
        const y = ((mapPosition.y - MAP_BOUNDS.minY) / MAP_BOUNDS.height) * 100;
        dom.playerDot.style.left = `${THREE.MathUtils.clamp(x, 4, 96)}%`;
        dom.playerDot.style.top = `${THREE.MathUtils.clamp(y, 4, 96)}%`;
        dom.playerDot.style.transform = `translate(-50%, -50%) rotate(${-yaw}rad)`;
      }
      syncPlayerData();
      if (dom.mapDialog?.open) {
        overlays.updatePlayer({ x: position.x, z: position.z, yaw });
      }
    }
    if (simulationActive) {
      renderer.render(scene, camera);
      root.dataset.walkDrawCalls = String(renderer.info.render.calls);
      root.dataset.walkTriangles = String(renderer.info.render.triangles);
    }
    animationFrameId = requestAnimationFrame(animate);
  }

  root.dataset.walkReady = 'true';
  overlays.markThreeDimensionalReady();
  dom.loading?.setAttribute('hidden', '');
  setFieldOfView(fieldOfView);
  syncPlayerData();
  overlays.updatePlayer({ x: position.x, z: position.z, yaw });
  if (standalone) {
    setExpanded(true);
    started = true;
    setActive(!hasOpenOverlay());
  }
  animationFrameId = requestAnimationFrame(animate);

  return {
    openEvidence,
    dispose() {
      if (disposed) return;
      disposed = true;
      setExpanded(false, false);
      if (standalone) document.body.classList.remove('street-walk-expanded');
      root.dataset.walkSimulationActive = 'false';
      cancelAnimationFrame(animationFrameId);
      eventController.abort();
      resizeObserver.disconnect();
      overlays.dispose();
      regionManager.dispose();
      cartography.dispose();
      atmosphere.dispose();
      scene.environment = null;
      reflectionTarget?.dispose();
      if (document.pointerLockElement === dom.canvas) document.exitPointerLock();

      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        const renderable = object as THREE.Mesh;
        if (renderable.geometry) geometries.add(renderable.geometry);
        const objectMaterials = Array.isArray(renderable.material)
          ? renderable.material
          : renderable.material
            ? [renderable.material]
            : [];
        for (const material of objectMaterials) {
          materials.add(material);
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) textures.add(value);
          }
        }
      });
      for (const texture of textures) texture.dispose();
      for (const material of materials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      root.dataset.walkInitialized = 'false';
      root.dataset.walkReady = 'false';
    },
  };
}
