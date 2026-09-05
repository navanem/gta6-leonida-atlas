export interface WalkPoint {
  x: number;
  z: number;
}

export interface MovementAxes {
  right: number;
  forward: number;
}

export interface WalkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type AxisAlignedRectangle = WalkBounds;

export interface InteractiveHotspotCandidate {
  position: WalkPoint;
  interactive?: boolean;
  interactionRadius?: number;
}

export interface NearestInteractiveHotspot<T extends InteractiveHotspotCandidate> {
  hotspot: T;
  distance: number;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function stableNumber(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

function orderedRange(first: number, second: number): readonly [number, number] {
  return first <= second ? [first, second] : [second, first];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeMovementAxes(axes: MovementAxes): MovementAxes {
  const right = finiteOrZero(axes.right);
  const forward = finiteOrZero(axes.forward);
  const magnitude = Math.hypot(right, forward);

  if (magnitude <= 1) {
    return { right: stableNumber(right), forward: stableNumber(forward) };
  }

  return {
    right: stableNumber(right / magnitude),
    forward: stableNumber(forward / magnitude),
  };
}

export function getYawRelativeMovementDelta(
  axes: MovementAxes,
  yawRadians: number,
  distance: number,
): WalkPoint {
  const normalizedAxes = normalizeMovementAxes(axes);
  const yaw = finiteOrZero(yawRadians);
  const step = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  const sine = Math.sin(yaw);
  const cosine = Math.cos(yaw);

  return {
    x: stableNumber((normalizedAxes.right * cosine - normalizedAxes.forward * sine) * step),
    z: stableNumber((normalizedAxes.right * sine - normalizedAxes.forward * cosine) * step),
  };
}

export function clampPlayerToBounds(
  position: WalkPoint,
  bounds: WalkBounds,
  radius: number,
): WalkPoint {
  const [worldMinX, worldMaxX] = orderedRange(bounds.minX, bounds.maxX);
  const [worldMinZ, worldMaxZ] = orderedRange(bounds.minZ, bounds.maxZ);
  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;

  const minimumX = worldMinX + safeRadius;
  const maximumX = worldMaxX - safeRadius;
  const minimumZ = worldMinZ + safeRadius;
  const maximumZ = worldMaxZ - safeRadius;
  const fallbackX = (worldMinX + worldMaxX) / 2;
  const fallbackZ = (worldMinZ + worldMaxZ) / 2;

  return {
    x:
      minimumX > maximumX
        ? fallbackX
        : clamp(Number.isFinite(position.x) ? position.x : fallbackX, minimumX, maximumX),
    z:
      minimumZ > maximumZ
        ? fallbackZ
        : clamp(Number.isFinite(position.z) ? position.z : fallbackZ, minimumZ, maximumZ),
  };
}

export function circleIntersectsRectangle(
  center: WalkPoint,
  radius: number,
  rectangle: AxisAlignedRectangle,
): boolean {
  if (!Number.isFinite(center.x) || !Number.isFinite(center.z)) return false;

  const [minimumX, maximumX] = orderedRange(rectangle.minX, rectangle.maxX);
  const [minimumZ, maximumZ] = orderedRange(rectangle.minZ, rectangle.maxZ);
  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  const nearestX = clamp(center.x, minimumX, maximumX);
  const nearestZ = clamp(center.z, minimumZ, maximumZ);
  const distanceX = center.x - nearestX;
  const distanceZ = center.z - nearestZ;

  return distanceX * distanceX + distanceZ * distanceZ <= safeRadius * safeRadius;
}

export function collidesWithBuildings(
  center: WalkPoint,
  radius: number,
  buildings: readonly AxisAlignedRectangle[],
): boolean {
  return buildings.some((building) => circleIntersectsRectangle(center, radius, building));
}

export function findNearestInteractiveHotspot<T extends InteractiveHotspotCandidate>(
  position: WalkPoint,
  hotspots: readonly T[],
  maxDistance: number,
): NearestInteractiveHotspot<T> | null {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return null;

  const globalLimit =
    maxDistance === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Number.isFinite(maxDistance)
        ? Math.max(0, maxDistance)
        : 0;
  let nearest: NearestInteractiveHotspot<T> | null = null;

  for (const hotspot of hotspots) {
    if (
      hotspot.interactive === false ||
      !Number.isFinite(hotspot.position.x) ||
      !Number.isFinite(hotspot.position.z)
    ) {
      continue;
    }

    const localLimit =
      hotspot.interactionRadius === undefined
        ? globalLimit
        : Number.isFinite(hotspot.interactionRadius)
          ? Math.max(0, hotspot.interactionRadius)
          : 0;
    const allowedDistance = Math.min(globalLimit, localLimit);
    const distance = Math.hypot(hotspot.position.x - position.x, hotspot.position.z - position.z);

    if (distance <= allowedDistance && (nearest === null || distance < nearest.distance)) {
      nearest = { hotspot, distance };
    }
  }

  return nearest;
}
