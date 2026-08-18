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
