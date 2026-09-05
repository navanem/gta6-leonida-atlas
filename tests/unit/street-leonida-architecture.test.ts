import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AxisAlignedRectangle } from '../../src/features/street-leonida/walk-engine';
import { addHighFidelityWalkArchitecture } from '../../src/features/street-leonida/walk-architecture';
import { LEGACY_REGION_TRANSLATIONS } from '../../src/features/street-leonida/walk-geography';

describe('Street Leonida regional architecture', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps Port Gellhorn collision geometry aligned with the translated sign', () => {
    const scene = new THREE.Scene();
    const collisions: AxisAlignedRectangle[] = [];
    const root = addHighFidelityWalkArchitecture(scene, collisions, false, {
      viceCity: false,
      ambrosia: false,
    });
    root.updateMatrixWorld(true);

    const sign = root.getObjectByName('port-weathered-sign-post');
    if (!sign) throw new Error('Port Gellhorn sign missing');
    const worldPosition = sign.getWorldPosition(new THREE.Vector3());
    expect(worldPosition.x).toBeCloseTo(LEGACY_REGION_TRANSLATIONS.portGellhorn.x - 120.8, 5);
    expect(worldPosition.z).toBeCloseTo(LEGACY_REGION_TRANSLATIONS.portGellhorn.z - 41.7, 5);
    expect(collisions).toHaveLength(1);
    expect((collisions[0]!.minX + collisions[0]!.maxX) / 2).toBeCloseTo(worldPosition.x, 5);
    expect((collisions[0]!.minZ + collisions[0]!.maxZ) / 2).toBeCloseTo(worldPosition.z, 5);
  });

  it('adds region-specific facade and roof aging while reducing mobile instances', () => {
    const desktopScene = new THREE.Scene();
    addHighFidelityWalkArchitecture(desktopScene, [], false, {
      viceCity: false,
      ambrosia: false,
    });
    const mobileScene = new THREE.Scene();
    addHighFidelityWalkArchitecture(mobileScene, [], true, {
      viceCity: false,
      ambrosia: false,
    });

    const desktopWeathering = desktopScene.getObjectByName('port-motel-facade-weathering');
    const mobileWeathering = mobileScene.getObjectByName('port-motel-facade-weathering');
    expect(desktopWeathering).toBeInstanceOf(THREE.InstancedMesh);
    expect(mobileWeathering).toBeInstanceOf(THREE.InstancedMesh);
    expect((desktopWeathering as THREE.InstancedMesh).count).toBeGreaterThan(
      (mobileWeathering as THREE.InstancedMesh).count,
    );
    expect(desktopScene.getObjectByName('port-motel-rooftop-hvac')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(desktopScene.getObjectByName('keys-marina-roof-seams')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(desktopScene.getObjectByName('grassrivers-camp-roof-flashing')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
  });
});
