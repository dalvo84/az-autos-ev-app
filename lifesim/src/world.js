// Every decision gets its own level, and every level gets its own 3D scene.
// These builders assemble a level out of low-poly parts, seeded so the same
// decision always looks the same.

import * as THREE from '../vendor/three.module.js';
import {
  makePerson, makeBigToy, makeBall, makeTree, makeBuilding, makeGoal,
  makeSpeaker, makeMonitor, makeMic, makeBed,
} from './actors.js';

const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

function groundPlane(colour, size = 90) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), M(colour));
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  return g;
}

// A dollhouse room: four walls whose normals point inward, so the wall between
// you and the room is back-face culled and you always get to look in.
function floorRoom(rng, { floor = 0xb08a5f, wall = 0xe8e2d6, w = 9, d = 9, h = 3.2 } = {}) {
  const g = new THREE.Group();

  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(w + 3, d + 3), M(0x1e222b));
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = -0.05;
  g.add(skirt);

  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M(floor));
  f.rotation.x = -Math.PI / 2;
  f.receiveShadow = true;
  g.add(f);

  const wallMat = M(wall);
  const walls = [
    { geo: [w, h], pos: [0, h / 2, -d / 2], rot: 0 },
    { geo: [w, h], pos: [0, h / 2, d / 2], rot: Math.PI },
    { geo: [d, h], pos: [-w / 2, h / 2, 0], rot: Math.PI / 2 },
    { geo: [d, h], pos: [w / 2, h / 2, 0], rot: -Math.PI / 2 },
  ];
  for (const cfg of walls) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.geo[0], cfg.geo[1]), wallMat);
    m.position.set(...cfg.pos);
    m.rotation.y = cfg.rot;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

function scatterTrees(g, rng, n, radius, inner = 8) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = inner + rng() * (radius - inner);
    const t = makeTree(rng, 0.8 + rng() * 0.7);
    t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(t);
  }
}

function crowd(g, rng, people, opts = {}) {
  const { radius = 4, y = 0, spread = Math.PI * 2, offset = 0 } = opts;
  people.forEach((p, i) => {
    const a = offset + (i / Math.max(1, people.length)) * spread + (rng() - 0.5) * 0.3;
    const r = radius * (0.75 + rng() * 0.5);
    const person = makePerson({ colour: p.colour, height: p.height || 1.7 });
    person.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    person.userData.baseY = y;
    person.rotation.y = -a + Math.PI / 2;
    g.add(person);
  });
}

// ---------------------------------------------------------------------------

const BUILDERS = {
  nursery(g, rng, ctx) {
    g.add(floorRoom(rng, { floor: 0xc7b299, wall: 0xf2e6ef, w: 8, d: 8 }));
    const cot = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.9), M(0xf7f3ea));
    cot.position.set(-1.2, 0.35, -1.6);
    cot.castShadow = true;
    g.add(cot);
    for (let i = 0; i < 8; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), M(0xe4dccb));
      bar.position.set(-1.85 + i * 0.19, 0.95, -1.18);
      g.add(bar);
    }
    const sp = makeSpeaker(1.1);
    sp.position.set(2.2, 0, -2.4);
    g.add(sp);
    const sp2 = makeSpeaker(1.1);
    sp2.position.set(-3.1, 0, -1.2);
    g.add(sp2);
    for (let i = 0; i < 12; i++) {
      const note = new THREE.Mesh(new THREE.TetrahedronGeometry(0.1),
        new THREE.MeshBasicMaterial({ color: 0xa78bfa }));
      note.position.set((rng() - 0.5) * 6, 1 + rng() * 2, (rng() - 0.5) * 5);
      note.userData.kind = 'note';
      g.add(note);
    }
    return { camera: [5.2, 3.6, 6.4], target: [-0.4, 0.9, -0.8], interior: true };
  },

  home(g, rng, ctx) {
    g.add(floorRoom(rng, { floor: 0xa87c52, wall: 0xece5d9, w: 10, d: 10 }));
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 1), M(0x5c6b7a));
    sofa.position.set(0, 0.35, -2.4);
    sofa.castShadow = true;
    g.add(sofa);
    const backRest = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.6, 0.28), M(0x4e5c6a));
    backRest.position.set(0, 0.85, -2.85);
    g.add(backRest);
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.8), M(0x7a5a38));
    table.position.set(0, 0.45, -0.9);
    table.castShadow = true;
    g.add(table);
    for (const [x, z] of [[-0.65, -0.55], [0.65, -0.55], [-0.65, -1.25], [0.65, -1.25]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), M(0x6a4d30));
      leg.position.set(x, 0.2, z);
      g.add(leg);
    }
    const tv = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.08), M(0x1b1b22));
    tv.position.set(0, 1.2, -4.85);
    g.add(tv);
    const sp = makeSpeaker(1);
    sp.position.set(2.3, 0, -4.2);
    g.add(sp);
    crowd(g, rng, ctx.people.slice(0, 4), { radius: 2.6, spread: Math.PI * 0.8, offset: Math.PI * 1.1 });
    return { camera: [6.4, 4.2, 7.2], target: [0, 0.9, -1.2], interior: true };
  },

  bedroom(g, rng, ctx) {
    g.add(floorRoom(rng, { floor: 0x9c7a55, wall: 0xdfe7f0, w: 7, d: 7 }));
    const bed = makeBed();
    bed.position.set(-1.5, 0, -1.2);
    bed.rotation.y = Math.PI / 2;
    g.add(bed);
    const desk = makeMonitor();
    desk.position.set(1.9, 0, -2.6);
    desk.rotation.y = -0.35;
    g.add(desk);
    if (ctx.flags.mario_friend || ctx.flags.mario_teammate || ctx.flags.mario_audience) {
      if (!ctx.flags.mario_loft || ctx.flags.mario_returns || ctx.flags.mario_forever || ctx.flags.mario_moves_in) {
        const toy = makeBigToy(1);
        toy.position.set(2.3, 0, 0.6);
        toy.rotation.y = -0.9;
        g.add(toy);
      }
    }
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.4), M(0x2b2b3a));
    poster.position.set(0.4, 1.9, -3.45);
    g.add(poster);
    return { camera: [5, 3.4, 5.8], target: [0.2, 0.9, -0.8], interior: true };
  },

  loft(g, rng, ctx) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), M(0x6a5540));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    // Rafters overhead, high enough to frame the space without hiding it.
    for (let i = -3; i <= 3; i++) {
      if (i === 0 || i === 1) continue; // leave a clear window over him
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 8.6), M(0x4a3c2b));
      rafter.position.set(i * 1.5, 4.1 - Math.abs(i) * 0.16, 0);
      g.add(rafter);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.18, 0.18), M(0x4a3c2b));
    ridge.position.set(0, 4.4, 0);
    g.add(ridge);

    // Boxes pushed out to the edges so the middle stays clear.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng() * 0.4;
      const r = 3 + rng() * 1.6;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.7 + rng() * 0.5, 0.5 + rng() * 0.45, 0.6 + rng() * 0.4),
        M(rng() < 0.5 ? 0xb08a5f : 0x9c7a4e));
      box.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r);
      box.rotation.y = rng() * 0.8;
      box.castShadow = true;
      g.add(box);
    }

    const toy = makeBigToy(1.15);
    toy.position.set(0, 0, -0.2);
    toy.rotation.y = 0.35;
    g.add(toy);

    // The torch beam: a spotlight plus a visible cone, aimed at him.
    const aim = new THREE.Object3D();
    aim.position.set(0, 0.6, -0.2);
    g.add(aim);
    const beam = new THREE.SpotLight(0xfff0c4, 90, 18, 0.34, 0.55, 1.4);
    beam.position.set(-2.6, 3.1, 3.4);
    beam.target = aim;
    beam.castShadow = true;
    g.add(beam);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 4.6, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0.045, side: THREE.DoubleSide }));
    cone.position.set(-1.3, 1.85, 1.6);
    cone.lookAt(0, 0.6, -0.2);
    cone.rotateX(Math.PI / 2);
    g.add(cone);

    // A little warm bounce so he is never a silhouette.
    const bounce = new THREE.PointLight(0xffd9a0, 14, 7, 2);
    bounce.position.set(0.6, 1.5, 1);
    g.add(bounce);

    return {
      camera: [4.4, 4.4, 6.2], target: [0, 0.75, -0.2],
      dark: true, sky: 0x14141e, fog: 0x14141e, interior: true,
    };
  },

  garden(g, rng, ctx) {
    g.add(groundPlane(0x6fa858));
    scatterTrees(g, rng, 9, 22, 6);
    const house = makeBuilding(rng, { w: 7, d: 6, h: 4.2, wall: 0xd9cdb8, roof: 0x8c4a3b });
    house.position.set(0, 0, -11);
    g.add(house);
    const ball = makeBall();
    ball.position.set(1.4, 0.12, 1.2);
    ball.userData.baseY = 0.12;
    g.add(ball);
    const slide = new THREE.Group();
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 3), M(0xd94f4f));
    ramp.position.set(0, 0.9, 0);
    ramp.rotation.x = -0.45;
    ramp.castShadow = true;
    slide.add(ramp);
    for (const x of [-0.35, 0.35]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 6), M(0x3f7fb5));
      leg.position.set(x, 0.85, -1.3);
      slide.add(leg);
    }
    slide.position.set(-3.4, 0, -1.5);
    g.add(slide);
    crowd(g, rng, ctx.people.slice(0, 5), { radius: 4.5, spread: Math.PI * 1.2, offset: Math.PI * 0.9 });
    return { camera: [6, 3.6, 7.5], target: [-0.5, 1, -1] };
  },

  village(g, rng, ctx) {
    g.add(groundPlane(0x6fa858, 140));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng() * 0.3;
      const r = 14 + rng() * 12;
      const b = makeBuilding(rng, { wall: rng() < 0.5 ? 0xdcd2bf : 0xc9b89d, roof: 0x7d4235 });
      b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      b.rotation.y = rng() * Math.PI;
      g.add(b);
    }
    const church = new THREE.Group();
    const nave = makeBuilding(rng, { w: 6, d: 10, h: 5, wall: 0xcfc6b4, roof: 0x5c5750, windows: false });
    church.add(nave);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 11, 3), M(0xc4bba9));
    tower.position.set(0, 5.5, -5.5);
    tower.castShadow = true;
    church.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.4, 4), M(0x5c5750));
    spire.position.set(0, 12.6, -5.5);
    spire.rotation.y = Math.PI / 4;
    church.add(spire);
    church.position.set(-6, 0, -22);
    g.add(church);
    scatterTrees(g, rng, 16, 44, 10);
    crowd(g, rng, ctx.people.slice(0, 4), { radius: 5 });
    return { camera: [9, 5, 12], target: [-2, 2, -6] };
  },

  town(g, rng, ctx) {
    g.add(groundPlane(0x8a8f88, 140));
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 120), M(0x3a3d41));
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    g.add(road);
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const b = makeBuilding(rng, {
        w: 4 + rng() * 2, d: 5 + rng() * 3, h: 5 + rng() * 5,
        wall: [0xd6c7b0, 0xbfa98d, 0xc9c2b4][Math.floor(rng() * 3)],
        roof: 0x6b4038, pitched: rng() < 0.6,
      });
      b.position.set(side * (6.5 + rng() * 3), 0, -30 + i * 5 + rng() * 2);
      g.add(b);
    }
    scatterTrees(g, rng, 8, 26, 12);
    crowd(g, rng, ctx.people.slice(0, 5), { radius: 4.2, spread: Math.PI, offset: 0.4 });
    return { camera: [7.5, 4.2, 11], target: [0, 1.6, -4] };
  },

  school_lower(g, rng, ctx) { return schoolScene(g, rng, ctx, 0.85, 0xf0c14b); },
  school_mid(g, rng, ctx) { return schoolScene(g, rng, ctx, 1, 0x4f9de0); },
  school_high(g, rng, ctx) { return schoolScene(g, rng, ctx, 1.15, 0x6ec06a); },

  pitch(g, rng, ctx) {
    g.add(groundPlane(0x4f9e46, 160));
    const stripes = new THREE.Group();
    for (let i = -6; i <= 6; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 70), M(i % 2 === 0 ? 0x56a84c : 0x4b9743));
      s.rotation.x = -Math.PI / 2;
      s.position.set(i * 5, 0.02, 0);
      stripes.add(s);
    }
    g.add(stripes);
    const line = new THREE.Mesh(new THREE.RingGeometry(4.4, 4.6, 48), M(0xffffff));
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.03;
    g.add(line);
    const goal = makeGoal(7.4);
    goal.position.set(0, 0, -24);
    g.add(goal);
    const goal2 = makeGoal(7.4);
    goal2.position.set(0, 0, 24);
    goal2.rotation.y = Math.PI;
    g.add(goal2);
    const ball = makeBall(0.16);
    ball.position.set(0.6, 0.16, 1.4);
    ball.userData.baseY = 0.16;
    g.add(ball);
    crowd(g, rng, ctx.people.slice(0, 6), { radius: 7, spread: Math.PI * 1.4, offset: Math.PI * 0.8 });
    scatterTrees(g, rng, 10, 55, 32);
    return { camera: [8.5, 4.5, 12], target: [0, 1.2, -3] };
  },

  pool(g, rng, ctx) {
    g.add(floorRoom(rng, { floor: 0xcfd6dd, wall: 0xdfe9f2, w: 20, d: 16, h: 5 }));
    const water = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 8),
      new THREE.MeshLambertMaterial({ color: 0x2f9ed4, transparent: true, opacity: 0.85 }));
    water.position.set(0, 0.2, -1);
    g.add(water);
    for (let i = -2; i <= 2; i++) {
      const lane = new THREE.Mesh(new THREE.BoxGeometry(12, 0.05, 0.08), M(0xe8e34a));
      lane.position.set(0, 0.42, -1 + i * 1.6);
      g.add(lane);
    }
    for (let i = -2; i <= 2; i++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), M(0xe8e8ee));
      block.position.set(-6.6, 0.22, -1 + i * 1.6);
      block.castShadow = true;
      g.add(block);
    }
    crowd(g, rng, ctx.people.slice(0, 3), { radius: 5.6, spread: Math.PI * 0.6, offset: Math.PI * 1.3 });
    return { camera: [11, 6.2, 12], target: [0, 0.7, -1], interior: true };
  },

  ring(g, rng, ctx) {
    g.add(groundPlane(0x24242e, 70));
    const apron = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 9), M(0x2f3140));
    apron.position.y = 0.5;
    apron.castShadow = true;
    g.add(apron);
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.08, 8.6), M(0xe4e6ee));
    canvas.position.y = 1.02;
    g.add(canvas);
    const postMat = M(0xd93b3b);
    for (const [x, z] of [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.4, 10), postMat);
      post.position.set(x, 2.2, z);
      post.castShadow = true;
      g.add(post);
    }
    // Ropes run flat along each side: X-aligned pairs, then Z-aligned pairs.
    const ropeGeo = new THREE.CylinderGeometry(0.05, 0.05, 8.4, 6);
    const ropeMat = M(0xe8e8f0);
    for (let r = 0; r < 3; r++) {
      const y = 1.5 + r * 0.55;
      for (const z of [-4.2, 4.2]) {
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.rotation.z = Math.PI / 2;
        rope.position.set(0, y, z);
        g.add(rope);
      }
      for (const x of [-4.2, 4.2]) {
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.rotation.x = Math.PI / 2;
        rope.position.set(x, y, 0);
        g.add(rope);
      }
    }
    const spot = new THREE.SpotLight(0xffffff, 900, 40, 0.62, 0.5, 1.6);
    spot.position.set(0, 13, 0);
    spot.castShadow = true;
    g.add(spot);
    const rim = new THREE.PointLight(0xff9d6b, 220, 26, 2);
    rim.position.set(-7, 6, 7);
    g.add(rim);
    crowd(g, rng, ctx.people.slice(0, 6), { radius: 11, y: 0, spread: Math.PI * 2 });
    return { camera: [8, 5.5, 10], target: [0, 1.8, 0], dark: true, sky: 0x14141c, fog: 0x14141c, interior: true };
  },

  studio(g, rng, ctx) {
    g.add(floorRoom(rng, { floor: 0x3d3a44, wall: 0x2c2a34, w: 9, d: 9, h: 3.4 }));
    for (let i = 0; i < 24; i++) {
      const foam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.1), M(0x4a4654));
      foam.position.set(-4 + (i % 6) * 0.75, 1 + Math.floor(i / 6) * 0.7, -4.4);
      foam.rotation.z = Math.PI / 4;
      g.add(foam);
    }
    const mic = makeMic();
    mic.position.set(-0.6, 0, -1.2);
    g.add(mic);
    const desk = makeMonitor();
    desk.position.set(2.3, 0, -2.6);
    desk.rotation.y = -0.5;
    g.add(desk);
    const sp = makeSpeaker(0.8);
    sp.position.set(3.4, 0.68, -2);
    g.add(sp);
    crowd(g, rng, ctx.people.slice(0, 2), { radius: 2.8, spread: Math.PI * 0.5, offset: Math.PI * 1.2 });
    return { camera: [5.6, 3.6, 6.4], target: [0.2, 1.1, -1.2], dark: true, sky: 0x1a1822, fog: 0x1a1822, interior: true };
  },

  stage(g, rng, ctx) {
    g.add(groundPlane(0x1b1b26, 90));
    const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 7), M(0x33313d));
    deck.position.set(0, 0.6, -3);
    deck.castShadow = true;
    g.add(deck);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), M(0x171722));
    back.position.set(0, 4.5, -6.4);
    g.add(back);
    const mic = makeMic();
    mic.position.set(0, 1.2, -1.6);
    g.add(mic);
    const star = makePerson({ colour: 0xf0c14b, height: 1.75 });
    star.position.set(0, 1.2, -2.3);
    star.userData.baseY = 1.2;
    g.add(star);
    for (const [x, colour] of [[-4.5, 0xff4d6d], [-1.5, 0x4dd2ff], [1.5, 0xffd24d], [4.5, 0x9b6bff]]) {
      const l = new THREE.SpotLight(colour, 420, 30, 0.35, 0.4, 1.4);
      l.position.set(x, 8, -1);
      l.target.position.set(x * 0.3, 1.2, -3);
      g.add(l.target);
      g.add(l);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.09, side: THREE.DoubleSide }));
      beam.position.set(x * 0.6, 4.6, -2);
      g.add(beam);
    }
    crowd(g, rng, ctx.people, { radius: 6.5, spread: Math.PI, offset: 0.2 });
    for (let i = 0; i < 26; i++) {
      const p = makePerson({ colour: 0x3a3a4a, height: 1.6 + rng() * 0.25 });
      p.position.set((rng() - 0.5) * 16, 0, 2 + rng() * 9);
      p.userData.baseY = 0;
      g.add(p);
    }
    return { camera: [5.5, 4.2, 9], target: [0, 2, -2.5], dark: true, sky: 0x101018, fog: 0x101018, interior: true };
  },

  city(g, rng, ctx) {
    g.add(groundPlane(0x4a4d55, 200));
    for (let i = 0; i < 30; i++) {
      const a = rng() * Math.PI * 2;
      const r = 16 + rng() * 46;
      const h = 8 + rng() * 34;
      const b = makeBuilding(rng, {
        w: 4 + rng() * 5, d: 4 + rng() * 5, h,
        wall: [0x6b7280, 0x565d68, 0x7b8390][Math.floor(rng() * 3)],
        roof: 0x3f434b, pitched: false,
      });
      b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      g.add(b);
    }
    const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 200), M(0x2f3238));
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    g.add(road);
    crowd(g, rng, ctx.people.slice(0, 5), { radius: 5, spread: Math.PI * 1.6 });
    return { camera: [10, 6.5, 14], target: [0, 3, -4], sky: 0x8fa4bd };
  },

  office(g, rng, ctx) {
    g.add(floorRoom(rng, { floor: 0x5f6570, wall: 0xdfe4ea, w: 13, d: 11, h: 3.4 }));
    for (let i = 0; i < 5; i++) {
      const d = makeMonitor();
      d.position.set(-4.5 + i * 2.3, 0, -3 + (i % 2) * 2.2);
      d.rotation.y = (rng() - 0.5) * 0.5;
      g.add(d);
    }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.4), M(0xf7f7f2));
    board.position.set(0, 2, -5.4);
    g.add(board);
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4 + rng() * 1.4), M(0x4ade80));
      bar.position.set(-1.6 + i * 0.8, 1.3 + (0.4 + rng() * 1.4) / 2 - 0.6, -5.38);
      g.add(bar);
    }
    crowd(g, rng, ctx.people.slice(0, 5), { radius: 4, spread: Math.PI * 1.1, offset: Math.PI * 0.9 });
    return { camera: [8.5, 5.4, 9.5], target: [0, 1.2, -1.6], interior: true };
  },

  workshop(g, rng, ctx) {
    g.add(floorRoom(rng, { floor: 0x6b6b73, wall: 0x9aa0a8, w: 12, d: 10, h: 4.4 }));
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 1.2), M(0x8a6a45));
    bench.position.set(0, 0.9, -3);
    bench.castShadow = true;
    g.add(bench);
    for (const x of [-2, 2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 1.1), M(0x5a4a35));
      leg.position.set(x, 0.45, -3);
      g.add(leg);
    }
    for (let i = 0; i < 12; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), M(rng() < 0.5 ? 0xc08b4a : 0xa2743c));
      crate.position.set(-5 + rng() * 10, 0.4 + Math.floor(rng() * 2) * 0.8, -4.4 + rng() * 2);
      crate.rotation.y = rng() * 0.5;
      crate.castShadow = true;
      g.add(crate);
    }
    const d = makeMonitor();
    d.position.set(3, 0, -1.2);
    d.rotation.y = -0.7;
    g.add(d);
    crowd(g, rng, ctx.people.slice(0, 3), { radius: 3.4, spread: Math.PI * 0.8, offset: Math.PI });
    return { camera: [7.8, 5, 8.8], target: [0, 1.2, -1.6], interior: true };
  },

  home_modern(g, rng, ctx) {
    g.add(groundPlane(0x6d9f59, 120));
    const house = makeBuilding(rng, { w: 11, d: 8, h: 6, wall: 0xf0ece4, roof: 0x4a4d52, pitched: false });
    house.position.set(0, 0, -10);
    g.add(house);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.4),
      new THREE.MeshLambertMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.55 }));
    glass.position.set(0, 2, -5.95);
    g.add(glass);
    const patio = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), M(0xb9b3a6));
    patio.rotation.x = -Math.PI / 2;
    patio.position.set(0, 0.02, -2.5);
    g.add(patio);
    scatterTrees(g, rng, 7, 30, 12);
    crowd(g, rng, ctx.people, { radius: 4.6, spread: Math.PI * 1.5, offset: Math.PI * 0.7 });
    return { camera: [7, 4.2, 8.5], target: [0, 1.6, -4] };
  },

  stadium(g, rng, ctx) {
    g.add(groundPlane(0x4f9e46, 200));
    for (let i = -8; i <= 8; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 90), M(i % 2 === 0 ? 0x56a84c : 0x4b9743));
      s.rotation.x = -Math.PI / 2;
      s.position.set(i * 5, 0.02, 0);
      g.add(s);
    }
    const goal = makeGoal(7.4);
    goal.position.set(0, 0, -30);
    g.add(goal);
    for (const side of [-1, 1]) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 74), M(0x8a3b3b));
      stand.position.set(side * 30, 4.5, 0);
      stand.castShadow = true;
      g.add(stand);
      for (let r = 0; r < 5; r++) {
        const row = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 72), M(0xd0d6dd));
        row.position.set(side * (26.5 + r * 0.6), 2 + r * 1.5, 0);
        g.add(row);
      }
      for (const z of [-28, 28]) {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(1, 22, 1), M(0x9aa0a8));
        pylon.position.set(side * 34, 11, z);
        g.add(pylon);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff3cf }));
        lamp.position.set(side * 34, 22, z);
        g.add(lamp);
      }
    }
    const ball = makeBall(0.16);
    ball.position.set(0, 0.16, 0);
    ball.userData.baseY = 0.16;
    g.add(ball);
    crowd(g, rng, ctx.people.slice(0, 6), { radius: 9, spread: Math.PI * 1.5 });
    return { camera: [13, 7, 18], target: [0, 2, -6], sky: 0x7f9dc0 };
  },
};

function schoolScene(g, rng, ctx, scale, accent) {
  g.add(groundPlane(0x7ba85f, 140));
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(26, 20), M(0x8d8f92));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(0, 0.02, 2);
  g.add(yard);
  const block = makeBuilding(rng, {
    w: 18 * scale, d: 8, h: 4 + scale * 2.5, wall: 0xd8d2c4, roof: 0x5f5a52, pitched: scale < 1.1,
  });
  block.position.set(0, 0, -12);
  g.add(block);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.12), M(accent));
  door.position.set(0, 1.2, -8.05);
  g.add(door);
  const frame = new THREE.Group();
  const barMat = M(accent);
  for (const x of [-1.4, 1.4]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), barMat);
    post.position.set(x, 1.2, 0);
    frame.add(post);
  }
  for (let i = 0; i < 4; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 8), barMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.5 + i * 0.6, 0);
    frame.add(rung);
  }
  frame.position.set(-7, 0, 4);
  g.add(frame);
  const ball = makeBall(0.14);
  ball.position.set(3.2, 0.14, 3);
  ball.userData.baseY = 0.14;
  g.add(ball);
  scatterTrees(g, rng, 8, 40, 18);
  crowd(g, rng, ctx.people, { radius: 5.5, spread: Math.PI * 1.7, offset: Math.PI * 0.6 });
  return { camera: [8, 4.6, 11], target: [-1, 1.4, -3] };
}

export function buildLevel(sceneId, ctx, rng) {
  const group = new THREE.Group();
  const builder = BUILDERS[sceneId] || BUILDERS.home;
  const info = builder(group, rng, ctx) || {};
  return {
    group,
    camera: info.camera || [7, 4, 9],
    target: info.target || [0, 1.2, 0],
    sky: info.sky !== undefined ? info.sky : (ctx.place ? ctx.place.sky : 0x9ecbf0),
    fog: info.fog !== undefined ? info.fog : (info.sky !== undefined ? info.sky : (ctx.place ? ctx.place.sky : 0x9ecbf0)),
    dark: !!info.dark,
    interior: !!info.interior,
  };
}

export const SCENE_IDS = Object.keys(BUILDERS);
