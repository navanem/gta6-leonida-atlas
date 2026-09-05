import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  collidesWithBuildings,
  type AxisAlignedRectangle,
} from '../../src/features/street-leonida/walk-engine';
import { PLACE_ENTRY_VIEWS } from '../../src/features/street-leonida/walk-geography';
import { createAmbrosiaDistrict } from '../../src/features/street-leonida/walk-ambrosia';

function intersectionArea(first: AxisAlignedRectangle, second: AxisAlignedRectangle): number {
  const width = Math.max(0, Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX));
  const depth = Math.max(0, Math.min(first.maxZ, second.maxZ) - Math.max(first.minZ, second.minZ));
  return width * depth;
}

describe('Street Leonida Ambrosia district', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    });
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(() => new THREE.Texture());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps only source-supported Ambrosia identities and preserves every evidence facet', () => {
    const scene = new THREE.Scene();
    const collisions: AxisAlignedRectangle[] = [];
    const district = createAmbrosiaDistrict(scene, collisions, false);

    expect(district.features).toEqual(
      expect.arrayContaining([
        'ambrosia-xero-station',
        'ambrosia-cane-fields',
        'ambrosia-field-pylons',
        'ambrosia-radio-tower',
        'ambrosia-unidentified-utility-site',
      ]),
    );
    expect(district.features).not.toContain('ambrosia-county-sheriff-office');
    expect(district.features).not.toContain('ambrosia-pump-station-s3');
    expect(district.features).not.toContain('ambrosia-agricultural-burn');
    expect(district.features).not.toContain('ambrosia-lake-leonida');
    expect(district.root.getObjectByName('ambrosia-lake-leonida')).toBeUndefined();

    expect(district.root.getObjectByName('ambrosia-xero-station')?.userData).toMatchObject({
      communityId: 'L406',
      nativeCoordinates: [-2706.7584168799162, 4235.8266820880035],
      evidence: {
        name: 'KNOWN',
        placement: 'APPROXIMATE',
        tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
      },
    });
    expect(
      district.root.getObjectByName('ambrosia-unidentified-utility-site')?.userData,
    ).toMatchObject({
      communityId: 'L594',
      nativeCoordinates: [-2444.910983189574, 4198.580404492531],
      landmarkClaim: 'UNKNOWN',
      nameEvidence: 'UNKNOWN',
      evidence: {
        name: 'UNKNOWN',
        placement: 'APPROXIMATE',
        tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
      },
    });
    expect(district.root.getObjectByName('ambrosia-cane-fields')?.userData).toMatchObject({
      communityId: 'L1065',
      nativeCoordinates: [-2060.372616795449, 3408.0846264475886],
      landmarkClaim: 'UNCONFIRMED',
      nameEvidence: 'KNOWN',
      unconfirmed: true,
      evidence: {
        name: 'KNOWN',
        placement: 'APPROXIMATE',
        tagSignals: { levelTags: [], unconfirmed: true, demolished: false },
      },
    });
    expect(district.root.getObjectByName('ambrosia-radio-tower')?.userData).toMatchObject({
      communityId: 'L888',
      nativeCoordinates: [-2050.1361147653543, 3163.5188173313654],
      landmarkClaim: 'UNCONFIRMED',
      nameEvidence: 'KNOWN',
      unconfirmed: true,
      evidence: {
        name: 'KNOWN',
        placement: 'APPROXIMATE',
        tagSignals: { levelTags: [], unconfirmed: true, demolished: false },
      },
    });
  });

  it('renders only audited Ambrosia copy and omits unsupported identity signs and field fire', () => {
    const signCopy: string[] = [];
    const gradient = { addColorStop: () => undefined };
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 0,
          textAlign: '',
          font: '',
          fillRect: () => undefined,
          strokeRect: () => undefined,
          fillText: (copy: string) => signCopy.push(copy),
          createLinearGradient: () => gradient,
          createRadialGradient: () => gradient,
        }),
      }),
    });
    const district = createAmbrosiaDistrict(new THREE.Scene(), [], false);
    const copy = signCopy.join(' ');

    expect(copy).toMatch(/ALLIED CRYSTAL/i);
    expect(copy).toMatch(/SUGAR MILL/i);
    expect(copy.match(/\bXERO\b/gi)).toHaveLength(1);
    expect(copy).not.toMatch(
      /COUNTY SHERIFF|ROUTE 35|\bS-3\b|PUMP STATION|INDUSTRY RUNS DEEP|LEONIDA FOR ALL/i,
    );
    expect(district.root.getObjectByName('ambrosia-field-embers')).toBeUndefined();
    expect(district.root.getObjectByName('ambrosia-field-smoke')).toBeUndefined();
  });

  it('places authored Ambrosia feature datums at their audited L406, L594, L888 and L1065 local anchors', () => {
    const scene = new THREE.Scene();
    const collisions: AxisAlignedRectangle[] = [];
    const district = createAmbrosiaDistrict(scene, collisions, false);
    district.root.updateMatrixWorld(true);

    const xeroCanopy = district.root.getObjectByName('ambrosia-gas-canopy');
    const unknownUtility = district.root.getObjectByName('ambrosia-unidentified-utility-site');
    const radioTower = district.root.getObjectByName('ambrosia-radio-tower');
    const sugarFieldGround = district.root.getObjectByName('ambrosia-field-soil');
    if (!xeroCanopy || !unknownUtility || !radioTower || !sugarFieldGround) {
      throw new Error('Ambrosia audited feature datum missing');
    }

    const at = (object: THREE.Object3D): THREE.Vector3 =>
      object.getWorldPosition(new THREE.Vector3());
    const expectPosition = (object: THREE.Object3D, x: number, z: number): void => {
      const position = at(object);
      expect(position.x).toBeCloseTo(x, 6);
      expect(position.z).toBeCloseTo(z, 6);
    };
    expectPosition(xeroCanopy, 662.304575, -1815.328653);
    expectPosition(unknownUtility, 1185.999442, -1740.836098);
    expectPosition(radioTower, 1975.549179, 329.287076);
    expectPosition(sugarFieldGround, 1955.076175, -159.844542);

    const collisionCentres = collisions.map((collision) => ({
      x: (collision.minX + collision.maxX) / 2,
      z: (collision.minZ + collision.maxZ) / 2,
    }));
    const hasCollisionAt = (x: number, z: number): boolean =>
      collisionCentres.some(
        (centre) => Math.abs(centre.x - x) < 1e-6 && Math.abs(centre.z - z) < 1e-6,
      );
    expect(hasCollisionAt(668.904575, -1815.328653)).toBe(true);
    expect(hasCollisionAt(1189.899442, -1740.836098)).toBe(true);
  });

  it('keeps town building collisions separated and the arrival road walkable', () => {
    const scene = new THREE.Scene();
    const collisions: AxisAlignedRectangle[] = [];
    createAmbrosiaDistrict(scene, collisions, false);

    const townBuildings = collisions.slice(0, 4);
    expect(townBuildings).toHaveLength(4);
    for (let first = 0; first < townBuildings.length; first += 1) {
      for (let second = first + 1; second < townBuildings.length; second += 1) {
        expect(intersectionArea(townBuildings[first]!, townBuildings[second]!)).toBe(0);
      }
    }
    expect(collidesWithBuildings(PLACE_ENTRY_VIEWS.ambrosia!.position, 0.8, collisions)).toBe(
      false,
    );
  });

  it('keeps transformed industrial collisions centered on their rendered tanks', () => {
    const scene = new THREE.Scene();
    const collisions: AxisAlignedRectangle[] = [];
    createAmbrosiaDistrict(scene, collisions, false);

    const firstTankCollision = collisions[4];
    expect(firstTankCollision).toBeDefined();
    expect((firstTankCollision!.minX + firstTankCollision!.maxX) / 2).toBeCloseTo(31.45, 5);
    expect((firstTankCollision!.minZ + firstTankCollision!.maxZ) / 2).toBeCloseTo(-28.3, 5);
  });

  it('adds weathered storefront and processing-building detail with mobile reduction', () => {
    const desktopScene = new THREE.Scene();
    const desktop = createAmbrosiaDistrict(desktopScene, [], false);
    const mobileScene = new THREE.Scene();
    const mobile = createAmbrosiaDistrict(mobileScene, [], true);

    const desktopFrames = desktop.root.getObjectByName('ambrosia-storefront-window-frames');
    const mobileFrames = mobile.root.getObjectByName('ambrosia-storefront-window-frames');
    expect(desktopFrames).toBeInstanceOf(THREE.InstancedMesh);
    expect(mobileFrames).toBeInstanceOf(THREE.InstancedMesh);
    expect((desktopFrames as THREE.InstancedMesh).count).toBeGreaterThan(
      (mobileFrames as THREE.InstancedMesh).count,
    );
    expect(desktop.root.getObjectByName('ambrosia-storefront-rooftop-hvac')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(desktop.root.getObjectByName('ambrosia-processing-cladding-seams')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
    expect(desktop.root.getObjectByName('ambrosia-processing-clerestory')).toBeInstanceOf(
      THREE.InstancedMesh,
    );
  });
});
