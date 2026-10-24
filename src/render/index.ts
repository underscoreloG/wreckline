import type * as THREE from 'three';
import type { CarMeshSpec, Renderer, RendererOptions } from '../shared/contracts';

// STUBS (WP00), WP03 replaces the bodies and keeps the signatures.

export async function createRenderer(_opts: RendererOptions): Promise<Renderer> {
  throw new Error('not implemented: WP03');
}

export function buildCarMesh(_spec: CarMeshSpec, _color: string): THREE.Group {
  throw new Error('not implemented: WP03');
}
