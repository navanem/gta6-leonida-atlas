import * as THREE from 'three';

export type WalkMaterialKey =
  | 'asphalt'
  | 'concrete'
  | 'stucco'
  | 'grass'
  | 'marsh'
  | 'sand'
  | 'weatheredWood'
  | 'metal'
  | 'facade'
  | 'windows';

export interface WalkMaterialLibraryOptions {
  /** A stable seed keeps the generated textures identical between builds. */
  seed?: number;
  /** Power-of-two canvas resolution. Values are clamped between 32 and 1024. */
  textureSize?: number;
  /** Explicit texture anisotropy. Defaults to the renderer maximum, capped at 16. */
  anisotropy?: number;
  renderer?: THREE.WebGLRenderer;
}

export interface WalkMaterialInstanceOptions {
  /** UV repeat as a uniform number or independent horizontal/vertical values. */
  repeat?: number | readonly [number, number];
  color?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  side?: THREE.Side;
}

export interface WalkTextureSet {
  asphaltColor: THREE.CanvasTexture;
  asphaltRoughness: THREE.CanvasTexture;
  asphaltHeight: THREE.CanvasTexture;
  asphaltNormal: THREE.CanvasTexture;
  concreteColor: THREE.CanvasTexture;
  concreteRoughness: THREE.CanvasTexture;
  concreteHeight: THREE.CanvasTexture;
  concreteNormal: THREE.CanvasTexture;
  stuccoColor: THREE.CanvasTexture;
  stuccoRoughness: THREE.CanvasTexture;
  stuccoHeight: THREE.CanvasTexture;
  stuccoNormal: THREE.CanvasTexture;
  grassColor: THREE.CanvasTexture;
  grassRoughness: THREE.CanvasTexture;
  grassHeight: THREE.CanvasTexture;
  grassNormal: THREE.CanvasTexture;
  marshColor: THREE.CanvasTexture;
  marshRoughness: THREE.CanvasTexture;
  marshHeight: THREE.CanvasTexture;
  marshNormal: THREE.CanvasTexture;
  sandColor: THREE.CanvasTexture;
  sandRoughness: THREE.CanvasTexture;
  sandHeight: THREE.CanvasTexture;
  sandNormal: THREE.CanvasTexture;
  woodColor: THREE.CanvasTexture;
  woodRoughness: THREE.CanvasTexture;
  woodHeight: THREE.CanvasTexture;
  woodNormal: THREE.CanvasTexture;
  metalColor: THREE.CanvasTexture;
  metalRoughness: THREE.CanvasTexture;
  metalHeight: THREE.CanvasTexture;
  metalNormal: THREE.CanvasTexture;
  facadeColor: THREE.CanvasTexture;
  facadeRoughness: THREE.CanvasTexture;
  facadeHeight: THREE.CanvasTexture;
  facadeNormal: THREE.CanvasTexture;
  facadeEmissive: THREE.CanvasTexture;
  windowsColor: THREE.CanvasTexture;
  windowsRoughness: THREE.CanvasTexture;
  windowsEmissive: THREE.CanvasTexture;
}

export type WalkMaterialSet = Record<WalkMaterialKey, THREE.MeshStandardMaterial>;

export interface WalkMaterialLibrary {
  textures: WalkTextureSet;
  materials: WalkMaterialSet;
  /**
   * Produces an independent material whose maps can use a per-mesh UV repeat.
   * The clone and its texture views are disposed with the library.
   */
  createMaterial: (
    key: WalkMaterialKey,
    options?: WalkMaterialInstanceOptions,
  ) => THREE.MeshStandardMaterial;
  dispose: () => void;
}

type Pixel = readonly [red: number, green: number, blue: number, alpha?: number];
type PixelPainter = (x: number, y: number, u: number, v: number) => Pixel;
type HeightPainter = (x: number, y: number, u: number, v: number) => number;

const TAU = Math.PI * 2;

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function byte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function hash(x: number, y: number, seed: number): number {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

/** Periodic value noise keeps the first and last texels visually continuous. */
function periodicNoise(u: number, v: number, cells: number, seed: number): number {
  const px = u * cells;
  const py = v * cells;
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = (x0 + 1) % cells;
  const y1 = (y0 + 1) % cells;
  const wrappedX0 = ((x0 % cells) + cells) % cells;
  const wrappedY0 = ((y0 % cells) + cells) % cells;
  const tx = smoothStep(px - x0);
  const ty = smoothStep(py - y0);
  const upper = mix(hash(wrappedX0, wrappedY0, seed), hash(x1, wrappedY0, seed), tx);
  const lower = mix(hash(wrappedX0, y1, seed), hash(x1, y1, seed), tx);
  return mix(upper, lower, ty);
}

function fbm(u: number, v: number, seed: number): number {
  let value = 0;
  let weight = 0.56;
  let totalWeight = 0;
  for (const cells of [2, 4, 8, 16, 32]) {
    value += periodicNoise(u, v, cells, seed + cells * 97) * weight;
    totalWeight += weight;
    weight *= 0.52;
  }
  return value / totalWeight;
}

function grayscale(value: number): Pixel {
  return [value, value, value, 255];
}

function nearestPowerOfTwo(value: number): number {
  const safeValue = clamp(Math.round(value), 32, 1024);
  return 2 ** Math.round(Math.log2(safeValue));
}

function resolveAnisotropy(options: WalkMaterialLibraryOptions): number {
  const rendererMaximum = options.renderer?.capabilities.getMaxAnisotropy() ?? 16;
  const requested = options.anisotropy ?? rendererMaximum;
  return Math.round(clamp(requested, 1, Math.min(rendererMaximum, 16)));
}

function createTexture(
  name: string,
  size: number,
  anisotropy: number,
  colorTexture: boolean,
  painter: PixelPainter,
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    throw new Error('Street Leonida materials must be created in a browser environment.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable; procedural materials cannot be built.');

  const imageData = context.createImageData(size, size);
  const { data } = imageData;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const pixel = painter(x, y, x / size, y / size);
      data[offset] = byte(pixel[0]);
      data[offset + 1] = byte(pixel[1]);
      data[offset + 2] = byte(pixel[2]);
      data[offset + 3] = byte(pixel[3] ?? 255);
    }
  }
  context.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `street-leonida/${name}`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function wrapUnit(value: number): number {
  return ((value % 1) + 1) % 1;
}

function createNormalTexture(
  name: string,
  size: number,
  anisotropy: number,
  strength: number,
  heightPainter: HeightPainter,
): THREE.CanvasTexture {
  const texel = 1 / size;
  const sample = (u: number, v: number): number => {
    const wrappedU = wrapUnit(u);
    const wrappedV = wrapUnit(v);
    return (
      heightPainter(Math.floor(wrappedU * size), Math.floor(wrappedV * size), wrappedU, wrappedV) /
      255
    );
  };

  return createTexture(name, size, anisotropy, false, (_x, _y, u, v) => {
    const horizontal = (sample(u - texel, v) - sample(u + texel, v)) * strength;
    const vertical = (sample(u, v + texel) - sample(u, v - texel)) * strength;
    const inverseLength = 1 / Math.hypot(horizontal, vertical, 1);
    return [
      (horizontal * inverseLength * 0.5 + 0.5) * 255,
      (vertical * inverseLength * 0.5 + 0.5) * 255,
      (inverseLength * 0.5 + 0.5) * 255,
      255,
    ];
  });
}

function createTextures(size: number, anisotropy: number, seed: number): WalkTextureSet {
  const texture = (
    name: string,
    _offset: number,
    colorTexture: boolean,
    painter: PixelPainter,
  ): THREE.CanvasTexture =>
    createTexture(name, size, anisotropy, colorTexture, (x, y, u, v) => painter(x, y, u, v));
  const noise = (u: number, v: number, offset: number): number => fbm(u, v, seed + offset);
  const grain = (x: number, y: number, offset: number): number => hash(x, y, seed + offset);
  const normal = (name: string, strength: number, painter: HeightPainter): THREE.CanvasTexture =>
    createNormalTexture(name, size, anisotropy, strength, painter);

  const asphaltHeight: HeightPainter = (x, y, u, v) =>
    101 + noise(u, v, 15) * 63 + (grain(x, y, 16) - 0.5) * 40;
  const concreteHeight: HeightPainter = (x, y, u, v) =>
    112 + noise(u, v, 23) * 42 + (grain(x, y, 24) - 0.5) * 28;
  const stuccoHeight: HeightPainter = (x, y, u, v) =>
    92 + noise(u, v, 33) * 71 + grain(x, y, 34) * 38;
  const grassHeight: HeightPainter = (x, y, u, v) =>
    82 + noise(u, v, 43) * 85 + (grain(x, y, 44) > 0.77 ? 46 : 0);
  const marshHeight: HeightPainter = (x, y, u, v) =>
    77 + noise(u, v, 53) * 84 + (grain(x, y, 54) > 0.9 ? 41 : 0);
  const sandHeight: HeightPainter = (x, y, u, v) =>
    121 + Math.sin((u * 8 + v * 2) * TAU + noise(u, v, 64)) * 34 + (grain(x, y, 65) - 0.5) * 11;
  const woodHeight: HeightPainter = (_x, _y, u, v) => {
    const localU = (u * 4) % 1;
    const seam = localU < 0.035 || localU > 0.965 ? -62 : 0;
    return 130 + Math.sin((v * 20 + noise(u, v, 73) * 2.2) * TAU) * 22 + seam;
  };
  const metalHeight: HeightPainter = (_x, _y, u, v) =>
    118 + noise(u, v, 83) * 34 + Math.sin(v * 64 * TAU) * 11;
  const facadeHeight: HeightPainter = (_x, _y, u, v) => {
    const cellU = (u * 4) % 1;
    const cellV = (v * 8) % 1;
    const frame = cellU < 0.1 || cellU > 0.9 || cellV < 0.1 || cellV > 0.9;
    return frame ? 196 : 102;
  };

  return {
    asphaltColor: texture('asphalt/color', 10, true, (x, y, u, v) => {
      const broad = noise(u, v, 10);
      const aggregate = grain(x, y, 11);
      const tar = periodicNoise(u, v, 6, seed + 12);
      const speck = aggregate > 0.982 ? 31 : aggregate < 0.018 ? -20 : 0;
      return [
        38 + broad * 24 + tar * 7 + speck,
        41 + broad * 24 + tar * 7 + speck,
        44 + broad * 25 + tar * 8 + speck,
      ];
    }),
    asphaltRoughness: texture('asphalt/roughness', 13, false, (x, y, u, v) =>
      grayscale(206 + noise(u, v, 13) * 38 + (grain(x, y, 14) - 0.5) * 22),
    ),
    asphaltHeight: texture('asphalt/height', 15, false, (x, y, u, v) =>
      grayscale(asphaltHeight(x, y, u, v)),
    ),
    asphaltNormal: normal('asphalt/normal', 6.2, asphaltHeight),

    concreteColor: texture('concrete/color', 20, true, (x, y, u, v) => {
      const value = noise(u, v, 20);
      const pores = grain(x, y, 21) < 0.016 ? -28 : 0;
      return [166 + value * 45 + pores, 164 + value * 43 + pores, 157 + value * 39 + pores];
    }),
    concreteRoughness: texture('concrete/roughness', 22, false, (_x, _y, u, v) =>
      grayscale(211 + noise(u, v, 22) * 34),
    ),
    concreteHeight: texture('concrete/height', 23, false, (x, y, u, v) =>
      grayscale(concreteHeight(x, y, u, v)),
    ),
    concreteNormal: normal('concrete/normal', 5.4, concreteHeight),

    stuccoColor: texture('stucco/color', 30, true, (x, y, u, v) => {
      const body = noise(u, v, 30);
      const granule = grain(x, y, 31);
      return [
        202 + body * 35 + granule * 9,
        187 + body * 34 + granule * 8,
        165 + body * 32 + granule * 7,
      ];
    }),
    stuccoRoughness: texture('stucco/roughness', 32, false, (_x, _y, u, v) =>
      grayscale(220 + noise(u, v, 32) * 30),
    ),
    stuccoHeight: texture('stucco/height', 33, false, (x, y, u, v) =>
      grayscale(stuccoHeight(x, y, u, v)),
    ),
    stuccoNormal: normal('stucco/normal', 5.8, stuccoHeight),

    grassColor: texture('grass/color', 40, true, (x, y, u, v) => {
      const terrain = noise(u, v, 40);
      const blades = grain(x, y, 41) > 0.82 ? 21 : 0;
      return [
        43 + terrain * 37 + blades * 0.35,
        78 + terrain * 63 + blades,
        44 + terrain * 41 + blades * 0.45,
      ];
    }),
    grassRoughness: texture('grass/roughness', 42, false, (_x, _y, u, v) =>
      grayscale(224 + noise(u, v, 42) * 27),
    ),
    grassHeight: texture('grass/height', 43, false, (x, y, u, v) =>
      grayscale(grassHeight(x, y, u, v)),
    ),
    grassNormal: normal('grass/normal', 4.8, grassHeight),

    marshColor: texture('marsh/color', 50, true, (x, y, u, v) => {
      const wet = noise(u, v, 50);
      const reeds = grain(x, y, 51) > 0.9 ? 20 : 0;
      return [49 + wet * 45 + reeds * 0.5, 65 + wet * 52 + reeds, 39 + wet * 31 + reeds * 0.35];
    }),
    marshRoughness: texture('marsh/roughness', 52, false, (_x, _y, u, v) =>
      grayscale(160 + noise(u, v, 52) * 86),
    ),
    marshHeight: texture('marsh/height', 53, false, (x, y, u, v) =>
      grayscale(marshHeight(x, y, u, v)),
    ),
    marshNormal: normal('marsh/normal', 4.3, marshHeight),

    sandColor: texture('sand/color', 60, true, (x, y, u, v) => {
      const dune = Math.sin((u * 8 + v * 2) * TAU + noise(u, v, 60) * 1.4);
      const grit = grain(x, y, 61) > 0.975 ? -22 : 0;
      return [
        194 + dune * 10 + noise(u, v, 62) * 32 + grit,
        165 + dune * 9 + noise(u, v, 62) * 29 + grit,
        119 + dune * 7 + noise(u, v, 62) * 24 + grit,
      ];
    }),
    sandRoughness: texture('sand/roughness', 63, false, (_x, _y, u, v) =>
      grayscale(219 + Math.sin((u * 8 + v * 2) * TAU) * 12 + noise(u, v, 63) * 22),
    ),
    sandHeight: texture('sand/height', 64, false, (x, y, u, v) =>
      grayscale(sandHeight(x, y, u, v)),
    ),
    sandNormal: normal('sand/normal', 3.8, sandHeight),

    woodColor: texture('weathered-wood/color', 70, true, (_x, _y, u, v) => {
      const board = Math.floor(u * 4);
      const localU = (u * 4) % 1;
      const seam = localU < 0.035 || localU > 0.965 ? -45 : 0;
      const grainLine = Math.sin((v * 20 + noise(u, v, 70) * 3.1) * TAU);
      const fade = periodicNoise(u, v, 4, seed + board * 19 + 71);
      return [
        104 + fade * 66 + grainLine * 9 + seam,
        76 + fade * 50 + grainLine * 7 + seam,
        51 + fade * 37 + grainLine * 5 + seam,
      ];
    }),
    woodRoughness: texture('weathered-wood/roughness', 72, false, (_x, _y, u, v) =>
      grayscale(207 + noise(u, v, 72) * 42),
    ),
    woodHeight: texture('weathered-wood/height', 73, false, (x, y, u, v) =>
      grayscale(woodHeight(x, y, u, v)),
    ),
    woodNormal: normal('weathered-wood/normal', 5.2, woodHeight),

    metalColor: texture('weathered-metal/color', 80, true, (x, y, u, v) => {
      const galvanized = noise(u, v, 80);
      const brushed = Math.sin(v * 64 * TAU) * 4;
      const oxidation = grain(Math.floor(x / 5), Math.floor(y / 5), 81) > 0.86 ? -19 : 0;
      return [
        139 + galvanized * 75 + brushed + oxidation,
        146 + galvanized * 73 + brushed + oxidation,
        148 + galvanized * 70 + brushed + oxidation,
      ];
    }),
    metalRoughness: texture('weathered-metal/roughness', 82, false, (_x, _y, u, v) =>
      grayscale(104 + noise(u, v, 82) * 94),
    ),
    metalHeight: texture('weathered-metal/height', 83, false, (x, y, u, v) =>
      grayscale(metalHeight(x, y, u, v)),
    ),
    metalNormal: normal('weathered-metal/normal', 3.6, metalHeight),

    facadeColor: texture('facade/color', 90, true, (_x, _y, u, v) => {
      const columns = 4;
      const rows = 8;
      const cellU = (u * columns) % 1;
      const cellV = (v * rows) % 1;
      const frame = cellU < 0.1 || cellU > 0.9 || cellV < 0.1 || cellV > 0.9;
      const lit = hash(Math.floor(u * columns), Math.floor(v * rows), seed + 90) > 0.48;
      if (frame) return [81, 87, 91];
      if (lit)
        return hash(Math.floor(u * columns), Math.floor(v * rows), seed + 91) > 0.67
          ? [255, 183, 135]
          : [171, 222, 224];
      const reflection = 18 * Math.sin((cellU + cellV) * Math.PI);
      return [25 + reflection, 45 + reflection, 58 + reflection];
    }),
    facadeRoughness: texture('facade/roughness', 92, false, (_x, _y, u, v) => {
      const cellU = (u * 4) % 1;
      const cellV = (v * 8) % 1;
      const frame = cellU < 0.1 || cellU > 0.9 || cellV < 0.1 || cellV > 0.9;
      return grayscale(frame ? 176 : 58 + noise(u, v, 92) * 30);
    }),
    facadeHeight: texture('facade/height', 93, false, (x, y, u, v) =>
      grayscale(facadeHeight(x, y, u, v)),
    ),
    facadeNormal: normal('facade/normal', 7.2, facadeHeight),
    facadeEmissive: texture('facade/emissive', 94, true, (_x, _y, u, v) => {
      const cellU = (u * 4) % 1;
      const cellV = (v * 8) % 1;
      const frame = cellU < 0.1 || cellU > 0.9 || cellV < 0.1 || cellV > 0.9;
      const lit = hash(Math.floor(u * 4), Math.floor(v * 8), seed + 90) > 0.48;
      if (frame || !lit) return [0, 0, 0];
      return [224, 155, 101];
    }),

    windowsColor: texture('windows/color', 100, true, (_x, _y, u, v) => {
      const columns = 5;
      const rows = 8;
      const cellU = (u * columns) % 1;
      const cellV = (v * rows) % 1;
      const mullion = cellU < 0.065 || cellU > 0.935 || cellV < 0.065 || cellV > 0.935;
      if (mullion) return [18, 23, 29];
      const diagonalReflection = 18 * Math.sin((cellU + cellV) * Math.PI);
      return [20 + diagonalReflection, 51 + diagonalReflection, 70 + diagonalReflection * 1.2];
    }),
    windowsRoughness: texture('windows/roughness', 102, false, (_x, _y, u, v) => {
      const cellU = (u * 5) % 1;
      const cellV = (v * 8) % 1;
      const mullion = cellU < 0.065 || cellU > 0.935 || cellV < 0.065 || cellV > 0.935;
      return grayscale(mullion ? 166 : 36 + noise(u, v, 102) * 28);
    }),
    windowsEmissive: texture('windows/emissive', 103, true, (_x, _y, u, v) => {
      const column = Math.floor(u * 5);
      const row = Math.floor(v * 8);
      const cellU = (u * 5) % 1;
      const cellV = (v * 8) % 1;
      const mullion = cellU < 0.065 || cellU > 0.935 || cellV < 0.065 || cellV > 0.935;
      const lit = hash(column, row, seed + 103) > 0.71;
      return mullion || !lit ? [0, 0, 0] : [166, 111, 73];
    }),
  };
}

function buildMaterials(textures: WalkTextureSet): WalkMaterialSet {
  return {
    asphalt: new THREE.MeshStandardMaterial({
      name: 'street-leonida/asphalt',
      map: textures.asphaltColor,
      roughnessMap: textures.asphaltRoughness,
      bumpMap: textures.asphaltHeight,
      normalMap: textures.asphaltNormal,
      normalScale: new THREE.Vector2(0.72, 0.72),
      roughness: 0.94,
      metalness: 0.02,
      bumpScale: 0.055,
    }),
    concrete: new THREE.MeshStandardMaterial({
      name: 'street-leonida/concrete',
      map: textures.concreteColor,
      roughnessMap: textures.concreteRoughness,
      bumpMap: textures.concreteHeight,
      normalMap: textures.concreteNormal,
      normalScale: new THREE.Vector2(0.52, 0.52),
      roughness: 0.9,
      bumpScale: 0.07,
    }),
    stucco: new THREE.MeshStandardMaterial({
      name: 'street-leonida/stucco',
      map: textures.stuccoColor,
      roughnessMap: textures.stuccoRoughness,
      bumpMap: textures.stuccoHeight,
      normalMap: textures.stuccoNormal,
      normalScale: new THREE.Vector2(0.46, 0.46),
      roughness: 0.95,
      bumpScale: 0.095,
    }),
    grass: new THREE.MeshStandardMaterial({
      name: 'street-leonida/grass',
      map: textures.grassColor,
      roughnessMap: textures.grassRoughness,
      bumpMap: textures.grassHeight,
      normalMap: textures.grassNormal,
      normalScale: new THREE.Vector2(0.58, 0.58),
      roughness: 1,
      bumpScale: 0.105,
    }),
    marsh: new THREE.MeshStandardMaterial({
      name: 'street-leonida/marsh',
      map: textures.marshColor,
      roughnessMap: textures.marshRoughness,
      bumpMap: textures.marshHeight,
      normalMap: textures.marshNormal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughness: 0.91,
      bumpScale: 0.085,
    }),
    sand: new THREE.MeshStandardMaterial({
      name: 'street-leonida/sand',
      map: textures.sandColor,
      roughnessMap: textures.sandRoughness,
      bumpMap: textures.sandHeight,
      normalMap: textures.sandNormal,
      normalScale: new THREE.Vector2(0.36, 0.36),
      roughness: 0.97,
      bumpScale: 0.09,
    }),
    weatheredWood: new THREE.MeshStandardMaterial({
      name: 'street-leonida/weathered-wood',
      map: textures.woodColor,
      roughnessMap: textures.woodRoughness,
      bumpMap: textures.woodHeight,
      normalMap: textures.woodNormal,
      normalScale: new THREE.Vector2(0.48, 0.48),
      roughness: 0.92,
      bumpScale: 0.065,
    }),
    metal: new THREE.MeshStandardMaterial({
      name: 'street-leonida/weathered-metal',
      map: textures.metalColor,
      roughnessMap: textures.metalRoughness,
      bumpMap: textures.metalHeight,
      normalMap: textures.metalNormal,
      normalScale: new THREE.Vector2(0.34, 0.34),
      roughness: 0.58,
      metalness: 0.7,
      bumpScale: 0.025,
      envMapIntensity: 1.15,
    }),
    facade: new THREE.MeshStandardMaterial({
      name: 'street-leonida/facade',
      map: textures.facadeColor,
      roughnessMap: textures.facadeRoughness,
      bumpMap: textures.facadeHeight,
      normalMap: textures.facadeNormal,
      normalScale: new THREE.Vector2(0.28, 0.28),
      emissiveMap: textures.facadeEmissive,
      emissive: new THREE.Color(0xffc58b),
      emissiveIntensity: 0.42,
      roughness: 0.62,
      metalness: 0.08,
      bumpScale: 0.035,
      envMapIntensity: 1.05,
    }),
    windows: new THREE.MeshStandardMaterial({
      name: 'street-leonida/windows',
      map: textures.windowsColor,
      roughnessMap: textures.windowsRoughness,
      emissiveMap: textures.windowsEmissive,
      emissive: new THREE.Color(0xffbd83),
      emissiveIntensity: 0.4,
      roughness: 0.22,
      metalness: 0.3,
      envMapIntensity: 1.35,
    }),
  };
}

const MATERIAL_TEXTURE_KEYS = [
  'map',
  'roughnessMap',
  'bumpMap',
  'normalMap',
  'emissiveMap',
] as const satisfies readonly (keyof THREE.MeshStandardMaterial)[];

function setTextureRepeat(
  texture: THREE.Texture,
  repeat: number | readonly [number, number],
): void {
  const horizontal = typeof repeat === 'number' ? repeat : repeat[0];
  const vertical = typeof repeat === 'number' ? repeat : repeat[1];
  texture.repeat.set(Math.max(0.001, horizontal), Math.max(0.001, vertical));
  texture.needsUpdate = true;
}

/**
 * Creates the complete deterministic PBR material library. Call this after the
 * WebGL renderer exists so anisotropic filtering can match the user's GPU.
 */
export function createWalkMaterialLibrary(
  options: WalkMaterialLibraryOptions = {},
): WalkMaterialLibrary {
  const textureSize = nearestPowerOfTwo(options.textureSize ?? 256);
  const anisotropy = resolveAnisotropy(options);
  const textures = createTextures(textureSize, anisotropy, options.seed ?? 0x6a6f6e);
  const materials = buildMaterials(textures);
  const ownedTextures = new Set<THREE.Texture>(Object.values(textures));
  const ownedMaterials = new Set<THREE.MeshStandardMaterial>(Object.values(materials));

  for (const texture of Object.values(textures)) setTextureRepeat(texture, 4);

  const createMaterial = (
    key: WalkMaterialKey,
    instanceOptions: WalkMaterialInstanceOptions = {},
  ): THREE.MeshStandardMaterial => {
    const material = materials[key].clone();
    material.name = `${materials[key].name}/instance`;
    const repeat = instanceOptions.repeat ?? 4;

    for (const property of MATERIAL_TEXTURE_KEYS) {
      const source = material[property];
      if (!(source instanceof THREE.Texture)) continue;
      const clone = source.clone();
      clone.name = `${source.name}/instance`;
      setTextureRepeat(clone, repeat);
      material[property] = clone as never;
      ownedTextures.add(clone);
    }

    if (instanceOptions.color !== undefined) material.color.set(instanceOptions.color);
    if (instanceOptions.emissiveIntensity !== undefined) {
      material.emissiveIntensity = instanceOptions.emissiveIntensity;
    }
    if (instanceOptions.side !== undefined) material.side = instanceOptions.side;
    material.needsUpdate = true;
    ownedMaterials.add(material);
    return material;
  };

  return {
    textures,
    materials,
    createMaterial,
    dispose() {
      for (const material of ownedMaterials) material.dispose();
      for (const texture of ownedTextures) texture.dispose();
      ownedMaterials.clear();
      ownedTextures.clear();
    },
  };
}
