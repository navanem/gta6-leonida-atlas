import * as THREE from "three";
import { publicPath } from "../explorer/public-path";

export type WalkSurfaceKind =
  "asphalt" | "concrete" | "rock" | "wood" | "gravel";
type SurfaceImage = HTMLImageElement;
type ImageLoader = (url: string) => Promise<SurfaceImage>;
const sharedImages = new Map<string, Promise<SurfaceImage>>();
const sharedSources = new WeakMap<SurfaceImage, THREE.Source<SurfaceImage>>();

function loadLocalImage(url: string): Promise<SurfaceImage> {
  const cached = sharedImages.get(url);
  if (cached) return cached;
  const request = new Promise<SurfaceImage>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Surface image unavailable."));
    image.src = url;
  });
  const recoverable = request.catch((error: unknown) => {
    if (sharedImages.get(url) === recoverable) sharedImages.delete(url);
    throw error;
  });
  sharedImages.set(url, recoverable);
  return recoverable;
}

export interface WalkSurfaceOptions {
  readonly repeat?: readonly [number, number];
  readonly normalScale?: number;
  /** Horizontal surfaces sample in world metres, independent of instance dimensions. */
  readonly groundTileMetres?: number;
  readonly roughnessFloor?: number;
  readonly color?: THREE.ColorRepresentation;
}

/** Locally served CC0 images; source records and checksums accompany the files. */
export function createWalkSurfaceLibrary(
  options: {
    anisotropy?: number;
    loadImage?: ImageLoader;
  } = {},
): {
  apply(
    material: THREE.MeshStandardMaterial,
    kind: WalkSurfaceKind,
    options?: WalkSurfaceOptions,
  ): void;
  whenReady(): Promise<void>;
  dispose(): void;
} {
  const loadImage = options.loadImage ?? loadLocalImage;
  const images = new Map<WalkSurfaceKind, Promise<readonly SurfaceImage[]>>();
  const textures = new Set<THREE.Texture>();
  const pending: Promise<void>[] = [];
  const subscriptions: Array<() => void> = [];
  let disposed = false;
  const anisotropy = THREE.MathUtils.clamp(options.anisotropy ?? 8, 1, 16);

  function getImages(kind: WalkSurfaceKind): Promise<readonly SurfaceImage[]> {
    const existing = images.get(kind);
    if (existing) return existing;
    const request = Promise.all(
      ["color", "normal", "roughness"].map((channel) =>
        loadImage(
          publicPath(`assets/street-leonida/surfaces/${kind}-${channel}.webp`),
        ),
      ),
    );
    images.set(kind, request);
    return request;
  }

  return {
    apply(material, kind, instance = {}) {
      if (disposed) return;
      let materialDisposed = false;
      const onDispose = (): void => {
        materialDisposed = true;
      };
      material.addEventListener("dispose", onDispose);
      subscriptions.push(() =>
        material.removeEventListener("dispose", onDispose),
      );
      const repeat = instance.repeat ?? [1, 1];
      const request = getImages(kind)
        .then((loaded) => {
          if (disposed || materialDisposed) return;
          const maps = loaded.map((image, index) => {
            // Three refcounts GPU uploads by Source and sampler settings; UV
            // transforms belong to each Texture and therefore remain independent.
            let source = sharedSources.get(image);
            if (!source) {
              source = new THREE.Source(image);
              sharedSources.set(image, source);
            }
            const texture = new THREE.Texture();
            texture.source = source;
            texture.name = `walk-photographic-${kind}-${["color", "normal", "roughness"][index]}`;
            texture.colorSpace =
              index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(
              Math.max(0.001, repeat[0]),
              Math.max(0.001, repeat[1]),
            );
            texture.anisotropy = anisotropy;
            texture.needsUpdate = true;
            textures.add(texture);
            return texture;
          });
          material.map = maps[0]!;
          material.normalMap = maps[1]!;
          material.roughnessMap = maps[2]!;
          material.normalScale.setScalar(
            instance.normalScale ?? (kind === "rock" ? 0.75 : 0.38),
          );
          material.bumpMap = null;
          if (instance.color !== undefined) material.color.set(instance.color);
          if (
            instance.groundTileMetres &&
            Number.isFinite(instance.groundTileMetres)
          ) {
            const metres = Math.max(0.01, instance.groundTileMetres);
            const previousCompile = material.onBeforeCompile;
            const previousKey = material.customProgramCacheKey();
            material.onBeforeCompile = (shader, renderer) => {
              previousCompile.call(material, shader, renderer);
              shader.uniforms.atlasGroundTileMetres = { value: metres };
              // Asphalt stays diffuse at a grazing sun angle; a photographed
              // roughness channel must not turn the entire dry road into a mirror.
              shader.uniforms.atlasGroundRoughnessFloor = {
                value: THREE.MathUtils.clamp(
                  instance.roughnessFloor ?? 0,
                  0,
                  1,
                ),
              };
              shader.fragmentShader =
                "uniform float atlasGroundRoughnessFloor;\n" +
                shader.fragmentShader.replace(
                  "#include <roughnessmap_fragment>",
                  "#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, atlasGroundRoughnessFloor);",
                );
              shader.vertexShader =
                "uniform float atlasGroundTileMetres;\n" + shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace(
                "#include <worldpos_vertex>",
                `
                #include <worldpos_vertex>
                vec4 atlasGroundPosition = vec4(transformed, 1.0);
                #ifdef USE_BATCHING
                  atlasGroundPosition = batchingMatrix * atlasGroundPosition;
                #endif
                #ifdef USE_INSTANCING
                  atlasGroundPosition = instanceMatrix * atlasGroundPosition;
                #endif
                atlasGroundPosition = modelMatrix * atlasGroundPosition;
                vec2 atlasGroundUv = atlasGroundPosition.xz / atlasGroundTileMetres;
                #ifdef USE_MAP
                  vMapUv = atlasGroundUv;
                #endif
                #ifdef USE_NORMALMAP
                  vNormalMapUv = atlasGroundUv;
                #endif
                #ifdef USE_ROUGHNESSMAP
                  vRoughnessMapUv = atlasGroundUv;
                #endif
              `,
              );
            };
            material.customProgramCacheKey = () =>
              previousKey + ":atlas-ground-metres-v1";
          }
          material.userData.photographicSurface = kind;
          material.needsUpdate = true;
        })
        .catch(() => {
          // The existing material remains usable when assets are offline or blocked.
          if (!disposed && !materialDisposed)
            material.userData.photographicSurface = "fallback";
        });
      pending.push(request);
    },
    async whenReady() {
      await Promise.all(pending);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      for (const texture of textures) texture.dispose();
      textures.clear();
      images.clear();
    },
  };
}
