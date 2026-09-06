import * as THREE from "three";

/** Contact shading is deliberately smaller than the color buffer, with a fixed pixel ceiling. */
export function getWalkPostprocessSize(
  width: number,
  height: number,
  coarsePointer: boolean,
) {
  const w = Math.max(1, Math.floor(Number.isFinite(width) ? width : 1));
  const h = Math.max(1, Math.floor(Number.isFinite(height) ? height : 1));
  const scale = Math.min(
    coarsePointer ? 0.4 : 0.5,
    Math.sqrt(512_000 / (w * h)),
  );
  return {
    width: w,
    height: h,
    contactWidth: Math.max(1, Math.floor(w * scale)),
    contactHeight: Math.max(1, Math.floor(h * scale)),
  };
}

export function reconstructViewPosition(
  u: number,
  v: number,
  depth: number,
  inverseProjection: THREE.Matrix4,
): THREE.Vector3 {
  const point = new THREE.Vector4(
    u * 2 - 1,
    v * 2 - 1,
    depth * 2 - 1,
    1,
  ).applyMatrix4(inverseProjection);
  return new THREE.Vector3(point.x, point.y, point.z).divideScalar(point.w);
}

const VERTEX = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position, 1.0); }
`;
const DEPTH_FUNCTIONS = /* glsl */ `
  uniform sampler2D tDepth;
  uniform mat4 inverseProjection;
  vec3 viewPosition(vec2 uv) {
    float depth = texture2D(tDepth, uv).x;
    vec4 point = inverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    return point.xyz / point.w;
  }
`;

const CONTACT_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 imageSize;
  uniform float projectionY;
  ${DEPTH_FUNCTIONS}
  void main() {
    float depth = texture2D(tDepth, vUv).x;
    vec3 p = viewPosition(vUv);
    if (depth > 0.999995 || -p.z > 150.0) { gl_FragColor = vec4(1.0); return; }
    vec2 texel = 1.0 / imageSize;
    vec3 l = viewPosition(vUv - vec2(texel.x, 0.0));
    vec3 r = viewPosition(vUv + vec2(texel.x, 0.0));
    vec3 b = viewPosition(vUv - vec2(0.0, texel.y));
    vec3 t = viewPosition(vUv + vec2(0.0, texel.y));
    vec3 dx = abs(l.z - p.z) < abs(r.z - p.z) ? p - l : r - p;
    vec3 dy = abs(b.z - p.z) < abs(t.z - p.z) ? p - b : t - p;
    vec3 crossNormal = cross(dx, dy);
    vec3 normal = crossNormal / max(length(crossNormal), 0.000001);
    float radius = 1.35;
    float screenRadius = clamp(radius * projectionY * imageSize.y / max(-2.0 * p.z, 0.2), 2.0, 72.0);
    float obscurance = 0.0;
    float rotation = fract(dot(floor(vUv * imageSize * 0.5), vec2(0.06711056, 0.00583715))) * 6.2831853;
    for (int i = 0; i < CONTACT_SAMPLES; i++) {
      float angle = rotation + float(i) * 2.39996323;
      float distanceFactor = (float(i) + 0.5) / float(CONTACT_SAMPLES);
      vec2 uv = vUv + vec2(cos(angle), sin(angle)) * sqrt(distanceFactor) * screenRadius * texel;
      if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) continue;
      vec3 delta = viewPosition(uv) - p;
      float distanceSquared = dot(delta, delta);
      float horizon = max(dot(normal, delta) - 0.035, 0.0) / sqrt(max(distanceSquared, 0.0001));
      float falloff = 1.0 - smoothstep(0.12, radius * radius, distanceSquared);
      obscurance += horizon * falloff;
    }
    float occlusion = clamp(obscurance * 3.2 / float(CONTACT_SAMPLES), 0.0, 0.48);
    occlusion *= 1.0 - smoothstep(75.0, 150.0, -p.z);
    gl_FragColor = vec4(vec3(1.0 - occlusion), 1.0);
  }
`;

const OUTPUT_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tColor;
  uniform sampler2D tContact;
  uniform vec2 contactSize;
  uniform vec2 imageSize;
  uniform float bloomStrength;
  #include <tonemapping_pars_fragment>
  #include <colorspace_pars_fragment>
  ${DEPTH_FUNCTIONS}
  void main() {
    vec3 color = texture2D(tColor, vUv).rgb;
    float z = viewPosition(vUv).z;
    float sum = 0.0;
    float weightSum = 0.0;
    // A depth-aware 2x2 reconstruction keeps foreground shading off sky silhouettes.
    for (int y = 0; y < 2; y++) {
      for (int x = 0; x < 2; x++) {
        vec2 uv = (floor(vUv * contactSize - 0.5) + vec2(float(x), float(y)) + 0.5) / contactSize;
        float neighborZ = viewPosition(uv).z;
        float weight = exp(-abs(z - neighborZ) / max(0.06, -z * 0.012));
        sum += texture2D(tContact, uv).r * weight;
        weightSum += weight;
      }
    }
    float contact = weightSum > 0.0001 ? sum / weightSum : texture2D(tContact, vUv).r;
    // Bright emission keeps its energy. The contact pass primarily grounds diffuse surfaces.
    float emissiveProtection = smoothstep(1.1, 3.2, max(max(color.r, color.g), color.b));
    color *= mix(contact, 1.0, emissiveProtection);
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float angle = float(i) * 0.78539816;
      vec2 offset = vec2(cos(angle), sin(angle)) * 4.0 / imageSize;
      glow += max(texture2D(tColor, vUv + offset).rgb - 1.4, vec3(0.0));
    }
    color += min(glow * (bloomStrength / 8.0), vec3(0.2));
    gl_FragColor = sRGBTransferOETF(vec4(ACESFilmicToneMapping(color), 1.0));
  }
`;

export interface WalkPostprocessing {
  readonly targets: readonly THREE.WebGLRenderTarget[];
  resize(width: number, height: number): void;
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
  dispose(): void;
}

/** One scene render; depth reconstruction avoids an extra normal/geometry pass. */
export function createWalkPostprocessing(
  renderer: THREE.WebGLRenderer,
  coarsePointer: boolean,
): WalkPostprocessing {
  // An unsigned-byte intermediate would clip scene radiance before tone mapping.
  // Let the caller retain its direct-rendering path when HDR is unavailable.
  if (!renderer.extensions.has("EXT_color_buffer_float")) {
    throw new Error("Walk postprocessing requires an HDR color target.");
  }
  const color = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: Math.min(coarsePointer ? 2 : 4, renderer.capabilities.maxSamples),
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  });
  color.texture.name = "walk-hdr-color";
  const contact = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  contact.texture.name = "walk-contact-shading";
  const inverseProjection = new THREE.Matrix4();
  const imageSize = new THREE.Vector2(1, 1);
  const contactSize = new THREE.Vector2(1, 1);
  const contactMaterial = new THREE.RawShaderMaterial({
    name: "walk-depth-contact-shading",
    defines: { CONTACT_SAMPLES: coarsePointer ? 8 : 16 },
    uniforms: {
      tDepth: { value: color.depthTexture },
      inverseProjection: { value: inverseProjection },
      imageSize: { value: imageSize },
      projectionY: { value: 1 },
    },
    vertexShader: VERTEX,
    fragmentShader: CONTACT_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const outputMaterial = new THREE.RawShaderMaterial({
    name: "walk-contact-output",
    uniforms: {
      tColor: { value: color.texture },
      tDepth: { value: color.depthTexture },
      tContact: { value: contact.texture },
      inverseProjection: { value: inverseProjection },
      contactSize: { value: contactSize },
      imageSize: { value: imageSize },
      toneMappingExposure: { value: renderer.toneMappingExposure },
      bloomStrength: { value: 0.055 },
    },
    vertexShader: VERTEX,
    fragmentShader: OUTPUT_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  const quad = new THREE.Mesh(geometry, contactMaterial);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.Camera();
  let shaderFailed = false;
  const onShaderError = () => {
    // Do not throw inside Three's callback: WebGLProgram still has shader
    // cleanup to finish before renderer.render() returns.
    shaderFailed = true;
  };
  const renderQuad = (material: THREE.RawShaderMaterial) => {
    quad.material = material;
    renderer.render(quadScene, quadCamera);
    if (shaderFailed) throw new Error("Walk postprocessing shader failed.");
  };
  let disposed = false;
  return {
    targets: [color, contact],
    resize(width, height) {
      if (disposed) return;
      const size = getWalkPostprocessSize(width, height, coarsePointer);
      color.setSize(size.width, size.height);
      contact.setSize(size.contactWidth, size.contactHeight);
      imageSize.set(size.width, size.height);
      contactSize.set(size.contactWidth, size.contactHeight);
    },
    render(scene, camera) {
      if (disposed) return;
      const previousTarget = renderer.getRenderTarget();
      const previousToneMapping = renderer.toneMapping;
      const previousAutoReset = renderer.info.autoReset;
      const previousShaderHandler = renderer.debug.onShaderError;
      const previousShaderChecks = renderer.debug.checkShaderErrors;
      renderer.info.autoReset = false;
      renderer.info.reset();
      inverseProjection.copy(camera.projectionMatrixInverse);
      contactMaterial.uniforms.projectionY!.value =
        camera.projectionMatrix.elements[5];
      outputMaterial.uniforms.toneMappingExposure!.value =
        renderer.toneMappingExposure;
      try {
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setRenderTarget(color);
        renderer.render(scene, camera);
        // Restrict error interception to our own two programs; scene materials
        // keep the caller's diagnostic behavior.
        shaderFailed = false;
        renderer.debug.checkShaderErrors = true;
        renderer.debug.onShaderError = onShaderError;
        renderer.setRenderTarget(contact);
        renderQuad(contactMaterial);
        renderer.setRenderTarget(previousTarget);
        renderQuad(outputMaterial);
      } finally {
        renderer.debug.onShaderError = previousShaderHandler;
        renderer.debug.checkShaderErrors = previousShaderChecks;
        renderer.toneMapping = previousToneMapping;
        renderer.info.autoReset = previousAutoReset;
        renderer.setRenderTarget(previousTarget);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      color.dispose();
      contact.dispose();
      geometry.dispose();
      contactMaterial.dispose();
      outputMaterial.dispose();
      quadScene.clear();
    },
  };
}
