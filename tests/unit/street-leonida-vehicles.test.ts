import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  createMotorcycle,
  createRoadVehicle,
  type MotorcycleType,
  type RoadVehicleType,
} from '../../src/features/street-leonida/walk-vehicles';

function singleMesh(group: THREE.Group): THREE.Mesh {
  const meshes: THREE.Mesh[] = [];
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  expect(meshes).toHaveLength(1);
  return meshes[0]!;
}

function bounds(mesh: THREE.Mesh): THREE.Box3 {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!.clone();
}

function uniqueVertexColors(mesh: THREE.Mesh): number {
  const colors = mesh.geometry.getAttribute('color');
  const uniqueColors = new Set<string>();
  for (let index = 0; index < colors.count; index += 1) {
    uniqueColors.add(
      [colors.getX(index), colors.getY(index), colors.getZ(index)]
        .map((channel) => channel.toFixed(4))
        .join(','),
    );
  }
  return uniqueColors.size;
}

function hasVertexColor(mesh: THREE.Mesh, hexadecimal: number): boolean {
  const expected = new THREE.Color(hexadecimal);
  const colors = mesh.geometry.getAttribute('color');
  for (let index = 0; index < colors.count; index += 1) {
    if (
      Math.abs(colors.getX(index) - expected.r) < 0.0001 &&
      Math.abs(colors.getY(index) - expected.g) < 0.0001 &&
      Math.abs(colors.getZ(index) - expected.b) < 0.0001
    ) {
      return true;
    }
  }
  return false;
}

function vertexColorBounds(mesh: THREE.Mesh, hexadecimal: number): THREE.Box3 {
  const expected = new THREE.Color(hexadecimal);
  const positions = mesh.geometry.getAttribute('position');
  const colors = mesh.geometry.getAttribute('color');
  const result = new THREE.Box3();
  for (let index = 0; index < colors.count; index += 1) {
    if (
      Math.abs(colors.getX(index) - expected.r) < 0.0001 &&
      Math.abs(colors.getY(index) - expected.g) < 0.0001 &&
      Math.abs(colors.getZ(index) - expected.b) < 0.0001
    ) {
      result.expandByPoint(
        new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index)),
      );
    }
  }
  expect(result.isEmpty()).toBe(false);
  return result;
}

function minimumYForColorOutsideBody(
  mesh: THREE.Mesh,
  hexadecimal: number,
  minimumAbsoluteX: number,
): number {
  const expected = new THREE.Color(hexadecimal);
  const positions = mesh.geometry.getAttribute('position');
  const colors = mesh.geometry.getAttribute('color');
  let minimumY = Number.POSITIVE_INFINITY;
  for (let index = 0; index < colors.count; index += 1) {
    const matchesColor =
      Math.abs(colors.getX(index) - expected.r) < 0.0001 &&
      Math.abs(colors.getY(index) - expected.g) < 0.0001 &&
      Math.abs(colors.getZ(index) - expected.b) < 0.0001;
    if (matchesColor && Math.abs(positions.getX(index)) > minimumAbsoluteX) {
      minimumY = Math.min(minimumY, positions.getY(index));
    }
  }
  return minimumY;
}

function vertexColorSlope(
  mesh: THREE.Mesh,
  hexadecimal: number,
  coordinate: 'x' | 'z',
  select: (point: THREE.Vector3) => boolean,
): number {
  const expected = new THREE.Color(hexadecimal);
  const positions = mesh.geometry.getAttribute('position');
  const colors = mesh.geometry.getAttribute('color');
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < colors.count; index += 1) {
    const matchesColor =
      Math.abs(colors.getX(index) - expected.r) < 0.0001 &&
      Math.abs(colors.getY(index) - expected.g) < 0.0001 &&
      Math.abs(colors.getZ(index) - expected.b) < 0.0001;
    const point = new THREE.Vector3(
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index),
    );
    if (matchesColor && select(point)) points.push(point);
  }
  expect(points.length).toBeGreaterThan(100);
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const meanCoordinate = points.reduce((sum, point) => sum + point[coordinate], 0) / points.length;
  const covariance = points.reduce(
    (sum, point) => sum + (point.y - meanY) * (point[coordinate] - meanCoordinate),
    0,
  );
  const verticalVariance = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
  return covariance / verticalVariance;
}

describe('Street Leonida vehicle rendering', () => {
  it('uses a single sculpted, panelled PBR mesh for road traffic', () => {
    const vehicle = createRoadVehicle(0x287cab, 'pickup');
    const mesh = singleMesh(vehicle);

    expect(mesh.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect((mesh.material as THREE.MeshPhysicalMaterial).clearcoat).toBeGreaterThan(0.5);
    expect(vehicle.userData.surfaceProfile).toBe('sculpted-panelled-pbr');
    expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(6_000);
    expect(mesh.geometry.getAttribute('position').count).toBeLessThan(18_000);
    expect(bounds(mesh).max.y).toBeGreaterThan(1.7);
    expect(bounds(mesh).min.x).toBeLessThan(-1.12);
  });

  it('gives every road category a recognisable detailed silhouette', () => {
    const types: RoadVehicleType[] = [
      'sedan',
      'pickup',
      'convertible',
      'police',
      'tanker',
      'utility',
    ];
    const meshes = Object.fromEntries(
      types.map((type) => [type, singleMesh(createRoadVehicle(0x287cab, type))]),
    ) as Record<RoadVehicleType, THREE.Mesh>;
    const boxes = Object.fromEntries(types.map((type) => [type, bounds(meshes[type])])) as Record<
      RoadVehicleType,
      THREE.Box3
    >;
    const sedanPaint = vertexColorBounds(meshes.sedan, 0x287cab);
    const policePaint = vertexColorBounds(meshes.police, 0x287cab);
    const pickupPaint = vertexColorBounds(meshes.pickup, 0x287cab);

    expect(boxes.pickup.getSize(new THREE.Vector3()).z).toBeGreaterThan(
      boxes.sedan.getSize(new THREE.Vector3()).z + 0.4,
    );
    expect(sedanPaint.max.y).toBeGreaterThanOrEqual(1.45);
    expect(sedanPaint.max.y).toBeLessThanOrEqual(1.55);
    expect(policePaint.max.y).toBeCloseTo(sedanPaint.max.y, 5);
    expect(pickupPaint.max.y).toBeGreaterThan(sedanPaint.max.y + 0.25);
    expect(boxes.police.max.y).toBeGreaterThan(sedanPaint.max.y + 0.1);
    expect(boxes.tanker.getSize(new THREE.Vector3()).z).toBeGreaterThan(
      boxes.pickup.getSize(new THREE.Vector3()).z + 1.5,
    );
    expect(boxes.utility.getSize(new THREE.Vector3()).z).toBeGreaterThan(
      boxes.sedan.getSize(new THREE.Vector3()).z + 0.7,
    );
    expect(boxes.convertible.getSize(new THREE.Vector3()).x).toBeGreaterThan(2.25);
    expect(uniqueVertexColors(meshes.sedan)).toBeGreaterThanOrEqual(9);
    expect(uniqueVertexColors(meshes.pickup)).toBeGreaterThanOrEqual(9);
    expect(uniqueVertexColors(meshes.convertible)).toBeGreaterThanOrEqual(10);
    expect(uniqueVertexColors(meshes.police)).toBeGreaterThanOrEqual(12);
    expect(uniqueVertexColors(meshes.tanker)).toBeGreaterThanOrEqual(10);
    expect(uniqueVertexColors(meshes.utility)).toBeGreaterThanOrEqual(10);
    expect(hasVertexColor(meshes.convertible, 0x382c31)).toBe(true);
    expect(hasVertexColor(meshes.police, 0xe8edf1)).toBe(true);
    expect(minimumYForColorOutsideBody(meshes.sedan, 0x287cab, 0.925)).toBeGreaterThan(0.3);

    for (const type of types) {
      expect(createRoadVehicle(0x287cab, type).userData.designCues).toEqual(
        expect.arrayContaining([
          'trapezoidal-cabin',
          'inclined-windshield',
          'low-hood',
          'wheel-arch-fenders',
          'detailed-wheel-and-light-set',
        ]),
      );
    }
  });

  it('integrates rounded bumpers and slim lamps into the low sedan body', () => {
    const mesh = singleMesh(createRoadVehicle(0x287cab, 'sedan'));
    const paint = vertexColorBounds(mesh, 0x287cab);
    const tires = vertexColorBounds(mesh, 0x111419);
    const headlights = vertexColorBounds(mesh, 0xfff2c4).getSize(new THREE.Vector3());
    const taillights = vertexColorBounds(mesh, 0xd92c32).getSize(new THREE.Vector3());

    expect(tires.max.y).toBeLessThanOrEqual(0.78);
    expect(paint.min.z).toBeLessThan(-2.15);
    expect(paint.max.z).toBeGreaterThan(2.15);
    expect(headlights.y).toBeGreaterThan(0.06);
    expect(headlights.y).toBeLessThan(0.13);
    expect(taillights.y).toBeGreaterThan(0.06);
    expect(taillights.y).toBeLessThan(0.13);
  });

  it('aligns each sedan window with the tapered cabin face beneath it', () => {
    const mesh = singleMesh(createRoadVehicle(0x287cab, 'sedan'));
    const glass = 0x173445;

    expect(
      vertexColorSlope(mesh, glass, 'z', ({ x, z }) => Math.abs(x) < 0.58 && z < -0.55),
    ).toBeGreaterThan(0.15);
    expect(
      vertexColorSlope(mesh, glass, 'z', ({ x, z }) => Math.abs(x) < 0.58 && z > 0.55),
    ).toBeLessThan(-0.1);
    expect(vertexColorSlope(mesh, glass, 'x', ({ x }) => x > 0.6)).toBeLessThan(-0.1);
    expect(vertexColorSlope(mesh, glass, 'x', ({ x }) => x < -0.6)).toBeGreaterThan(0.1);
  });

  it('rakes the convertible windscreen rearward from the hood', () => {
    const mesh = singleMesh(createRoadVehicle(0x287cab, 'convertible'));

    expect(vertexColorSlope(mesh, 0x173445, 'z', () => true)).toBeGreaterThan(0.1);
  });

  it('keeps both motorcycle profiles detailed and within a mobile geometry budget', () => {
    const types: MotorcycleType[] = ['cruiser', 'dirt-bike'];
    const meshes = Object.fromEntries(
      types.map((type) => [type, singleMesh(createMotorcycle(0x22262c, type))]),
    ) as Record<MotorcycleType, THREE.Mesh>;

    for (const type of types) {
      const motorcycle = meshes[type];
      expect(motorcycle.geometry.getAttribute('position').count).toBeGreaterThan(5_200);
      expect(motorcycle.geometry.getAttribute('position').count).toBeLessThan(8_000);
      expect(uniqueVertexColors(motorcycle)).toBeGreaterThanOrEqual(10);
      expect(hasVertexColor(motorcycle, 0xc51f2b)).toBe(true);
      expect(hasVertexColor(motorcycle, 0xff9f1c)).toBe(true);
    }
    expect(bounds(meshes.cruiser).getSize(new THREE.Vector3()).z).toBeGreaterThan(
      bounds(meshes['dirt-bike']).getSize(new THREE.Vector3()).z + 0.2,
    );
    expect(createMotorcycle(0x22262c, 'cruiser').userData.surfaceProfile).toBe(
      'rounded-panelled-pbr',
    );
  });
});
