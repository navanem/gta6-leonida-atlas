import * as THREE from 'three';

/** Opaque room portals: the view ray reaches room walls behind the glass plane.
 * No transmission pass or transparent sorting is needed for thousands of windows. */
export function createWindowInteriorMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.19,
    metalness: 0.16,
    envMapIntensity: 0.8,
    emissive: 0xffffff,
    emissiveIntensity: 0.13,
  });
  material.name = 'street-leonida/window/interior-portals';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
      varying vec2 vRoomUv;
      varying vec3 vRoomView;
      varying float vRoomSeed;
    `,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      mat4 roomTransform = modelMatrix;
      #ifdef USE_INSTANCING
        roomTransform = modelMatrix * instanceMatrix;
      #endif
      vec3 roomEye = cameraPosition - (roomTransform * vec4(position, 1.0)).xyz;
      vRoomView = vec3(
        dot(roomEye, roomTransform[0].xyz) / max(dot(roomTransform[0].xyz, roomTransform[0].xyz), 0.0001),
        dot(roomEye, roomTransform[1].xyz) / max(dot(roomTransform[1].xyz, roomTransform[1].xyz), 0.0001),
        dot(roomEye, roomTransform[2].xyz) / max(dot(roomTransform[2].xyz, roomTransform[2].xyz), 0.0001)
      );
      vRoomUv = uv;
      vRoomSeed = fract(sin(dot(roomTransform[3].xyz, vec3(0.1271, 0.3117, 0.0747))) * 43758.5453);
    `,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
      varying vec2 vRoomUv;
      varying vec3 vRoomView;
      varying float vRoomSeed;
      float roomRect(vec2 p, vec2 center, vec2 halfSize) {
        vec2 edge = smoothstep(halfSize, halfSize + vec2(0.012), abs(p - center));
        return 1.0 - max(edge.x, edge.y);
      }
    `,
      )
      .replace(
        '#include <map_fragment>',
        `
      vec3 roomOrigin = vec3(vRoomUv - 0.5, 0.0);
      vec3 roomDirection = normalize(-vRoomView);
      roomDirection.z = -max(abs(roomDirection.z), 0.0001);
      vec3 safeDirection = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), roomDirection))
        * max(abs(roomDirection), vec3(0.0001));
      float roomDepth = 1.35 + vRoomSeed * 1.8;
      vec3 roomLimit = vec3(
        roomDirection.x > 0.0 ? 0.5 : -0.5,
        roomDirection.y > 0.0 ? 0.5 : -0.5,
        -roomDepth
      );
      vec3 roomDistances = (roomLimit - roomOrigin) / safeDirection;
      float roomDistance = min(roomDistances.x, min(roomDistances.y, roomDistances.z));
      vec3 roomHit = roomOrigin + roomDirection * roomDistance;
      bool roomSide = roomDistances.x < min(roomDistances.y, roomDistances.z);
      bool roomHorizontal = roomDistances.y < min(roomDistances.x, roomDistances.z);
      vec3 roomColor = mix(vec3(0.39, 0.40, 0.36), vec3(0.58, 0.48, 0.34), vRoomSeed);
      if (roomSide) roomColor *= 0.63;
      if (roomHorizontal) {
        roomColor = roomHit.y < 0.0 ? vec3(0.19, 0.135, 0.09) : vec3(0.58, 0.57, 0.5);
        if (roomHit.y < 0.0) roomColor *= 0.87 + 0.13 * step(0.06, fract(roomHit.z * 4.0));
      }
      if (!roomSide && !roomHorizontal) {
        float picture = roomRect(roomHit.xy, vec2(0.15 - vRoomSeed * 0.22, 0.12), vec2(0.16, 0.14));
        float furniture = roomRect(roomHit.xy, vec2(-0.13, -0.34), vec2(0.28, 0.14));
        roomColor = mix(roomColor, mix(vec3(0.08, 0.15, 0.17), vec3(0.25, 0.15, 0.08), vRoomSeed), picture);
        roomColor = mix(roomColor, vec3(0.14, 0.12, 0.1), furniture);
      }
      float curtain = step(0.66, vRoomSeed) * smoothstep(0.34, 0.42, abs(vRoomUv.x - 0.5));
      vec3 curtainColor = vec3(0.55, 0.52, 0.44) * (0.76 + 0.24 * sin(vRoomUv.x * 150.0));
      roomColor = mix(roomColor, curtainColor, curtain);
      // Rooms receive much less daylight than the exterior facade. The physical
      // material still contributes the unattenuated reflected environment.
      roomColor *= 0.32;
      diffuseColor.rgb *= roomColor;
    `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
      totalEmissiveRadiance *= roomColor * (0.12 + step(0.83, vRoomSeed) * 1.3);
    `,
      );
  };
  material.customProgramCacheKey = () => 'atlas-window-interior-ray-box-v1';
  return material;
}
