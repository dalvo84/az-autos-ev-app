// Low-poly figures and recurring props.

import * as THREE from '../vendor/three.module.js';

const SKIN = 0xe8b58a;

function mat(colour, opts = {}) {
  return new THREE.MeshLambertMaterial({ color: colour, ...opts });
}

// A stylised person. `height` is in metres; everything scales off it.
export function makePerson({ colour = 0x4a7fb5, height = 1.75, skin = SKIN, hair = 0x3a2a1e } = {}) {
  const g = new THREE.Group();
  const h = height;
  const torsoH = h * 0.34;
  const legH = h * 0.42;
  const headR = h * 0.105;

  const legGeo = new THREE.CapsuleGeometry(h * 0.048, legH * 0.7, 3, 8);
  const legMat = mat(0x2f3a4a);
  for (const x of [-h * 0.055, h * 0.055]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, legH * 0.5, 0);
    leg.castShadow = true;
    g.add(leg);
  }

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.1, torsoH * 0.6, 4, 10), mat(colour));
  torso.position.y = legH + torsoH * 0.45;
  torso.castShadow = true;
  g.add(torso);

  const armGeo = new THREE.CapsuleGeometry(h * 0.035, torsoH * 0.62, 3, 8);
  const armMat = mat(colour);
  const arms = [];
  for (const x of [-h * 0.135, h * 0.135]) {
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(x, legH + torsoH * 0.5, 0);
    arm.castShadow = true;
    arms.push(arm);
    g.add(arm);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), mat(skin));
  head.position.y = legH + torsoH + headR * 0.85;
  head.castShadow = true;
  g.add(head);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.02, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hair));
  cap.position.copy(head.position);
  cap.position.y += headR * 0.06;
  g.add(cap);

  g.userData.parts = { head, torso, arms };
  g.userData.phase = Math.random() * Math.PI * 2;
  g.userData.kind = 'person';
  return g;
}

// Three foot six of red-and-blue soft toy. He turns up more than you would think.
export function makeBigToy(scale = 1) {
  const g = new THREE.Group();
  const h = 1.07 * scale; // three foot six
  const red = mat(0xd23b30);
  const blue = mat(0x2f5fb8);
  const skin = mat(0xf0c49a);

  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.15, h * 0.2, 4, 10), blue);
  legs.position.y = h * 0.22;
  legs.castShadow = true;
  g.add(legs);

  const body = new THREE.Mesh(new THREE.SphereGeometry(h * 0.26, 18, 14), blue);
  body.position.y = h * 0.46;
  body.scale.y = 0.9;
  body.castShadow = true;
  g.add(body);

  const shirt = new THREE.Mesh(new THREE.SphereGeometry(h * 0.2, 16, 12), red);
  shirt.position.y = h * 0.56;
  shirt.scale.set(1.06, 0.6, 1.02);
  g.add(shirt);

  for (const x of [-h * 0.26, h * 0.26]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.075, h * 0.16, 3, 8), red);
    arm.position.set(x, h * 0.55, 0);
    arm.rotation.z = x < 0 ? 0.5 : -0.5;
    arm.castShadow = true;
    g.add(arm);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(h * 0.085, 12, 10), mat(0xffffff));
    glove.position.set(x * 1.35, h * 0.42, 0);
    g.add(glove);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.24, 20, 16), skin);
  head.position.y = h * 0.82;
  head.castShadow = true;
  g.add(head);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(h * 0.08, 12, 10), skin);
  nose.position.set(0, h * 0.8, h * 0.21);
  g.add(nose);

  const tache = new THREE.Mesh(new THREE.BoxGeometry(h * 0.24, h * 0.05, h * 0.06), mat(0x4a2c19));
  tache.position.set(0, h * 0.74, h * 0.2);
  g.add(tache);

  const capDome = new THREE.Mesh(
    new THREE.SphereGeometry(h * 0.245, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), red);
  capDome.position.y = h * 0.85;
  g.add(capDome);

  const peak = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.16, h * 0.16, h * 0.02, 16, 1, false, 0, Math.PI), red);
  peak.position.set(0, h * 0.85, h * 0.13);
  peak.rotation.y = Math.PI;
  g.add(peak);

  for (const x of [-h * 0.09, h * 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(h * 0.035, 10, 8), mat(0x1b1b28));
    eye.position.set(x, h * 0.87, h * 0.19);
    g.add(eye);
  }

  g.userData.kind = 'toy';
  return g;
}

export function makeBall(radius = 0.12) {
  const g = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), mat(0xf5f5f5, { flatShading: true }));
  g.castShadow = true;
  g.userData.kind = 'ball';
  return g;
}

export function makeTree(rng, scale = 1) {
  const g = new THREE.Group();
  const trunkH = (1.6 + rng() * 1.4) * scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * scale, 0.16 * scale, trunkH, 7), mat(0x6b4a2f));
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const leafColours = [0x3f7d3a, 0x4b8f45, 0x356b32, 0x5a9c4e];
  const blobs = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    const r = (0.55 + rng() * 0.4) * scale;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0),
      mat(leafColours[Math.floor(rng() * leafColours.length)], { flatShading: true }));
    leaf.position.set((rng() - 0.5) * 0.7 * scale, trunkH + (rng() - 0.2) * 0.6 * scale, (rng() - 0.5) * 0.7 * scale);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

export function makeBuilding(rng, opts = {}) {
  const {
    w = 3 + rng() * 3, d = 3 + rng() * 3, h = 3 + rng() * 4,
    wall = 0xd8cfc0, roof = 0x8a4a3c, pitched = true, windows = true,
  } = opts;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(wall));
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  if (pitched) {
    const top = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.4, 4), mat(roof));
    top.position.y = h + h * 0.2;
    top.rotation.y = Math.PI / 4;
    top.castShadow = true;
    g.add(top);
  } else {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 0.06, d * 1.04), mat(roof));
    slab.position.y = h;
    g.add(slab);
  }

  if (windows) {
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const rows = Math.max(1, Math.floor(h / 1.6));
    const cols = Math.max(1, Math.floor(w / 1.4));
    for (let ry = 0; ry < rows; ry++) {
      for (let cx = 0; cx < cols; cx++) {
        if (rng() < 0.35) continue;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), winMat);
        win.position.set(-w / 2 + (cx + 0.5) * (w / cols), 0.9 + ry * 1.6, d / 2 + 0.02);
        g.add(win);
      }
    }
  }
  return g;
}

export function makeGoal(width = 3.2) {
  const g = new THREE.Group();
  const m = mat(0xf2f2f2);
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.1, 8);
  for (const x of [-width / 2, width / 2]) {
    const post = new THREE.Mesh(postGeo, m);
    post.position.set(x, 1.05, 0);
    post.castShadow = true;
    g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, width, 8), m);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 2.1;
  g.add(bar);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(width, 2.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
  net.position.set(0, 1.05, -0.7);
  g.add(net);
  return g;
}

export function makeSpeaker(scale = 1) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.9 * scale, 0.42 * scale), mat(0x24242c));
  box.position.y = 0.45 * scale;
  box.castShadow = true;
  g.add(box);
  for (const [y, r] of [[0.62, 0.14], [0.28, 0.19]]) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(r * scale, r * scale, 0.04 * scale, 16), mat(0x11111a));
    cone.rotation.x = Math.PI / 2;
    cone.position.set(0, y * scale, 0.22 * scale);
    g.add(cone);
  }
  g.userData.kind = 'speaker';
  return g;
}

export function makeMonitor() {
  const g = new THREE.Group();
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.06), mat(0x1a1a22));
  screen.position.y = 0.95;
  g.add(screen);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshBasicMaterial({ color: 0x5ad0ff }));
  glow.position.set(0, 0.95, 0.035);
  g.add(glow);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 0.5, 10), mat(0x33333d));
  stand.position.y = 0.35;
  g.add(stand);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.8), mat(0x8a6a45));
  desk.position.y = 0.6;
  desk.receiveShadow = true;
  g.add(desk);
  return g;
}

export function makeMic() {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), mat(0x2a2a32));
  stand.position.y = 0.7;
  g.add(stand);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 16), mat(0x2a2a32));
  base.position.y = 0.03;
  g.add(base);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), mat(0x9aa0aa));
  head.position.y = 1.42;
  g.add(head);
  return g;
}

export function makeBed() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.32, 2.05), mat(0x7a5c3d));
  frame.position.y = 0.16;
  frame.receiveShadow = true;
  g.add(frame);
  const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.18, 1.5), mat(0x4f7fb5));
  duvet.position.set(0, 0.38, 0.22);
  g.add(duvet);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 0.36), mat(0xf0efe8));
  pillow.position.set(0, 0.39, -0.76);
  g.add(pillow);
  return g;
}

export function updateActors(root, t) {
  root.traverse((obj) => {
    const kind = obj.userData && obj.userData.kind;
    if (kind === 'person') {
      const p = obj.userData.phase || 0;
      obj.position.y = (obj.userData.baseY || 0) + Math.sin(t * 1.6 + p) * 0.025;
      const parts = obj.userData.parts;
      if (parts) {
        parts.head.rotation.y = Math.sin(t * 0.7 + p) * 0.35;
        parts.arms[0].rotation.x = Math.sin(t * 1.5 + p) * 0.22;
        parts.arms[1].rotation.x = -Math.sin(t * 1.5 + p) * 0.22;
      }
    } else if (kind === 'ball') {
      obj.position.y = (obj.userData.baseY || 0.12) + Math.abs(Math.sin(t * 2.2)) * 0.5;
      obj.rotation.x += 0.03;
      obj.rotation.z += 0.02;
    } else if (kind === 'speaker') {
      const pulse = 1 + Math.abs(Math.sin(t * 4.5)) * 0.035;
      obj.scale.set(pulse, 1, pulse);
    }
  });
}

// ---------------------------------------------------------------------------
// Home fit-out. Everything below is placed by the wealth-tier style, so the
// same room reads as a damp flat or a hall with a grand piano in it.
// ---------------------------------------------------------------------------

export function makeSofa({ w = 2.8, colour = 0x5c6b7a, worn = false, sectional = false } = {}) {
  const g = new THREE.Group();
  const d = sectional ? 1.25 : 1;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.42, d), mat(colour));
  seat.position.y = 0.36;
  seat.castShadow = true;
  seat.receiveShadow = true;
  g.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(w, 0.62, 0.26), mat(shade(colour, -0.12)));
  back.position.set(0, 0.68, -d / 2 + 0.13);
  back.castShadow = true;
  g.add(back);

  for (const x of [-w / 2 + 0.13, w / 2 - 0.13]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, d), mat(shade(colour, -0.06)));
    arm.position.set(x, 0.6, 0);
    g.add(arm);
  }

  // Cushions, and on a worn sofa they sag and do not match.
  const cushions = Math.max(2, Math.round(w / 0.95));
  for (let i = 0; i < cushions; i++) {
    const cw = (w - 0.5) / cushions - 0.06;
    const c = new THREE.Mesh(new THREE.BoxGeometry(cw, worn ? 0.1 : 0.16, d - 0.3),
      mat(shade(colour, worn ? (i % 2 ? -0.18 : 0.06) : 0.05)));
    c.position.set(-w / 2 + 0.25 + cw / 2 + i * ((w - 0.5) / cushions), worn ? 0.6 : 0.64, 0.04);
    g.add(c);
  }

  if (sectional) {
    const chaise = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 1.9), mat(colour));
    chaise.position.set(w / 2 - 0.65, 0.36, d / 2 + 0.65);
    chaise.castShadow = true;
    g.add(chaise);
  }
  return g;
}

export function makeArmchair(colour = 0x5c6b7a) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), mat(colour));
  seat.position.y = 0.34;
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.2), mat(shade(colour, -0.12)));
  back.position.set(0, 0.64, -0.35);
  g.add(back);
  for (const x of [-0.4, 0.4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.9), mat(shade(colour, -0.06)));
    arm.position.set(x, 0.55, 0);
    g.add(arm);
  }
  return g;
}

export function makeMattress(colour = 0x8a8175) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 1.1), mat(colour));
  pad.position.y = 0.08;
  pad.receiveShadow = true;
  g.add(pad);
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.95), mat(0x6b5f7a));
  blanket.position.set(0.1, 0.2, 0.02);
  blanket.rotation.y = 0.08;
  g.add(blanket);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.34), mat(0xd8d2c4));
  pillow.position.set(-0.6, 0.22, -0.1);
  g.add(pillow);
  return g;
}

export function makeTv({ w = 1.6, wall = false } = {}) {
  const g = new THREE.Group();
  const h = w * 0.58;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), mat(0x15161c));
  panel.position.y = wall ? 0 : h / 2 + 0.55;
  g.add(panel);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.9),
    new THREE.MeshBasicMaterial({ color: 0x1d2b3a }));
  screen.position.set(0, panel.position.y, 0.04);
  g.add(screen);
  if (!wall) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.5, 0.4), mat(0x3a3a44));
    stand.position.y = 0.25;
    stand.castShadow = true;
    g.add(stand);
  }
  return g;
}

export function makeLowTable({ w = 1.5, colour = 0x7a5a38 } = {}) {
  const g = new THREE.Group();
  const d = w * 0.55;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), mat(colour));
  top.position.y = 0.45;
  top.castShadow = true;
  g.add(top);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), mat(shade(colour, -0.1)));
    leg.position.set(x * (w / 2 - 0.12), 0.2, z * (d / 2 - 0.1));
    g.add(leg);
  }
  return g;
}

export function makeCrate(colour = 0xa8895c) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.5), mat(colour));
  g.position.y = 0.225;
  g.castShadow = true;
  return g;
}

export function makeRug(rng, { w = 3, d = 2, colour = 0x7a4a3c } = {}) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(colour));
  g.rotation.x = -Math.PI / 2;
  g.position.y = 0.015;
  return g;
}

export function makeBulb() {
  const g = new THREE.Group();
  const flex = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), mat(0x2a2a2a));
  flex.position.y = -0.25;
  g.add(flex);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe7ae }));
  bulb.position.y = -0.55;
  g.add(bulb);
  const light = new THREE.PointLight(0xffdb96, 18, 8, 2);
  light.position.y = -0.55;
  g.add(light);
  return g;
}

export function makeShadeLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.4, 8), mat(0x4a4a52));
  pole.position.y = 0.7;
  g.add(pole);
  const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.3, 12, 1, true), mat(0xe8dcc0));
  shadeMesh.position.y = 1.5;
  g.add(shadeMesh);
  const light = new THREE.PointLight(0xffdcae, 22, 7, 2);
  light.position.y = 1.4;
  g.add(light);
  return g;
}

export function makeChandelier() {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), mat(0xc9a24a));
  rod.position.y = -0.55;
  g.add(rod);
  for (const [r, y] of [[0.95, -1.15], [0.62, -1.5]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.055, 6, 22), mat(0xd9b45c));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
    const drops = Math.round(r * 14);
    for (let i = 0; i < drops; i++) {
      const a = (i / drops) * Math.PI * 2;
      const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.13),
        new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
      drop.position.set(Math.cos(a) * r, y - 0.22, Math.sin(a) * r);
      g.add(drop);
    }
  }
  const light = new THREE.PointLight(0xffe6b8, 150, 24, 2);
  light.position.y = -1.3;
  g.add(light);
  return g;
}

export function makeFloorLamp() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 14), mat(0x38383f));
  g.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 8), mat(0x38383f));
  pole.position.y = 0.85;
  g.add(pole);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.3, 12, 1, true), mat(0xf0e2c4));
  head.position.y = 1.75;
  g.add(head);
  const light = new THREE.PointLight(0xffe0b0, 30, 8, 2);
  light.position.y = 1.6;
  g.add(light);
  return g;
}

export function makePiano() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 2.1), mat(0x14141a));
  body.position.y = 0.75;
  body.castShadow = true;
  g.add(body);
  const curve = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.3, 18, 1, false, 0, Math.PI), mat(0x14141a));
  curve.position.set(0, 0.75, 1.05);
  g.add(curve);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.5), mat(0x1c1c24));
  lid.position.set(0, 0.95, 0.4);
  lid.rotation.z = -0.35;
  g.add(lid);
  const keys = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.07, 0.3), mat(0xf4f1e8));
  keys.position.set(0, 0.76, -1);
  g.add(keys);
  for (const x of [-0.6, 0.6, 0]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), mat(0x14141a));
    leg.position.set(x, 0.3, x === 0 ? 0.9 : -0.8);
    g.add(leg);
  }
  const stool = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.3), mat(0x2a2118));
  stool.position.set(0, 0.5, -1.6);
  g.add(stool);
  return g;
}

export function makeFireplace() {
  const g = new THREE.Group();
  const surround = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 0.35), mat(0xe2ded4));
  surround.position.y = 0.75;
  g.add(surround);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.2), mat(0x1a1512));
  hole.position.set(0, 0.55, 0.16);
  g.add(hole);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 8),
    new THREE.MeshBasicMaterial({ color: 0xff9a3c }));
  fire.position.set(0, 0.4, 0.2);
  g.add(fire);
  const glow = new THREE.PointLight(0xff8a3a, 26, 7, 2);
  glow.position.set(0, 0.6, 0.6);
  g.add(glow);
  const mantel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.5), mat(0xf0ece2));
  mantel.position.y = 1.5;
  g.add(mantel);
  return g;
}

export function makeArt(rng, { w = 1.1, h = 0.85 } = {}) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), mat(0xc9a24a));
  g.add(frame);
  const palette = [0x8a4a52, 0x3f5a7a, 0x4a7a5c, 0x7a6a3f, 0x5c4a7a];
  const canvasArt = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.12),
    mat(palette[Math.floor(rng() * palette.length)]));
  canvasArt.position.z = 0.04;
  g.add(canvasArt);
  return g;
}

export function makePicture(rng) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.04), mat(0x4a4038));
  return g;
}

export function makePlant(scale = 1) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.16 * scale, 0.34 * scale, 10), mat(0xa8724a));
  pot.position.y = 0.17 * scale;
  pot.castShadow = true;
  g.add(pot);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26 * scale, 0),
      mat([0x3f7d3a, 0x4b8f45, 0x5a9c4e][i % 3], { flatShading: true }));
    leaf.position.set((i - 2) * 0.11 * scale, (0.5 + i * 0.11) * scale, ((i % 2) - 0.5) * 0.16 * scale);
    g.add(leaf);
  }
  return g;
}

export function makeIndoorTree() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.6, 14), mat(0xd8d2c4));
  pot.position.y = 0.3;
  g.add(pot);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.2, 8), mat(0x6b4a2f));
  trunk.position.y = 1.6;
  g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), mat(0x437d3d, { flatShading: true }));
    blob.position.set((i % 2 ? 0.4 : -0.4), 2.7 + (i * 0.3), (i < 2 ? 0.3 : -0.3));
    blob.castShadow = true;
    g.add(blob);
  }
  return g;
}

export function makeBookshelf() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.32), mat(0x6b4a2f));
  frame.position.y = 0.95;
  frame.castShadow = true;
  g.add(frame);
  const colours = [0x8a4a52, 0x3f5a7a, 0x4a7a5c, 0xb08a4a, 0x5c4a7a];
  for (let shelf = 0; shelf < 4; shelf++) {
    for (let b = 0; b < 8; b++) {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.22), mat(colours[(shelf + b) % colours.length]));
      book.position.set(-0.55 + b * 0.14, 0.35 + shelf * 0.45, 0.08);
      g.add(book);
    }
  }
  return g;
}

export function makeStairs() {
  const g = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 0.32), mat(0xd8d2c8));
    step.position.set(0, 0.16 + i * 0.22, -i * 0.32);
    step.castShadow = true;
    g.add(step);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3.4), mat(0xc9a24a));
  rail.position.set(0.78, 1.6, -1.5);
  rail.rotation.x = -0.6;
  g.add(rail);
  return g;
}

export function makeSculpture(rng) {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.6), mat(0xe8e4dc));
  plinth.position.y = 0.45;
  g.add(plinth);
  const form = new THREE.Mesh(new THREE.TorusKnotGeometry(0.28, 0.09, 48, 8), mat(0xc9a24a));
  form.position.y = 1.35;
  form.castShadow = true;
  g.add(form);
  return g;
}

export function makeClutter(rng, n = 6) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const kind = rng();
    let item;
    if (kind < 0.4) {
      item = new THREE.Mesh(new THREE.BoxGeometry(0.3 + rng() * 0.3, 0.24, 0.26), mat(0x9a7a52));
      item.position.y = 0.12;
    } else if (kind < 0.75) {
      item = new THREE.Mesh(new THREE.SphereGeometry(0.15 + rng() * 0.08, 8, 6), mat(0x5c5f6a));
      item.position.y = 0.15;
    } else {
      item = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 8), mat(0x7a8a6a));
      item.position.y = 0.13;
    }
    item.position.x = (rng() - 0.5) * 4;
    item.position.z = (rng() - 0.5) * 3;
    item.rotation.y = rng() * 3;
    g.add(item);
  }
  return g;
}

export function makeBucket() {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.28, 12), mat(0x4a5a6a));
  g.position.y = 0.14;
  return g;
}

// Damp blooms and peeling patches, laid flat against a wall plane.
export function makeDampPatches(rng, { w = 6, h = 2.4, n = 7 } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const r = 0.25 + rng() * 0.55;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(r, 9),
      new THREE.MeshBasicMaterial({ color: rng() < 0.5 ? 0x6f6a5c : 0x5b5348, transparent: true, opacity: 0.5 }));
    patch.position.set((rng() - 0.5) * (w - 1), 0.4 + rng() * (h - 0.8), 0.02);
    patch.scale.y = 0.6 + rng() * 0.7;
    g.add(patch);
  }
  return g;
}

function shade(colour, amount) {
  const c = new THREE.Color(colour);
  if (amount >= 0) c.lerp(new THREE.Color(0xffffff), amount);
  else c.lerp(new THREE.Color(0x000000), -amount);
  return c.getHex();
}
