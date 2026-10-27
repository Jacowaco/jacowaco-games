// Globo 3D (three.js). Expone window.sunshineGlobe.update(q) con q en [0,1].
import * as THREE from 'three';

const LAT = -34.5622057, LON = -58.4267994;
const container = document.getElementById('globe');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer, scene, camera, earth, clouds, stars, running = false, q = 0;
const targetRotY = THREE.MathUtils.degToRad(-(LON + 90));
const targetRotX = THREE.MathUtils.degToRad(LAT);
const START_Y = targetRotY - Math.PI * 0.95;
const START_X = 0.45;
const CAM_FAR = 3.8, CAM_NEAR = 1.32;

const smooth = t => t * t * (3 - 2 * t);
const clamp01 = v => Math.min(1, Math.max(0, v));

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.01, 300);

  const loader = new THREE.TextureLoader();
  const tex = (u, srgb = true) => { const t = loader.load(u); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

  earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 96),
    new THREE.MeshPhongMaterial({
      map: tex('img/earth.jpg'),
      emissiveMap: tex('img/lights.png'),
      emissive: new THREE.Color(0xffd27a), emissiveIntensity: 0.4,
      shininess: 6, specular: new THREE.Color(0x1a1a1a),
    })
  );
  clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.007, 96, 96),
    new THREE.MeshLambertMaterial({ map: tex('img/clouds.png'), transparent: true, opacity: 0.8, depthWrite: false })
  );
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.035, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x5fb2ff, transparent: true, opacity: 0.22, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  scene.add(earth, clouds, atmo);

  const N = 3000, pos = new Float32Array(N * 3), v = new THREE.Vector3();
  for (let i = 0; i < N; i++) { v.randomDirection().multiplyScalar(70 + Math.random() * 60); pos.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.9 }));
  scene.add(stars);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff4d6, 2.6); sun.position.set(-4, 2.5, 5); scene.add(sun);

  resize();
  addEventListener('resize', resize);
  update(0);

  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) loop(); }, { threshold: 0 });
  io.observe(container);
}

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.render(scene, camera);
}

function update(p) {
  q = clamp01(p);
  const r = smooth(q);
  earth.rotation.y = START_Y + (targetRotY - START_Y) * r;
  earth.rotation.x = START_X + (targetRotX - START_X) * r;
  camera.position.z = CAM_FAR + (CAM_NEAR - CAM_FAR) * Math.pow(q, 1.7);
  stars.rotation.y = q * 0.4; stars.rotation.x = q * 0.15;
}

let t0 = performance.now();
function loop() {
  if (!running) return;
  const t = (performance.now() - t0) / 1000;
  clouds.rotation.copy(earth.rotation); clouds.rotation.y += t * 0.012;
  if (q < 0.02) earth.rotation.y = START_Y + t * 0.05; // gira solo mientras no scrolleás
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

if (!reduce) {
  try { init(); window.sunshineGlobe = { update }; }
  catch (err) { console.warn('Globe off:', err); container.style.display = 'none'; window.sunshineGlobeFailed = true; }
} else { window.sunshineGlobeFailed = true; }
