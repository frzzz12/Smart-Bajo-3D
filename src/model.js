import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Model 3D Hidroponik Smart Bajo (dibangun secara prosedural)
 *  Satuan: 1 unit ≈ 0.5 m. Depan = +Z, kiri = -X.
 * ------------------------------------------------------------------ */

const TIERS = [
  { y: 2.35, z: -0.7 },
  { y: 1.75, z: -0.3 },
  { y: 1.15, z: 0.1 },
  { y: 0.55, z: 0.5 },
];
const PIPE_R = 0.16;
const PIPE_XR = 2.3; // ujung pipa (masuk nutrisi)
const PIPE_XL = -2.3; // ujung pipa (keluar / drain)

const rand = (() => {
  let s = 20260;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutBack = (x) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/* Box kayu dengan UV sehingga serat memanjang searah sisi terpanjang */
function woodBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [ud, vd] = dims[f];
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      let u = uv.getX(idx), v = uv.getY(idx);
      if (ud > vd) { const t = u; u = v; v = t; }
      uv.setXY(idx, u, v);
    }
  }
  return g;
}

export function buildInstallation() {
  const root = new THREE.Group();
  const uTime = { value: 0 };
  const waters = [];
  const sway = [];

  /* ---------------------------- Material ---------------------------- */
  const woodTex = canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = '#c48b4b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = rand() * w, lw = 0.6 + rand() * 2.4;
      g.fillStyle = rand() > 0.5 ? `rgba(90,52,18,${0.05 + rand() * 0.12})` : `rgba(255,220,160,${0.05 + rand() * 0.1})`;
      g.fillRect(x, 0, lw, h);
    }
  }, { repeat: true });
  const M = {
    wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.78 }),
    pipeWhite: new THREE.MeshStandardMaterial({ color: 0xf6f8f8, roughness: 0.32, transparent: true }),
    pipeGray: new THREE.MeshStandardMaterial({ color: 0xc3cacf, roughness: 0.4, transparent: true }),
    frame: new THREE.MeshStandardMaterial({ color: 0xdfe4e6, roughness: 0.35 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf5f7f7, roughness: 0.45 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1b1e21, roughness: 0.5 }),
    darkGray: new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.5, metalness: 0.2 }),
    cup: new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.7 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xc9ced2, roughness: 0.3, metalness: 0.8 }),
  };

  const netTex = canvasTex(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(32,44,36,0.42)'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(22,30,25,0.95)';
    g.fillRect(0, 0, 64, 12); g.fillRect(0, 0, 12, 64);
  }, { repeat: true });
  const wireTex = canvasTex(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(70,78,84,1)'; g.lineWidth = 4.5;
    g.beginPath(); g.moveTo(0, 2); g.lineTo(64, 2); g.moveTo(2, 0); g.lineTo(2, 64); g.stroke();
  }, { repeat: true });

  /* ------------------------------ Helper ----------------------------- */
  const tag = (o, id) => { o.traverse((c) => { if (c.isMesh) c.userData.hotspot = id; }); return o; };
  const shade = (o, cast = true, recv = true) => o.traverse((c) => { if (c.isMesh) { c.castShadow = cast; c.receiveShadow = recv; } });
  const put = (o, id, parent = root, cast = true) => { if (id) tag(o, id); shade(o, cast); parent.add(o); return o; };
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function waterMat(len, c1, c2) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime, uLen: { value: len }, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform float uLen; uniform vec3 uC1; uniform vec3 uC2; varying vec2 vUv;
        void main(){
          float p = vUv.x * uLen * 1.4 - uTime * 1.3;
          float b = 0.5 + 0.5 * sin(p * 6.2831);
          float s = smoothstep(0.3, 1.0, b);
          vec3 col = mix(uC1, uC2, s);
          gl_FragColor = vec4(col, 0.6 + 0.38 * s);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
  }

  /* Pipa lurus + aliran air di dalamnya */
  function pipePath(points, r, mat, { c1 = '#3b9cf0', c2 = '#b6e3ff', waterR = 0.7, joints = true } = {}) {
    const g = new THREE.Group();
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const len = a.distanceTo(b);
      if (len < 1e-4) continue;
      const curve = new THREE.LineCurve3(a, b);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 1, r, 16, false), mat));
      const w = new THREE.Mesh(new THREE.TubeGeometry(curve, 1, r * waterR, 12, false), waterMat(len, c1, c2));
      w.renderOrder = 2; w.userData.isWater = true; w.castShadow = false;
      waters.push(w); g.add(w);
    }
    if (joints) points.forEach((p) => g.add(mesh(new THREE.SphereGeometry(r * 1.03, 14, 10), mat, p.x, p.y, p.z)));
    return g;
  }

  /* ----------------------------- Alas / lantai ----------------------------- */
  const slab = mesh(new THREE.BoxGeometry(8.7, 0.08, 6.2), new THREE.MeshStandardMaterial({ color: 0xf1f4f2, roughness: 0.95 }), 0, -0.04, 0);
  slab.receiveShadow = true;
  root.add(slab);
  const slabEdge = mesh(new THREE.BoxGeometry(8.78, 0.03, 6.28), new THREE.MeshStandardMaterial({ color: 0xdfe8e1, roughness: 1 }), 0, -0.095, 0);
  root.add(slabEdge);

  /* ------------------------ Rangka kayu utama + atap ------------------------ */
  const frame = new THREE.Group();
  const POST = 0.17;
  const roofY = (z) => 3.3 - (z + 1.9) * (0.4 / 3.8);
  [[-3, -1.9], [3, -1.9], [-3, 1.9], [3, 1.9]].forEach(([x, z]) => {
    const h = roofY(z) - 0.05;
    frame.add(mesh(woodBox(POST, h, POST), M.wood, x, h / 2, z));
    frame.add(mesh(new THREE.BoxGeometry(0.34, 0.05, 0.34), M.black, x, 0.025, z)); // sepatu tiang
  });
  // balok penghubung tinggi & palang bawah
  const ROOF_ROT = Math.atan(0.4 / 3.8);
  const roof = new THREE.Group();
  roof.position.set(0, 3.1, 0);
  roof.rotation.x = ROOF_ROT;
  roof.add(mesh(woodBox(6.9, 0.12, 0.14), M.wood, 0, -0.02, -2.2));
  roof.add(mesh(woodBox(6.9, 0.12, 0.14), M.wood, 0, -0.02, 2.2));
  roof.add(mesh(woodBox(0.14, 0.12, 4.5), M.wood, -3.3, -0.02, 0));
  roof.add(mesh(woodBox(0.14, 0.12, 4.5), M.wood, 3.3, -0.02, 0));
  [-1.1, 0, 1.1].forEach((z) => roof.add(mesh(woodBox(6.6, 0.08, 0.1), M.wood, 0, 0.03, z)));
  const netT = netTex.clone(); netT.needsUpdate = true; netT.repeat.set(6.6 / 0.1, 4.4 / 0.1);
  const net = mesh(new THREE.PlaneGeometry(6.6, 4.4), new THREE.MeshStandardMaterial({ map: netT, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1 }), 0, 0.085, 0);
  net.rotation.x = -Math.PI / 2;
  net.userData.noPick = true; net.castShadow = false; net.receiveShadow = true;
  roof.add(net);
  tag(roof, 'rangka'); net.userData.hotspot = null;
  shade(roof, true, true); net.castShadow = false;
  root.add(roof);
  // balok silang sisi (tiang ke atap)
  [-3, 3].forEach((x) => {
    frame.add(mesh(woodBox(0.1, 0.1, 3.8), M.wood, x, roofY(0) - 0.35, 0));
    frame.add(mesh(woodBox(0.1, 0.1, 3.8), M.wood, x, 0.55, 0));
  });
  frame.add(mesh(woodBox(6.0, 0.1, 0.1), M.wood, 0, 0.55, -1.9));
  put(frame, 'rangka');

  /* --------------------------- Pagar kawat + gerbang --------------------------- */
  const fence = new THREE.Group();
  const FH = 1.1;
  function fenceSegment(x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
    const g = new THREE.Group();
    g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    g.rotation.y = Math.atan2(-dz, dx);
    g.add(mesh(woodBox(L, 0.09, 0.09), M.wood, 0, 0.15, 0));
    g.add(mesh(woodBox(L, 0.1, 0.1), M.wood, 0, FH - 0.05, 0));
    const t = wireTex.clone(); t.needsUpdate = true; t.repeat.set(L / 0.16, (FH - 0.3) / 0.16);
    const m = mesh(new THREE.PlaneGeometry(L, FH - 0.3), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 }), 0, 0.62, 0);
    m.userData.noPick = true; m.castShadow = false;
    g.add(m);
    return g;
  }
  const fp = (x, z, h = FH + 0.08) => {
    const g = new THREE.Group();
    g.add(mesh(woodBox(0.14, h, 0.14), M.wood, x, h / 2, z));
    return g;
  };
  const FX = 3.4, FZ = 2.3;
  fence.add(fenceSegment(-FX, -FZ, FX, -FZ));
  fence.add(fenceSegment(-FX, -FZ, -FX, FZ));
  fence.add(fenceSegment(FX, -FZ, FX, FZ));
  fence.add(fenceSegment(-FX, FZ, 0.1, FZ));
  fence.add(fenceSegment(1.6, FZ, FX, FZ));
  [[-FX, -FZ], [FX, -FZ], [-FX, FZ], [FX, FZ], [0, -FZ], [-FX, 0], [FX, 0], [-1.7, FZ], [2.5, FZ]].forEach(([x, z]) => fence.add(fp(x, z)));
  // tiang gerbang
  [0.1, 1.6].forEach((x) => {
    const g = new THREE.Group();
    g.add(mesh(woodBox(0.2, 1.45, 0.2), M.wood, x, 0.725, FZ));
    g.add(mesh(new THREE.BoxGeometry(0.28, 0.06, 0.28), M.black, x, 1.48, FZ));
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), M.black, x, 0.025, FZ));
    fence.add(g);
  });
  put(fence, 'rangka');
  // daun gerbang (dapat dibuka)
  const gatePivot = new THREE.Group();
  gatePivot.position.set(1.5, 0, FZ);
  {
    const W = 1.3, H = 1.0;
    const gl = new THREE.Group();
    gl.add(mesh(woodBox(0.1, H, 0.08), M.wood, -0.05, 0.18 + H / 2, 0));
    gl.add(mesh(woodBox(0.1, H, 0.08), M.wood, -W + 0.05, 0.18 + H / 2, 0));
    gl.add(mesh(woodBox(W, 0.1, 0.08), M.wood, -W / 2, 0.2, 0));
    gl.add(mesh(woodBox(W, 0.1, 0.08), M.wood, -W / 2, 0.18 + H - 0.05, 0));
    const diag = mesh(woodBox(Math.hypot(W, H) - 0.2, 0.09, 0.07), M.wood, -W / 2, 0.18 + H / 2, 0.01);
    diag.rotation.z = Math.atan2(H - 0.1, -W); gl.add(diag);
    const t = wireTex.clone(); t.needsUpdate = true; t.repeat.set(W / 0.16, (H - 0.2) / 0.16);
    const m = mesh(new THREE.PlaneGeometry(W - 0.2, H - 0.15), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 }), -W / 2, 0.18 + H / 2, 0);
    m.userData.noPick = true; gl.add(m);
    gl.add(mesh(new THREE.BoxGeometry(0.06, 0.2, 0.1), M.black, -0.02, 1.0, 0));
    gl.traverse((c) => { if (c.isMesh && !c.userData.noPick) c.userData.gate = true; });
    shade(gl, true, true);
    gatePivot.add(gl);
  }
  root.add(gatePivot);

  /* ----------------------- Rak NFT: pipa, rangka, tanaman ----------------------- */
  const rak = new THREE.Group();
  // pipa utama tiap tingkat
  TIERS.forEach((t) => {
    const a = V(PIPE_XR, t.y, t.z), b = V(PIPE_XL, t.y, t.z);
    rak.add(pipePath([a, b], PIPE_R, M.pipeWhite, { c1: '#3b9cf0', c2: '#bfe7ff', waterR: 0.6, joints: false }));
    [PIPE_XR + 0.01, PIPE_XL - 0.01].forEach((x) => {
      const cap = mesh(new THREE.CylinderGeometry(PIPE_R + 0.012, PIPE_R + 0.012, 0.06, 20), M.pipeWhite, x, t.y, t.z);
      cap.rotation.z = Math.PI / 2; rak.add(cap);
    });
  });
  // rangka A-frame penopang pipa
  const rods = new THREE.Group();
  const rod = (a, b, r = 0.04, mat = M.frame) => {
    const d = b.clone().sub(a), L = d.length();
    const m = mesh(new THREE.CylinderGeometry(r, r, L, 10), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    return m;
  };
  [-1.9, 0, 1.9].forEach((x) => {
    const A = TIERS.map((t) => V(x, t.y - 0.22, t.z));
    for (let i = 0; i < A.length - 1; i++) rods.add(rod(A[i], A[i + 1]));
    const f = V(x, 0.04, A[3].z + 0.25), bk = V(x, 0.04, A[0].z - 0.4);
    rods.add(rod(A[3], f)); rods.add(rod(A[0], bk)); rods.add(rod(f, bk));
    TIERS.forEach((t) => {
      const ring = mesh(new THREE.TorusGeometry(PIPE_R + 0.035, 0.026, 8, 24), M.frame, x, t.y, t.z);
      ring.rotation.y = Math.PI / 2; rods.add(ring);
    });
    [A[0], A[1], A[2], A[3], f, bk].forEach((p) => rods.add(mesh(new THREE.SphereGeometry(0.052, 10, 8), M.frame, p.x, p.y, p.z)));
  });
  rak.add(rods);

  /* Tanaman: daun ber-instance */
  function leafGeometry() {
    const g = new THREE.SphereGeometry(0.5, 12, 8);
    g.scale(0.95, 0.1, 1.0);
    g.translate(0, 0, 0.5);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, p.getY(i) + 0.3 * x * x - 0.16 * z * z);
    }
    g.computeVertexNormals();
    return g;
  }
  const leafGeo = leafGeometry();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, side: THREE.DoubleSide });
  const leaves = [];
  const cups = [];
  TIERS.forEach((t, ti) => {
    for (let k = 0; k < 9; k++) {
      const x = -2.0 + k * 0.5;
      const base = V(x, t.y + PIPE_R + 0.05, t.z);
      cups.push(base.clone());
      const bok = ti >= 2;
      const count = bok ? 16 : 21;
      const phase = rand() * 6.28;
      for (let j = 0; j < count; j++) {
        const layer = j % 3;
        const tilt = [1.0, 0.75, 0.5][layer] + rand() * 0.18;
        const len = [0.2, 0.27, 0.33][layer] * (0.88 + rand() * 0.24) * (bok ? 1.1 : 1);
        const wf = bok ? 0.8 : 1.0;
        const yaw = j * 2.399 + rand() * 0.35;
        const col = new THREE.Color().setHSL(0.26 + rand() * 0.07 + (bok ? 0.0 : 0.01), 0.55 + rand() * 0.15, [0.46, 0.38, 0.32][layer] + rand() * 0.07);
        leaves.push({ base, tilt, len, wf, yaw, col, phase, delay: ti * 0.1 + k * 0.035 });
      }
    }
  });
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length);
  leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leaves.forEach((l, i) => leafMesh.setColorAt(i, l.col));
  leafMesh.instanceColor.needsUpdate = true;
  leafMesh.frustumCulled = false;
  leafMesh.userData.hotspot = 'rak';
  rak.add(leafMesh);
  const cupMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.095, 0.065, 0.1, 14), M.cup, cups.length);
  const _m = new THREE.Matrix4();
  cups.forEach((p, i) => { _m.makeTranslation(p.x, p.y - 0.03, p.z); cupMesh.setMatrixAt(i, _m); });
  rak.add(cupMesh);
  put(rak, 'rak');
  leafMesh.castShadow = true; leafMesh.receiveShadow = true;

  const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function updateLeaves(t, intro) {
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];
      const g = easeOutBack(clamp01((intro * 1.7 - l.delay) / 0.7)) * 1;
      const sw = Math.sin(t * 1.1 + l.phase) * 0.035 * (0.4 + l.len);
      _e.set(-l.tilt + sw, l.yaw, 0);
      _q.setFromEuler(_e);
      _s.set(l.len * l.wf * g, l.len * g, l.len * g);
      _m.compose(l.base, _q, _s);
      leafMesh.setMatrixAt(i, _m);
    }
    leafMesh.instanceMatrix.needsUpdate = true;
  }

  /* --------------------------- Tandon nutrisi (tub) --------------------------- */
  const tank = new THREE.Group();
  const TK = { x: 2.2, z: 1.6, w: 1.3, d: 0.85, h: 0.46 };
  const tubMat = new THREE.MeshStandardMaterial({ color: 0xf7f9f9, roughness: 0.4 });
  tank.add(mesh(new THREE.BoxGeometry(TK.w, 0.05, TK.d), tubMat, TK.x, 0.025, TK.z));
  tank.add(mesh(new THREE.BoxGeometry(TK.w, TK.h, 0.05), tubMat, TK.x, TK.h / 2, TK.z - TK.d / 2 + 0.025));
  tank.add(mesh(new THREE.BoxGeometry(TK.w, TK.h, 0.05), tubMat, TK.x, TK.h / 2, TK.z + TK.d / 2 - 0.025));
  tank.add(mesh(new THREE.BoxGeometry(0.05, TK.h, TK.d), tubMat, TK.x - TK.w / 2 + 0.025, TK.h / 2, TK.z));
  tank.add(mesh(new THREE.BoxGeometry(0.05, TK.h, TK.d), tubMat, TK.x + TK.w / 2 - 0.025, TK.h / 2, TK.z));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => tank.add(mesh(new THREE.BoxGeometry(0.1, 0.05, 0.1), M.frame, TK.x + sx * (TK.w / 2 - 0.02), TK.h, TK.z + sz * (TK.d / 2 - 0.02))));
  // lis atas
  tank.add(mesh(new THREE.BoxGeometry(TK.w + 0.06, 0.035, 0.06), tubMat, TK.x, TK.h + 0.005, TK.z - TK.d / 2));
  tank.add(mesh(new THREE.BoxGeometry(TK.w + 0.06, 0.035, 0.06), tubMat, TK.x, TK.h + 0.005, TK.z + TK.d / 2));
  tank.add(mesh(new THREE.BoxGeometry(0.06, 0.035, TK.d), tubMat, TK.x - TK.w / 2, TK.h + 0.005, TK.z));
  tank.add(mesh(new THREE.BoxGeometry(0.06, 0.035, TK.d), tubMat, TK.x + TK.w / 2, TK.h + 0.005, TK.z));
  put(tank, 'tandon');
  // permukaan air
  const waterSurf = mesh(new THREE.PlaneGeometry(TK.w - 0.1, TK.d - 0.1), new THREE.MeshPhysicalMaterial({ color: 0x4aaef2, roughness: 0.1, transparent: true, opacity: 0.88, clearcoat: 1 }), TK.x, 0.37, TK.z);
  waterSurf.rotation.x = -Math.PI / 2; waterSurf.userData.hotspot = 'tandon';
  root.add(waterSurf);
  // riak air
  const ripples = [0, 1, 2].map((i) => {
    const r = mesh(new THREE.RingGeometry(0.9, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), 1.7, 0.375, 1.4);
    r.rotation.x = -Math.PI / 2; r.userData.off = i / 3; root.add(r); return r;
  });
  // tetesan air
  const drops = [0, 1, 2, 3].map((i) => {
    const d = mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4aaef2, emissive: 0x2a8de0, emissiveIntensity: 0.5 }), 1.7, 0.4, 1.4);
    d.userData.off = i / 4; root.add(d); return d;
  });

  /* ------------------------ Jalur pipa: suplai & drain ------------------------ */
  const plumb = new THREE.Group();
  const SUP = { x: 2.45, z: 0.85 };
  // tandon -> pompa
  plumb.add(pipePath([V(SUP.x, 0.3, 1.38), V(SUP.x, 0.58, 1.38), V(SUP.x, 0.58, 1.0), V(SUP.x, 0.3, 1.0)], 0.04, M.pipeGray, { c1: '#2d8ee0', c2: '#9fd8ff' }));
  // riser suplai
  plumb.add(pipePath([V(SUP.x, 0.3, SUP.z), V(SUP.x, 2.35, SUP.z)], 0.05, M.pipeGray, { c1: '#2d8ee0', c2: '#9fd8ff' }));
  TIERS.forEach((t) => {
    plumb.add(pipePath([V(SUP.x, t.y, SUP.z), V(SUP.x, t.y, t.z), V(PIPE_XR, t.y, t.z)], 0.045, M.pipeGray, { c1: '#2d8ee0', c2: '#9fd8ff' }));
  });
  // drain tiap tingkat -> riser kiri -> lantai -> tandon
  const DZ = 1.05, DX = -2.6;
  TIERS.forEach((t) => {
    plumb.add(pipePath([V(PIPE_XL, t.y, t.z), V(DX, t.y, t.z), V(DX, t.y, DZ)], 0.045, M.pipeGray, { c1: '#1f84b5', c2: '#8fe0d8' }));
  });
  plumb.add(pipePath([V(DX, 2.35, DZ), V(DX, 0.12, DZ), V(1.2, 0.12, DZ), V(1.2, 0.52, DZ), V(1.2, 0.52, 1.4), V(1.7, 0.52, 1.4)], 0.05, M.pipeGray, { c1: '#1f84b5', c2: '#8fe0d8' }));
  put(plumb, 'pompa');

  /* ------------------------------- Pompa air ------------------------------- */
  function makePump(x, z, id) {
    const g = new THREE.Group();
    const motor = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 18), M.black, 0, 0.17, 0.0);
    motor.rotation.x = Math.PI / 2;
    const head = mesh(new THREE.BoxGeometry(0.2, 0.2, 0.16), M.darkGray, 0, 0.17, -0.19);
    const inlet = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10), M.white, 0, 0.3, -0.19);
    const outlet = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10), M.white, 0.08, 0.2, -0.28);
    outlet.rotation.z = -Math.PI / 2;
    const foot = mesh(new THREE.BoxGeometry(0.26, 0.04, 0.5), M.black, 0, 0.02, -0.05);
    const cap = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 14), new THREE.MeshStandardMaterial({ color: 0x1d6fd1, roughness: 0.4 }), 0, 0.17, 0.14);
    cap.rotation.x = Math.PI / 2;
    g.add(motor, head, inlet, outlet, foot, cap);
    g.position.set(x, 0.0, z);
    g.position.z += 0.13;
    return g;
  }
  put(makePump(SUP.x, SUP.z, 'pompa'), 'pompa');
  put(makePump(2.85, SUP.z, 'pompa'), 'pompa');

  /* ----------------------------- Sensor RO (jalur) ----------------------------- */
  {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.2, 16), M.white, SUP.x, 0.86, SUP.z));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.12, 0.16), M.white, SUP.x, 0.86, SUP.z + 0.1));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: 0x1d6fd1 }), SUP.x, 0.88, SUP.z + 0.185));
    put(g, 'ro');
  }

  /* --------------------------- Sensor pH & EC di tandon --------------------------- */
  {
    const g = new THREE.Group();
    const bx = 1.86, bz = 1.28;
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.05, 0.28), M.white, bx + 0.04, 0.47, bz - 0.03));
    [[bx, bz], [bx + 0.09, bz + 0.03]].forEach(([x, z], i) => {
      g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.6, 10), M.black, x, 0.47, z));
      g.add(mesh(new THREE.CylinderGeometry(0.024, 0.016, 0.1, 10), i ? M.silver : new THREE.MeshStandardMaterial({ color: 0xe8a21a, roughness: 0.4 }), x, 0.14, z));
    });
    const probeBox = mesh(new THREE.BoxGeometry(0.22, 0.14, 0.12), M.white, bx + 0.05, 0.84, bz - 0.04);
    g.add(probeBox);
    put(g, 'ph');
    const cable = new THREE.CatmullRomCurve3([V(bx + 0.05, 0.9, bz - 0.04), V(1.85, 1.0, 1.55), V(2.5, 1.0, 2.15), V(3.1, 0.9, 1.4), V(3.08, 0.8, 0.7), V(2.98, 1.3, 0.6), V(2.95, 1.58, 0.58)]);
    const cm = mesh(new THREE.TubeGeometry(cable, 60, 0.012, 6, false), M.black);
    put(cm, 'ph', root, false);
  }

  /* ----------------------- Kotak IoT Gateway + baterai ----------------------- */
  const BOX = { x: 2.95, z: 0.54 };
  {
    const g = new THREE.Group();
    g.add(mesh(woodBox(0.15, 2.6, 0.15), M.wood, BOX.x, 1.3, 0.38)); // tiang
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.05, 0.34), M.black, BOX.x, 0.025, 0.38));
    put(g, 'gateway');
    const box = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(0.58, 0.82, 0.2), new THREE.MeshStandardMaterial({ color: 0xf5f7f7, roughness: 0.35 }), 0, 0, 0);
    box.add(body);
    const screenTex = canvasTex(256, 320, (c, w, h) => {
      c.fillStyle = '#10243f'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#18365f'; c.fillRect(14, 14, w - 28, 150);
      c.strokeStyle = '#4ad07a'; c.lineWidth = 4; c.beginPath();
      c.moveTo(24, 130); c.lineTo(70, 100); c.lineTo(110, 118); c.lineTo(150, 60); c.lineTo(190, 84); c.lineTo(232, 40); c.stroke();
      c.fillStyle = '#e8f1ff'; c.font = 'bold 20px sans-serif'; c.fillText('SMART BAJO', 56, 205);
      c.fillStyle = '#3ecf6b';
      c.beginPath(); c.arc(128, 262, 30, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(128, 262, 10, 17, 0.7, 0, 7); c.fill();
    });
    const screen = mesh(new THREE.PlaneGeometry(0.44, 0.55), new THREE.MeshBasicMaterial({ map: screenTex }), 0, 0.0, 0.102);
    box.add(screen);
    const led = mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3ecf6b, emissive: 0x3ecf6b, emissiveIntensity: 1.5 }), 0.2, 0.35, 0.102);
    box.add(led); root.userData.led = led;
    [-0.15, 0.15].forEach((x, i) => {
      const a = mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.34, 8), M.black, x, 0.55, -0.02);
      a.rotation.z = i ? -0.12 : 0.12; box.add(a);
      box.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), M.black, x + (i ? -0.01 : 0.01), 0.41, -0.02));
    });
    box.position.set(BOX.x, 1.95, BOX.z);
    box.rotation.y = -0.08;
    put(box, 'gateway');
    // baterai
    const bat = new THREE.Group();
    bat.add(mesh(new THREE.BoxGeometry(0.46, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x252a30, roughness: 0.5 }), 0, 0.17, 0));
    bat.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.01), new THREE.MeshStandardMaterial({ color: 0x3ecf6b, emissive: 0x2fae56, emissiveIntensity: 0.6 }), 0, 0.2, 0.155));
    bat.position.set(BOX.x + 0.05, 0.0, 0.62);
    put(bat, 'surya');
  }
  // sprite wifi
  const wifiTex = canvasTex(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#1d6fd1'; c.lineWidth = 9; c.lineCap = 'round';
    [26, 44, 62].forEach((r) => { c.beginPath(); c.arc(64, 98, r, Math.PI * 1.22, Math.PI * 1.78); c.stroke(); });
    c.fillStyle = '#1d6fd1'; c.beginPath(); c.arc(64, 98, 7, 0, 7); c.fill();
  });
  const wifi = new THREE.Sprite(new THREE.SpriteMaterial({ map: wifiTex, transparent: true, depthWrite: false }));
  wifi.position.set(BOX.x, 2.88, BOX.z); wifi.scale.set(0.55, 0.55, 1);
  root.add(wifi);

  /* ----------------------------- Sensor suhu & RH ----------------------------- */
  {
    const g = new THREE.Group();
    g.add(mesh(woodBox(0.1, 1.9, 0.1), M.wood, -2.85, 0.95, -0.3));
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.05, 0.34), M.black, -2.85, 0.025, -0.3));
    const sh = new THREE.Group();
    sh.add(mesh(new THREE.BoxGeometry(0.24, 0.34, 0.13), M.white, 0, 0, 0));
    for (let i = 0; i < 5; i++) sh.add(mesh(new THREE.BoxGeometry(0.2, 0.012, 0.02), M.darkGray, 0, -0.1 + i * 0.05, 0.072));
    sh.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), M.silver, 0.06, -0.23, 0));
    sh.position.set(-2.85, 1.65, -0.24);
    g.add(sh);
    put(g, 'suhu');
  }

  /* ------------------------------- Panel surya ------------------------------- */
  {
    const g = new THREE.Group();
    const W = 2.15, D = 1.15;
    const cellTex = canvasTex(512, 280, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#173a7c'); gr.addColorStop(1, '#0c2352');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(190,215,255,0.55)'; c.lineWidth = 2;
      for (let i = 1; i < 12; i++) { c.beginPath(); c.moveTo(i * w / 12, 0); c.lineTo(i * w / 12, h); c.stroke(); }
      for (let j = 1; j < 6; j++) { c.beginPath(); c.moveTo(0, j * h / 6); c.lineTo(w, j * h / 6); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
      for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(i * w / 12 + w / 24, 0); c.lineTo(i * w / 12 + w / 24, h); c.stroke(); }
    });
    cellTex.anisotropy = 16;
    const pf = mesh(new THREE.BoxGeometry(W, 0.06, D), M.silver, 0, 0, 0);
    const face = mesh(new THREE.PlaneGeometry(W - 0.1, D - 0.1), new THREE.MeshStandardMaterial({ map: cellTex, roughness: 0.18, metalness: 0.35 }), 0, 0.032, 0);
    face.rotation.x = -Math.PI / 2;
    g.add(pf, face);
    g.position.set(1.5, 3.62, -1.0);
    g.rotation.x = 0.45;
    put(g, 'surya');
    const legs = new THREE.Group();
    [0.75, -0.75].forEach((dx) => {
      legs.add(rod(V(1.5 + dx, 3.27, -1.5), V(1.5 + dx, 3.83, -1.5), 0.028, M.silver));
      legs.add(rod(V(1.5 + dx, 3.22, -0.5), V(1.5 + dx, 3.36, -0.5), 0.028, M.silver));
    });
    put(legs, 'surya');
  }

  /* -------------------------------- Update -------------------------------- */
  let gateAngle = 0, gateTarget = 0;
  const gateLeaf = gatePivot;
  let t0 = null;
  const _xray = { on: true };

  function setXray(on) {
    _xray.on = on;
    [M.pipeWhite, M.pipeGray].forEach((m) => { m.opacity = on ? 0.42 : 1; m.depthWrite = !on; m.transparent = on; m.needsUpdate = true; });
    waters.forEach((w) => { w.visible = on; });
  }
  setXray(true);

  function update(t, dt) {
    if (t0 === null) t0 = t;
    uTime.value = t;
    const intro = (t - t0) / 2.6;
    updateLeaves(t, intro);
    const led = root.userData.led;
    if (led) led.material.emissiveIntensity = 0.8 + 1.2 * (0.5 + 0.5 * Math.sin(t * 5));
    const k = (t * 0.9) % 1;
    wifi.material.opacity = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.2));
    wifi.position.y = 2.88 + 0.05 * Math.sin(t * 2);
    drops.forEach((d) => {
      const f = (t * 1.1 + d.userData.off) % 1;
      d.position.y = 0.5 - f * 0.12;
      d.visible = _xray.on || true;
      d.scale.setScalar(f < 0.98 ? 1 : 0);
    });
    ripples.forEach((r) => {
      const f = (t * 0.7 + r.userData.off) % 1;
      r.scale.setScalar(0.04 + f * 0.28);
      r.material.opacity = (1 - f) * 0.55;
    });
    gateAngle += (gateTarget - gateAngle) * Math.min(1, dt * 4);
    gateLeaf.rotation.y = gateAngle;
    void k;
  }

  return {
    root,
    update,
    setXray,
    toggleGate() { gateTarget = gateTarget > 0.1 ? 0 : 1.25; },
  };
}
