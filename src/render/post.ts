import { BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import * as THREE from 'three';

/** `high` quality composer (design.md section 1, post-processing). `low` renders straight to the canvas instead. */
export interface Post {
  render(dt: number): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Post {
  // Half float keeps emissive values above 1 so the bloom threshold only catches lights, flashes and flames.
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
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
    render: (dt) => composer.render(dt),
    setSize: (w, h) => composer.setSize(w, h, false),
    dispose: () => composer.dispose(),
  };
}
