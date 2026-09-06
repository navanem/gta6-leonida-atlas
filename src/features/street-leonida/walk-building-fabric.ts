import * as THREE from 'three';
import {
  createFacadeShellKit,
  type FacadeShellSpec,
  type FacadeShellResource,
} from './walk-facade-shell';

export interface FabricBuilding {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly rotation: number;
  readonly seed: number;
  readonly region: string;
  readonly frontFace?: number;
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
  setView(position: { x: number; z: number }, distance?: number): void;
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
  const facadeKit = createFacadeShellKit();
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
      const cellSpecs = new Map<
        string,
        { specs: FacadeShellSpec[]; minX: number; maxX: number; minZ: number; maxZ: number }
      >();
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
      const core = (
        b: FabricBuilding,
        baseY: number,
        width: number,
        height: number,
        depth: number,
        color: number,
        floors: number,
      ) => {
        // A .46m inset leaves every .32m window portal in front of the solid core.
        push(
          bodies,
          b,
          0,
          baseY + height / 2,
          0,
          Math.max(1, width - 0.92),
          height,
          Math.max(1, depth - 0.92),
          color,
        );
        const key = `${Math.floor(b.x / 128)}/${Math.floor(b.z / 128)}`;
        const halfX =
          (Math.abs(Math.cos(b.rotation)) * width + Math.abs(Math.sin(b.rotation)) * depth) / 2;
        const halfZ =
          (Math.abs(Math.sin(b.rotation)) * width + Math.abs(Math.cos(b.rotation)) * depth) / 2;
        const cell = cellSpecs.get(key) ?? {
          specs: [],
          minX: b.x - halfX,
          maxX: b.x + halfX,
          minZ: b.z - halfZ,
          maxZ: b.z + halfZ,
        };
        cell.minX = Math.min(cell.minX, b.x - halfX);
        cell.maxX = Math.max(cell.maxX, b.x + halfX);
        cell.minZ = Math.min(cell.minZ, b.z - halfZ);
        cell.maxZ = Math.max(cell.maxZ, b.z + halfZ);
        const style: FacadeShellSpec['style'] =
          b.region === 'Vice City'
            ? 'urban'
            : b.region === 'Leonida Keys'
              ? 'coastal'
              : b.region === 'Ambrosia'
                ? 'industrial'
                : b.region === 'Port Gellhorn'
                  ? 'weathered'
                  : 'timber';
        const c = Math.cos(b.rotation),
          s = Math.sin(b.rotation);
        const faces = [
          [0, depth / 2, width, 0],
          [0, -depth / 2, width, Math.PI],
          [width / 2, 0, depth, Math.PI / 2],
          [-width / 2, 0, depth, -Math.PI / 2],
        ] as const;
        faces.forEach(([x, z, span, yaw], index) => {
          const frontage = index === (b.frontFace ?? 0);
          cell.specs.push({
            position: [b.x + x * c + z * s, baseY + 0.06, b.z - x * s + z * c],
            rotationY: b.rotation + yaw,
            width: span,
            height,
            floors,
            seed: b.seed + index * 0.03,
            style,
            color,
            bayWidth: style === 'industrial' ? 6.3 : detail === 'mobile' ? 4.8 : 4.1,
            storefront:
              baseY === 0 && frontage && ['urban', 'coastal', 'weathered'].includes(style),
            balconies: frontage && (style === 'urban' || style === 'coastal') && b.seed > 0.35,
          });
        });
        cellSpecs.set(key, cell);
      };
      buildings.forEach((b) => {
        const d = describeRegionalBuilding(b.region, b.width, b.depth, b.seed),
          palette = PALETTES[b.region] ?? PALETTES['Port Gellhorn']!;
        const color = palette[Math.min(palette.length - 1, Math.floor(b.seed * palette.length))]!;
        if (d.tower) {
          core(b, 0, b.width, 8.2, b.depth, color, 2);
          core(b, 8.2, b.width * 0.79, d.height - 8.2, b.depth * 0.79, color, d.floors - 2);
          push(flatRoofs, b, 0, d.height + 0.32, 0, b.width * 0.81, 0.64, b.depth * 0.81, 0xc3c6bd);
        } else {
          const stepped = b.region === 'Vice City' && d.floors >= 4 && b.seed > 0.4;
          const topWidth = b.width * (stepped ? 0.86 : 1);
          const topDepth = b.depth * (stepped ? 0.9 : 1);
          if (stepped) {
            core(b, 0, b.width, d.floorHeight * 2, b.depth, color, 2);
            core(
              b,
              d.floorHeight * 2,
              b.width * 0.86,
              d.height - d.floorHeight * 2,
              b.depth * 0.9,
              color,
              d.floors - 2,
            );
          } else core(b, 0, b.width, d.height, b.depth, color, d.floors);
          if (d.roof === 'flat')
            push(
              flatRoofs,
              b,
              0,
              d.height + 0.18,
              0,
              topWidth + 0.24,
              0.36,
              topDepth + 0.24,
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
        // Roof equipment and parapets share the existing roof batch; they remain
        // in the silhouette when the close facade cells are outside their range.
        if (d.roof === 'flat') {
          const setback = d.tower
            ? 0.79
            : b.region === 'Vice City' && d.floors >= 4 && b.seed > 0.4
              ? 0.86
              : 1;
          const topWidth = b.width * setback;
          const topDepth = b.depth * (d.tower ? 0.79 : setback < 1 ? 0.9 : 1);
          push(
            flatRoofs,
            b,
            topWidth * 0.15,
            d.height + 0.82,
            -topDepth * 0.18,
            Math.min(3.8, topWidth * 0.23),
            1.1,
            Math.min(3, topDepth * 0.2),
            0x9b9e95,
          );
          for (const side of [-1, 1]) {
            push(
              flatRoofs,
              b,
              0,
              d.height + 0.52,
              (side * topDepth) / 2,
              topWidth,
              0.65,
              0.17,
              0xc1beb0,
            );
            push(
              flatRoofs,
              b,
              (side * topWidth) / 2,
              d.height + 0.52,
              0,
              0.17,
              0.65,
              topDepth,
              0xc1beb0,
            );
          }
        } else if (b.region === 'Ambrosia' || b.region === 'Mount Kalaga') {
          const rise = Math.min(4, Math.min(b.width, b.depth) * 0.19);
          push(
            flatRoofs,
            b,
            0,
            d.height + rise + 0.6,
            -b.depth * 0.22,
            b.region === 'Ambrosia' ? Math.min(2.5, b.width * 0.2) : 0.72,
            1.25,
            b.region === 'Ambrosia' ? Math.min(4, b.depth * 0.25) : 0.72,
            0x72796f,
          );
        }
      });
      batch(root, `${name}-walls`, box, wall, bodies, true);
      batch(root, `${name}-flat-roofs`, box, roof, flatRoofs);
      batch(root, `${name}-pitched-roofs`, gable, roof, gables);
      batch(root, `${name}-hip-roofs`, hip, roof, hips);
      let detailRoot: THREE.Group | null = null;
      let released = false;
      const cells = new Map<string, FacadeShellResource>();
      const ensureRoot = () => {
        if (!detailRoot) {
          detailRoot = new THREE.Group();
          detailRoot.name = `${name}-detail`;
          root.add(detailRoot);
        }
        return detailRoot;
      };
      const showCell = (key: string, close: boolean) => {
        let cell = cells.get(key);
        if (!cell) {
          cell = facadeKit.create(cellSpecs.get(key)!.specs, `${name}-cell-${key}`);
          cells.set(key, cell);
          ensureRoot().add(cell.root);
        }
        cell.root.visible = true;
        cell.setDetail(close);
      };
      return {
        root,
        buildingCount: buildings.length,
        get detailCount() {
          return [...cells.values()].reduce((sum, cell) => sum + cell.instanceCount, 0);
        },
        setDetail(visible) {
          if (released || disposed) return;
          if (visible) for (const key of cellSpecs.keys()) showCell(key, true);
          if (detailRoot) detailRoot.visible = visible;
        },
        setView(position, distance = detail === 'mobile' ? 220 : 300) {
          if (released || disposed) return;
          for (const [key, bounds] of cellSpecs) {
            const dx = Math.max(bounds.minX - position.x, 0, position.x - bounds.maxX);
            const dz = Math.max(bounds.minZ - position.z, 0, position.z - bounds.maxZ);
            const range = Math.hypot(dx, dz);
            if (range <= distance) showCell(key, range <= (detail === 'mobile' ? 55 : 80));
            else if (cells.has(key)) cells.get(key)!.root.visible = false;
          }
          if (detailRoot)
            detailRoot.visible = [...cells.values()].some((cell) => cell.root.visible);
        },
        dispose() {
          if (released) return;
          released = true;
          for (const cell of cells.values()) cell.dispose();
          cells.clear();
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
      facadeKit.dispose();
      for (const item of [box, gable, hip, facadeTexture, wall, roof]) item.dispose();
    },
  };
}
