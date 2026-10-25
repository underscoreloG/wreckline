import { BloomEffect, Effect, EffectAttribute, EffectComposer, EffectPass, RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import * as THREE from 'three';
import { EDGE_BLUR_KEY } from './camera';

/** `high` quality composer (design.md section 1, post-processing). `low` renders straight to the canvas instead. */
export interface Post {
  render(dt: number): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

// Screen-edge zoom blur while the player boosts (WP26). Strength comes from FollowCamera via camera.userData.
const EDGE_SAMPLES = 8;
const EDGE_SPAN = 0.06; // fraction of the distance to the screen centre smeared at full strength, at the very edge
const EDGE_INNER = 0.25; // uv radius from the centre kept sharp (the centre ~50% of the screen)
const EDGE_OUTER = 0.6; // uv radius where the blur reaches full strength

const EDGE_FRAG = /* glsl */ `
uniform float strength;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 d = uv - 0.5;
  float k = strength * smoothstep(${EDGE_INNER.toFixed(3)}, ${EDGE_OUTER.toFixed(3)}, length(d));
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${EDGE_SAMPLES}; i++) {
    // Samples toward the centre: a zoom blur, things rush outward past the edges.
    sum += texture2D(inputBuffer, uv - d * k * ${EDGE_SPAN.toFixed(3)} * float(i) / ${(EDGE_SAMPLES - 1).toFixed(1)}).rgb;
  }
  outputColor = vec4(sum / ${EDGE_SAMPLES.toFixed(1)}, inputColor.a);
}`;

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Post {
  // Half float keeps emissive values above 1 so the bloom threshold only catches lights, flashes and flames.
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  // Its own pass: SMAA is a convolution effect too and two cannot share one. Disabled (no draw) when not boosting.
  const strength = new THREE.Uniform(0);
  const edgePass = new EffectPass(camera, new Effect('EdgeBlurEffect', EDGE_FRAG, { attributes: EffectAttribute.CONVOLUTION, uniforms: new Map([['strength', strength]]) }));
  edgePass.enabled = false;
  composer.addPass(edgePass);
  composer.addPass(
    new EffectPass(
      camera,
      new SMAAEffect(),
      new BloomEffect({ luminanceThreshold: 0.75, luminanceSmoothing: 0.2, intensity: 1.1, mipmapBlur: true }),
      new VignetteEffect({ darkness: 0.45, offset: 0.3 }),
      new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
    ),
  );
  return {
    render: (dt) => {
      strength.value = (camera.userData[EDGE_BLUR_KEY] as number | undefined) ?? 0;
      edgePass.enabled = strength.value > 0.001;
      composer.render(dt);
    },
    setSize: (w, h) => composer.setSize(w, h, false),
    dispose: () => composer.dispose(),
  };
}
