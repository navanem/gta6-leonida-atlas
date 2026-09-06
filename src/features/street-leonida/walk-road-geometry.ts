export interface RoadEdge {
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly rotation: number;
  readonly pathId?: number;
}
export interface RoadBoundary extends RoadEdge {
  readonly kind: 'urban' | 'rural' | 'water' | 'unknown';
  readonly outwardX: number;
  readonly outwardY: number;
}

/** Keep road-side interpretation tied to the pixels on either side of the boundary. */
export function classifyRoadBoundary(
  edge: RoadEdge,
  sample: (x: number, y: number) => string,
): RoadBoundary {
  const nx = -Math.sin(edge.rotation),
    ny = Math.cos(edge.rotation);
  const plus = sample(edge.x + nx * 1.5, edge.y + ny * 1.5);
  const minus = sample(edge.x - nx * 1.5, edge.y - ny * 1.5);
  const sign =
    minus === 'road' && plus !== 'road' ? 1 : plus === 'road' && minus !== 'road' ? -1 : 0;
  const outside = sign > 0 ? plus : minus;
  const kind = !sign
    ? 'unknown'
    : outside === 'pavement'
      ? 'urban'
      : outside === 'ground' || outside === 'vegetation'
        ? 'rural'
        : outside === 'water'
          ? 'water'
          : 'unknown';
  return { ...edge, kind, outwardX: nx * sign || 0, outwardY: ny * sign || 0 };
}

/** Returns front/back/right/left in the building's own rotated frame. */
export function findRoadFacingSide(
  position: { x: number; y: number },
  yaw: number,
  edges: readonly RoadEdge[],
): number {
  let nearest = Infinity,
    directionX = 0,
    directionY = 1;
  for (const edge of edges) {
    const c = Math.cos(edge.rotation),
      s = Math.sin(edge.rotation);
    const projection = Math.max(
      -edge.length / 2,
      Math.min(edge.length / 2, (position.x - edge.x) * c + (position.y - edge.y) * s),
    );
    const dx = edge.x + projection * c - position.x,
      dy = edge.y + projection * s - position.y;
    const distance = dx * dx + dy * dy;
    if (distance < nearest) {
      nearest = distance;
      directionX = dx;
      directionY = dy;
    }
  }
  const x = directionX * Math.cos(yaw) - directionY * Math.sin(yaw);
  const z = directionX * Math.sin(yaw) + directionY * Math.cos(yaw);
  return Math.abs(x) > Math.abs(z) ? (x >= 0 ? 2 : 3) : z >= 0 ? 0 : 1;
}
type Point = { x: number; y: number };
const key = (p: Point) => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`;

function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const a = points[0]!,
    b = points[points.length - 1]!,
    dx = b.x - a.x,
    dy = b.y - a.y;
  let furthest = 0,
    index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
    );
    const distance = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    if (distance > furthest) {
      furthest = distance;
      index = i;
    }
  }
  if (furthest <= tolerance) return [a, b];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

/** Reconnect raster boundaries, then smooth only within the source-pixel tolerance. */
export function simplifyRoadEdges(edges: readonly RoadEdge[], tolerance = 1): RoadEdge[] {
  const endpoints = edges.map((e) => {
    const dx = (Math.cos(e.rotation) * e.length) / 2,
      dy = (Math.sin(e.rotation) * e.length) / 2;
    return [
      { x: e.x - dx, y: e.y - dy },
      { x: e.x + dx, y: e.y + dy },
    ] as const;
  });
  const neighbors = new Map<string, number[]>();
  endpoints.forEach((pair, i) =>
    pair.forEach((p) => {
      const list = neighbors.get(key(p)) ?? [];
      list.push(i);
      neighbors.set(key(p), list);
    }),
  );
  const visited = new Set<number>(),
    result: RoadEdge[] = [];
  const starts = [...endpoints.keys()].sort(
    (a, b) =>
      Number(endpoints[b]!.some((p) => neighbors.get(key(p))!.length === 1)) -
      Number(endpoints[a]!.some((p) => neighbors.get(key(p))!.length === 1)),
  );
  let pathId = 0;
  for (const start of starts) {
    if (visited.has(start)) continue;
    const first = endpoints[start]!,
      open = first.find((p) => neighbors.get(key(p))!.length === 1) ?? first[0];
    const points = [open];
    let current = open,
      edge = start;
    while (!visited.has(edge)) {
      visited.add(edge);
      const pair = endpoints[edge]!,
        next = key(pair[0]) === key(current) ? pair[1] : pair[0];
      points.push(next);
      current = next;
      const candidates = neighbors.get(key(current))!.filter((i) => !visited.has(i));
      if (candidates.length !== 1) break;
      edge = candidates[0]!;
    }
    const reduced = simplify(points, tolerance);
    for (let i = 1; i < reduced.length; i++) {
      const a = reduced[i - 1]!,
        b = reduced[i]!,
        length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 0.01) continue;
      result.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        length,
        rotation: Math.atan2(b.y - a.y, b.x - a.x),
        pathId,
      });
    }
    pathId++;
  }
  return result;
}

/** Spacing uses accumulated metres along each connected edge, never a segment index. */
export function sampleRoadFixtures<T extends RoadEdge>(
  edges: readonly T[],
  spacingMetres: number,
  metresPerPixel = 2,
): T[] {
  const spacing = Math.max(1, spacingMetres / metresPerPixel),
    output: T[] = [];
  let remaining = spacing / 2,
    path: number | undefined;
  for (const edge of edges) {
    if (edge.pathId !== path) {
      remaining = spacing / 2;
      path = edge.pathId;
    }
    const c = Math.cos(edge.rotation),
      s = Math.sin(edge.rotation);
    while (remaining < edge.length) {
      output.push({
        ...edge,
        x: edge.x + (remaining - edge.length / 2) * c,
        y: edge.y + (remaining - edge.length / 2) * s,
        length: 0,
        rotation: edge.rotation,
        pathId: edge.pathId,
      });
      remaining += spacing;
    }
    remaining -= edge.length;
  }
  return output;
}
