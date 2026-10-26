import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildInstallation } from './model.js';
import { HOTSPOTS, TOUR_ORDER, HOME_VIEW } from './data.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#scene');

/* ------------------------------ Renderer & scene ------------------------------ */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
camera.position.set(15, 8, 17);

scene.add(new THREE.HemisphereLight(0xffffff, 0xe3ece5, 0.55));
const sun = new THREE.DirectionalLight(0xfff6e8, 2.1);
sun.position.set(6.5, 11, 7.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: 1, far: 30 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun);

const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.ShadowMaterial({ opacity: 0.14 }));
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = -0.11;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);

const install = buildInstallation();
scene.add(install.root);

/* --------------------------------- Kontrol --------------------------------- */
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.7;
controls.minDistance = 3;
controls.maxDistance = 24;
controls.maxPolarAngle = 1.5;
controls.screenSpacePanning = true;
controls.target.set(...HOME_VIEW.look);
controls.addEventListener('change', () => {
  const t = controls.target;
  t.x = THREE.MathUtils.clamp(t.x, -5, 5);
  t.y = THREE.MathUtils.clamp(t.y, 0, 4);
  t.z = THREE.MathUtils.clamp(t.z, -4, 4);
});

/* ---------------------------------- Tween ---------------------------------- */
let tween = null;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function flyTo(cam, look, dur = 1.8) {
  tween = {
    t0: performance.now(), dur: dur * 1000,
    c0: camera.position.clone(), l0: controls.target.clone(),
    c1: new THREE.Vector3(...cam), l1: new THREE.Vector3(...look),
  };
}
function stepTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.t0) / tween.dur);
  const e = ease(k);
  camera.position.lerpVectors(tween.c0, tween.c1, e);
  controls.target.lerpVectors(tween.l0, tween.l1, e);
  if (k >= 1) tween = null;
}
controls.addEventListener('start', () => { tween = null; userTouched(); });

/* ------------------------------- Pin hotspot ------------------------------- */
const pinsEl = $('#pins');
const listEl = $('#componentList');
const pins = new Map();
HOTSPOTS.forEach((h) => {
  const b = document.createElement('button');
  b.className = 'pin';
  b.id = `pin-${h.id}`;
  b.style.setProperty('--c', h.color);
  b.setAttribute('aria-label', h.title);
  b.innerHTML = `<span class="pin-ring"></span><span class="pin-no">${h.no}</span><span class="pin-label">${h.title}</span>`;
  b.addEventListener('click', (e) => { e.stopPropagation(); userTouched(); select(h.id); });
  pinsEl.appendChild(b);
  pins.set(h.id, { el: b, pos: new THREE.Vector3(...h.pos) });

  const li = document.createElement('button');
  li.className = 'comp-item';
  li.id = `comp-${h.id}`;
  li.style.setProperty('--c', h.color);
  li.innerHTML = `<span class="comp-no">${h.no}</span><span class="comp-name">${h.title}</span>`;
  li.addEventListener('click', () => { userTouched(); select(h.id); });
  listEl.appendChild(li);
});

const _v = new THREE.Vector3();
function updatePins(w, h) {
  pins.forEach(({ el, pos }) => {
    _v.copy(pos).project(camera);
    const vis = _v.z < 1 && _v.z > -1;
    el.style.display = vis ? '' : 'none';
    if (!vis) return;
    el.style.transform = `translate(${((_v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-_v.y * 0.5 + 0.5) * h).toFixed(1)}px)`;
  });
}

/* ------------------------------ Panel informasi ------------------------------ */
const panel = $('#panel');
const panelBody = $('#panelBody');
let activeId = null;
let liveTimer = null;
const byId = Object.fromEntries(HOTSPOTS.map((h) => [h.id, h]));

function renderPanel(h) {
  const idx = HOTSPOTS.findIndex((x) => x.id === h.id);
  let html = `
    <div class="panel-top" style="--c:${h.color}">
      <span class="panel-no">${h.no}</span>
      <span class="panel-tag">${h.tag}</span>
    </div>
    <h2 class="panel-title">${h.title}</h2>
    <p class="panel-text">${h.text}</p>`;
  if (h.live) {
    html += `<div class="live"><div class="live-head"><span class="dot"></span>Contoh data (simulasi)</div><div class="live-grid">` +
      h.live.map((s) => `<div class="live-card"><span class="live-label">${s.label}</span><span class="live-val" id="live-${s.k}">–</span><span class="live-unit">${s.unit}</span></div>`).join('') +
      `</div></div>`;
  }
  if (h.points) html += `<ul class="panel-points">${h.points.map((p) => `<li>${p}</li>`).join('')}</ul>`;
  if (h.steps) html += `<div class="panel-sub">Proses Hidroponik <small>20–25 hari</small></div><div class="steps">${h.steps.map((s, i) => `<span class="step"><b>${i + 1}</b>${s}</span>`).join('')}</div>`;
  if (h.flow) html += `<div class="panel-sub">Alur Kerja Sistem</div><ol class="flow">${h.flow.map((s) => `<li>${s}</li>`).join('')}</ol>`;
  html += `<div class="panel-nav">
      <button id="prevBtn" class="nav-btn" aria-label="Komponen sebelumnya">‹ Sebelumnya</button>
      <span class="nav-count">${idx + 1} / ${HOTSPOTS.length}</span>
      <button id="nextBtn" class="nav-btn nav-next" aria-label="Komponen berikutnya">Berikutnya ›</button>
    </div>`;
  panelBody.innerHTML = html;
  $('#prevBtn').onclick = () => { userTouched(); select(HOTSPOTS[(idx - 1 + HOTSPOTS.length) % HOTSPOTS.length].id); };
  $('#nextBtn').onclick = () => { userTouched(); select(HOTSPOTS[(idx + 1) % HOTSPOTS.length].id); };
  clearInterval(liveTimer);
  if (h.live) {
    const tick = () => {
      const t = performance.now() / 1000;
      h.live.forEach((s, i) => {
        const el = document.getElementById(`live-${s.k}`);
        if (el) el.textContent = (s.base + s.amp * Math.sin(t * 0.8 + i) + (Math.random() - 0.5) * s.amp * 0.4).toFixed(s.dec);
      });
    };
    tick(); liveTimer = setInterval(tick, 1100);
  }
}

function select(id, { fly = true } = {}) {
  const h = byId[id];
  if (!h) return;
  activeId = id;
  pins.forEach(({ el }, k) => el.classList.toggle('active', k === id));
  document.querySelectorAll('.comp-item').forEach((el) => el.classList.toggle('active', el.id === `comp-${id}`));
  renderPanel(h);
  panel.classList.add('open');
  document.body.classList.add('panel-open');
  if (fly) flyTo(h.cam, h.look, 1.7);
}
function closePanel() {
  activeId = null;
  clearInterval(liveTimer);
  panel.classList.remove('open');
  document.body.classList.remove('panel-open');
  pins.forEach(({ el }) => el.classList.remove('active'));
  document.querySelectorAll('.comp-item').forEach((el) => el.classList.remove('active'));
}
$('#panelClose').onclick = () => { userTouched(); closePanel(); };

function goHome() {
  closePanel();
  flyTo(HOME_VIEW.cam, HOME_VIEW.look, 1.8);
}

/* --------------------------- Klik objek 3D (raycast) --------------------------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; userTouched(); });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 450;
  down = null;
  if (moved > 7 || !quick) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObject(install.root, true);
  for (const hit of hits) {
    const u = hit.object.userData;
    if (u.noPick) continue;
    if (u.gate) { install.toggleGate(); return; }
    if (u.hotspot) { select(u.hotspot); return; }
    break;
  }
  if (activeId && !tour.active) closePanel();
});

/* ---------------------------- Tur otomatis & idle ---------------------------- */
const tour = { active: false, i: 0, timer: null, dwell: 7000 };
const tourBar = $('#tourBar');
const tourLabel = $('#tourLabel');
const tourFill = $('#tourFill');
const tourBtn = $('#btnTour');
const tourSteps = [null, ...TOUR_ORDER];
let lastTouch = performance.now();

function userTouched() {
  lastTouch = performance.now();
  if (tour.active) stopTour();
}
function runTourStep() {
  const id = tourSteps[tour.i];
  if (id) {
    select(id);
    tourLabel.textContent = `${tour.i}/${tourSteps.length - 1} · ${byId[id].title}`;
  } else {
    goHome();
    tourLabel.textContent = 'Gambaran Umum Instalasi Smart Bajo';
  }
  tourFill.style.animation = 'none';
  void tourFill.offsetWidth;
  tourFill.style.animation = `fill ${tour.dwell}ms linear forwards`;
  clearTimeout(tour.timer);
  tour.timer = setTimeout(() => { tour.i = (tour.i + 1) % tourSteps.length; runTourStep(); }, tour.dwell);
}
function startTour() {
  tour.active = true;
  tour.i = 0;
  tourBtn.classList.add('on');
  tourBtn.querySelector('.lbl').textContent = 'Hentikan Tur';
  tourBar.classList.add('show');
  document.body.classList.add('touring');
  runTourStep();
}
function stopTour() {
  tour.active = false;
  clearTimeout(tour.timer);
  tourBtn.classList.remove('on');
  tourBtn.querySelector('.lbl').textContent = 'Tur Otomatis';
  tourBar.classList.remove('show');
  document.body.classList.remove('touring');
}
tourBtn.onclick = () => { if (tour.active) { stopTour(); lastTouch = performance.now(); } else startTour(); };
$('#tourStop').onclick = () => { stopTour(); lastTouch = performance.now(); };

/* ----------------------------- Tombol & toggle ----------------------------- */
$('#btnHome').onclick = () => { userTouched(); goHome(); };
const flowBtn = $('#btnFlow');
flowBtn.onclick = () => {
  userTouched();
  const on = !flowBtn.classList.contains('on');
  flowBtn.classList.toggle('on', on);
  install.setXray(on);
};
const labelBtn = $('#btnPins');
labelBtn.onclick = () => {
  userTouched();
  const on = !labelBtn.classList.contains('on');
  labelBtn.classList.toggle('on', on);
  pinsEl.classList.toggle('hidden', !on);
};
const modal = $('#infoModal');
$('#btnInfo').onclick = () => { userTouched(); modal.classList.add('show'); };
$('#modalClose').onclick = () => { modal.classList.remove('show'); lastTouch = performance.now(); };
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
$('#btnFull').onclick = () => {
  userTouched();
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
};
$('#btnList').onclick = () => { userTouched(); $('#compCard').classList.toggle('collapsed'); };
window.addEventListener('keydown', (e) => {
  userTouched();
  if (e.key === 'Escape') { modal.classList.remove('show'); closePanel(); }
});
window.addEventListener('wheel', userTouched, { passive: true });

/* ------------------------------- Resize & loop ------------------------------- */
let W = 0, H = 0, viewShift = 0;
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.fov = W / H < 1 ? 50 : 36;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let started = false;
const _o = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  const t = clock.elapsedTime;

  // geser tampilan agar objek tidak tertutup panel
  const panelW = document.body.classList.contains('panel-open') && W > 820 ? Math.min(420, W * 0.36) : 0;
  viewShift += (panelW * 0.5 - viewShift) * Math.min(1, dt * 5);
  if (Math.abs(viewShift) > 0.3) camera.setViewOffset(W, H, viewShift, 0, W, H);
  else camera.clearViewOffset();

  stepTween(now);
  if (tour.active && !tween) {
    // putar pelan mengelilingi target selama jeda tur
    _o.copy(camera.position).sub(controls.target);
    _o.applyAxisAngle(THREE.Object3D.DEFAULT_UP, dt * (tourSteps[tour.i] ? 0.07 : 0.14));
    camera.position.copy(controls.target).add(_o);
  }
  controls.update();
  install.update(t, dt);
  updatePins(W, H);
  renderer.render(scene, camera);

  if (!started) {
    started = true;
    $('#loader').classList.add('done');
    const hash = decodeURIComponent(location.hash.slice(1));
    if (byId[hash]) { select(hash); lastTouch = performance.now(); }
    else flyTo(HOME_VIEW.cam, HOME_VIEW.look, 3.2);
    setTimeout(() => $('#hint').classList.add('show'), 3500);
    setTimeout(() => $('#hint').classList.remove('show'), 13000);
  }
  // mode "attract": tur otomatis jika tidak disentuh
  if (!tour.active && !modal.classList.contains('show') && now - lastTouch > 45000 && now > 5000) startTour();
}
frame();

window.__app = { select, goHome, startTour, stopTour, camera, controls };
