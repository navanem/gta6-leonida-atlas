import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { setupWalkAtmosphere } from '../../src/features/street-leonida/walk-atmosphere';

describe('Cloud color and alpha rendering', () => {
  it('never multiplies cloud instance tint by a missing black vertex attribute', () => {
    const atmosphere = setupWalkAtmosphere(new THREE.Scene());
    const clouds = atmosphere.clouds;
    expect(clouds.material.vertexColors && !clouds.geometry.hasAttribute('color')).toBe(false);
    expect(clouds.instanceColor).not.toBeNull();
    atmosphere.dispose();
  });

  it('keeps luminous cloud rims, shaded volume and fully transparent texture edges', () => {
    const atmosphere = setupWalkAtmosphere(new THREE.Scene());
    const texture = atmosphere.clouds.material.map as THREE.DataTexture;
    const data = texture.image.data as Uint8Array;
    const width = texture.image.width,
      height = texture.image.height;
    const solid: number[] = [];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1)
          expect(data[offset + 3]).toBe(0);
        if (data[offset + 3]! >= 140) solid.push(data[offset]!);
      }
    expect(solid.length).toBeGreaterThan(500);
    expect(Math.min(...solid)).toBeGreaterThanOrEqual(200);
    expect(Math.max(...solid) - Math.min(...solid)).toBeGreaterThan(14);
    expect(atmosphere.clouds.material.depthWrite).toBe(false);
    atmosphere.dispose();
  });
});
