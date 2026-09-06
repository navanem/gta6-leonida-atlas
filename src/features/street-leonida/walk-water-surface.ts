import type * as THREE from 'three';

/** Shared wave trains keep floating props and the lighting normal in the same world space. */
const WAVES = [
  { x: 0.38, z: 0.21, speed: 0.83, amplitude: 0.068 },
  { x: -0.24, z: 0.44, speed: -0.67, amplitude: 0.041 },
  { x: 1.19, z: 0.73, speed: 1.37, amplitude: 0.015 },
  { x: -1.61, z: 1.14, speed: -1.62, amplitude: 0.008 },
] as const;

export function sampleWalkWaterSurface(
  x: number,
  z: number,
  time: number,
): {
  height: number;
  normal: readonly [number, number, number];
} {
  let height = 0;
  let dx = 0;
  let dz = 0;
  for (const wave of WAVES) {
    const phase = x * wave.x + z * wave.z + time * wave.speed;
    height += Math.sin(phase) * wave.amplitude;
    const slope = Math.cos(phase) * wave.amplitude;
    dx += slope * wave.x;
    dz += slope * wave.z;
  }
  const length = Math.hypot(dx, 1, dz);
  return { height, normal: [-dx / length, 1 / length, -dz / length] };
}

const glsl = (value: number): string => value.toFixed(6);
const WAVE_SHADER = /* glsl */ `
  vec3 atlasWaterSurface(vec2 point, float time) {
    vec2 slope = vec2(0.0);
    float height = 0.0;
    ${WAVES.map(
      (wave, index) => `
      float phase${index} = dot(point, vec2(${glsl(wave.x)}, ${glsl(wave.z)})) + time * ${glsl(wave.speed)};
      height += sin(phase${index}) * ${glsl(wave.amplitude)};
      slope += cos(phase${index}) * ${glsl(wave.amplitude)} * vec2(${glsl(wave.x)}, ${glsl(wave.z)});
    `,
    ).join('\n')}
    return vec3(slope, height);
  }
`;

/** Small traveling ripples are normal detail, so shore meshes never lift or expose gaps. */
export function installWalkWaterSurface(
  material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  strength = 1,
): { update(time: number): void; dispose(): void } {
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  const time = { value: 0 };
  const waveStrength = { value: strength };
  const compile: THREE.Material['onBeforeCompile'] = (shader, renderer) => {
    previousCompile.call(material, shader, renderer);
    shader.uniforms.atlasWaterTime = time;
    shader.uniforms.atlasWaterStrength = waveStrength;
    shader.vertexShader = `varying vec3 vAtlasWaterPosition;\n${shader.vertexShader}`.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vec4 atlasWaterPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        atlasWaterPosition = instanceMatrix * atlasWaterPosition;
      #endif
      vAtlasWaterPosition = (modelMatrix * atlasWaterPosition).xyz;`,
    );
    shader.fragmentShader = `
      varying vec3 vAtlasWaterPosition;
      uniform float atlasWaterTime;
      uniform float atlasWaterStrength;
      ${WAVE_SHADER}
      ${shader.fragmentShader}
    `
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
      vec3 atlasWave = atlasWaterSurface(vAtlasWaterPosition.xz, atlasWaterTime);
      vec3 atlasWaveNormal = normalize(vec3(-atlasWave.x * atlasWaterStrength, 1.0, -atlasWave.y * atlasWaterStrength));
      normal = normalize(mat3(viewMatrix) * atlasWaveNormal);
      diffuseColor.rgb *= 0.96 + 0.065 * sin(atlasWave.z * 18.0 + vAtlasWaterPosition.x * 0.021);`,
      )
      .replace(
        '#include <clearcoat_normal_fragment_maps>',
        `#include <clearcoat_normal_fragment_maps>
      #ifdef USE_CLEARCOAT
        clearcoatNormal = normal;
      #endif`,
      );
  };
  material.onBeforeCompile = compile;
  material.customProgramCacheKey = () => `${previousKey.call(material)}:atlas-water-2`;
  material.needsUpdate = true;
  let disposed = false;
  return {
    update(elapsedSeconds) {
      if (!disposed && Number.isFinite(elapsedSeconds)) time.value = elapsedSeconds;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (material.onBeforeCompile === compile) {
        material.onBeforeCompile = previousCompile;
        material.customProgramCacheKey = previousKey;
        material.needsUpdate = true;
      }
    },
  };
}
