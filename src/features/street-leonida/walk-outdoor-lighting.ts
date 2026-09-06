import * as THREE from 'three';
import { WALK_ATMOSPHERE_REGION_PRESETS } from './walk-atmosphere';
import type { WalkRenderRegion } from './walk-region-streaming';

/** An outdoor radiance field, without the bright rectangular softboxes of an indoor studio. */
export function createWalkOutdoorEnvironment(
  renderer: THREE.WebGLRenderer,
  coarsePointer: boolean,
): {
  textureFor(region: WalkRenderRegion): THREE.Texture;
  dispose(): void;
} {
  const generator = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  const uniforms = {
    zenith: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    ground: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() },
    sunDirection: { value: new THREE.Vector3() },
    sunEnergy: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec3 direction; void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 direction;
      uniform vec3 zenith, horizon, ground, sunColor, sunDirection;
      uniform float sunEnergy;
      void main() {
        vec3 ray = normalize(direction);
        vec3 sky = mix(horizon, zenith, smoothstep(0.0, 0.82, ray.y));
        sky = mix(ground, sky, smoothstep(-0.12, 0.06, ray.y));
        float sun = pow(max(dot(ray, sunDirection), 0.0), 420.0);
        float glow = pow(max(dot(ray, sunDirection), 0.0), 12.0);
        gl_FragColor = vec4(sky + sunColor * sunEnergy * (sun * 7.0 + glow * 0.12), 1.0);
      }
    `,
  });
  const geometry = new THREE.SphereGeometry(20, 24, 12);
  scene.add(new THREE.Mesh(geometry, material));
  const targets = new Map<WalkRenderRegion, THREE.WebGLRenderTarget>();
  let disposed = false;
  return {
    textureFor(region) {
      if (disposed) throw new Error('Outdoor environment is disposed.');
      const existing = targets.get(region);
      if (existing) return existing.texture;
      const preset = WALK_ATMOSPHERE_REGION_PRESETS[region];
      uniforms.zenith.value.setHex(preset.zenith).multiplyScalar(0.85);
      uniforms.horizon.value.setHex(preset.horizon).multiplyScalar(0.95);
      uniforms.ground.value.setHex(preset.hemisphereGround).multiplyScalar(0.42);
      uniforms.sunColor.value.setHex(preset.sun);
      uniforms.sunEnergy.value = preset.sunIntensity / 4.1;
      const azimuth = THREE.MathUtils.degToRad(preset.sunAzimuth);
      const elevation = THREE.MathUtils.degToRad(preset.sunElevation);
      uniforms.sunDirection.value.set(
        Math.cos(elevation) * Math.sin(azimuth),
        Math.sin(elevation),
        Math.cos(elevation) * Math.cos(azimuth),
      );
      const target = generator.fromScene(scene, 0, 0.1, 60, {
        size: coarsePointer ? 128 : 256,
      });
      targets.set(region, target);
      return target.texture;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const target of targets.values()) target.dispose();
      targets.clear();
      geometry.dispose();
      material.dispose();
      generator.dispose();
      scene.clear();
    },
  };
}
