import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STREET_LEONIDA_REGION_MANIFESTS } from '../../src/features/street-leonida/leonida-evidence';
import { setupWalkAtmosphere } from '../../src/features/street-leonida/walk-atmosphere';
import { collidesWithBuildings } from '../../src/features/street-leonida/walk-engine';
import { buildWalkRegion } from '../../src/features/street-leonida/walk-region-builders';
import {
  WALK_ROCKSTAR_REFERENCE_PROFILES,
  type RockstarReferenceRegion,
} from '../../src/features/street-leonida/walk-rockstar-reference';

const renderer = {
  capabilities: { getMaxAnisotropy: () => 8 },
} as unknown as THREE.WebGLRenderer;

function stubSignCopyRecorder(): string[] {
  const signCopy: string[] = [];
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        textBaseline: '',
        letterSpacing: '',
        fillRect: () => undefined,
        strokeRect: () => undefined,
        fillText: (copy: string) => signCopy.push(copy),
      }),
    }),
  });
  return signCopy;
}

const EXPECTED_HERO_DETAILS: Readonly<Record<RockstarReferenceRegion, readonly string[]>> = {
  'leonida-keys': [
    'keys-rusty-anchor',
    'keys-rusty-anchor-sign-face',
    'keys-rusty-anchor-openwork-railing',
    'keys-coral-limestone-surface',
    'keys-roadside-utility-wires',
    'keys-marina-fleet',
  ],
  grassrivers: [
    'grassrivers-waterfront-settlement',
    'grassrivers-water-tower',
    'grassrivers-marsh-surface',
    'grassrivers-dock-fleet',
    'grassrivers-wildlife',
  ],
  'port-gellhorn': [
    'port-starlet-motel',
    'port-starlet-motel-pitched-roof',
    'port-starlet-motel-sign-face',
    'port-wet-road-surface',
    'port-wet-road-puddles',
    'port-delights-cabaret',
  ],
  ambrosia: [
    'ambrosia-arrival-roadside-market',
    'ambrosia-utility-grid',
    'ambrosia-weathered-billboard-face',
    'ambrosia-industrial-horizon',
  ],
  'mount-kalaga': [
    'kalaga-weathered-rock-cut-corridor',
    'kalaga-rock-cut-cliff-masses',
    'kalaga-overhead-rail-bridge',
    'kalaga-industrial-silo-site',
    'kalaga-forest-understory',
  ],
  'vice-city': [
    'vice-city-arrival-facade-surface-panels',
    'vice-city-arrival-endcap-window-rhythm',
    'vice-city-arrival-balcony-rails',
    'vice-city-arrival-secondary-signage',
    'vice-city-arrival-traffic-silhouettes',
  ],
};

describe('Street Leonida Rockstar visual references', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    });
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(new THREE.Texture());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('documents a primary official screenshot and concrete visual cues for all six regions', () => {
    expect(Object.keys(WALK_ROCKSTAR_REFERENCE_PROFILES)).toHaveLength(6);
    for (const profile of Object.values(WALK_ROCKSTAR_REFERENCE_PROFILES)) {
      expect(profile.primaryShot).toMatch(
        /^(Ambrosia|Grassrivers|Leonida_Keys|Port_Gellhorn|Mount_Kalaga_National_Park|Vice_City)_\d{2}$/,
      );
      expect(profile.supportingShots.length).toBeGreaterThanOrEqual(2);
      expect(profile.requiredDetails.length).toBeGreaterThanOrEqual(4);
      expect(profile.officialSource).toBe('https://www.rockstargames.com/VI/media/screenshots');
    }
    expect(WALK_ROCKSTAR_REFERENCE_PROFILES.grassrivers.requiredDetails).toContain(
      'dark tannin water',
    );
    expect(WALK_ROCKSTAR_REFERENCE_PROFILES.grassrivers.requiredDetails).toContain(
      'sparse stilt outposts and docks',
    );
    expect(WALK_ROCKSTAR_REFERENCE_PROFILES.grassrivers.requiredDetails).not.toContain(
      'green water',
    );
    expect(WALK_ROCKSTAR_REFERENCE_PROFILES['vice-city'].supportingShots).toContain('Vice_City_08');
  });

  it('keeps every runtime Rockstar shot inside the reviewed manifest', () => {
    const manifestSlug: Readonly<
      Record<RockstarReferenceRegion, keyof typeof STREET_LEONIDA_REGION_MANIFESTS>
    > = {
      'vice-city': 'vice-city',
      'leonida-keys': 'leonida-keys',
      grassrivers: 'grassrivers',
      'port-gellhorn': 'port-gellhorn',
      ambrosia: 'ambrosia',
      'mount-kalaga': 'mount-kalaga-national-park',
    };

    for (const [region, profile] of Object.entries(WALK_ROCKSTAR_REFERENCE_PROFILES) as [
      RockstarReferenceRegion,
      (typeof WALK_ROCKSTAR_REFERENCE_PROFILES)[RockstarReferenceRegion],
    ][]) {
      const reviewed = new Set(
        STREET_LEONIDA_REGION_MANIFESTS[manifestSlug[region]].officialSources.flatMap(
          ({ reviewedStillGroups }) => reviewedStillGroups,
        ),
      );
      for (const shot of [profile.primaryShot, ...profile.supportingShots]) {
        expect(reviewed.has(shot), `${region}: ${shot}`).toBe(true);
      }
    }
  });

  it.each(Object.entries(EXPECTED_HERO_DETAILS) as [RockstarReferenceRegion, string[]][])(
    'builds screenshot-grounded hero details for %s',
    (region, expectedNames) => {
      const resource = buildWalkRegion(region, { renderer, coarsePointer: false });
      for (const name of expectedNames) {
        expect(resource.root.getObjectByName(name), `${region}: ${name}`).toBeDefined();
      }
      const arrival = resource.root.getObjectByName(
        region === 'vice-city'
          ? 'vice-city-arrival-urban-boulevard'
          : `${region === 'mount-kalaga' ? 'mount-kalaga' : region}-arrival-${
              region === 'leonida-keys'
                ? 'causeway'
                : region === 'grassrivers'
                  ? 'wetland-road'
                  : region === 'port-gellhorn'
                    ? 'commercial-strip'
                    : region === 'ambrosia'
                      ? 'industrial-road'
                      : 'park-road'
            }`,
      );
      expect(arrival?.userData.rockstarPrimaryShot).toBe(
        WALK_ROCKSTAR_REFERENCE_PROFILES[region].primaryShot,
      );
      expect(arrival).toBeInstanceOf(THREE.Group);
      const actors: THREE.SkinnedMesh[] = [];
      arrival!.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh) actors.push(object);
      });
      expect(actors).toHaveLength(4);
      const geometries = actors.map((actor) => actor.geometry);
      const material = actors[0]!.material;
      const boneRotations = actors.map((actor) => actor.skeleton.bones[4]!.rotation.y);
      for (const actor of actors) {
        expect(actor.parent).toBeInstanceOf(THREE.Group);
        expect(actor.parent!.userData.renderProfile).toBe('single-mesh-pedestrian');
        expect(actor.geometry.hasAttribute('skinIndex')).toBe(true);
        expect(actor.geometry.hasAttribute('skinWeight')).toBe(true);
        expect(actor.skeleton.bones.length).toBeGreaterThanOrEqual(16);
        expect(actor.material).toBe(material);
        const position = actor.parent!.getWorldPosition(new THREE.Vector3());
        expect(collidesWithBuildings(position, 0.25, resource.collisions)).toBe(false);
      }
      resource.update(2);
      actors.forEach((actor, index) => {
        expect(actor.geometry).toBe(geometries[index]);
        expect(actor.material).toBe(material);
        expect(actor.skeleton.bones[4]!.rotation.y).not.toBe(boneRotations[index]);
      });
      const releaseSkeleton = vi.spyOn(actors[0]!.skeleton, 'dispose');
      resource.dispose();
      expect(releaseSkeleton).toHaveBeenCalledOnce();
    },
  );

  it('uses L544 as approximate Keys context without merging Watson Bay into Rusty Anchor', () => {
    const signCopy = stubSignCopyRecorder();
    const resource = buildWalkRegion('leonida-keys', { renderer, coarsePointer: false });
    const arrival = resource.root.getObjectByName('leonida-keys-arrival-causeway');
    const identitySign = resource.root.getObjectByName('keys-rusty-anchor-sign-face');
    const railing = resource.root.getObjectByName('keys-rusty-anchor-openwork-railing');
    if (!arrival || !identitySign || !railing) throw new Error('Keys arrival identity missing');

    expect(arrival.userData.locality).toBe('Watson Bay');
    expect(arrival.userData.gtadbAnchorId).toBe('L544');
    expect(identitySign.userData.locality).toBeUndefined();
    expect(identitySign.userData).toMatchObject({
      evidence: 'VISUAL_REFERENCE_ONLY',
      placement: 'APPROXIMATE',
    });
    expect(signCopy.join(' ')).toMatch(/WATERFRONT PORCH/i);
    expect(signCopy.join(' ')).not.toMatch(/WATSON BAY/i);
    expect(signCopy.join(' ')).not.toMatch(/KEY LENTO|FLORIDA/i);
    expect(railing).toBeInstanceOf(THREE.InstancedMesh);
    expect(resource.root.getObjectByName('keys-rusty-anchor-crowd')).toBeUndefined();
    expect(resource.root.getObjectByName('keys-rusty-anchor-yard-life')).toBeUndefined();
    resource.dispose();
  });

  it('keeps Grassrivers tannic, irregular and limited to three spaced approximate outposts', () => {
    const signCopy = stubSignCopyRecorder();
    const resource = buildWalkRegion('grassrivers', { renderer, coarsePointer: false });
    const arrival = resource.root.getObjectByName('grassrivers-arrival-wetland-road');
    const water = resource.root.getObjectByName('grassrivers-arrival-water') as THREE.Mesh;
    const settlement = resource.root.getObjectByName(
      'grassrivers-waterfront-settlement',
    ) as THREE.Group;
    const roofs = resource.root.getObjectByName(
      'grassrivers-corrugated-outpost-roofs',
    ) as THREE.InstancedMesh;
    const marshEdge = resource.root.getObjectByName(
      'grassrivers-marsh-surface',
    ) as THREE.InstancedMesh;
    const reeds = resource.root.getObjectByName('grassrivers-reed-beds') as THREE.InstancedMesh;
    const waterTower = resource.root.getObjectByName('grassrivers-water-tower');
    const people = arrival?.children.filter((object) =>
      object.children.some((child) => child instanceof THREE.SkinnedMesh),
    );
    if (
      !arrival ||
      !water ||
      !settlement ||
      !roofs ||
      !marshEdge ||
      !reeds ||
      !waterTower ||
      !people
    ) {
      throw new Error('Grassrivers arrival identity missing');
    }

    expect(resource.root.getObjectByName('landmarks-grassrivers')).toBeUndefined();
    expect(resource.root.getObjectByName('architecture-grassrivers')).toBeUndefined();

    const waterMaterial = water.material as THREE.MeshPhysicalMaterial;
    const waterLuminance =
      waterMaterial.color.r * 0.2126 +
      waterMaterial.color.g * 0.7152 +
      waterMaterial.color.b * 0.0722;
    expect(waterLuminance).toBeLessThan(0.065);
    expect(waterMaterial.color.g).toBeGreaterThan(waterMaterial.color.r);
    expect(waterMaterial.roughness).toBeGreaterThanOrEqual(0.2);
    expect(waterMaterial.roughness).toBeLessThanOrEqual(0.3);
    expect(waterMaterial.metalness).toBeLessThanOrEqual(0.04);
    const waterShader = {
      vertexShader: THREE.ShaderLib.physical.vertexShader,
      fragmentShader: THREE.ShaderLib.physical.fragmentShader,
      uniforms: {},
    } as Parameters<typeof waterMaterial.onBeforeCompile>[0];
    const compileWater = waterMaterial.onBeforeCompile;
    compileWater(waterShader, renderer);
    expect(waterShader.uniforms.atlasWaterStrength!.value).toBeCloseTo(0.45, 5);
    expect(waterShader.uniforms.atlasWaterTime!.value).toBe(0);
    resource.update(1.5);
    expect(waterShader.uniforms.atlasWaterTime!.value).toBe(1.5);
    expect((marshEdge.material as THREE.MeshStandardMaterial).opacity).toBeLessThanOrEqual(0.62);

    const outposts: THREE.Object3D[] = [];
    resource.root.traverse((object) => {
      if (object.userData.outpost === true) outposts.push(object);
    });
    expect(outposts).toHaveLength(3);
    for (let index = 0; index < outposts.length; index += 1) {
      for (let next = index + 1; next < outposts.length; next += 1) {
        expect(outposts[index]!.position.distanceTo(outposts[next]!.position)).toBeGreaterThan(45);
      }
    }

    expect(settlement.userData.evidence).toBe('APPROXIMATE');
    expect(settlement.userData.density).toBe('very-low');
    expect(roofs.count).toBe(outposts.length * 2);
    expect((roofs.material as THREE.MeshStandardMaterial).name).toContain('corrugated');
    const roofMatrix = new THREE.Matrix4();
    const roofRotation = new THREE.Euler();
    const roofPosition = new THREE.Vector3();
    const roofQuaternion = new THREE.Quaternion();
    const roofScale = new THREE.Vector3();
    for (let index = 0; index < roofs.count; index += 1) {
      roofs.getMatrixAt(index, roofMatrix);
      roofMatrix.decompose(roofPosition, roofQuaternion, roofScale);
      roofRotation.setFromQuaternion(roofQuaternion);
      expect(Math.abs(roofRotation.z)).toBeGreaterThan(0.08);
    }

    expect(marshEdge.userData.edgeProfile).toBe('irregular-marsh-mangrove-margin');
    expect(marshEdge.geometry.type).toBe('ShapeGeometry');
    expect(marshEdge.count).toBeLessThanOrEqual(6);
    expect(reeds.userData.edgeProfile).toBe('irregular-marsh-mangrove-margin');
    expect(reeds.count).toBeGreaterThanOrEqual(180);
    expect(waterTower.userData).toMatchObject({
      evidence: 'APPROXIMATE',
      namedLandmark: false,
    });
    expect(people).toHaveLength(4);
    expect(resource.root.getObjectByName('grassrivers-dock-life-sprite')).toBeUndefined();
    expect(signCopy.join(' ')).toMatch(/APPROXIMATE/i);
    expect(signCopy.join(' ')).not.toMatch(/WATSON|KEY LENTO/i);
    resource.dispose();
    resource.update(3);
    expect(waterShader.uniforms.atlasWaterTime!.value).toBe(1.5);
    expect(waterMaterial.onBeforeCompile).not.toBe(compileWater);
  });

  it('renders Mount Kalaga as a humid forest rock cut rather than a desert canyon', () => {
    const resource = buildWalkRegion('mount-kalaga', { renderer, coarsePointer: false });
    const corridor = resource.root.getObjectByName('kalaga-weathered-rock-cut-corridor');
    const cliffMasses = resource.root.getObjectByName(
      'kalaga-rock-cut-cliff-masses',
    ) as THREE.InstancedMesh;
    const photoPines = resource.root.getObjectByName(
      'kalaga-arrival-photo-pines',
    ) as THREE.InstancedMesh;
    const nativePines = resource.root.getObjectByName('kalaga-arrival-photo-pines-native');
    const pineTrunks = nativePines?.getObjectByName('pine-tapered-trunks') as THREE.InstancedMesh;
    const pineLeaves = nativePines?.getObjectByName(
      'pine-individual-leaves',
    ) as THREE.InstancedMesh;

    expect(corridor).toBeDefined();
    expect(resource.root.getObjectByName('kalaga-red-rock-canyon')).toBeUndefined();
    expect(cliffMasses).toBeInstanceOf(THREE.InstancedMesh);
    expect((cliffMasses.material as THREE.MeshStandardMaterial).name).toBe(
      'street-leonida/surface/0-0',
    );
    expect((cliffMasses.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xcfc0ae);
    expect(photoPines).toBeInstanceOf(THREE.InstancedMesh);
    expect(photoPines.userData.photoAsset).toBe(
      '/assets/street-leonida/vegetation/southern-pine.webp',
    );
    expect(nativePines).toBeInstanceOf(THREE.Group);
    expect(pineTrunks).toBeInstanceOf(THREE.InstancedMesh);
    expect(pineLeaves).toBeInstanceOf(THREE.InstancedMesh);
    expect(pineLeaves.count).toBe(pineTrunks.count);
    expect(pineTrunks.count).toBeGreaterThan(0);
    expect(photoPines.count + pineTrunks.count).toBeGreaterThanOrEqual(150);
    expect(pineLeaves.geometry.getAttribute('position').count).toBeGreaterThan(12);
    expect((pineLeaves.material as THREE.MeshStandardMaterial).map).toBeNull();
    const pineMatrix = new THREE.Matrix4();
    const pinePosition = new THREE.Vector3();
    for (const pines of [photoPines, pineTrunks]) {
      for (let index = 0; index < pines.count; index += 1) {
        pines.getMatrixAt(index, pineMatrix);
        pinePosition.setFromMatrixPosition(pineMatrix);
        const obscuresIdentitySign =
          pinePosition.x >= -22 &&
          pinePosition.x <= -4 &&
          pinePosition.z >= -45 &&
          pinePosition.z <= 8;
        expect(obscuresIdentitySign).toBe(false);
      }
    }
    resource.dispose();
  });

  it('labels the inferred Mount Kalaga roadside arrival instead of inventing a trailhead', () => {
    const signCopy = stubSignCopyRecorder();
    const resource = buildWalkRegion('mount-kalaga', { renderer, coarsePointer: false });
    const shelter = resource.root.getObjectByName('kalaga-approximate-roadside-shelter');
    const sign = resource.root.getObjectByName('kalaga-arrival-park-sign-face');

    expect(resource.root.getObjectByName('kalaga-arrival-ranger-cabin')).toBeUndefined();
    expect(resource.root.getObjectByName('kalaga-arrival-ranger-truck')).toBeUndefined();
    expect(shelter?.userData).toMatchObject({ evidence: 'APPROXIMATE', landmarkClaim: 'NONE' });
    expect(sign?.userData).toMatchObject({ evidence: 'APPROXIMATE', placement: 'APPROXIMATE' });
    expect(signCopy.join(' ')).toMatch(/COMMUNITY RECONSTRUCTION.*APPROXIMATE/i);
    expect(signCopy.join(' ')).not.toMatch(/TRAILHEAD|RANGER/i);
    resource.dispose();
  });

  it('switches the world light and sky palette by active Rockstar region profile', () => {
    const scene = new THREE.Scene();
    const atmosphere = setupWalkAtmosphere(scene);
    const initialSky = (
      atmosphere.sky.material.uniforms.uZenith as THREE.IUniform<THREE.Color>
    ).value.getHex();

    atmosphere.setRegion('port-gellhorn');
    const portSky = (
      atmosphere.sky.material.uniforms.uZenith as THREE.IUniform<THREE.Color>
    ).value.getHex();
    const portIntensity = atmosphere.sunLight.intensity;

    atmosphere.setRegion('leonida-keys');
    const keysSky = (
      atmosphere.sky.material.uniforms.uZenith as THREE.IUniform<THREE.Color>
    ).value.getHex();

    expect(portSky).not.toBe(initialSky);
    expect(keysSky).not.toBe(portSky);
    expect(atmosphere.sunLight.intensity).toBeGreaterThan(portIntensity * 2);
    expect(atmosphere.clouds.material.opacity).toBeCloseTo(0.64, 5);
    expect(atmosphere.clouds.material.blending).toBe(THREE.NormalBlending);
    atmosphere.dispose();
  });
});
