import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildCarMesh, preloadCarModels } from '../../../render';
import type { CarMeshSpec } from '../../../shared/contracts';

const WIDTH = 512;
const HEIGHT = 320;
const TURN_RATE = 0.4; // rad/s turntable
const MAX_DT = 0.1; // s, a throttled tab must not spin the car in one jump
const FOV = 30;

/** Garage turntable: its own small WebGLRenderer, released (context included) on unmount. */
export function CarPreview({ spec, color }: { spec: CarMeshSpec; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(WIDTH, HEIGHT, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, WIDTH / HEIGHT, 0.1, 100);
    const size = Math.max(spec.length, spec.width * 1.6);
    camera.position.set(0, size * 0.75, size * 1.85);
    camera.lookAt(0, spec.height * 0.5, 0);

    // 3-point studio light: warm key, cool fill, strong rim from behind.
    const key = new THREE.DirectionalLight('#FFF1E0', 2.6);
    key.position.set(4, 6, 5);
    const fill = new THREE.DirectionalLight('#9FC4FF', 0.9);
    fill.position.set(-5, 3, 3);
    const rim = new THREE.DirectionalLight('#FFFFFF', 2.2);
    rim.position.set(-1, 4, -6);
    scene.add(key, fill, rim, new THREE.HemisphereLight('#3A4250', '#0B0D10', 0.6));

    const floor = new THREE.Mesh(new THREE.CircleGeometry(size * 0.75, 48), new THREE.MeshStandardMaterial({ color: '#1A1E25', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    // The turntable spins this group; the car joins it once its model is loaded (procedural fallback on failure).
    const car = new THREE.Group();
    scene.add(floor, car);
    let disposed = false;
    void preloadCarModels([spec]).then(() => {
      if (!disposed) car.add(buildCarMesh(spec, color));
    });

    let raf = 0;
    let last = performance.now();
    const frame = (now: number): void => {
      const dt = Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      car.rotation.y += TURN_RATE * dt;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    car.rotation.y = -0.6;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
      });
      renderer.dispose();
      // dispose() keeps the GL context alive; without this, remounts pile up contexts until Chrome drops the oldest.
      renderer.forceContextLoss();
    };
  }, [spec, color]);

  return <canvas ref={ref} className="car-preview" width={WIDTH} height={HEIGHT} />;
}
