import * as THREE from 'three';

import type { WalkRenderRegion } from './walk-region-streaming';

export interface WalkAtmosphereOptions {
  camera?: THREE.Camera;
  reducedQuality?: boolean;
  radius?: number;
  fogDensity?: number;
  waterMaterial?: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
}

export interface WalkWaterAnimator {
  update: (elapsedSeconds: number) => void;
  dispose: () => void;
}

export interface WalkAtmosphere {
  root: THREE.Group;
  sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  clouds: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  aerosols: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  haze: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  sunLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  hemisphereLight: THREE.HemisphereLight;
  ambientLight: THREE.AmbientLight;
  water: WalkWaterAnimator | null;
  setRegion: (region: WalkRenderRegion) => void;
  update: (deltaSeconds: number, elapsedSeconds: number) => void;
  dispose: () => void;
}

interface WalkAtmosphereRegionPreset {
  readonly zenith: number;
  readonly upperSky: number;
  readonly horizon: number;
  readonly groundHaze: number;
  readonly sun: number;
  readonly moon: number;
  readonly haze: number;
  readonly sunset: number;
  readonly fog: number;
  readonly hemisphereSky: number;
  readonly hemisphereGround: number;
  readonly ambient: number;
  readonly fill: number;
  readonly sunAzimuth: number;
  readonly sunElevation: number;
  readonly sunIntensity: number;
  readonly fillIntensity: number;
  readonly hemisphereIntensity: number;
  readonly ambientIntensity: number;
  readonly moonOpacity: number;
  readonly cloudOpacity: number;
  readonly fogDensity: number;
}

export const WALK_ATMOSPHERE_REGION_PRESETS: Readonly<
  Record<WalkRenderRegion, WalkAtmosphereRegionPreset>
> = {
  'leonida-keys': {
    zenith: 0x2e91d0,
    upperSky: 0x85c9ec,
    horizon: 0xe1f5f7,
    groundHaze: 0xb9d7d3,
    sun: 0xfff1cd,
    moon: 0xcfe7ef,
    haze: 0xbad7d2,
    sunset: 0xffddb2,
    fog: 0xa8ced0,
    hemisphereSky: 0xd3edf6,
    hemisphereGround: 0x7f8879,
    ambient: 0xb9cbca,
    fill: 0x7f9fac,
    sunAzimuth: -58,
    sunElevation: 52,
    sunIntensity: 5.1,
    fillIntensity: 0.7,
    hemisphereIntensity: 1.42,
    ambientIntensity: 0.4,
    moonOpacity: 0.05,
    cloudOpacity: 0.14,
    fogDensity: 0.00115,
  },
  grassrivers: {
    zenith: 0x4d89aa,
    upperSky: 0x9fc5d0,
    horizon: 0xdce0c9,
    groundHaze: 0x8c9f84,
    sun: 0xffe4af,
    moon: 0xc9dce4,
    haze: 0x9eae91,
    sunset: 0xe6b984,
    fog: 0x8fa28d,
    hemisphereSky: 0xc6d7d2,
    hemisphereGround: 0x5f624e,
    ambient: 0xa7aa9d,
    fill: 0x82989a,
    sunAzimuth: -42,
    sunElevation: 34,
    sunIntensity: 3.75,
    fillIntensity: 0.48,
    hemisphereIntensity: 1.08,
    ambientIntensity: 0.34,
    moonOpacity: 0.06,
    cloudOpacity: 0.14,
    fogDensity: 0.0019,
  },
  'port-gellhorn': {
    zenith: 0x07131f,
    upperSky: 0x1e3342,
    horizon: 0x68747a,
    groundHaze: 0x202b30,
    sun: 0xd7a37e,
    moon: 0xbdd9e6,
    haze: 0x354951,
    sunset: 0x946258,
    fog: 0x273940,
    hemisphereSky: 0x526b78,
    hemisphereGround: 0x292b29,
    ambient: 0x62696b,
    fill: 0x557084,
    sunAzimuth: -69,
    sunElevation: 4,
    sunIntensity: 0.8,
    fillIntensity: 0.22,
    hemisphereIntensity: 0.38,
    ambientIntensity: 0.16,
    moonOpacity: 0.82,
    cloudOpacity: 0.11,
    fogDensity: 0.00245,
  },
  ambrosia: {
    zenith: 0x637f9e,
    upperSky: 0xb9b4ae,
    horizon: 0xf4ad71,
    groundHaze: 0xb78e67,
    sun: 0xffc879,
    moon: 0xcddde3,
    haze: 0xc49a70,
    sunset: 0xf08a50,
    fog: 0xb19372,
    hemisphereSky: 0xe2b99b,
    hemisphereGround: 0x6d5840,
    ambient: 0xb69c82,
    fill: 0x8b7b6e,
    sunAzimuth: -55,
    sunElevation: 17,
    sunIntensity: 4.35,
    fillIntensity: 0.4,
    hemisphereIntensity: 0.94,
    ambientIntensity: 0.3,
    moonOpacity: 0.08,
    cloudOpacity: 0.13,
    fogDensity: 0.00155,
  },
  'mount-kalaga': {
    zenith: 0x4b91c4,
    upperSky: 0x9dcee7,
    horizon: 0xe9e4ce,
    groundHaze: 0xaeb29b,
    sun: 0xffe3a7,
    moon: 0xd3e2e7,
    haze: 0xbab99d,
    sunset: 0xe9b174,
    fog: 0xaab19d,
    hemisphereSky: 0xc8dce8,
    hemisphereGround: 0x59604d,
    ambient: 0xadb5a8,
    fill: 0x7898a8,
    sunAzimuth: -68,
    sunElevation: 38,
    sunIntensity: 4.6,
    fillIntensity: 0.48,
    hemisphereIntensity: 1.12,
    ambientIntensity: 0.31,
    moonOpacity: 0.05,
    cloudOpacity: 0.14,
    fogDensity: 0.00135,
  },
  'vice-city': {
    zenith: 0x2f7fb9,
    upperSky: 0x82bad9,
    horizon: 0xeaded0,
    groundHaze: 0xb6c5c1,
    sun: 0xffd8a3,
    moon: 0xd2e7ef,
    haze: 0xb9c6c0,
    sunset: 0xf2b678,
    fog: 0xaabfbd,
    hemisphereSky: 0xb8b4ad,
    hemisphereGround: 0x706d68,
    ambient: 0xa9a8a3,
    fill: 0x9b9994,
    sunAzimuth: -54,
    sunElevation: 29,
    sunIntensity: 4.1,
    fillIntensity: 0.3,
    hemisphereIntensity: 0.78,
    ambientIntensity: 0.2,
    moonOpacity: 0.04,
    cloudOpacity: 0.13,
    fogDensity: 0.00128,
  },
};

interface SkyUniforms extends Record<string, THREE.IUniform> {
  uZenith: { value: THREE.Color };
  uUpperSky: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uGroundHaze: { value: THREE.Color };
  uSunColor: { value: THREE.Color };
  uMoonColor: { value: THREE.Color };
  uSunDirection: { value: THREE.Vector3 };
  uMoonDirection: { value: THREE.Vector3 };
  uTime: { value: number };
}

interface HazeUniforms extends Record<string, THREE.IUniform> {
  uHazeColor: { value: THREE.Color };
  uSunsetColor: { value: THREE.Color };
  uSunDirection: { value: THREE.Vector3 };
  uTime: { value: number };
}

const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vDirection = normalize(position);
    vec4 clipPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clipPosition.xyww;
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uUpperSky;
  uniform vec3 uHorizon;
  uniform vec3 uGroundHaze;
  uniform vec3 uSunColor;
  uniform vec3 uMoonColor;
  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  uniform float uTime;

  varying vec3 vDirection;

  float hash12(vec2 point) {
    vec3 p3 = fract(vec3(point.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float altitude = direction.y;
    float upperBlend = smoothstep(-0.02, 0.72, altitude);
    float zenithBlend = smoothstep(0.28, 0.94, altitude);
    vec3 skyColor = mix(uHorizon, uUpperSky, upperBlend);
    skyColor = mix(skyColor, uZenith, zenithBlend);
    skyColor = mix(uGroundHaze, skyColor, smoothstep(-0.22, 0.025, altitude));

    float sunAlignment = max(dot(direction, normalize(uSunDirection)), 0.0);
    float sunHalo = pow(sunAlignment, 7.0);
    float sunCore = pow(sunAlignment, 720.0);
    float horizonGlow = exp(-abs(altitude) * 7.5) * pow(sunAlignment, 2.2);
    skyColor += uSunColor * (sunHalo * 0.28 + sunCore * 1.15 + horizonGlow * 0.22);

    float moonAlignment = max(dot(direction, normalize(uMoonDirection)), 0.0);
    float moonGlow = pow(moonAlignment, 64.0);
    skyColor += uMoonColor * moonGlow * 0.1;

    float atmosphericBand = exp(-abs(altitude + 0.015) * 18.0);
    skyColor += mix(vec3(0.08, 0.17, 0.24), uHorizon, 0.55) * atmosphericBand * 0.08;

    float dither = (hash12(gl_FragCoord.xy + uTime * 0.01) - 0.5) / 255.0;
    gl_FragColor = vec4(skyColor + dither, 1.0);
  }
`;

const HAZE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldDirection;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const HAZE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uHazeColor;
  uniform vec3 uSunsetColor;
  uniform vec3 uSunDirection;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vWorldDirection;

  void main() {
    float vertical = pow(max(sin(vUv.y * 3.14159265), 0.0), 2.2);
    float sunFacing = pow(max(dot(normalize(vWorldDirection), normalize(uSunDirection)), 0.0), 2.5);
    float ripple = 0.94 + 0.06 * sin(vUv.x * 31.0 + uTime * 0.035);
    vec3 color = mix(uHazeColor, uSunsetColor, sunFacing * 0.46);
    gl_FragColor = vec4(color, vertical * ripple * 0.17);
  }
`;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sphericalDirection(azimuthDegrees: number, elevationDegrees: number): THREE.Vector3 {
  const azimuth = THREE.MathUtils.degToRad(azimuthDegrees);
  const elevation = THREE.MathUtils.degToRad(elevationDegrees);
  const horizontal = Math.cos(elevation);
  return new THREE.Vector3(
    Math.sin(azimuth) * horizontal,
    Math.sin(elevation),
    Math.cos(azimuth) * horizontal,
  ).normalize();
}

function createDiscTexture(
  size: number,
  inner: readonly [number, number, number],
  halo: readonly [number, number, number],
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const center = (size - 1) * 0.5;
  const radius = size * 0.5;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center) / radius;
      const core = 1 - THREE.MathUtils.smoothstep(distance, 0.44, 0.54);
      const glow = 1 - THREE.MathUtils.smoothstep(distance, 0.2, 1);
      const haloMix = THREE.MathUtils.smoothstep(distance, 0.15, 0.85);
      const offset = (y * size + x) * 4;
      data[offset] = Math.round(THREE.MathUtils.lerp(inner[0], halo[0], haloMix));
      data[offset + 1] = Math.round(THREE.MathUtils.lerp(inner[1], halo[1], haloMix));
      data[offset + 2] = Math.round(THREE.MathUtils.lerp(inner[2], halo[2], haloMix));
      data[offset + 3] = Math.round(255 * Math.max(core, glow * 0.33));
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createCloudTexture(): THREE.DataTexture {
  const width = 192;
  const height = 96;
  const pixels = new Uint8Array(width * height * 4);
  const lobes = [
    [0.19, 0.56, 0.19, 0.25],
    [0.34, 0.42, 0.22, 0.3],
    [0.5, 0.5, 0.29, 0.34],
    [0.67, 0.43, 0.22, 0.3],
    [0.82, 0.58, 0.18, 0.23],
  ] as const;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const v = y / (height - 1);
      let density = 0;
      for (const [centerX, centerY, radiusX, radiusY] of lobes) {
        const deltaX = (u - centerX) / radiusX;
        const deltaY = (v - centerY) / radiusY;
        density += Math.exp(-(deltaX * deltaX + deltaY * deltaY) * 2.25);
      }
      const edgeFade = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      const wisps = 0.91 + 0.09 * Math.sin(u * 31 + Math.sin(v * 17) * 2.2);
      const alpha = THREE.MathUtils.clamp((density - 0.18) * 1.16, 0, 1) * edgeFade * wisps;
      const offset = (y * width + x) * 4;
      const lowerWarmth = THREE.MathUtils.smoothstep(v, 0.34, 0.78);
      pixels[offset] = Math.round(255 - lowerWarmth * 7);
      pixels[offset + 1] = Math.round(255 - lowerWarmth * 5);
      pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createClouds(
  reducedQuality: boolean,
): THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const cloudCount = reducedQuality ? 5 : 10;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: createCloudTexture(),
    transparent: true,
    opacity: reducedQuality ? 0.1 : 0.13,
    alphaTest: 0.02,
    depthWrite: false,
    vertexColors: true,
    fog: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  const clouds = new THREE.InstancedMesh(geometry, material, cloudCount);
  const dummy = new THREE.Object3D();
  const random = seededRandom(0x6c656f6e);
  for (let index = 0; index < cloudCount; index += 1) {
    const angle = index * 1.47 + random() * 0.42;
    const distance = 260 + random() * 320;
    const height = 76 + random() * 60;
    dummy.position.set(Math.sin(angle) * distance, height, Math.cos(angle) * distance);
    dummy.scale.set(92 + random() * 104, 32 + random() * 38, 1);
    dummy.rotation.set(
      -0.08 + random() * 0.16,
      angle + Math.PI + (random() - 0.5) * 0.18,
      (random() - 0.5) * 0.05,
    );
    dummy.updateMatrix();
    clouds.setMatrixAt(index, dummy.matrix);
    clouds.setColorAt(index, new THREE.Color().setHSL(0.085, 0.06, 0.95 + random() * 0.035));
  }

  clouds.instanceMatrix.needsUpdate = true;
  if (clouds.instanceColor) clouds.instanceColor.needsUpdate = true;
  clouds.name = 'walk-atmosphere-clouds';
  clouds.frustumCulled = false;
  clouds.renderOrder = -700;
  return clouds;
}

function createAerosols(
  reducedQuality: boolean,
): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
  const particleCount = reducedQuality ? 24 : 72;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const random = seededRandom(0x68756d69);
  const cool = new THREE.Color(0xb7d7dd);
  const warm = new THREE.Color(0xffd0a8);
  const tint = new THREE.Color();

  for (let index = 0; index < particleCount; index += 1) {
    const radius = 16 + Math.sqrt(random()) * 112;
    const angle = random() * Math.PI * 2;
    const offset = index * 3;
    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = -1.5 + random() * 28;
    positions[offset + 2] = Math.sin(angle) * radius;
    tint.copy(cool).lerp(warm, Math.max(0, Math.cos(angle + 0.9)) * 0.52);
    colors[offset] = tint.r;
    colors[offset + 1] = tint.g;
    colors[offset + 2] = tint.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const texture = createDiscTexture(reducedQuality ? 8 : 16, [255, 249, 231], [255, 186, 126]);
  const material = new THREE.PointsMaterial({
    map: texture,
    size: reducedQuality ? 0.42 : 0.32,
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: reducedQuality ? 0.1 : 0.13,
    alphaTest: 0.015,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    fog: true,
    toneMapped: false,
  });
  const aerosols = new THREE.Points(geometry, material);
  aerosols.name = 'walk-atmosphere-aerosols';
  aerosols.userData.particleBudget = particleCount;
  aerosols.userData.surfaceProfile = 'humid-subtropical-aerial-depth';
  aerosols.frustumCulled = false;
  aerosols.renderOrder = -520;
  return aerosols;
}

export function createWalkWaterAnimator(
  material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
): WalkWaterAnimator {
  const baseColor = material.color.clone();
  const baseEmissive = material.emissive.clone();
  const baseRoughness = material.roughness;
  const baseMetalness = material.metalness;
  const physicalMaterial = material instanceof THREE.MeshPhysicalMaterial ? material : null;
  const baseClearcoat = physicalMaterial?.clearcoat ?? 0;
  const baseClearcoatRoughness = physicalMaterial?.clearcoatRoughness ?? 0;

  return {
    update(elapsedSeconds: number): void {
      const slowWave = Math.sin(elapsedSeconds * 0.43);
      const crossWave = Math.sin(elapsedSeconds * 0.71 + 1.6);
      const shimmer = slowWave * 0.5 + crossWave * 0.5;
      material.color.copy(baseColor).multiplyScalar(1 + shimmer * 0.025);
      const emissiveContribution = 0.018 + shimmer * 0.006;
      material.emissive.setRGB(
        baseEmissive.r + baseColor.r * emissiveContribution,
        baseEmissive.g + baseColor.g * emissiveContribution,
        baseEmissive.b + baseColor.b * emissiveContribution,
      );
      material.roughness = THREE.MathUtils.clamp(baseRoughness + shimmer * 0.045, 0.08, 1);
      material.metalness = THREE.MathUtils.clamp(baseMetalness - shimmer * 0.012, 0, 1);
      if (physicalMaterial) {
        physicalMaterial.clearcoat = Math.max(baseClearcoat, 0.34) + shimmer * 0.035;
        physicalMaterial.clearcoatRoughness =
          Math.max(baseClearcoatRoughness, 0.16) + shimmer * 0.02;
      }
    },
    dispose(): void {
      material.color.copy(baseColor);
      material.emissive.copy(baseEmissive);
      material.roughness = baseRoughness;
      material.metalness = baseMetalness;
      if (physicalMaterial) {
        physicalMaterial.clearcoat = baseClearcoat;
        physicalMaterial.clearcoatRoughness = baseClearcoatRoughness;
      }
    },
  };
}

export function setupWalkAtmosphere(
  scene: THREE.Scene,
  options: WalkAtmosphereOptions = {},
): WalkAtmosphere {
  const reducedQuality = options.reducedQuality ?? false;
  const radius = Math.max(320, options.radius ?? 540);
  const sunDirection = sphericalDirection(-52, 27);
  const moonDirection = sphericalDirection(118, 18);
  const root = new THREE.Group();
  root.name = 'walk-atmosphere';

  const skyUniforms: SkyUniforms = {
    uZenith: { value: new THREE.Color(0x5f91b7) },
    uUpperSky: { value: new THREE.Color(0x9dc9df) },
    uHorizon: { value: new THREE.Color(0xf5b5a1) },
    uGroundHaze: { value: new THREE.Color(0x9aa8b2) },
    uSunColor: { value: new THREE.Color(0xffc28f) },
    uMoonColor: { value: new THREE.Color(0xb9d7ea) },
    uSunDirection: { value: sunDirection.clone() },
    uMoonDirection: { value: moonDirection.clone() },
    uTime: { value: 0 },
  };
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(radius, reducedQuality ? 24 : 40, reducedQuality ? 12 : 20),
    skyMaterial,
  );
  sky.name = 'walk-atmosphere-sky';
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  root.add(sky);

  const sunTexture = createDiscTexture(reducedQuality ? 32 : 64, [255, 250, 220], [255, 158, 85]);
  const sunDisc = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
    }),
  );
  sunDisc.name = 'walk-atmosphere-sun';
  sunDisc.position.copy(sunDirection).multiplyScalar(radius * 0.82);
  sunDisc.scale.setScalar(radius * 0.055);
  sunDisc.renderOrder = -850;
  root.add(sunDisc);

  const moonTexture = createDiscTexture(reducedQuality ? 24 : 48, [226, 240, 247], [123, 161, 191]);
  const moonDisc = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: moonTexture,
      color: 0xcbe7f3,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false,
    }),
  );
  moonDisc.name = 'walk-atmosphere-moon';
  moonDisc.position.copy(moonDirection).multiplyScalar(radius * 0.84);
  moonDisc.scale.setScalar(radius * 0.025);
  moonDisc.renderOrder = -860;
  root.add(moonDisc);

  const clouds = createClouds(reducedQuality);
  root.add(clouds);
  const aerosols = createAerosols(reducedQuality);
  root.add(aerosols);

  const hazeUniforms: HazeUniforms = {
    uHazeColor: { value: new THREE.Color(0x9eb8c4) },
    uSunsetColor: { value: new THREE.Color(0xf1ac91) },
    uSunDirection: { value: sunDirection.clone() },
    uTime: { value: 0 },
  };
  const hazeMaterial = new THREE.ShaderMaterial({
    uniforms: hazeUniforms,
    vertexShader: HAZE_VERTEX_SHADER,
    fragmentShader: HAZE_FRAGMENT_SHADER,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
  });
  const haze = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius * 0.63,
      radius * 0.63,
      112,
      reducedQuality ? 32 : 64,
      1,
      true,
    ),
    hazeMaterial,
  );
  haze.name = 'walk-atmosphere-haze';
  haze.position.y = 20;
  haze.frustumCulled = false;
  haze.renderOrder = -600;
  root.add(haze);

  const hemisphereLight = new THREE.HemisphereLight(0xc8e8f7, 0x65727f, 1.12);
  hemisphereLight.name = 'walk-atmosphere-hemisphere-light';
  root.add(hemisphereLight);

  const ambientLight = new THREE.AmbientLight(0x91abc2, 0.35);
  ambientLight.name = 'walk-atmosphere-ambient-light';
  root.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffc59b, 3.9);
  sunLight.name = 'walk-atmosphere-sun-light';
  sunLight.position.copy(sunDirection).multiplyScalar(220);
  sunLight.target.position.set(0, -16, 0);
  root.add(sunLight, sunLight.target);

  const fillLight = new THREE.DirectionalLight(0x6e9fca, 0.42);
  fillLight.name = 'walk-atmosphere-fill-light';
  fillLight.position.set(105, 70, -145);
  fillLight.target.position.set(0, 10, 0);
  root.add(fillLight, fillLight.target);

  const previousFog = scene.fog;
  const fog = new THREE.FogExp2(0x86a4b4, options.fogDensity ?? 0.00275);
  scene.fog = fog;
  scene.add(root);

  const water = options.waterMaterial ? createWalkWaterAnimator(options.waterMaterial) : null;
  let cloudRotation = clouds.rotation.y;
  let activeRegion: WalkRenderRegion | null = null;

  const setRegion = (region: WalkRenderRegion): void => {
    if (activeRegion === region) return;
    activeRegion = region;
    const preset = WALK_ATMOSPHERE_REGION_PRESETS[region];
    const nextSunDirection = sphericalDirection(preset.sunAzimuth, preset.sunElevation);
    skyUniforms.uZenith.value.setHex(preset.zenith);
    skyUniforms.uUpperSky.value.setHex(preset.upperSky);
    skyUniforms.uHorizon.value.setHex(preset.horizon);
    skyUniforms.uGroundHaze.value.setHex(preset.groundHaze);
    skyUniforms.uSunColor.value.setHex(preset.sun);
    skyUniforms.uMoonColor.value.setHex(preset.moon);
    skyUniforms.uSunDirection.value.copy(nextSunDirection);
    hazeUniforms.uHazeColor.value.setHex(preset.haze);
    hazeUniforms.uSunsetColor.value.setHex(preset.sunset);
    hazeUniforms.uSunDirection.value.copy(nextSunDirection);
    sunDisc.position.copy(nextSunDirection).multiplyScalar(radius * 0.82);
    moonDisc.material.opacity = preset.moonOpacity;
    clouds.material.opacity = preset.cloudOpacity;
    sunLight.color.setHex(preset.sun);
    sunLight.intensity = preset.sunIntensity;
    sunLight.position.copy(nextSunDirection).multiplyScalar(220);
    hemisphereLight.color.setHex(preset.hemisphereSky);
    hemisphereLight.groundColor.setHex(preset.hemisphereGround);
    ambientLight.color.setHex(preset.ambient);
    fillLight.color.setHex(preset.fill);
    fillLight.intensity = preset.fillIntensity;
    hemisphereLight.intensity = preset.hemisphereIntensity;
    ambientLight.intensity = preset.ambientIntensity;
    fog.color.setHex(preset.fog);
    fog.density = preset.fogDensity;
    root.userData.activeRegion = region;
  };

  return {
    root,
    sky,
    clouds,
    aerosols,
    haze,
    sunLight,
    fillLight,
    hemisphereLight,
    ambientLight,
    water,
    setRegion,
    update(deltaSeconds: number, elapsedSeconds: number): void {
      if (options.camera) root.position.copy(options.camera.position);
      const safeDelta = THREE.MathUtils.clamp(deltaSeconds, 0, 0.1);
      cloudRotation += safeDelta * 0.0028;
      clouds.rotation.y = cloudRotation + Math.sin(elapsedSeconds * 0.017) * 0.0018;
      clouds.position.y = Math.sin(elapsedSeconds * 0.035) * 0.38;
      aerosols.rotation.y = -cloudRotation * 2.6;
      aerosols.position.y = Math.sin(elapsedSeconds * 0.11) * 0.12;
      skyUniforms.uTime.value = elapsedSeconds;
      hazeUniforms.uTime.value = elapsedSeconds;
      sunDisc.material.opacity = 0.93 + Math.sin(elapsedSeconds * 0.24) * 0.025;
      water?.update(elapsedSeconds);
    },
    dispose(): void {
      scene.remove(root);
      if (scene.fog === fog) scene.fog = previousFog;
      water?.dispose();
      clouds.material.map?.dispose();
      aerosols.material.map?.dispose();
      sunTexture.dispose();
      moonTexture.dispose();
      root.traverse((object) => {
        if (
          !(object instanceof THREE.Mesh) &&
          !(object instanceof THREE.Sprite) &&
          !(object instanceof THREE.Points)
        )
          return;
        if (object instanceof THREE.Mesh || object instanceof THREE.Points)
          object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      root.clear();
    },
  };
}
