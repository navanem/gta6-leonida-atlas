import * as THREE from 'three';

export interface FabricBuilding {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly rotation: number;
  readonly seed: number;
  readonly region: string;
}
export interface RegionalBuildingDescription {
  readonly floors: number;
  readonly height: number;
  readonly floorHeight: number;
  readonly roof: 'flat' | 'hip' | 'gable';
  readonly tower: boolean;
}

/** Visual families are approximate; only the raster supplies position and footprint. */
export function describeRegionalBuilding(
  region: string,
  width: number,
  depth: number,
  seed: number,
): RegionalBuildingDescription {
  const large = width * depth > 1_900;
  const tower = region === 'Vice City' && !large && Math.min(width, depth) >= 18 && seed > 0.81;
  const floors = tower
    ? 18 + Math.floor(seed * 12)
    : region === 'Vice City'
      ? large
        ? 2 + Math.floor(seed * 3)
        : Math.min(Math.min(width, depth) < 12 ? 4 : 8, 3 + Math.floor(seed * 6))
      : region === 'Port Gellhorn'
        ? 1 + Number(seed > 0.32)
        : region === 'Leonida Keys'
          ? 1 + Math.floor(seed * 2.8)
          : region === 'Ambrosia'
            ? large
              ? 1
              : 1 + Number(seed > 0.68)
            : 1 + Number(seed > 0.88);
  const floorHeight =
    region === 'Ambrosia' && large ? 7.2 : tower ? 3.45 : region === 'Vice City' ? 3.6 : 3.2;
  const roof =
    region === 'Leonida Keys'
      ? 'hip'
      : region === 'Ambrosia' || region === 'Mount Kalaga' || region === 'Grassrivers'
        ? 'gable'
        : 'flat';
  return { floors, height: floors * floorHeight, floorHeight, roof, tower };
}

const PALETTES: Readonly<Record<string, readonly number[]>> = {
  'Vice City': [0xdddcd1, 0xd8b9ac, 0xc5d4d0, 0xefeadf, 0xb7cbd2],
  'Port Gellhorn': [0xb89b80, 0xc4baa2, 0x93aaa4, 0xc19987],
  'Leonida Keys': [0xdadbc3, 0xa7c8bd, 0xbacbcd, 0xdbc4ac],
  Ambrosia: [0xb3a388, 0xaaa797, 0xa5947e],
  Grassrivers: [0x837b61, 0x938c75],
  'Mount Kalaga': [0x837666, 0xa6967d],
};
interface Placement {
  position: [number, number, number];
  scale: [number, number, number];
  yaw: number;
  color?: number;
}
export interface BuildingFabric {
  readonly root: THREE.Group;
  readonly buildingCount: number;
  readonly detailCount: number;
  setDetail(visible: boolean): void;
  dispose(): void;
}

function gableGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0, 1);
  shape.lineTo(0.5, 0);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: false,
    steps: 1,
  });
  geometry.translate(0, 0, -0.5);
  return geometry;
}

export function createBuildingFacadeTexture(): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const localX = x % 16;
      const localY = y % 16;
      const column = Math.floor(x / 16);
      const row = Math.floor(y / 16);
      const window = localX >= 3 && localX <= 12 && localY >= 4 && localY <= 13;
      const mullion = window && (localX === 7 || localX === 8);
      const reflection = window && localY === 5 && localX >= 4 && localX <= 11;
      const litWindow = window && !mullion && (column * 7 + row * 11) % 13 === 0;
      const panelJoint = localX === 0 || localY === 0;
      const concreteNoise = (x * 17 + y * 31) % 9;

      let red = 207 + concreteNoise;
      let green = 211 + concreteNoise;
      let blue = 209 + concreteNoise;
      if (panelJoint) {
        red = 164;
        green = 170;
        blue = 169;
      } else if (mullion) {
        red = 19;
        green = 27;
        blue = 33;
      } else if (litWindow) {
        red = 232;
        green = 154;
        blue = 84;
      } else if (reflection) {
        red = 64;
        green = 104;
        blue = 132;
      } else if (window) {
        red = 27;
        green = 52;
        blue = 73;
      }

      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createBuildingEmissiveTexture(): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const localX = x % 16;
      const localY = y % 16;
      const column = Math.floor(x / 16);
      const row = Math.floor(y / 16);
      const windowInterior =
        localX >= 3 && localX <= 12 && localX !== 7 && localX !== 8 && localY >= 4 && localY <= 13;
      const lit = windowInterior && (column * 7 + row * 11) % 13 === 0;
      const value = lit ? 255 : 0;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createBuildingFabricKit() {
  const box = new THREE.BoxGeometry(1, 1, 1),
    gable = gableGeometry();
  const hip = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4);
  hip.rotateY(Math.PI / 4);
  hip.translate(0, 0.5, 0);
  const facadeTexture = createBuildingFacadeTexture();
  facadeTexture.wrapS = facadeTexture.wrapT = THREE.RepeatWrapping;
  const wall = new THREE.MeshStandardMaterial({
    map: facadeTexture,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0,
  });
  // Dimensions come from each instance matrix, so a 2-storey house never gets
  // the same stretched eight-storey texture as a tower. One material serves all tiles.
  wall.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
      varying vec2 vFabricRepeat;
      varying float vFabricWall;
    `,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
      float fabricWidth = length(instanceMatrix[0].xyz);
      float fabricHeight = length(instanceMatrix[1].xyz);
      float fabricDepth = length(instanceMatrix[2].xyz);
      float fabricSpan = abs(normal.x) > 0.5 ? fabricDepth : fabricWidth;
      vFabricRepeat = max(vec2(1.0), floor(vec2(fabricSpan / 4.2, fabricHeight / 3.45) + 0.5)) / 8.0;
      vFabricWall = 1.0 - abs(normal.y);
    `,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
      varying vec2 vFabricRepeat;
      varying float vFabricWall;
    `,
      )
      .replace(
        '#include <map_fragment>',
        `
      vec4 sampledDiffuseColor = texture2D(map, vMapUv * vFabricRepeat);
      if (vFabricWall < 0.5) sampledDiffuseColor = vec4(0.72, 0.72, 0.67, 1.0);
      diffuseColor *= sampledDiffuseColor;
    `,
      );
  };
  wall.customProgramCacheKey = () => 'atlas-fabric-metre-facades-v1';
  const roof = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.83,
    metalness: 0.08,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0xd5d1c3,
    roughness: 0.76,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x264957,
    roughness: 0.31,
    metalness: 0.26,
    envMapIntensity: 0.7,
  });
  const recess = new THREE.MeshStandardMaterial({
    color: 0x343d3b,
    roughness: 0.91,
  });
  const shutter = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.84,
  });
  let disposed = false;

  const batch = (
    parent: THREE.Group,
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    placements: Placement[],
    shadow = false,
  ) => {
    if (!placements.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length),
      dummy = new THREE.Object3D();
    placements.forEach((p, index) => {
      dummy.position.set(...p.position);
      dummy.scale.set(...p.scale);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (p.color !== undefined) mesh.setColorAt(index, new THREE.Color(p.color));
    });
    mesh.name = name;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    parent.add(mesh);
  };

  return {
    create(
      buildings: readonly FabricBuilding[],
      name: string,
      detail: 'desktop' | 'mobile',
    ): BuildingFabric {
      const root = new THREE.Group();
      root.name = name;
      root.userData.evidence = 'APPROXIMATE';
      root.userData.source = 'GTADB footprint geometry; regional visual interpretation';
      const bodies: Placement[] = [],
        flatRoofs: Placement[] = [],
        gables: Placement[] = [],
        hips: Placement[] = [];
      const push = (
        list: Placement[],
        b: FabricBuilding,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
        depth: number,
        color?: number,
        yaw = 0,
      ) => {
        const c = Math.cos(b.rotation),
          s = Math.sin(b.rotation);
        list.push({
          position: [b.x + x * c + z * s, y + 0.06, b.z - x * s + z * c],
          scale: [width, height, depth],
          yaw: b.rotation + yaw,
          color,
        });
      };
      buildings.forEach((b) => {
        const d = describeRegionalBuilding(b.region, b.width, b.depth, b.seed),
          palette = PALETTES[b.region] ?? PALETTES['Port Gellhorn']!;
        const color = palette[Math.min(palette.length - 1, Math.floor(b.seed * palette.length))]!;
        if (d.tower) {
          push(bodies, b, 0, 4.1, 0, b.width, 8.2, b.depth, color);
          push(
            bodies,
            b,
            0,
            (d.height + 8.2) / 2,
            0,
            b.width * 0.79,
            d.height - 8.2,
            b.depth * 0.79,
            color,
          );
          push(flatRoofs, b, 0, d.height + 0.32, 0, b.width * 0.81, 0.64, b.depth * 0.81, 0xc3c6bd);
        } else {
          push(bodies, b, 0, d.height / 2, 0, b.width, d.height, b.depth, color);
          if (d.roof === 'flat')
            push(
              flatRoofs,
              b,
              0,
              d.height + 0.18,
              0,
              b.width + 0.24,
              0.36,
              b.depth + 0.24,
              0xa5a89c,
            );
          else
            push(
              d.roof === 'hip' ? hips : gables,
              b,
              0,
              d.height,
              0,
              b.width + 0.6,
              Math.min(4, Math.min(b.width, b.depth) * 0.19),
              b.depth + 0.6,
              b.region === 'Leonida Keys' ? 0x8b9b94 : 0x827768,
            );
        }
      });
      batch(root, `${name}-walls`, box, wall, bodies, true);
      batch(root, `${name}-flat-roofs`, box, roof, flatRoofs);
      batch(root, `${name}-pitched-roofs`, gable, roof, gables);
      batch(root, `${name}-hip-roofs`, hip, roof, hips);
      let detailRoot: THREE.Group | null = null,
        detailCount = 0,
        released = false;
      const buildDetail = () => {
        detailRoot = new THREE.Group();
        detailRoot.name = `${name}-detail`;
        root.add(detailRoot);
        const panes: Placement[] = [],
          frames: Placement[] = [],
          dark: Placement[] = [],
          accents: Placement[] = [];
        buildings.forEach((b) => {
          const d = describeRegionalBuilding(b.region, b.width, b.depth, b.seed);
          const floorStride = detail === 'mobile' && d.floors > 12 ? 2 : 1;
          for (let floor = 0; floor < d.floors; floor += floorStride) {
            const y = (floor + 0.53) * d.floorHeight,
              setback = d.tower && y > 8.2 ? 0.79 : 1;
            const w = b.width * setback,
              depth = b.depth * setback;
            // Shared batches retain real floor height. Far detail is culled as a tile group.
            for (const face of [0, 1, 2, 3]) {
              const side = face < 2 ? -1 : 1,
                alongX = face % 2 === 0;
              const span = alongX ? w : depth;
              const bays = Math.min(
                detail === 'mobile' ? 7 : 12,
                Math.max(2, Math.floor(span / 4.2)),
              );
              for (let bay = 0; bay < bays; bay++) {
                const offset = -span / 2 + ((bay + 0.5) * span) / bays;
                const x = alongX ? offset : side * (w / 2 + 0.065),
                  z = alongX ? side * (depth / 2 + 0.065) : offset;
                const winW = Math.min(2.35, (span / bays) * 0.58),
                  winH = Math.min(1.85, d.floorHeight * 0.52);
                push(
                  dark,
                  b,
                  x,
                  y,
                  z,
                  alongX ? winW + 0.22 : 0.16,
                  winH + 0.22,
                  alongX ? 0.16 : winW + 0.22,
                );
                push(
                  panes,
                  b,
                  x + (alongX ? 0 : side * 0.09),
                  y,
                  z + (alongX ? side * 0.09 : 0),
                  alongX ? winW : 0.035,
                  winH,
                  alongX ? 0.035 : winW,
                );
                push(
                  frames,
                  b,
                  x,
                  y - winH / 2 - 0.13,
                  z,
                  alongX ? winW + 0.38 : 0.34,
                  0.12,
                  alongX ? 0.34 : winW + 0.38,
                );
                if (b.region === 'Leonida Keys' || b.region === 'Port Gellhorn') {
                  const shift = winW / 2 + 0.24;
                  for (const sign of [-1, 1])
                    push(
                      accents,
                      b,
                      x + (alongX ? sign * shift : 0),
                      y,
                      z + (alongX ? 0 : sign * shift),
                      alongX ? 0.3 : 0.22,
                      winH + 0.12,
                      alongX ? 0.22 : 0.3,
                      b.region === 'Leonida Keys' ? 0x507f76 : 0x7e6957,
                    );
                }
              }
            }
            if (floor > 0 && b.region === 'Vice City') {
              // Four narrow cornices leave the facade readable without solid wraparound slabs.
              for (const side of [-1, 1]) {
                push(frames, b, 0, floor * d.floorHeight, (side * depth) / 2, w + 0.6, 0.16, 0.55);
                push(frames, b, (side * w) / 2, floor * d.floorHeight, 0, 0.55, 0.16, depth);
              }
            }
          }
          if (d.roof === 'flat') {
            const topW = b.width * (d.tower ? 0.79 : 1),
              topD = b.depth * (d.tower ? 0.79 : 1);
            push(
              dark,
              b,
              topW * 0.18,
              d.height + 1,
              -topD * 0.15,
              Math.min(4.5, topW * 0.25),
              1.5,
              Math.min(4, topD * 0.22),
            );
            for (const side of [-1, 1]) {
              push(frames, b, 0, d.height + 0.7, (side * topD) / 2, topW, 0.85, 0.22);
              push(frames, b, (side * topW) / 2, d.height + 0.7, 0, 0.22, 0.85, topD);
            }
          }
          if (b.region === 'Port Gellhorn' || b.region === 'Leonida Keys') {
            const front = b.depth / 2;
            push(
              accents,
              b,
              0,
              2.9,
              front + 0.65,
              b.width * 0.86,
              0.2,
              1.5,
              b.region === 'Leonida Keys' ? 0x82a69a : 0x9a6951,
            );
            for (const sign of [-1, 1])
              push(frames, b, sign * b.width * 0.39, 1.48, front + 1.1, 0.14, 2.96, 0.14);
          }
        });
        batch(detailRoot, `${name}-window-recesses`, box, recess, dark);
        batch(detailRoot, `${name}-window-glass`, box, glass, panes);
        batch(detailRoot, `${name}-cornices-and-sills`, box, trim, frames);
        batch(detailRoot, `${name}-shutters-and-porches`, box, shutter, accents);
        detailCount = panes.length + frames.length + dark.length + accents.length;
      };
      return {
        root,
        buildingCount: buildings.length,
        get detailCount() {
          return detailCount;
        },
        setDetail(visible) {
          if (released || disposed) return;
          if (visible && !detailRoot) buildDetail();
          if (detailRoot) detailRoot.visible = visible;
        },
        dispose() {
          if (released) return;
          released = true;
          root.traverse((o) => {
            if (o instanceof THREE.InstancedMesh) o.dispose();
          });
          root.removeFromParent();
        },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const item of [box, gable, hip, facadeTexture, wall, roof, trim, glass, recess, shutter])
        item.dispose();
    },
  };
}
