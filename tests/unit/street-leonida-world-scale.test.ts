import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { gtadbToWorld } from '../../src/features/street-leonida/leonida-coordinates';
import { collidesWithBuildings } from '../../src/features/street-leonida/walk-engine';
import {
  adjustArrivalForCollisions,
  configureWalkSunShadow,
  createStateWaterContinuityMaterial,
  reconcileWalkPosition,
  WALK_PLAYER_CONFIG,
  WALK_STATE_WATER_CENTER_Y,
  WALK_STATE_WATER_RENDER_ORDER,
  WALK_WORLD_RENDER_CONFIG,
} from '../../src/features/street-leonida/walk-world';

describe('Street Leonida human and world scale', () => {
  it('uses a human eye height, body radius, and plausible walk/run speeds', () => {
    expect(WALK_PLAYER_CONFIG).toEqual({
      eyeHeightMetres: 1.72,
      radiusMetres: 0.42,
      walkMetresPerSecond: 1.6,
      runMetresPerSecond: 4.8,
    });
  });

  it('uses a regional camera budget rather than a state-sized or toy-world clamp', () => {
    expect(WALK_WORLD_RENDER_CONFIG.cameraFarMetres).toBeGreaterThanOrEqual(1_200);
    expect(WALK_WORLD_RENDER_CONFIG.cameraFarMetres).toBeLessThanOrEqual(2_500);
    expect('globalMovementBounds' in WALK_WORLD_RENDER_CONFIG).toBe(false);
  });

  it('keeps streamed cartography local enough for responsive region travel', () => {
    expect(WALK_WORLD_RENDER_CONFIG.desktopCartographyTileRadius).toBe(1);
    expect(WALK_WORLD_RENDER_CONFIG.mobileCartographyTileRadius).toBe(1);
  });

  it('caps total framebuffer work and throttles DOM telemetry on large displays', () => {
    expect(WALK_WORLD_RENDER_CONFIG.desktopPixelBudget).toBeLessThanOrEqual(5_000_000);
    expect(WALK_WORLD_RENDER_CONFIG.mobilePixelBudget).toBeLessThanOrEqual(2_000_000);
    expect(WALK_WORLD_RENDER_CONFIG.telemetryIntervalMs).toBeGreaterThanOrEqual(80);
  });

  it('enables restrained image-based lighting for reflective glass and metal', () => {
    expect(WALK_WORLD_RENDER_CONFIG.environmentIntensity).toBeCloseTo(0.42, 5);
    expect(WALK_WORLD_RENDER_CONFIG.toneMappingExposure).toBeCloseTo(0.94, 5);
    expect(WALK_WORLD_RENDER_CONFIG.shadowFilter).toBe('pcf');
    expect(WALK_WORLD_RENDER_CONFIG.shadowMapSize).toBe(1024);
    expect(WALK_WORLD_RENDER_CONFIG.shadowDistanceMetres).toBeLessThanOrEqual(320);
  });

  it('keeps state water in a non-occluding background pass so it cannot overlay roads', () => {
    const water = createStateWaterContinuityMaterial();

    expect(water.transparent).toBe(false);
    expect(water.opacity).toBe(1);
    expect(water.depthTest).toBe(false);
    expect(water.depthWrite).toBe(false);
    expect(WALK_STATE_WATER_RENDER_ORDER).toBeLessThan(-500);
    expect(water.roughness).toBeLessThan(0.3);
    expect(WALK_STATE_WATER_CENTER_Y + 0.11).toBeLessThanOrEqual(-1.8);
    water.dispose();
  });

  it('keeps documented landmark arrivals at their exact transformed position when unobstructed', () => {
    const hotelDixon = gtadbToWorld([1973.5, 737]);

    expect(adjustArrivalForCollisions(hotelDixon, [])).toEqual({
      position: hotelDixon,
      adjusted: false,
      offsetMetres: 0,
    });
  });

  it('reports a local collision-safe offset without rewriting the documented destination', () => {
    const target = { x: 20, z: 30 };
    const result = adjustArrivalForCollisions(target, [{ minX: 18, maxX: 22, minZ: 28, maxZ: 32 }]);

    expect(result.adjusted).toBe(true);
    expect(result.position).not.toEqual(target);
    expect(result.offsetMetres).toBeGreaterThan(0);
    expect(result.offsetMetres).toBeLessThanOrEqual(24);
    if (!result.adjusted) throw new Error('Expected a collision-adjusted arrival');
    expect(result.documentedTarget).toEqual(target);
  });

  it('never returns the old unsafe 24 metre fallback from a large collision footprint', () => {
    const target = { x: 0, z: 0 };
    const collisions = [{ minX: -80, maxX: 80, minZ: -80, maxZ: 80 }];
    const result = adjustArrivalForCollisions(target, collisions);

    expect(result.adjusted).toBe(true);
    expect(result.offsetMetres).toBeGreaterThan(24);
    expect(
      collidesWithBuildings(result.position, WALK_PLAYER_CONFIG.radiusMetres, collisions),
    ).toBe(false);
  });

  it('reconciles a player position when async cartography adds a collision around it', () => {
    const collisions = [{ minX: -3, maxX: 3, minZ: -3, maxZ: 3 }];
    const result = reconcileWalkPosition({ x: 0, z: 0 }, collisions);

    expect(result.relocated).toBe(true);
    expect(
      collidesWithBuildings(result.position, WALK_PLAYER_CONFIG.radiusMetres, collisions),
    ).toBe(false);
  });

  it('updates the directional shadow projection after changing its frustum', () => {
    const light = new THREE.DirectionalLight();

    configureWalkSunShadow(light, false);

    expect(light.shadow.camera.left).toBe(-WALK_WORLD_RENDER_CONFIG.shadowDistanceMetres / 2);
    expect(light.shadow.camera.right).toBe(WALK_WORLD_RENDER_CONFIG.shadowDistanceMetres / 2);
    expect(light.shadow.camera.projectionMatrix.elements[0]).toBeCloseTo(
      2 / WALK_WORLD_RENDER_CONFIG.shadowDistanceMetres,
      8,
    );
  });
});
