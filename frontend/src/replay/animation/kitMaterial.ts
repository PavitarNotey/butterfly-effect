import * as THREE from "three";

// One immutable atlas for every shirt. Compact original bitmap digits, no fonts,
// per-player canvas/texture, badges, external requests or detached number decals.
const digits = [
  "11111100011001110101110011000111111",
  "00100011000010000100001000010001110",
  "11110000010000111111100001000011111",
  "11110000010000101110000010000111110",
  "10001100011000111111000010000100001",
  "11111100001000011110000010000111110",
  "01111100001000011110100011000101110",
  "11111000010001000100010000100001000",
  "01110100011000101110100011000101110",
  "01110100011000101111000010000111110",
];
let atlas: THREE.DataTexture | undefined;
function numberAtlas() {
  if (atlas) return atlas;
  const width = 128,
    height = 144,
    data = new Uint8Array(width * height * 4);
  for (let number = 1; number <= 12; number++) {
    const text = String(number),
      x0 = ((number - 1) % 4) * 32 + (32 - (text.length * 12 - 2)) / 2;
    const y0 = Math.floor((number - 1) / 4) * 48 + 10;
    for (let digit = 0; digit < text.length; digit++)
      for (let row = 0; row < 7; row++)
        for (let col = 0; col < 5; col++) {
          if (digits[Number(text[digit])][row * 5 + col] !== "1") continue;
          for (let dy = 0; dy < 4; dy++)
            for (let dx = 0; dx < 2; dx++) {
              const index =
                ((y0 + (6 - row) * 4 + dy) * width +
                  x0 +
                  digit * 12 +
                  col * 2 +
                  dx) *
                4;
              data.set([255, 255, 255, 255], index);
            }
        }
  }
  atlas = new THREE.DataTexture(data, width, height);
  atlas.magFilter = THREE.LinearFilter;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.needsUpdate = true;
  atlas.name = "Shared jersey numbers";
  return atlas;
}

const pool = new Map<
  string,
  { material: THREE.MeshStandardMaterial; references: number }
>();

/**
 * @returns A pooled material and its release callback; each owner must release exactly once.
 */
export function acquireKit(color: string, number: number, goalkeeper: boolean) {
  const key = `${color}:${number}:${goalkeeper}`;
  let entry = pool.get(key);
  if (!entry) {
    const uniforms = {
      kitColor: { value: new THREE.Color(color) },
      kitNumber: { value: number },
      kitKeeper: { value: goalkeeper ? 1 : 0 },
      kitAtlas: { value: numberAtlas() },
      kitSkin: { value: new THREE.Color("#bb8968") },
      kitInk: { value: new THREE.Color("#f3f0df") },
    };
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
    });
    material.name = `Football kit ${key}`;
    material.userData = { color, number, goalkeeper };
    material.customProgramCacheKey = () => "football-surface-kit-v1";
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader =
        "varying vec3 vKitPosition;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvKitPosition = position;",
      );
      shader.fragmentShader =
        `
varying vec3 vKitPosition;
uniform vec3 kitColor, kitSkin, kitInk;
uniform float kitNumber, kitKeeper;
uniform sampler2D kitAtlas;
` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
#include <color_fragment>
// Evaluate on the undeformed body surface. Skinning carries the entire kit and
// number together; clean seams are independent of the original triangle edges.
if (vColor.r > 0.9) {
  vec3 p = vKitPosition;
  vec3 navy = vec3(0.009, 0.018, 0.025);
  vec3 cloth = kitSkin;
  float sleeve = mix(0.60, 0.79, kitKeeper);
  bool shirt = p.y >= 0.96 && p.y < 1.60 && abs(p.x) < sleeve;
  if (p.y > 1.755) cloth = vec3(0.025, 0.016, 0.012);
  else if (p.y < 0.115) cloth = navy;
  else if (p.y < 0.43) {
    cloth = mix(kitInk, kitColor, 0.32);
    if (p.y > 0.39) cloth = kitColor;
  }
  else if (p.y > 0.64 && p.y < 0.96) {
    cloth = navy;
    if (abs(p.x) > 0.20) cloth = mix(navy, kitColor, 0.6);
  }
  else if (shirt) {
    cloth = kitColor;
    if (p.y < 0.985 || (p.y > 1.565 && abs(p.x) < 0.18)) cloth = mix(kitColor, kitInk, 0.45);
    bool back = p.z < -0.03;
    float side = back ? -1.0 : 1.0;
    vec2 size = back ? vec2(0.32, 0.35) : vec2(0.24, 0.28);
    vec2 uv = vec2(p.x * side, p.y - 1.36) / size + 0.5;
    if (abs(p.x) < 0.22 && (back || p.z > 0.035) && all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
      vec2 cell = vec2(mod(kitNumber - 1.0, 4.0), floor((kitNumber - 1.0) / 4.0));
      float ink = texture2D(kitAtlas, (cell + uv) / vec2(4.0, 3.0)).a;
      cloth = mix(cloth, kitInk, ink);
    }
  }
  diffuseColor.rgb = cloth;
}
`,
      );
    };
    entry = { material, references: 0 };
    pool.set(key, entry);
  }
  entry.references++;
  let released = false;
  return {
    material: entry.material,
    release() {
      if (released) return;
      released = true;
      if (--entry.references === 0) {
        entry.material.dispose();
        pool.delete(key);
      }
    },
  };
}

/** Small read-only diagnostics for resource regression tests. */
export function kitResources() {
  return {
    materials: pool.size,
    references: [...pool.values()].reduce(
      (sum, entry) => sum + entry.references,
      0,
    ),
  };
}
